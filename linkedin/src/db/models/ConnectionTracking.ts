export type ConnectionStatus = 'pending' | 'accepted' | 'withdrawn' | 'rejected';
export type DetectedVia = 'notification' | 'sent_diff' | 'connections_diff' | 'manual' | 'invite_api';

export interface ConnectionTracking {
  id: number;
  sender_user_id: number;
  recipient_name: string;
  recipient_vanity_name: string | null;
  recipient_profile_url: string | null;
  recipient_headline: string | null;
  status: ConnectionStatus;
  invite_sent_at: Date | null;
  accepted_at: Date | null;
  detected_via: DetectedVia | null;
  note_sent: string | null;
  meta_data: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConnectionTrackingInput {
  sender_user_id: number;
  recipient_name: string;
  recipient_vanity_name?: string | null;
  recipient_profile_url?: string | null;
  recipient_headline?: string | null;
  status?: ConnectionStatus;
  invite_sent_at?: Date | string | null;
  accepted_at?: Date | string | null;
  detected_via?: DetectedVia | null;
  note_sent?: string | null;
  meta_data?: Record<string, unknown> | null;
}
