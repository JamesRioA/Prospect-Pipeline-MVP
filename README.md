# Prospect Pipeline MVP

A premium B2B lead management and automated outreach dashboard connected to a Telegram voice-to-structured-data logger bot. Built with **Next.js 14 (App Router)**, **Tailwind CSS**, **Supabase (PostgreSQL + Realtime)**, **Gemini 2.0 Flash**, and **Groq Cloud (Whisper + LLaMA-3.3)**.

---

## Key Features

1. **AI-Assisted CSV Importer**: Drag-and-drop CSV contacts, auto-upsert unique companies, run automatic profile autocomplete enrichment, and preview validation skipped rows.
2. **Dashboard Cockpit**: Filters by lead status & source, paginated/virtualized contacts table with live PostgreSQL Realtime updates.
3. **Outreach Copilot**: AI-generated cold email drafts with Gemini (primary), Groq LLaMA (secondary fallback), and hardcoded template (final resort), keeping a chronological draft history.
4. **CRM Voice Logger Bot**: Telegram Bot accepts voice memos, transcribes via Groq Whisper, extracts summaries + checkboxes of action items using Gemini/LLaMA, fuzzy-matches the contact name, persists to database, and appends rows to a Google Sheets document.

---

## Tech Stack & Architecture

```
src/
├── config/        # Environment configurations and global constants
├── features/      # Feature-based vertical slices
│   ├── contacts/  # Contacts list, detail panel, status badges, & filters
│   ├── csv-upload/# CSV Papaparse parser & Uploader preview UI
│   └── email-drafts/# Draft generation panels & history view
├── lib/           # Infrastructure & third-party wrappers (Supabase, Gemini, Clearbit)
└── app/           # Root layouts, routing pages, and API routes
```

- **Frontend**: Next.js 14, Tailwind CSS, Lucide icons.
- **Backend**: Next.js Route Handlers.
- **Database**: Supabase PostgreSQL with Row Level Security (RLS) and Realtime replication.
- **Integrations**: Gemini API (`@google/generative-ai`), Groq SDK (`groq-sdk`), Telegram Bot API (`node-telegram-bot-api`), Google Sheets API (`googleapis`).

---

## Database Schema (Normalized)

The database structure consists of the following 7 normalized tables:
- `contact_sources` (id smallint PK, name varchar) — values: `csv_import`(1), `manual`(2), `telegram_bot`(3), `api`(4)
- `email_statuses` (id smallint PK, name varchar) — values: `pending`(1), `draft_generated`(2), `sent`(3), `replied`(4), `bounced`(5)
- `companies` (id uuid PK, name varchar, domain varchar, logo_url text, enrichment_source varchar, enriched_at timestamptz)
- `contacts` (id uuid PK, name varchar, email varchar, company_id uuid FK, role varchar, linkedin_url varchar, source_id smallint, email_status_id smallint, notes text, updated_at, created_at)
- `email_drafts` (id uuid PK, contact_id uuid FK, body text, generation_source varchar, is_active boolean)
- `voice_logs` (id uuid PK, contact_id uuid FK, telegram_message_id varchar, transcript text, summary text, transcription_source, summary_source)
- `action_items` (id uuid PK, voice_log_id uuid FK, description varchar, is_completed boolean, completed_at timestamptz)

---

## Setup & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root of the project with the following structure:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Gemini AI (Email drafts + Summarization)
GEMINI_API_KEY=your-gemini-api-key

# Groq Cloud (Whisper transcriptions + LLaMA fallbacks)
GROQ_API_KEY=your-groq-api-key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token
ALLOWED_TELEGRAM_CHAT_ID=your-telegram-chat-id-integer

# Google Sheets Logging
GOOGLE_SHEET_ID=your-google-sheet-id
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

### 3. Run the Web Dashboard
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 4. Run the Telegram Bot
```bash
npm run bot:dev
```

---

## Verification & Build Compliance
Both components have been successfully compile-checked with type-safety checks:
```bash
# Verify Web App TypeScript
npx tsc --noEmit

# Verify Bot TypeScript
npx tsc --project bot/tsconfig.json --noEmit
```
Both complete with zero errors.
