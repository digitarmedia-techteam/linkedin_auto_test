import mysql from 'mysql2/promise';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

let pool: mysql.Pool | null = null;

export function getDbPool(): mysql.Pool {
  if (!pool) {
    const dbConfig = config.db;
    pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
}

export async function testDbConnection(): Promise<boolean> {
  try {
    const p = getDbPool();
    await p.query('SELECT 1 as connected');
    logger.info('[DB] Connection test successful');
    return true;
  } catch (err) {
    logger.error('[DB] Connection test failed', { error: (err as Error).message });
    return false;
  }
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('[DB] Connection pool closed');
  }
}
