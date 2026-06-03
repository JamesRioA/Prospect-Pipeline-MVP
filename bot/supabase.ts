import { createClient } from '@supabase/supabase-js';

const CONTACT_SOURCE_TELEGRAM = 3;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  return createClient(url, key);
}

export interface MatchedContact {
  id: string;
  name: string;
  email: string;
  company_name: string | null;
}

/** Fuzzy match: checks if any contact's first name appears in the transcript */
export async function matchContact(transcript: string): Promise<MatchedContact | null> {
  const supabase = getSupabaseClient();

  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('id, name, email, companies(name)');

  if (error || !contacts || contacts.length === 0) return null;

  const lowerTranscript = transcript.toLowerCase();

  for (const contact of contacts) {
    const firstName = contact.name?.toLowerCase().split(' ')[0];
    if (firstName && firstName.length > 2 && lowerTranscript.includes(firstName)) {
      const companyData = (contact.companies as unknown) as { name: string } | null;
      return {
        id: contact.id,
        name: contact.name,
        email: contact.email,
        company_name: companyData?.name ?? null,
      };
    }
  }

  return null;
}

export interface VoiceLogInput {
  contactId: string | null;
  transcript: string;
  summary: string;
  actionItems: string[];
  telegramMessageId: string;
  transcriptionSource: string;
  summarySource: string;
}

/** Inserts voice log + individual action items in sequence */
export async function saveVoiceLog(input: VoiceLogInput): Promise<void> {
  const supabase = getSupabaseClient();

  // Insert voice log
  const { data: voiceLog, error: logError } = await supabase
    .from('voice_logs')
    .insert({
      contact_id: input.contactId,
      telegram_message_id: input.telegramMessageId,
      transcript: input.transcript,
      summary: input.summary,
      transcription_source: input.transcriptionSource,
      summary_source: input.summarySource,
    })
    .select('id')
    .single();

  if (logError) throw logError;

  // Insert action items if any
  if (input.actionItems.length > 0) {
    const actionItemRows = input.actionItems.map((description) => ({
      voice_log_id: voiceLog.id,
      description,
    }));

    const { error: itemsError } = await supabase
      .from('action_items')
      .insert(actionItemRows);

    if (itemsError) {
      // Non-fatal: voice log was saved, action items failed
      console.error('[supabase] Failed to insert action items:', itemsError);
    }
  }
}
