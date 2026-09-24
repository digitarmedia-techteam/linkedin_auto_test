export type AppUserRole = 'admin' | 'manager' | 'user';
export type AppUserStatus = 'active' | 'inactive' | 'suspended';

export interface AppUser {
  id: number;
  email: string;
  password_hash: string;
  salt: string;
  role: AppUserRole;
  manager_id?: number | null;
  created_by?: number | null;
  status: AppUserStatus;
  created_at: Date;
  updated_at: Date;
}

export type SafeAppUser = Omit<AppUser, 'password_hash' | 'salt'>;

export interface AppUserWithLinkedIn extends SafeAppUser {
  linkedin_account?: {
    id: number;
    username: string;
    status: string;
    has_active_session: boolean;
    last_login_at: Date | null;
  } | null;
}

export interface ManagerWithUsers extends AppUserWithLinkedIn {
  users: AppUserWithLinkedIn[];
}

export interface AppUserSession {
  id: number;
  token: string;
  app_user_id: number;
  expires_at: Date;
  created_at: Date;
}

export const ROLE_PERMISSIONS: Record<AppUserRole, string[]> = {
  admin: ['*'],
  manager: [
    'connections:read',
    'connections:write',
    'messages:read',
    'messages:write',
    'scan:index',
    'linkedin:manage',
    'team:manage',
  ],
  user: [
    'connections:read',
    'messages:read',
    'linkedin:manage',
  ],
};
