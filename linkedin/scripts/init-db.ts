import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { testDbConnection, closeDbPool } from '../src/db/connection.js';
import { TestUserRepository } from '../src/db/repositories/TestUserRepository.js';
import { config } from '../src/config/env.js';
import { AUTH_STATE_PATH } from '../src/config/constants.js';
import { logger } from '../src/utils/logger.js';
import type { StorageStateData } from '../src/db/models/TestUser.js';

async function main(): Promise<void> {
  logger.info('[init-db] Connecting to database...');
  const connected = await testDbConnection();
  if (!connected) {
    logger.error('[init-db] Could not connect to MySQL database. Check your .env DB_* variables.');
    process.exit(1);
  }

  logger.info('[init-db] Initializing linkedin_test_users table schema...');
  await TestUserRepository.initTable();

  // Check if existing auth.json exists to pre-populate session state
  let existingStorageState: StorageStateData | null = null;
  const authFilePath = resolve(process.cwd(), AUTH_STATE_PATH);
  if (existsSync(authFilePath)) {
    try {
      const raw = readFileSync(authFilePath, 'utf-8');
      existingStorageState = JSON.parse(raw) as StorageStateData;
      logger.info(`[init-db] Found existing session state at ${AUTH_STATE_PATH}`);
    } catch (err) {
      logger.warn('[init-db] Could not read existing auth state file', {
        error: (err as Error).message,
      });
    }
  }

  logger.info('[init-db] Seeding default user from environment variables...');
  await TestUserRepository.upsertUser({
    username: config.username,
    password: config.password,
    login_try: 1,
    status: 'active',
    storage_state_json: existingStorageState ? JSON.stringify(existingStorageState) : null,
    meta_data: {
      role: 'primary_test_user',
      source: 'env_seed',
      note: 'Auto-seeded primary account with login_try = 1',
    },
  });

  const usersToLogin = await TestUserRepository.getUsersToLogin();
  logger.info(`[init-db] Table is ready! Total users with login_try = 1: ${String(usersToLogin.length)}`);
  for (const u of usersToLogin) {
    const hasSession = u.storage_state_json !== null;
    logger.info(
      `   - ID: ${String(u.id)} | User: ${u.username} | login_try: ${String(u.login_try)} | Has Saved Session: ${String(hasSession)}`,
    );
  }

  await closeDbPool();
  logger.info('[init-db] Initialization complete!');
}

main().catch(async (err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('[init-db] Fatal error during DB initialization', { error: message });
  await closeDbPool();
  process.exit(1);
});
