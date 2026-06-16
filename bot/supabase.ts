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

/** Resolves or creates a company, then creates a contact with a guaranteed unique placeholder email */
export async function createContactAndCompany(
  name: string,
  companyName: string | null
): Promise<MatchedContact> {
  const supabase = getSupabaseClient();

  let companyId: string | null = null;

  // 1. Resolve or create company if specified
  if (companyName && companyName.trim()) {
    const trimmedCompany = companyName.trim();
    
    // Look up company case-insensitively
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', trimmedCompany)
      .maybeSingle();

    if (company) {
      companyId = company.id;
    } else {
      // Create new company with Clearbit enrichment
      let domain = `${trimmedCompany.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      let logoUrl: string | null = null;
      let enrichmentSource = 'fallback';

      try {
        const clearbitUrl = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(trimmedCompany)}`;
        const response = await fetch(clearbitUrl);
        if (response.ok) {
          const suggestions = await response.json();
          if (Array.isArray(suggestions) && suggestions.length > 0) {
            domain = suggestions[0].domain || domain;
            logoUrl = suggestions[0].logo || null;
            enrichmentSource = 'clearbit';
          }
        }
      } catch (err) {
        console.warn(`[bot] Clearbit autocomplete failed for "${trimmedCompany}":`, err);
      }

      const { data: newCompany, error: insertErr } = await supabase
        .from('companies')
        .insert({
          name: trimmedCompany,
          domain,
          logo_url: logoUrl,
          enrichment_source: enrichmentSource,
          enriched_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('[supabase] Failed to create company, falling back:', insertErr);
      } else {
        companyId = newCompany.id;
      }
    }
  }

  // 2. Generate a unique placeholder email
  const domain = companyName
    ? `${companyName.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.com`
    : 'unknown';
  const cleanName = name.toLowerCase().trim().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');

  let email = `${cleanName}@${domain}`;
  let exists = true;
  let suffix = 0;

  while (exists) {
    const checkEmail = suffix === 0 ? email : `${cleanName.includes('.') ? cleanName.replace('.', `${suffix}.`) : `${cleanName}${suffix}`}@${domain}`;
    const { data: duplicate } = await supabase
      .from('contacts')
      .select('id')
      .eq('email', checkEmail)
      .maybeSingle();

    if (!duplicate) {
      email = checkEmail;
      exists = false;
    } else {
      suffix++;
    }
  }

  // 3. Create the contact
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .insert({
      name,
      email,
      company_id: companyId,
      source_id: CONTACT_SOURCE_TELEGRAM, // 3 (telegram_bot)
      email_status_id: 1, // 1 (pending)
    })
    .select('id, name, email, companies(name)')
    .single();

  if (contactErr) {
    throw contactErr;
  }

  const companyData = (contact.companies as unknown) as { name: string } | null;
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    company_name: companyData?.name ?? null,
  };
}
