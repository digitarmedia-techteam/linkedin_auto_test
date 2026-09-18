import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { getDbPool } from '../connection.js';
import type {
  LinkedInTestUser,
  LoginStatus,
  UserStatus,
  StorageStateData,
  StorageStateCookie,
} from '../models/TestUser.js';
import { logger } from '../../utils/logger.js';

interface UserRow extends RowDataPacket {
  id: number;
  username: string;
  password: string;
  login_try: number;
  status: UserStatus;
  storage_state_json: string | null;
  session_cookies_json: string | null;
  li_at_token: string | null;
  user_agent: string | null;
  two_factor_secret: string | null;
  proxy: string | null;
  last_login_at: Date | null;
  last_login_status: LoginStatus;
  last_error: string | null;
  login_count: number;
  meta_data: unknown;
  created_at: Date;
  updated_at: Date;
}

function mapRowToUser(row: UserRow): LinkedInTestUser {
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
    username: row.username,
    password: row.password,
    login_try: row.login_try,
    status: row.status,
    storage_state_json: row.storage_state_json,
    session_cookies_json: row.session_cookies_json,
    li_at_token: row.li_at_token,
    user_agent: row.user_agent,
    two_factor_secret: row.two_factor_secret,
    proxy: row.proxy,
    last_login_at: row.last_login_at ? new Date(row.last_login_at) : null,
    last_login_status: row.last_login_status,
    last_error: row.last_error,
    login_count: row.login_count,
    meta_data: metaData,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  };
}

export const TestUserRepository = {
  /**
   * Initializes the linkedin_test_users table schema if it does not already exist.
   */
  async initTable(): Promise<void> {
    const pool = getDbPool();
    const query = `
      CREATE TABLE IF NOT EXISTS linkedin_test_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        login_try TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1 = target user for login attempts; 0 = do not attempt',
        status ENUM('active', 'inactive', 'locked', 'checkpoint', 'failed') NOT NULL DEFAULT 'active',
        storage_state_json LONGTEXT NULL COMMENT 'Serialized Playwright storageState JSON',
        session_cookies_json LONGTEXT NULL COMMENT 'Extracted session cookies JSON',
        li_at_token VARCHAR(512) NULL COMMENT 'LinkedIn li_at session cookie',
        user_agent TEXT NULL COMMENT 'User agent used during login',
        two_factor_secret VARCHAR(255) NULL COMMENT '2FA TOTP secret key if enabled',
        proxy VARCHAR(255) NULL COMMENT 'Custom proxy if used',
        last_login_at DATETIME NULL,
        last_login_status ENUM('never_attempted', 'success', 'failed', 'checkpoint', 'expired') NOT NULL DEFAULT 'never_attempted',
        last_error TEXT NULL,
        login_count INT UNSIGNED NOT NULL DEFAULT 0,
        meta_data JSON NULL COMMENT 'Custom metadata (tags, account type, profile URL, etc.)',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_login_try_status (login_try, status),
        INDEX idx_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await pool.query(query);
    logger.info('[TestUserRepository] Initialized table linkedin_test_users');
  },

  /**
   * Fetches all active users marked for login (login_try = 1).
   * Used to select which users should be authenticated.
   */
  async getUsersToLogin(): Promise<LinkedInTestUser[]> {
    const pool = getDbPool();
    const [rows] = await pool.query<UserRow[]>(
      `SELECT * FROM linkedin_test_users WHERE login_try = 1 AND status = 'active' ORDER BY id ASC`,
    );
    return rows.map(mapRowToUser);
  },

  /**
   * Fetches all users from the database table.
   */
  async getAllUsers(): Promise<LinkedInTestUser[]> {
    const pool = getDbPool();
    const [rows] = await pool.query<UserRow[]>(
      `SELECT * FROM linkedin_test_users ORDER BY id ASC`,
    );
    return rows.map(mapRowToUser);
  },

  /**
   * Finds a test user by username (email).
   */
  async getUserByUsername(username: string): Promise<LinkedInTestUser | null> {
    const pool = getDbPool();
    const [rows] = await pool.query<UserRow[]>(
      `SELECT * FROM linkedin_test_users WHERE username = ? LIMIT 1`,
      [username],
    );
    if (rows.length === 0 || !rows[0]) return null;
    return mapRowToUser(rows[0]);
  },

  /**
   * Finds a test user by ID.
   */
  async getUserById(id: number): Promise<LinkedInTestUser | null> {
    const pool = getDbPool();
    const [rows] = await pool.query<UserRow[]>(
      `SELECT * FROM linkedin_test_users WHERE id = ? LIMIT 1`,
      [id],
    );
    if (rows.length === 0 || !rows[0]) return null;
    return mapRowToUser(rows[0]);
  },

  /**
   * Persists authenticated session data (storageState, cookies, li_at token)
   * into the user record so future runs do not need to enter credentials.
   */
  async saveUserSession(
    userId: number,
    storageState: StorageStateData,
    userAgent?: string,
  ): Promise<void> {
    const pool = getDbPool();
    const storageStateJson = JSON.stringify(storageState);
    const cookiesJson = JSON.stringify(storageState.cookies ?? []);
    const liAtCookie = storageState.cookies?.find((c: StorageStateCookie) => c.name === 'li_at');
    const liAtToken = liAtCookie ? liAtCookie.value : null;

    const query = `
      UPDATE linkedin_test_users
      SET
        storage_state_json = ?,
        session_cookies_json = ?,
        li_at_token = ?,
        user_agent = COALESCE(?, user_agent),
        last_login_at = NOW(),
        last_login_status = 'success',
        last_error = NULL,
        login_count = login_count + 1,
        status = 'active'
      WHERE id = ?
    `;

    await pool.query(query, [storageStateJson, cookiesJson, liAtToken, userAgent ?? null, userId]);
    logger.info(`[TestUserRepository] Updated session state for user id ${String(userId)}`);
  },

  /**
   * Records a login failure or checkpoint challenge in the user's DB record.
   */
  async recordLoginFailure(
    userId: number,
    status: 'failed' | 'checkpoint' | 'expired',
    errorMessage: string,
  ): Promise<void> {
    const pool = getDbPool();
    const userStatus: UserStatus = status === 'checkpoint' ? 'checkpoint' : 'active';

    const query = `
      UPDATE linkedin_test_users
      SET
        last_login_status = ?,
        last_error = ?,
        status = ?
      WHERE id = ?
    `;

    await pool.query(query, [status, errorMessage, userStatus, userId]);
    logger.warn(
      `[TestUserRepository] Recorded login status "${status}" for user id ${String(userId)}: ${errorMessage}`,
    );
  },

  /**
   * Seeds or updates an initial test user with full metadata.
   */
  async upsertUser(user: {
    username: string;
    password: string;
    login_try?: number;
    status?: UserStatus;
    storage_state_json?: string | null;
    meta_data?: Record<string, unknown>;
    user_agent?: string | null;
  }): Promise<void> {
    const pool = getDbPool();
    const loginTry = user.login_try ?? 1;
    const status = user.status ?? 'active';
    const storageStateJson = user.storage_state_json ?? null;
    let cookiesJson: string | null = null;
    let liAtToken: string | null = null;

    if (storageStateJson) {
      try {
        const parsed = JSON.parse(storageStateJson) as StorageStateData;
        if (parsed.cookies) {
          cookiesJson = JSON.stringify(parsed.cookies);
          const liAt = parsed.cookies.find((c: StorageStateCookie) => c.name === 'li_at');
          if (liAt) liAtToken = liAt.value;
        }
      } catch {
        // ignore parse error
      }
    }

    const metaDataJson = user.meta_data ? JSON.stringify(user.meta_data) : null;

    const query = `
      INSERT INTO linkedin_test_users (
        username, password, login_try, status, storage_state_json, session_cookies_json,
        li_at_token, user_agent, meta_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        login_try = VALUES(login_try),
        status = VALUES(status),
        storage_state_json = COALESCE(VALUES(storage_state_json), storage_state_json),
        session_cookies_json = COALESCE(VALUES(session_cookies_json), session_cookies_json),
        li_at_token = COALESCE(VALUES(li_at_token), li_at_token),
        user_agent = COALESCE(VALUES(user_agent), user_agent),
        meta_data = COALESCE(VALUES(meta_data), meta_data);
    `;

    await pool.query<ResultSetHeader>(query, [
      user.username,
      user.password,
      loginTry,
      status,
      storageStateJson,
      cookiesJson,
      liAtToken,
      user.user_agent ?? null,
      metaDataJson,
    ]);

    logger.info(`[TestUserRepository] Upserted user: ${user.username} (login_try = ${String(loginTry)})`);
  },

  /**
   * Updates the login_try flag for a user (1 = target for login cron, 0 = skip).
   */
  async updateLoginTry(userId: number, loginTry: number): Promise<void> {
    const pool = getDbPool();
    const query = `UPDATE linkedin_test_users SET login_try = ? WHERE id = ?`;
    await pool.query(query, [loginTry ? 1 : 0, userId]);
    logger.info(`[TestUserRepository] Updated login_try to ${String(loginTry ? 1 : 0)} for user ID ${String(userId)}`);
  },
};
