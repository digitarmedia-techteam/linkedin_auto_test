import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDbPool } from '../connection.js';
import type {
  ConnectionTracking,
  ConnectionTrackingInput,
  ConnectionStatus,
  DetectedVia,
} from '../models/ConnectionTracking.js';
import { logger } from '../../utils/logger.js';

interface ConnectionRow extends RowDataPacket {
  id: number;
  sender_user_id: number;
  recipient_name: string;
  recipient_vanity_name: string | null;
  recipient_profile_url: string | null;
  recipient_headline: string | null;
  status: ConnectionStatus;
  invite_sent_at: Date | string | null;
  accepted_at: Date | string | null;
  detected_via: DetectedVia | null;
  note_sent: string | null;
  meta_data: unknown;
  created_at: Date;
  updated_at: Date;
}

function mapRowToConnectionTracking(row: ConnectionRow): ConnectionTracking {
  let metaData: Record<string, unknown> | null = null;
  if (typeof row.meta_data === 'string') {
    try {
      metaData = JSON.parse(row.meta_data) as Record<string, unknown>;
    } catch {
      metaData = null;
    }
  } else if (row.meta_data && typeof row.meta_data === 'object') {
    metaData = row.meta_data as Record<string, unknown>;
  }

  return {
    id: row.id,
    sender_user_id: row.sender_user_id,
    recipient_name: row.recipient_name,
    recipient_vanity_name: row.recipient_vanity_name,
    recipient_profile_url: row.recipient_profile_url,
    recipient_headline: row.recipient_headline,
    status: row.status,
    invite_sent_at: row.invite_sent_at ? new Date(row.invite_sent_at) : null,
    accepted_at: row.accepted_at ? new Date(row.accepted_at) : null,
    detected_via: row.detected_via,
    note_sent: row.note_sent,
    meta_data: metaData,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export const ConnectionTrackingRepository = {
  /**
   * Initializes the connection_tracking table schema if not already present.
   */
  async initTable(): Promise<void> {
    const pool = getDbPool();
    const query = `
      CREATE TABLE IF NOT EXISTS \`connection_tracking\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`sender_user_id\` INT NOT NULL,
        \`recipient_name\` VARCHAR(255) NOT NULL,
        \`recipient_vanity_name\` VARCHAR(255) NULL,
        \`recipient_profile_url\` VARCHAR(512) NULL,
        \`recipient_headline\` TEXT NULL,
        \`status\` ENUM('pending', 'accepted', 'withdrawn', 'rejected') NOT NULL DEFAULT 'pending',
        \`invite_sent_at\` DATETIME NULL COMMENT 'When we sent the connection request',
        \`accepted_at\` DATETIME NULL COMMENT 'When the recipient accepted',
        \`detected_via\` VARCHAR(64) NULL COMMENT 'notification | sent_diff | connections_diff | manual | invite_api',
        \`note_sent\` TEXT NULL COMMENT 'Optional note included with the invite',
        \`meta_data\` JSON NULL,
        \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY \`uq_sender_recipient\` (\`sender_user_id\`, \`recipient_vanity_name\`),
        INDEX \`idx_sender_status\` (\`sender_user_id\`, \`status\`),
        INDEX \`idx_sender_name\` (\`sender_user_id\`, \`recipient_name\`),
        INDEX \`idx_accepted_at\` (\`accepted_at\`),
        CONSTRAINT \`fk_ct_sender\` FOREIGN KEY (\`sender_user_id\`)
          REFERENCES \`linkedin_test_users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(query);
    logger.info('[ConnectionTrackingRepository] Initialized table connection_tracking');

    // Clean up any historical duplicate entries for the same sender
    try {
      await pool.query(`
        DELETE t1 FROM connection_tracking t1
        INNER JOIN connection_tracking t2 
        WHERE t1.id > t2.id 
          AND t1.sender_user_id = t2.sender_user_id 
          AND (
            (t1.recipient_vanity_name IS NOT NULL AND t1.recipient_vanity_name != '' AND LOWER(t1.recipient_vanity_name) = LOWER(t2.recipient_vanity_name))
            OR (LOWER(TRIM(t1.recipient_name)) = LOWER(TRIM(t2.recipient_name)))
            OR (t2.recipient_vanity_name IS NOT NULL AND LOWER(TRIM(t1.recipient_name)) = LOWER(TRIM(t2.recipient_vanity_name)))
            OR (t1.recipient_vanity_name IS NOT NULL AND LOWER(TRIM(t1.recipient_vanity_name)) = LOWER(TRIM(t2.recipient_name)))
          );
      `);
    } catch (cleanupErr) {
      // Ignored if table is empty or query not supported
    }
  },

  /**
   * Helper: Find existing matching contact row across vanity, display name, and profile URL.
   */
  async findMatchingRows(
    senderUserId: number,
    name?: string | null,
    vanity?: string | null,
    profileUrl?: string | null,
  ): Promise<ConnectionRow[]> {
    const pool = getDbPool();
    const conditions: string[] = [];
    const params: any[] = [senderUserId];

    const cleanName = name ? name.trim().toLowerCase() : null;
    const cleanVanity = vanity ? vanity.trim().toLowerCase() : null;

    if (cleanVanity) {
      conditions.push(`LOWER(recipient_vanity_name) = ?`);
      params.push(cleanVanity);
      conditions.push(`LOWER(recipient_name) = ?`);
      params.push(cleanVanity);
    }

    if (cleanName) {
      conditions.push(`LOWER(recipient_name) = ?`);
      params.push(cleanName);
      conditions.push(`LOWER(recipient_vanity_name) = ?`);
      params.push(cleanName);
    }

    if (profileUrl) {
      const match = profileUrl.match(/\/in\/([a-zA-Z0-9_%-]+)/i);
      if (match && match[1]) {
        const urlVanity = match[1].toLowerCase();
        conditions.push(`LOWER(recipient_vanity_name) = ?`);
        params.push(urlVanity);
      }
    }

    if (conditions.length === 0) return [];

    const query = `
      SELECT * FROM connection_tracking 
      WHERE sender_user_id = ? AND (${conditions.join(' OR ')})
      ORDER BY FIELD(status, 'accepted', 'pending', 'withdrawn', 'rejected'), id ASC
    `;

    const [rows] = await pool.query<ConnectionRow[]>(query, params);
    return rows;
  },

  /**
   * Upsert a contact. Intelligently matches existing records and merges duplicates.
   */
  async upsertContact(contact: ConnectionTrackingInput): Promise<ConnectionTracking> {
    const pool = getDbPool();
    const metaJson = contact.meta_data ? JSON.stringify(contact.meta_data) : null;
    const status = contact.status || 'pending';
    const vanity = contact.recipient_vanity_name ? contact.recipient_vanity_name.trim().toLowerCase() : null;
    const cleanName = (contact.recipient_name || vanity || 'LinkedIn Member').trim();

    // Check for existing matching rows
    const existingRows = await this.findMatchingRows(
      contact.sender_user_id,
      cleanName,
      vanity,
      contact.recipient_profile_url,
    );

    if (existingRows.length > 0) {
      const primary = existingRows[0];
      const isBetterName = cleanName && !/^[a-zA-Z0-9_\-]+-\d{5,}$/.test(cleanName) && cleanName.length > 2;
      const targetName = isBetterName ? cleanName : primary.recipient_name;
      const targetVanity = vanity || primary.recipient_vanity_name;
      const targetUrl = contact.recipient_profile_url || primary.recipient_profile_url || (targetVanity ? `https://www.linkedin.com/in/${targetVanity}/` : null);
      const targetHeadline = contact.recipient_headline || primary.recipient_headline;

      // Merge meta_data
      let mergedMeta: Record<string, unknown> = {};
      if (primary.meta_data) {
        try {
          mergedMeta = typeof primary.meta_data === 'string' ? JSON.parse(primary.meta_data) : { ...primary.meta_data as any };
        } catch {}
      }
      if (contact.meta_data) {
        mergedMeta = { ...mergedMeta, ...contact.meta_data };
      }

      const updateQuery = `
        UPDATE connection_tracking
        SET
          recipient_name = ?,
          recipient_vanity_name = ?,
          recipient_profile_url = ?,
          recipient_headline = ?,
          status = IF(? = 'accepted' OR status = 'accepted', 'accepted', ?),
          invite_sent_at = COALESCE(?, invite_sent_at),
          accepted_at = COALESCE(?, accepted_at),
          detected_via = COALESCE(?, detected_via),
          note_sent = COALESCE(?, note_sent),
          meta_data = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?;
      `;

      await pool.query(updateQuery, [
        targetName,
        targetVanity,
        targetUrl,
        targetHeadline,
        status,
        status,
        contact.invite_sent_at || null,
        contact.accepted_at || null,
        contact.detected_via || null,
        contact.note_sent || null,
        Object.keys(mergedMeta).length > 0 ? JSON.stringify(mergedMeta) : null,
        primary.id,
      ]);

      // If duplicate rows exist, delete the orphans
      if (existingRows.length > 1) {
        const orphanIds = existingRows.slice(1).map((r) => r.id);
        await pool.query(`DELETE FROM connection_tracking WHERE id IN (?)`, [orphanIds]);
      }

      const [updatedRows] = await pool.query<ConnectionRow[]>(
        `SELECT * FROM connection_tracking WHERE id = ? LIMIT 1`,
        [primary.id],
      );
      return mapRowToConnectionTracking(updatedRows[0]);
    }

    // Insert new row
    const insertQuery = `
      INSERT INTO connection_tracking
        (sender_user_id, recipient_name, recipient_vanity_name, recipient_profile_url, recipient_headline, status, invite_sent_at, accepted_at, detected_via, note_sent, meta_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const [result] = await pool.query<ResultSetHeader>(insertQuery, [
      contact.sender_user_id,
      cleanName,
      vanity,
      contact.recipient_profile_url || (vanity ? `https://www.linkedin.com/in/${vanity}/` : null),
      contact.recipient_headline || null,
      status,
      contact.invite_sent_at || null,
      contact.accepted_at || null,
      contact.detected_via || null,
      contact.note_sent || null,
      metaJson,
    ]);

    const [newRows] = await pool.query<ConnectionRow[]>(
      `SELECT * FROM connection_tracking WHERE id = ? LIMIT 1`,
      [result.insertId],
    );
    return mapRowToConnectionTracking(newRows[0]);
  },

  /**
   * Mark a contact as accepted by vanity name, profile URL, or recipient name.
   * Merges any duplicate records into a single canonical row.
   */
  async markAsAccepted(options: {
    senderUserId: number;
    recipientName: string;
    recipientVanity?: string | null;
    recipientProfileUrl?: string | null;
    recipientHeadline?: string | null;
    detectedVia: DetectedVia;
    acceptedAt?: Date | string;
    metaData?: Record<string, unknown>;
  }): Promise<ConnectionTracking> {
    const pool = getDbPool();
    const acceptedAt = options.acceptedAt ? new Date(options.acceptedAt) : new Date();
    const vanity = options.recipientVanity ? options.recipientVanity.trim().toLowerCase() : null;
    const cleanName = options.recipientName ? options.recipientName.trim() : '';

    const matchingRows = await this.findMatchingRows(
      options.senderUserId,
      cleanName,
      vanity,
      options.recipientProfileUrl,
    );

    if (matchingRows.length > 0) {
      const primary = matchingRows[0];
      const isHumanName = cleanName && !/^[a-zA-Z0-9_\-]+-\d{5,}$/.test(cleanName) && cleanName.length > 2;
      const targetName = isHumanName ? cleanName : primary.recipient_name;
      const targetVanity = vanity || primary.recipient_vanity_name;
      const targetUrl = options.recipientProfileUrl || primary.recipient_profile_url || (targetVanity ? `https://www.linkedin.com/in/${targetVanity}/` : null);
      const targetHeadline = options.recipientHeadline || primary.recipient_headline;

      // Merge meta_data
      let mergedMeta: Record<string, unknown> = {};
      if (primary.meta_data) {
        try {
          mergedMeta = typeof primary.meta_data === 'string' ? JSON.parse(primary.meta_data) : { ...primary.meta_data as any };
        } catch {}
      }
      if (options.metaData) {
        mergedMeta = { ...mergedMeta, ...options.metaData };
      }

      await pool.query(
        `UPDATE connection_tracking
         SET status = 'accepted',
             accepted_at = COALESCE(accepted_at, ?),
             detected_via = ?,
             recipient_name = ?,
             recipient_vanity_name = ?,
             recipient_profile_url = ?,
             recipient_headline = ?,
             meta_data = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          acceptedAt,
          options.detectedVia,
          targetName,
          targetVanity,
          targetUrl,
          targetHeadline,
          Object.keys(mergedMeta).length > 0 ? JSON.stringify(mergedMeta) : null,
          primary.id,
        ],
      );

      // Clean up any remaining duplicate rows for this contact
      if (matchingRows.length > 1) {
        const orphanIds = matchingRows.slice(1).map((r) => r.id);
        await pool.query(`DELETE FROM connection_tracking WHERE id IN (?)`, [orphanIds]);
      }

      const [rows] = await pool.query<ConnectionRow[]>(
        `SELECT * FROM connection_tracking WHERE id = ?`,
        [primary.id],
      );
      return mapRowToConnectionTracking(rows[0]);
    }

    // Insert as new accepted entry if not previously recorded
    return this.upsertContact({
      sender_user_id: options.senderUserId,
      recipient_name: cleanName || vanity || 'LinkedIn Member',
      recipient_vanity_name: vanity,
      recipient_profile_url: options.recipientProfileUrl || (vanity ? `https://www.linkedin.com/in/${vanity}/` : null),
      recipient_headline: options.recipientHeadline || null,
      status: 'accepted',
      accepted_at: acceptedAt,
      detected_via: options.detectedVia,
      meta_data: options.metaData || null,
    });
  },

  /**
   * Bulk snapshots currently pending sent invitations into connection_tracking.
   */
  async snapshotPendingList(
    senderUserId: number,
    pendingList: Array<{
      name: string;
      headline?: string;
      timeSent?: string;
      vanity?: string;
      profileUrl?: string;
    }>,
  ): Promise<number> {
    if (pendingList.length === 0) return 0;
    let savedCount = 0;

    for (const item of pendingList) {
      if (!item.name || !item.name.trim()) continue;
      await this.upsertContact({
        sender_user_id: senderUserId,
        recipient_name: item.name.trim(),
        recipient_vanity_name: item.vanity || null,
        recipient_profile_url: item.profileUrl || (item.vanity ? `https://www.linkedin.com/in/${item.vanity}/` : null),
        recipient_headline: item.headline || null,
        status: 'pending',
        invite_sent_at: item.timeSent ? new Date() : null,
        detected_via: 'sent_diff',
        meta_data: item.timeSent ? { rawTimeSent: item.timeSent } : null,
      });
      savedCount++;
    }

    logger.info(`[ConnectionTrackingRepository] Snapshotted ${savedCount} pending invitations for user ${senderUserId}`);
    return savedCount;
  },

  /**
   * Helper: Deduplicate a list of ConnectionTracking items by vanity / normalized name.
   */
  deduplicateContacts(contacts: ConnectionTracking[]): ConnectionTracking[] {
    const map = new Map<string, ConnectionTracking>();
    for (const c of contacts) {
      const vanityKey = c.recipient_vanity_name ? c.recipient_vanity_name.toLowerCase().trim() : '';
      const nameKey = c.recipient_name ? c.recipient_name.toLowerCase().trim() : '';
      const key = vanityKey || nameKey;

      if (!map.has(key)) {
        map.set(key, c);
      } else {
        const existing = map.get(key)!;
        // Prefer record with human name over slug
        const isCurrentHuman = !/^[a-zA-Z0-9_\-]+-\d{5,}$/.test(c.recipient_name);
        const isExistingHuman = !/^[a-zA-Z0-9_\-]+-\d{5,}$/.test(existing.recipient_name);

        if (isCurrentHuman && !isExistingHuman) {
          map.set(key, {
            ...existing,
            recipient_name: c.recipient_name,
            recipient_headline: c.recipient_headline || existing.recipient_headline,
            meta_data: { ...existing.meta_data, ...c.meta_data },
          });
        }
      }
    }
    return Array.from(map.values());
  },

  /**
   * Fetches all contacts currently marked as 'pending' for a sender.
   */
  async getPendingContacts(senderUserId: number): Promise<ConnectionTracking[]> {
    const pool = getDbPool();
    const [rows] = await pool.query<ConnectionRow[]>(
      `SELECT * FROM connection_tracking WHERE sender_user_id = ? AND status = 'pending' ORDER BY created_at DESC`,
      [senderUserId],
    );
    return this.deduplicateContacts(rows.map(mapRowToConnectionTracking));
  },

  /**
   * Fetches all contacts currently marked as 'accepted' for a sender.
   */
  async getAcceptedContacts(senderUserId: number, since?: Date): Promise<ConnectionTracking[]> {
    const pool = getDbPool();
    let query = `SELECT * FROM connection_tracking WHERE sender_user_id = ? AND status = 'accepted'`;
    const params: any[] = [senderUserId];

    if (since) {
      query += ` AND accepted_at >= ?`;
      params.push(since);
    }
    query += ` ORDER BY accepted_at DESC, updated_at DESC`;

    const [rows] = await pool.query<ConnectionRow[]>(query, params);
    return this.deduplicateContacts(rows.map(mapRowToConnectionTracking));
  },

  /**
   * Fetches contacts accepted today for a sender.
   */
  async getAcceptedTodayContacts(senderUserId: number): Promise<ConnectionTracking[]> {
    const pool = getDbPool();
    const query = `
      SELECT * FROM connection_tracking 
      WHERE sender_user_id = ? 
        AND status = 'accepted'
        AND (
          DATE(accepted_at) = CURDATE()
          OR (meta_data IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(meta_data, '$.acceptedToday')) = 'true')
          OR (meta_data IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(meta_data, '$.connectedTimeText')) LIKE '%2026%')
          OR (meta_data IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(meta_data, '$.connectedTimeText')) LIKE '%today%')
          OR (meta_data IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(meta_data, '$.connectedTimeText')) LIKE '%ago%')
          OR DATE(updated_at) = CURDATE()
        )
      ORDER BY COALESCE(accepted_at, updated_at) DESC
    `;
    const [rows] = await pool.query<ConnectionRow[]>(query, [senderUserId]);
    return this.deduplicateContacts(rows.map(mapRowToConnectionTracking));
  },

  /**
   * Fetches all tracked contacts for a sender.
   */
  async getAllContacts(senderUserId: number): Promise<ConnectionTracking[]> {
    const pool = getDbPool();
    const [rows] = await pool.query<ConnectionRow[]>(
      `SELECT * FROM connection_tracking WHERE sender_user_id = ? ORDER BY FIELD(status, 'accepted', 'pending', 'withdrawn', 'rejected'), updated_at DESC`,
      [senderUserId],
    );
    return this.deduplicateContacts(rows.map(mapRowToConnectionTracking));
  },

  /**
   * Gets aggregate count statistics for a sender.
   */
  async getStats(senderUserId: number): Promise<{
    total: number;
    accepted: number;
    pending: number;
    withdrawn: number;
    rejected: number;
  }> {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'withdrawn' THEN 1 ELSE 0 END) as withdrawn,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
       FROM connection_tracking
       WHERE sender_user_id = ?`,
      [senderUserId],
    );

    const r = rows[0] || {};
    return {
      total: Number(r.total || 0),
      accepted: Number(r.accepted || 0),
      pending: Number(r.pending || 0),
      withdrawn: Number(r.withdrawn || 0),
      rejected: Number(r.rejected || 0),
    };
  },
};
