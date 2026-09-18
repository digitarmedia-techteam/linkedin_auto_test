export type UserStatus = 'active' | 'inactive' | 'locked' | 'checkpoint' | 'failed';
export type LoginStatus = 'never_attempted' | 'success' | 'failed' | 'checkpoint' | 'expired';

export interface StorageStateCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface StorageStateData {
  cookies?: StorageStateCookie[];
  origins?: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

export interface LinkedInTestUser {
  id: number;
  username: string;
  password: string;
  login_try: number; // 1 = target for login, 0 = skip
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
  meta_data: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export type CreateTestUserInput = Omit<LinkedInTestUser, 'id' | 'created_at' | 'updated_at'>;
