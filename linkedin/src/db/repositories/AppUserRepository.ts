import crypto from 'crypto';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDbPool } from '../connection.js';
import {
  AppUser,
  SafeAppUser,
  AppUserWithLinkedIn,
  ManagerWithUsers,
  AppUserRole,
  AppUserStatus,
  ROLE_PERMISSIONS,
} from '../models/AppUser.js';
import { logger } from '../../utils/logger.js';

interface AppUserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  salt: string;
  role: AppUserRole;
  manager_id: number | null;
  created_by: number | null;
  status: AppUserStatus;
  created_at: Date;
  updated_at: Date;
}

interface AppSessionRow extends RowDataPacket {
  id: number;
  token: string;
  app_user_id: number;
  expires_at: Date;
  created_at: Date;
  email: string;
  role: AppUserRole;
  manager_id: number | null;
  created_by: number | null;
  status: AppUserStatus;
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, s, 10000, 64, 'sha512').toString('hex');
  return { hash, salt: s };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(verifyHash, 'hex'));
  } catch {
    return false;
  }
}

function mapRowToSafeUser(row: AppUserRow): SafeAppUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    manager_id: row.manager_id ?? null,
    created_by: row.created_by ?? null,
    status: row.status,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export const AppUserRepository = {
  getPermissionsForRole(role: AppUserRole): string[] {
    return ROLE_PERMISSIONS[role] || [];
  },

  /**
   * Initializes the app_users and app_user_sessions tables,
   * ensures hierarchy columns exist on app_users, app_user_id exists on linkedin_test_users,
   * and seeds default hierarchical accounts.
   */
  async initTables(): Promise<void> {
    const pool = getDbPool();

    // 1. Create app_users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        salt VARCHAR(255) NOT NULL,
        role ENUM('admin', 'manager', 'user') NOT NULL DEFAULT 'user',
        manager_id INT NULL,
        created_by INT NULL,
        status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role),
        INDEX idx_manager_id (manager_id),
        INDEX idx_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 1b. Check if manager_id and created_by columns exist on app_users (schema migration)
    try {
      const [userCols] = await pool.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'app_users' 
           AND COLUMN_NAME = 'manager_id'`
      );
      if (userCols.length === 0) {
        await pool.query(`
          ALTER TABLE app_users 
          ADD COLUMN manager_id INT NULL AFTER role,
          ADD COLUMN created_by INT NULL AFTER manager_id,
          ADD INDEX idx_manager_id (manager_id),
          ADD INDEX idx_created_by (created_by)
        `);
        logger.info('[AppUserRepository] Added manager_id and created_by columns to app_users');
      }
    } catch (err) {
      logger.warn('[AppUserRepository] Schema check for manager_id:', { error: (err as Error).message });
    }

    // 2. Create app_user_sessions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_user_sessions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        token VARCHAR(128) NOT NULL UNIQUE,
        app_user_id INT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_token (token),
        INDEX idx_app_user_id (app_user_id),
        CONSTRAINT fk_app_user_sessions_user
          FOREIGN KEY (app_user_id)
          REFERENCES app_users (id)
          ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Ensure app_user_id column exists on linkedin_test_users
    try {
      const [cols] = await pool.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'linkedin_test_users' 
           AND COLUMN_NAME = 'app_user_id'`
      );
      if (cols.length === 0) {
        await pool.query(`
          ALTER TABLE linkedin_test_users 
          ADD COLUMN app_user_id INT NULL AFTER id,
          ADD INDEX idx_app_user_id (app_user_id)
        `);
        logger.info('[AppUserRepository] Added app_user_id column to linkedin_test_users');
      }
    } catch (err) {
      logger.warn('[AppUserRepository] Schema check for app_user_id:', { error: (err as Error).message });
    }

    logger.info('[AppUserRepository] Initialized app_users and app_user_sessions tables');

    // 4. Seed default users
    await this.seedDefaultUsers();
  },

  /**
   * Seeds default platform users (admin, manager, user) with proper hierarchy.
   */
  async seedDefaultUsers(): Promise<void> {
    const pool = getDbPool();
    let adminId: number | null = null;
    let managerId: number | null = null;

    // 1. Seed or resolve Admin
    const existingAdmin = await this.getUserByEmail('admin@app.com');
    if (!existingAdmin) {
      const admin = await this.createUser('admin@app.com', 'Admin@123', 'admin');
      adminId = admin.id;
      logger.info(`[AppUserRepository] Seeded default admin: admin@app.com`);
    } else {
      adminId = existingAdmin.id;
    }

    // 2. Seed or resolve Manager
    const existingManager = await this.getUserByEmail('manager@app.com');
    if (!existingManager) {
      const manager = await this.createUser('manager@app.com', 'Manager@123', 'manager', null, adminId);
      managerId = manager.id;
      logger.info(`[AppUserRepository] Seeded default manager: manager@app.com`);
    } else {
      managerId = existingManager.id;
    }

    // 3. Seed or resolve User under Manager
    const existingUser = await this.getUserByEmail('user@app.com');
    if (!existingUser) {
      await this.createUser('user@app.com', 'User@123', 'user', managerId, managerId);
      logger.info(`[AppUserRepository] Seeded default user: user@app.com (Assigned to manager ID: ${managerId})`);
    } else if (managerId && !existingUser.manager_id) {
      // Link existing user to manager
      await pool.query(
        `UPDATE app_users SET manager_id = ?, created_by = ? WHERE id = ?`,
        [managerId, managerId, existingUser.id]
      );
      logger.info(`[AppUserRepository] Linked existing user@app.com to manager ID: ${managerId}`);
    }

    // Attach any existing unlinked LinkedIn test users to the admin account
    if (adminId) {
      try {
        await pool.query(
          `UPDATE linkedin_test_users SET app_user_id = ? WHERE app_user_id IS NULL`,
          [adminId]
        );
      } catch {
        // ignore
      }
    }
  },

  /**
   * Create a new platform user with hashed password and hierarchical link.
   */
  async createUser(
    email: string,
    password: string,
    role: AppUserRole = 'user',
    manager_id: number | null = null,
    created_by: number | null = null
  ): Promise<SafeAppUser> {
    const pool = getDbPool();
    const normalizedEmail = email.trim().toLowerCase();
    const { hash, salt } = hashPassword(password);

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO app_users (email, password_hash, salt, role, manager_id, created_by, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [normalizedEmail, hash, salt, role, manager_id, created_by]
    );

    return {
      id: result.insertId,
      email: normalizedEmail,
      role,
      manager_id,
      created_by,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    };
  },

  /**
   * Look up a user by email (internal, includes hash & salt).
   */
  async getUserByEmail(email: string): Promise<AppUser | null> {
    const pool = getDbPool();
    const normalizedEmail = email.trim().toLowerCase();
    const [rows] = await pool.query<AppUserRow[]>(
      `SELECT * FROM app_users WHERE email = ? LIMIT 1`,
      [normalizedEmail]
    );
    if (rows.length === 0 || !rows[0]) return null;
    return rows[0];
  },

  /**
   * Look up a user by ID.
   */
  async getUserById(id: number): Promise<SafeAppUser | null> {
    const pool = getDbPool();
    const [rows] = await pool.query<AppUserRow[]>(
      `SELECT id, email, role, manager_id, created_by, status, created_at, updated_at FROM app_users WHERE id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0 || !rows[0]) return null;
    return mapRowToSafeUser(rows[0]);
  },

  /**
   * Validates credentials and returns the safe user profile if valid.
   */
  async validateCredentials(email: string, password: string): Promise<SafeAppUser | null> {
    const user = await this.getUserByEmail(email);
    if (!user || user.status !== 'active') return null;

    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      manager_id: user.manager_id,
      created_by: user.created_by,
      status: user.status,
      created_at: new Date(user.created_at),
      updated_at: new Date(user.updated_at),
    };
  },

  /**
   * Creates an active session for the given app user (expires in 7 days).
   */
  async createSession(appUserId: number): Promise<string> {
    const pool = getDbPool();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
      `INSERT INTO app_user_sessions (token, app_user_id, expires_at) VALUES (?, ?, ?)`,
      [token, appUserId, expiresAt]
    );

    return token;
  },

  /**
   * Resolves a session token to the associated app user with their permissions.
   */
  async getSessionUser(token: string): Promise<(SafeAppUser & { permissions: string[] }) | null> {
    if (!token) return null;
    const pool = getDbPool();

    const [rows] = await pool.query<AppSessionRow[]>(
      `SELECT s.token, s.app_user_id, s.expires_at, u.id, u.email, u.role, u.manager_id, u.created_by, u.status, u.created_at, u.updated_at
       FROM app_user_sessions s
       INNER JOIN app_users u ON s.app_user_id = u.id
       WHERE s.token = ? AND s.expires_at > NOW() AND u.status = 'active'
       LIMIT 1`,
      [token]
    );

    if (rows.length === 0 || !rows[0]) return null;
    const row = rows[0];

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      manager_id: row.manager_id ?? null,
      created_by: row.created_by ?? null,
      status: row.status,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      permissions: this.getPermissionsForRole(row.role),
    };
  },

  /**
   * Invalidates a session token (logout).
   */
  async deleteSession(token: string): Promise<void> {
    const pool = getDbPool();
    await pool.query(`DELETE FROM app_user_sessions WHERE token = ?`, [token]);
  },

  /**
   * List all platform users.
   */
  async getAllUsers(): Promise<SafeAppUser[]> {
    const pool = getDbPool();
    const [rows] = await pool.query<AppUserRow[]>(
      `SELECT id, email, role, manager_id, created_by, status, created_at, updated_at FROM app_users ORDER BY id ASC`
    );
    return rows.map(mapRowToSafeUser);
  },

  /**
   * Get all users belonging to a specific manager.
   */
  async getUsersByManagerId(managerId: number): Promise<AppUserWithLinkedIn[]> {
    const pool = getDbPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.email, u.role, u.manager_id, u.created_by, u.status, u.created_at, u.updated_at,
              ltu.id AS linkedin_id, ltu.username AS linkedin_username, ltu.status AS linkedin_status,
              IF(ltu.storage_state_json IS NOT NULL, 1, 0) AS linkedin_active_session, ltu.last_login_at AS linkedin_last_login
       FROM app_users u
       LEFT JOIN linkedin_test_users ltu ON ltu.app_user_id = u.id
       WHERE u.manager_id = ?
       ORDER BY u.id ASC`,
      [managerId]
    );

    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      manager_id: r.manager_id,
      created_by: r.created_by,
      status: r.status,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
      linkedin_account: r.linkedin_id ? {
        id: r.linkedin_id,
        username: r.linkedin_username,
        status: r.linkedin_status,
        has_active_session: r.linkedin_active_session === 1,
        last_login_at: r.linkedin_last_login ? new Date(r.linkedin_last_login) : null,
      } : null,
    }));
  },

  /**
   * Get hierarchical tree: all managers with their nested users and LinkedIn statuses.
   */
  async getHierarchyTree(): Promise<{ managers: ManagerWithUsers[]; unassigned_users: AppUserWithLinkedIn[] }> {
    const pool = getDbPool();

    // 1. Get all managers
    const [managerRows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.email, u.role, u.manager_id, u.created_by, u.status, u.created_at, u.updated_at,
              ltu.id AS linkedin_id, ltu.username AS linkedin_username, ltu.status AS linkedin_status,
              IF(ltu.storage_state_json IS NOT NULL, 1, 0) AS linkedin_active_session, ltu.last_login_at AS linkedin_last_login
       FROM app_users u
       LEFT JOIN linkedin_test_users ltu ON ltu.app_user_id = u.id
       WHERE u.role = 'manager'
       ORDER BY u.id ASC`
    );

    // 2. Get all users
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.email, u.role, u.manager_id, u.created_by, u.status, u.created_at, u.updated_at,
              ltu.id AS linkedin_id, ltu.username AS linkedin_username, ltu.status AS linkedin_status,
              IF(ltu.storage_state_json IS NOT NULL, 1, 0) AS linkedin_active_session, ltu.last_login_at AS linkedin_last_login
       FROM app_users u
       LEFT JOIN linkedin_test_users ltu ON ltu.app_user_id = u.id
       WHERE u.role = 'user'
       ORDER BY u.id ASC`
    );

    const mapUserRow = (r: RowDataPacket): AppUserWithLinkedIn => ({
      id: r.id,
      email: r.email,
      role: r.role,
      manager_id: r.manager_id,
      created_by: r.created_by,
      status: r.status,
      created_at: new Date(r.created_at),
      updated_at: new Date(r.updated_at),
      linkedin_account: r.linkedin_id ? {
        id: r.linkedin_id,
        username: r.linkedin_username,
        status: r.linkedin_status,
        has_active_session: r.linkedin_active_session === 1,
        last_login_at: r.linkedin_last_login ? new Date(r.linkedin_last_login) : null,
      } : null,
    });

    const allUsers = userRows.map(mapUserRow);
    const unassigned_users: AppUserWithLinkedIn[] = [];

    const usersByManager = new Map<number, AppUserWithLinkedIn[]>();
    for (const u of allUsers) {
      if (u.manager_id) {
        if (!usersByManager.has(u.manager_id)) {
          usersByManager.set(u.manager_id, []);
        }
        usersByManager.get(u.manager_id)!.push(u);
      } else {
        unassigned_users.push(u);
      }
    }

    const managers: ManagerWithUsers[] = managerRows.map((m) => {
      const baseManager = mapUserRow(m);
      return {
        ...baseManager,
        users: usersByManager.get(m.id) || [],
      };
    });

    return { managers, unassigned_users };
  },

  /**
   * Delete a team user strictly belonging to a manager.
   */
  async deleteUserForManager(userId: number, managerId: number): Promise<boolean> {
    const pool = getDbPool();
    const [result] = await pool.query<ResultSetHeader>(
      `DELETE FROM app_users WHERE id = ? AND manager_id = ? AND role = 'user'`,
      [userId, managerId]
    );
    return result.affectedRows > 0;
  },

  /**
   * Update role for an app user (admin only).
   */
  async updateUserRole(id: number, role: AppUserRole): Promise<void> {
    const pool = getDbPool();
    await pool.query(`UPDATE app_users SET role = ? WHERE id = ?`, [role, id]);
  },

  /**
   * Delete a platform user (admin only, cascades sessions).
   * Prevents deleting any admin account.
   */
  async deleteUser(id: number): Promise<boolean> {
    const pool = getDbPool();
    const user = await this.getUserById(id);
    if (!user) return false;
    if (user.role === 'admin') {
      throw new Error('Cannot delete an Administrator account');
    }
    const [result] = await pool.query<ResultSetHeader>(`DELETE FROM app_users WHERE id = ?`, [id]);
    return result.affectedRows > 0;
  },
};
