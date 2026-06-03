import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { generateWithGemini } from '@/lib/gemini';
import Groq from 'groq-sdk';

const GROQ_FALLBACK_MODEL = 'llama-3.3-70b-versatile';

function buildOutreachPrompt(contactName: string, role: string | null, companyName: string | null): string {
  return `Write a highly personalized professional B2B cold email to a prospect.
Prospect Details:
- Name: ${contactName}
- Job Role: ${role || 'Decision Maker'}
- Company: ${companyName || 'Prospect Company'}

Goal: Introduce our services, highlight a potential mutual fit, and ask for a brief 10-minute introductory call.
Tone: Professional, respectful, value-driven, and concise.
Length: Under 150 words.
Do NOT include any generic placeholders like "[Your Name]". Write a cohesive draft directly from our sales representative.
Do NOT include markdown backticks or any meta-text. Just output the email subject and body, starting with 'Subject: ' on the first line.`;
}

function buildFallbackTemplate(contactName: string, companyName: string | null): string {
  return `Subject: Partnership opportunities with ${companyName || 'your team'}

Hi ${contactName},

I hope this email finds you well.

I've been following the work you've been doing, and I'm very impressed by your company's focus on operational excellence. I'd love to connect to discuss how we can assist your team in streamlining pipeline provisioning and automating prospect outreach flows.

Would you be open to a brief 10-minute chat next week to see if there is a mutual fit?

Best regards,
Sales Relations Team`;
}

export async function POST(request: Request) {
  try {
    const { contactId } = await request.json();

    if (!contactId) {
      return NextResponse.json({ error: 'Missing contactId' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // Fetch contact with company
    const { data: contact, error: fetchError } = await supabase
      .from('contacts')
      .select('id, name, role, email, companies(name)')
      .eq('id', contactId)
      .single();

    if (fetchError || !contact) {
      return NextResponse.json(
        { error: fetchError?.message || 'Contact not found' },
        { status: 404 }
      );
    }

    const companyData = (contact.companies as unknown) as { name: string } | null;
    const companyName = companyData?.name ?? null;

    const prompt = buildOutreachPrompt(contact.name, contact.role, companyName);

    let draftText = '';
    let generationSource: 'gemini' | 'groq' | 'fallback' = 'gemini';

    // 1. Try Gemini
    try {
      draftText = await generateWithGemini(prompt);
      if (!draftText) throw new Error('Empty response from Gemini');
    } catch (geminiError) {
      console.warn('[GenerateDraft] Gemini failed, falling back to Groq LLaMA:', geminiError);
      
      // 2. Try Groq LLaMA
      try {
        const groqApiKey = process.env.GROQ_API_KEY;
        if (!groqApiKey) throw new Error('GROQ_API_KEY not set');

        const groq = new Groq({ apiKey: groqApiKey });
        const completion = await groq.chat.completions.create({
          model: GROQ_FALLBACK_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
        });

        draftText = completion.choices[0]?.message?.content?.trim() || '';
        if (!draftText) throw new Error('Empty response from Groq');
        generationSource = 'groq';
      } catch (groqError) {
        console.error('[GenerateDraft] Groq failed, falling back to template:', groqError);
        
        // 3. Fallback to template
        draftText = buildFallbackTemplate(contact.name, companyName);
        generationSource = 'fallback';
      }
    }

    // Deactivate old drafts for this contact
    const { error: deactivateError } = await supabase
      .from('email_drafts')
      .update({ is_active: false })
      .eq('contact_id', contactId);

    if (deactivateError) {
      console.error('[GenerateDraft] Failed to deactivate old drafts:', deactivateError);
    }

    // Insert new draft
    const { data: newDraft, error: insertError } = await supabase
      .from('email_drafts')
      .insert({
        contact_id: contactId,
        body: draftText,
        generation_source: generationSource,
        is_active: true,
      })
      .select('*')
      .single();

    if (insertError) {
      throw insertError;
    }

    // Update contact status to 2 (draft_generated)
    const { error: updateContactError } = await supabase
      .from('contacts')
      .update({
        email_status_id: 2, // draft_generated
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);

    if (updateContactError) {
      console.error('[GenerateDraft] Failed to update contact status:', updateContactError);
    }

    return NextResponse.json({
      draft: newDraft,
      source: generationSource,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[GenerateDraft] Server error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
