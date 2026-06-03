export interface Company {
  id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  enrichment_source: string;
  enriched_at: string | null;
  created_at: string;
}

export interface ContactSource {
  id: number;
  name: string;
}

export interface EmailStatus {
  id: number;
  name: string;
}

export interface EmailDraft {
  id: string;
  contact_id: string;
  body: string;
  generation_source: string;
  is_active: boolean;
  created_at: string;
}

export interface VoiceLog {
  id: string;
  contact_id: string | null;
  telegram_message_id: string | null;
  transcript: string;
  summary: string;
  sheet_row_id: string | null;
  transcription_source: string;
  summary_source: string;
  created_at: string;
  action_items?: ActionItem[];
}

export interface ActionItem {
  id: string;
  voice_log_id: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  company_id: string | null;
  role: string | null;
  linkedin_url: string | null;
  source_id: number;
  email_status_id: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /* Joined relations from Supabase select */
  companies?: Company | null;
  contact_sources?: ContactSource;
  email_statuses?: EmailStatus;
  email_drafts?: EmailDraft[];
  voice_logs?: VoiceLog[];
}

/** Filter shape used by the contacts list view */
export interface ContactFilters {
  search: string;
  sourceId: number | null;
  emailStatusId: number | null;
}

/** Payload for creating a contact via CSV import */
export interface ContactInsertPayload {
  name: string;
  email: string;
  company_id: string | null;
  role: string | null;
  linkedin_url: string | null;
  source_id: number;
}
