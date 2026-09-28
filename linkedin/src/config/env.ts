import 'dotenv/config';
import { ConfigurationError } from '../utils/errors.js';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
}

export interface AppConfig {
  baseUrl: string;
  username?: string;
  /** Password is stored but NEVER logged. */
  password?: string;
  headless: boolean;
  timeout: number;
  networkingAdapter: 'mock' | 'official';
  db: DatabaseConfig;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new ConfigurationError(
      `Required environment variable "${name}" is missing or empty. ` +
        `Copy .env.example to .env and fill in all required values.`,
    );
  }
  return value.trim();
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true' || value === '1';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseAdapter(value: string | undefined): 'mock' | 'official' {
  if (value === 'official') return 'official';
  return 'mock';
}

function buildConfig(): AppConfig {
  const username = process.env['TEST_USERNAME'] || undefined;
  const password = process.env['TEST_PASSWORD'] || undefined;

  return {
    baseUrl: process.env['APP_BASE_URL'] ?? 'https://www.linkedin.com',
    username,
    password,
    headless: parseBoolean(process.env['HEADLESS'], true),
    timeout: parsePositiveInt(process.env['DEFAULT_TIMEOUT'], 30_000),
    networkingAdapter: parseAdapter(process.env['NETWORKING_ADAPTER']),
    db: {
      host: process.env['DB_HOST'] ?? '127.0.0.1',
      port: parsePositiveInt(process.env['DB_PORT'], 3307),
      database: process.env['DB_NAME'] ?? 'linkedin_db',
      user: process.env['DB_USER'] ?? 'linkedinuser',
      password: process.env['DB_PASSWORD'] ?? 'NAIYQfj-S-]KX(PE',
    },
  };
}

export const config: AppConfig = buildConfig();
