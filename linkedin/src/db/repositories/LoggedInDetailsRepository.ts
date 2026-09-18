import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDbPool } from '../connection.js';
import type {
  LoggedInDetail,
  LoggedInDetailInput,
  DataCategory,
} from '../models/LoggedInDetail.js';
import { logger } from '../../utils/logger.js';

interface DetailRow extends RowDataPacket {
  id: number;
  user_id: number;
  data_category: DataCategory;
  data_key: string;
  data_value: string | null;
  is_secret: number;
  extra_metadata: unknown;
  created_at: Date;
  updated_at: Date;
}

function mapRowToDetail(row: DetailRow): LoggedInDetail {
  let extraMetadata: Record<string, unknown> | null = null;
  if (typeof row.extra_metadata === 'string') {
    try {
      extraMetadata = JSON.parse(row.extra_metadata) as Record<string, unknown>;
    } catch {
      extraMetadata = null;
    }
  } else if (row.extra_metadata && typeof row.extra_metadata === 'object') {
    extraMetadata = row.extra_metadata as Record<string, unknown>;
  }

  return {
    id: row.id,
    user_id: row.user_id,
    data_category: row.data_category,
    data_key: row.data_key,
    data_value: row.data_value,
    is_secret: Boolean(row.is_secret),
    extra_metadata: extraMetadata,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export const LoggedInDetailsRepository = {
  /**
   * Initializes the loggedin_details table schema if not already present.
   */
  async initTable(): Promise<void> {
    const pool = getDbPool();
    const query = `
      CREATE TABLE IF NOT EXISTS loggedin_details (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        data_category ENUM('cookie', 'local_storage', 'session_storage', 'secret_key', 'session_meta', 'full_state') NOT NULL DEFAULT 'cookie',
        data_key VARCHAR(255) NOT NULL,
        data_value LONGTEXT NULL,
        is_secret TINYINT(1) NOT NULL DEFAULT 0,
        extra_metadata JSON NULL COMMENT 'Cookie domain/expires, or contextual metadata',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_data_key (user_id, data_key),
        INDEX idx_user_category (user_id, data_category),
        INDEX idx_user_id (user_id),
        INDEX idx_updated_at (updated_at),
        CONSTRAINT fk_loggedin_details_user FOREIGN KEY (user_id) REFERENCES linkedin_test_users (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(query);
    logger.info('[LoggedInDetailsRepository] Initialized table loggedin_details');
  },

  /**
   * Inserts or updates a single key-value pair for a user.
   * If the data_key already exists for the user_id, updates its value.
   */
  async upsertDetail(detail: LoggedInDetailInput): Promise<void> {
    const pool = getDbPool();
    const isSecret = detail.is_secret ? 1 : 0;
    const extraMeta = detail.extra_metadata ? JSON.stringify(detail.extra_metadata) : null;

    const query = `
      INSERT INTO loggedin_details (user_id, data_category, data_key, data_value, is_secret, extra_metadata)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        data_category = VALUES(data_category),
        data_value = VALUES(data_value),
        is_secret = VALUES(is_secret),
        extra_metadata = VALUES(extra_metadata),
        updated_at = CURRENT_TIMESTAMP;
    `;

    await pool.query<ResultSetHeader>(query, [
      detail.user_id,
      detail.data_category,
      detail.data_key,
      detail.data_value,
      isSecret,
      extraMeta,
    ]);
  },

  /**
   * Batch upserts multiple key-value details for a user.
   * Updates any existing keys in place.
   */
  async batchUpsertDetails(details: LoggedInDetailInput[]): Promise<number> {
    if (details.length === 0) return 0;
    for (const d of details) {
      await this.upsertDetail(d);
    }
    logger.info(`[LoggedInDetailsRepository] Upserted ${String(details.length)} details in loggedin_details`);
    return details.length;
  },

  /**
   * Fetches all loggedin_details rows for a given user_id.
   */
  async getDetailsByUserId(userId: number): Promise<LoggedInDetail[]> {
    const pool = getDbPool();
    const [rows] = await pool.query<DetailRow[]>(
      `SELECT * FROM loggedin_details WHERE user_id = ? ORDER BY data_category ASC, data_key ASC`,
      [userId],
    );
    return rows.map(mapRowToDetail);
  },

  /**
   * Fetches secret keys and authentication tokens for a user.
   */
  async getSecretTokens(userId: number): Promise<Record<string, string>> {
    const pool = getDbPool();
    const [rows] = await pool.query<DetailRow[]>(
      `SELECT data_key, data_value FROM loggedin_details WHERE user_id = ? AND (is_secret = 1 OR data_category = 'secret_key')`,
      [userId],
    );
    const result: Record<string, string> = {};
    for (const r of rows) {
      if (r.data_value !== null) {
        result[r.data_key] = r.data_value;
      }
    }
    return result;
  },
};
