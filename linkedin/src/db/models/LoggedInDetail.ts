export type DataCategory =
  | 'cookie'
  | 'local_storage'
  | 'session_storage'
  | 'secret_key'
  | 'session_meta'
  | 'full_state';

export interface LoggedInDetail {
  id: number;
  user_id: number;
  data_category: DataCategory;
  data_key: string;
  data_value: string | null;
  is_secret: boolean;
  extra_metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface LoggedInDetailInput {
  user_id: number;
  data_category: DataCategory;
  data_key: string;
  data_value: string | null;
  is_secret?: boolean;
  extra_metadata?: Record<string, unknown> | null;
}
