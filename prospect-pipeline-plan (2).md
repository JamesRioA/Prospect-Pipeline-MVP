# Prospect Pipeline Tool — Implementation Plan

> **Concept**: A single cohesive tool that combines all three vibe-coding prompts into one product that mirrors the hiring company's actual business: lead intake, enrichment, outreach drafting, and async voice-note logging — all connected.

---

## What You Are Building

A lightweight internal prospect pipeline tool with three connected modules:

1. **CSV Upload + Personalized Email Generator** — upload a contacts CSV, get personalized outreach drafts per contact
2. **Live Contacts Dashboard** — view, filter, and manage all contacts and their outreach status, pulling enrichment data from a public API
3. **Telegram Voice Note Bot** — drop a voice note into Telegram, get an auto-summary logged to a Google Sheet linked to the relevant contacts

The three modules share a **single contacts data layer** (Supabase). An action in one module reflects in the others. That connection is the point.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | Their stack, fast to ship |
| Styling | Tailwind CSS + Shadcn UI | Clean without effort |
| Database | Supabase (free tier) | Real-time, easy to set up |
| Email drafting | Gemini API (gemini-2.0-flash) | Free tier, fast, generous limits |
| Summarization (bot) | Gemini API primary, Groq LLaMA fallback | Both free |
| Contact enrichment | Clearbit autocomplete (free, no key needed) | Public API, zero setup |
| Transcription | Groq Whisper API (free tier) | Free, fast |
| Voice note bot | Telegram Bot API | Their explicit ask |
| Google Sheets sync | Google Sheets API v4 | Their explicit ask |
| Deployment | Vercel (web) + DigitalOcean droplet (bot) | Already have the droplet |

---

## Free Tier Limits You Should Know

| Service | Free Limit | Risk for Demo |
|---|---|---|
| Gemini API (Flash) | 15 RPM, 1,500 requests/day | Very low for a demo |
| Groq Whisper | 2,000 requests/day, 30 RPM | Very low |
| Groq LLaMA | 14,400 requests/day | No risk |
| Supabase | 500MB storage, 2GB bandwidth | No risk |
| Clearbit autocomplete | Unlimited public endpoint | No risk |
| Google Sheets API | 300 requests/minute | No risk |
| Telegram Bot API | No practical limit | No risk |

**Bottom line**: You will not hit any limits during development or a Loom recording. The only realistic error is a 429 from Gemini if you spam requests quickly. The retry logic below handles this.

---

## Data Model

### Supabase Table: `contacts`

```sql
create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  role text,
  linkedin_url text,
  source text default 'csv_import',
  enrichment_data jsonb,
  email_draft text,
  email_status text default 'pending',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Supabase Table: `voice_logs`

```sql
create table voice_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete set null,
  telegram_message_id text,
  transcript text,
  summary text,
  action_items text[],
  sheet_row_id text,
  created_at timestamptz default now()
);
```

---

## Graceful Fallback Strategy

Every external API call follows the same pattern:

```
Primary call (Gemini)
  → on 429 (rate limit): exponential backoff, retry up to 3 times
  → on 5xx (server error): retry once after 2 seconds
  → on total failure: try Groq LLaMA fallback
    → on Groq failure: return safe fallback value, never crash
```

### Central Retry Wrapper

```typescript
// lib/retry.ts
export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  fallback: T,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 1000, onRetry } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const isRateLimit = error instanceof Error && error.message.includes('429');
      const isServerError = error instanceof Error && error.message.includes('5');
      const isLastAttempt = attempt === maxAttempts;

      if (isLastAttempt || (!isRateLimit && !isServerError)) {
        console.error(`[withRetry] All attempts failed, returning fallback:`, error);
        return fallback;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      onRetry?.(attempt, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return fallback;
}
```

---

## Module 1: CSV Upload + Email Generator

### Key Code: CSV Parser

```typescript
// lib/csv-parser.ts
import Papa from 'papaparse';

export interface ContactRow {
  name: string;
  email: string;
  company?: string;
  role?: string;
  [key: string]: string | undefined;
}

export function parseCSV(file: File): Promise<ContactRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.toLowerCase().trim(),
      complete: (results) => resolve(results.data as ContactRow[]),
      error: reject,
    });
  });
}
```

### Key Code: Gemini Draft Generation with Fallback

```typescript
// lib/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function generateWithGemini(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}
```

```typescript
// app/api/generate-draft/route.ts
import { generateWithGemini } from '@/lib/gemini';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const FALLBACK_DRAFT = (name: string, company: string) =>
  `Hi ${name}, I came across ${company || 'your company'} and thought there might be a good fit. Would you be open to a quick chat this week?`;

const DRAFT_PROMPT = (contact: { name: string; company?: string; role?: string }) => `
Write a short personalized cold email for:
Name: ${contact.name}
Company: ${contact.company || 'unknown'}
Role: ${contact.role || 'unknown'}

Under 100 words. Sound human, not like a template. One clear CTA. No subject line. Just the body.
`;

export async function POST(req: Request) {
  const { contact } = await req.json();
  const prompt = DRAFT_PROMPT(contact);

  // Try Gemini first
  try {
    const draft = await generateWithGemini(prompt);
    return Response.json({ draft, source: 'gemini' });
  } catch (geminiError) {
    console.warn('[generate-draft] Gemini failed, trying Groq:', geminiError);
  }

  // Fallback to Groq LLaMA
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 200,
    });
    const draft = completion.choices[0]?.message?.content ?? '';
    if (!draft) throw new Error('Empty Groq response');
    return Response.json({ draft, source: 'groq' });
  } catch (groqError) {
    console.error('[generate-draft] Both Gemini and Groq failed:', groqError);
  }

  // Final fallback: template
  return Response.json({
    draft: FALLBACK_DRAFT(contact.name, contact.company),
    source: 'fallback',
    warning: 'Draft generated from template due to API errors.'
  });
}
```

---

## Module 2: Contacts Dashboard

### Enrichment with Fallback

```typescript
// lib/enrichment.ts
import { withRetry } from './retry';

export interface EnrichmentData {
  company_domain: string | null;
  company_logo: string | null;
  source: 'clearbit' | 'fallback';
}

export async function enrichContact(company: string): Promise<EnrichmentData> {
  return withRetry(
    async () => {
      const res = await fetch(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(company)}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!res.ok) throw new Error(`Clearbit ${res.status}`);
      const data = await res.json();
      if (data.length === 0) throw new Error('No results');
      return {
        company_domain: data[0].domain,
        company_logo: data[0].logo,
        source: 'clearbit' as const,
      };
    },
    {
      company_domain: company
        ? `${company.toLowerCase().replace(/\s+/g, '')}.com`
        : null,
      company_logo: null,
      source: 'fallback' as const,
    },
    { maxAttempts: 2, baseDelayMs: 500 }
  );
}
```

### Real-time Dashboard Subscription

```typescript
// components/contacts-table.tsx
'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function ContactsTable() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, voice_logs(*)')
      .order('created_at', { ascending: false });
    if (error) {
      setError('Failed to load contacts. Check your Supabase connection.');
      return;
    }
    setContacts(data ?? []);
  };

  useEffect(() => {
    fetchContacts();

    const channel = supabase
      .channel('contacts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' },
        () => fetchContacts()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // render table...
}
```

---

## Module 3: Telegram Voice Note Bot

### Groq Whisper Transcription with Fallback

```typescript
// bot/whisper.ts
import Groq from 'groq-sdk';
import { withRetry } from '../lib/retry';
import fs from 'fs';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function transcribeAudio(filePath: string): Promise<string> {
  return withRetry(
    async () => {
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: 'whisper-large-v3-turbo',
        response_format: 'text',
        language: 'en',
      });
      if (!transcription || typeof transcription !== 'string' || transcription.trim() === '') {
        throw new Error('Empty transcription returned');
      }
      return transcription.trim();
    },
    '[Transcription unavailable — Groq API did not respond. Raw audio saved.]',
    {
      maxAttempts: 3,
      baseDelayMs: 1000,
      onRetry: (attempt) => console.warn(`[Whisper] Retry attempt ${attempt}...`),
    }
  );
}
```

### Gemini Summarization with Groq LLaMA Fallback

```typescript
// bot/summarize.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SUMMARY_PROMPT = (transcript: string) => `
Summarize this voice note in 1-2 sentences and extract action items as a list.
Transcript: "${transcript}"
Respond ONLY in raw JSON, no markdown, no backticks:
{"summary": "...", "actionItems": ["..."]}
`;

interface SummaryResult {
  summary: string;
  actionItems: string[];
  source: 'gemini' | 'groq' | 'fallback';
}

function parseJSON(text: string) {
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export async function summarizeTranscript(transcript: string): Promise<SummaryResult> {
  const prompt = SUMMARY_PROMPT(transcript);

  // Try Gemini first
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJSON(text);
    return { ...parsed, source: 'gemini' };
  } catch (geminiError) {
    console.warn('[summarize] Gemini failed, trying Groq LLaMA:', geminiError);
  }

  // Fallback to Groq LLaMA
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    });
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = parseJSON(text);
    return { ...parsed, source: 'groq' };
  } catch (groqError) {
    console.error('[summarize] Both Gemini and Groq failed:', groqError);
  }

  // Final fallback: raw transcript as summary
  return {
    summary: transcript.slice(0, 150) + (transcript.length > 150 ? '...' : ''),
    actionItems: [],
    source: 'fallback',
  };
}
```

### Full Bot Handler

```typescript
// bot/index.ts
import TelegramBot from 'node-telegram-bot-api';
import { transcribeAudio } from './whisper';
import { summarizeTranscript } from './summarize';
import { logToSheet } from './sheets';
import { matchContact, saveVoiceLog } from './supabase';
import fs from 'fs';
import path from 'path';
import https from 'https';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

// Restrict bot to owner only. Get your ID by messaging @userinfobot on Telegram.
const ALLOWED_CHAT_ID = Number(process.env.ALLOWED_TELEGRAM_CHAT_ID!);

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, { timeout: 10000 }, (res) => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });
    request.on('error', reject);
    request.on('timeout', () => { request.destroy(); reject(new Error('Download timeout')); });
  });
}

bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  let tempFilePath: string | null = null;

  if (chatId !== ALLOWED_CHAT_ID) {
    await bot.sendMessage(chatId, 'Unauthorized.');
    return;
  }

  try {
    await bot.sendMessage(chatId, 'Got it, processing your voice note...');

    const fileId = msg.voice!.file_id;
    const fileLink = await bot.getFileLink(fileId);
    tempFilePath = path.join('/tmp', `voice_${Date.now()}.oga`);
    await downloadFile(fileLink, tempFilePath);

    await bot.sendMessage(chatId, 'Transcribing...');
    const transcript = await transcribeAudio(tempFilePath);

    await bot.sendMessage(chatId, 'Summarizing...');
    const { summary, actionItems, source } = await summarizeTranscript(transcript);

    const contact = await matchContact(transcript).catch(() => null);

    await saveVoiceLog({
      contactId: contact?.id ?? null,
      transcript,
      summary,
      actionItems,
      telegramMessageId: String(msg.message_id),
    }).catch(err => console.error('[bot] Supabase log failed:', err));

    const sheetLogged = await logToSheet({
      timestamp: new Date().toISOString(),
      transcript,
      summary,
      actionItems: actionItems.join(', '),
      contactName: contact?.name ?? 'Unknown',
      contactEmail: contact?.email ?? '',
    }).then(() => true).catch(err => {
      console.error('[bot] Sheets log failed:', err);
      return false;
    });

    const lines = [
      `Summary: ${summary}`,
      actionItems.length > 0
        ? `\nAction items:\n${actionItems.map(a => `• ${a}`).join('\n')}`
        : '',
      contact
        ? `\nLinked to: ${contact.name} (${contact.company ?? 'unknown company'})`
        : '\nNo matching contact found.',
      sheetLogged
        ? '\nLogged to Google Sheet.'
        : '\nNote: Sheet logging failed, saved to database only.',
      source === 'fallback' ? '\nNote: Summary used fallback mode.' : '',
    ].filter(Boolean).join('');

    await bot.sendMessage(chatId, lines);

  } catch (err) {
    console.error('[bot] Unhandled error:', err);
    await bot.sendMessage(
      chatId,
      'Something went wrong processing that voice note. Please try again in a moment.'
    );
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

bot.on('message', async (msg) => {
  if (msg.voice) return;
  if (msg.chat.id !== ALLOWED_CHAT_ID) {
    await bot.sendMessage(msg.chat.id, 'Unauthorized.');
    return;
  }
  await bot.sendMessage(
    msg.chat.id,
    'Send me a voice note and I will transcribe, summarize, and log it to your pipeline.'
  );
});

console.log('Prospect Pipeline Bot is running...');
```

### Google Sheets Logger

```typescript
// bot/sheets.ts
import { google } from 'googleapis';

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (sheetsClient) return sheetsClient;
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export interface SheetEntry {
  timestamp: string;
  transcript: string;
  summary: string;
  actionItems: string;
  contactName: string;
  contactEmail: string;
}

export async function logToSheet(entry: SheetEntry): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID!,
    range: 'Sheet1!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        entry.timestamp,
        entry.contactName,
        entry.contactEmail,
        entry.summary,
        entry.actionItems,
        entry.transcript,
      ]],
    },
  });
}
```

### Contact Matching (Fuzzy, Never Throws)

```typescript
// bot/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function matchContact(transcript: string) {
  try {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, email, company');
    if (!contacts || contacts.length === 0) return null;
    const lower = transcript.toLowerCase();
    return contacts.find(c =>
      c.name && lower.includes(c.name.toLowerCase().split(' ')[0])
    ) ?? null;
  } catch {
    return null;
  }
}

export async function saveVoiceLog(data: {
  contactId: string | null;
  transcript: string;
  summary: string;
  actionItems: string[];
  telegramMessageId: string;
}) {
  const { error } = await supabase.from('voice_logs').insert({
    contact_id: data.contactId,
    telegram_message_id: data.telegramMessageId,
    transcript: data.transcript,
    summary: data.summary,
    action_items: data.actionItems,
  });
  if (error) throw error;
}
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini (replaces Anthropic entirely)
GEMINI_API_KEY=

# Groq (Whisper transcription + LLaMA fallback)
GROQ_API_KEY=

# Telegram
TELEGRAM_BOT_TOKEN=
ALLOWED_TELEGRAM_CHAT_ID=   # Your numeric Telegram user ID — get it from @userinfobot

# Google Sheets
GOOGLE_SHEET_ID=
GOOGLE_SERVICE_ACCOUNT_JSON=
```

Note: No `ANTHROPIC_API_KEY` needed anywhere in this project.

---

## Package Dependencies

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "groq-sdk": "^0.9.0",
    "node-telegram-bot-api": "^0.66.0",
    "googleapis": "^144.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "papaparse": "^5.4.1",
    "next": "14.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "typescript": "^5.0.0"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "@types/node": "^22.0.0",
    "@types/node-telegram-bot-api": "^0.64.7",
    "@types/papaparse": "^5.3.14"
  }
}
```

---

## Project Structure

```
prospect-pipeline/
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── pipeline/page.tsx
│   │   └── api/
│   │       └── generate-draft/route.ts
│   ├── components/
│   │   ├── csv-upload.tsx
│   │   ├── contacts-table.tsx
│   │   ├── contact-detail-panel.tsx
│   │   ├── email-draft-panel.tsx
│   │   └── voice-log-list.tsx
│   └── lib/
│       ├── supabase.ts
│       ├── gemini.ts
│       ├── csv-parser.ts
│       ├── enrichment.ts
│       └── retry.ts
├── bot/
│   ├── index.ts
│   ├── whisper.ts
│   ├── summarize.ts
│   ├── sheets.ts
│   └── supabase.ts
├── supabase/
│   └── migrations/001_initial.sql
├── .env.local
├── package.json
└── README.md
```

---

## Build Order

| Step | Task | Est. Time |
|---|---|---|
| 1 | Supabase setup, create tables, get keys | 10 min |
| 2 | CSV upload, parse, insert to Supabase | 20 min |
| 3 | Contacts dashboard, real-time subscription | 20 min |
| 4 | Gemini email draft generation + Groq fallback | 15 min |
| 5 | Clearbit enrichment + fallback | 10 min |
| 6 | Telegram bot setup, voice download | 20 min |
| 7 | Groq Whisper transcription + retry logic | 15 min |
| 8 | Gemini summarization + Groq LLaMA fallback | 15 min |
| 9 | Google Sheets logging + soft fail | 15 min |
| 10 | Contact matching from transcript | 15 min |
| 11 | Deploy web to Vercel, run bot via PM2 on DigitalOcean, record Loom | 15 min |

**Total: approximately 2.5 to 3 hours**

---

## Deployment

| Part | Where | How |
|---|---|---|
| Web app | Vercel | `vercel deploy` |
| Telegram bot | DigitalOcean droplet | `pm2 start bot/index.ts --interpreter ts-node --name prospect-bot` |
| Database | Supabase free tier | Hosted, nothing to deploy |
| Google Sheet | Google Drive | Share view-only link in your email |

---

## How the Three Modules Connect

```
CSV Upload
    │
    ▼
contacts table (Supabase)
    │                    ▲
    ▼                    │
Dashboard ◄──── real-time subscription
    │                    │
    │              voice_logs table
    │                    ▲
    └──────────── Telegram Bot
                         │
                         ▼
                   Google Sheet
```

---

## Loom Walkthrough Script (2 minutes)

**0:00 to 0:20** — Open the dashboard. Show it is empty. Say: "You listed three things separately. I thought they were actually one product so I built it that way."

**0:20 to 0:50** — Upload the CSV. Show contacts appearing in the table. Click "Generate Drafts." Show Gemini writing personalized emails per contact.

**0:50 to 1:20** — Open a contact card. Show enrichment data and the draft. Note the empty voice log section.

**1:20 to 1:50** — Switch to Telegram. Send a voice note: "Hey, just talked to John Smith at Acme, he wants a pricing breakdown by Friday." Show the bot reply with summary and action items. Switch back to dashboard, show the voice log now appearing under John Smith.

**1:50 to 2:00** — Quick cut to Google Sheet. Show the row was logged. Done.

---

## What You Would Do Differently (for the application answer)

- Contact matching uses simple first-name string search. A proper implementation would use embeddings so "the guy from Acme" still resolves correctly.
- The Telegram bot runs on polling which is fine for a demo but needs webhooks in production.
- Email drafts are generated one at a time. Batch generation with Promise.all and rate limiting would be cleaner at scale.
- Google Sheet and Supabase are two separate stores for the same data. In production pick one source of truth.
- The Gemini-to-Groq fallback is sequential. A smarter approach would be parallel calls with first-to-succeed winning, trading cost for latency.
