import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // local dev
dotenv.config();                        // fallback to .env on droplet
import TelegramBot from 'node-telegram-bot-api';
import { transcribeAudio } from './whisper';
import { summarizeTranscript } from './summarize';
import { logToSheet } from './sheets';
import { matchContact, saveVoiceLog, createContactAndCompany } from './supabase';
import fs from 'fs';
import path from 'path';
import https from 'https';

const DOWNLOAD_TIMEOUT_MS = 10000;
const TEMP_DIR = path.join(process.cwd(), 'tmp');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN environment variable is not set');
  return token;
}

function getAllowedChatIds(): number[] {
  const chatIdStr = process.env.ALLOWED_TELEGRAM_CHAT_ID;
  if (!chatIdStr) throw new Error('ALLOWED_TELEGRAM_CHAT_ID environment variable is not set');
  return chatIdStr
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => {
      const num = Number(id);
      if (isNaN(num)) {
        throw new Error(`Invalid Telegram Chat ID in configuration: "${id}"`);
      }
      return num;
    });
}

async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const request = https.get(url, { timeout: DOWNLOAD_TIMEOUT_MS }, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });
    request.on('error', (err) => {
      fs.unlink(dest, () => { }); // Clean up partial file
      reject(err);
    });
    request.on('timeout', () => {
      request.destroy();
      fs.unlink(dest, () => { });
      reject(new Error('Download timeout'));
    });
  });
}

const bot = new TelegramBot(getBotToken(), { polling: true });
const ALLOWED_CHAT_IDS = getAllowedChatIds();

bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  let tempFilePath: string | null = null;

  if (!ALLOWED_CHAT_IDS.includes(chatId)) {
    await bot.sendMessage(chatId, 'Unauthorized.');
    return;
  }

  try {
    await bot.sendMessage(chatId, '🎙️ Got it, processing your voice note...');

    // Download voice file
    const fileId = msg.voice!.file_id;
    const fileLink = await bot.getFileLink(fileId);
    tempFilePath = path.join(TEMP_DIR, `voice_${Date.now()}.ogg`);
    await downloadFile(fileLink, tempFilePath);

    // Transcribe
    await bot.sendMessage(chatId, '📝 Transcribing...');
    const transcript = await transcribeAudio(tempFilePath);

    // Summarize
    await bot.sendMessage(chatId, '🧠 Summarizing...');
    const { summary, actionItems, extractedContact, source: summarySource } = await summarizeTranscript(transcript);

    // Match contact (fuzzy matching existing DB contacts)
    let contact = await matchContact(transcript).catch(() => null);

    // Auto-create contact if not matched in DB but extracted by LLM
    if (!contact && extractedContact && extractedContact.name && extractedContact.name.trim()) {
      try {
        contact = await createContactAndCompany(extractedContact.name, extractedContact.company);
        console.log(`[bot] Auto-created contact: ${contact.name} (${contact.company_name ?? 'Unknown'})`);
      } catch (err) {
        console.error('[bot] Failed to auto-create contact:', err);
      }
    }

    // Save to Supabase
    await saveVoiceLog({
      contactId: contact?.id ?? null,
      transcript,
      summary,
      actionItems,
      telegramMessageId: String(msg.message_id),
      transcriptionSource: 'groq',
      summarySource,
    }).catch((err) => console.error('[bot] Supabase save failed:', err));

    // Log to Google Sheet
    const sheetLogged = await logToSheet({
      timestamp: new Date().toISOString(),
      transcript,
      summary,
      actionItems: actionItems.join(', '),
      contactName: contact?.name ?? 'Unknown',
      companyName: contact?.company_name ?? 'Unknown',
      contactEmail: contact?.email ?? '',
    }).then(() => true).catch((err) => {
      console.error('[bot] Sheet log failed:', err);
      return false;
    });

    // Build reply
    const replyLines = [
      `👤 *Contact:* ${contact ? contact.name : 'Unknown'}`,
      `🏢 *Company:* ${contact?.company_name ?? 'Unknown'}\n`,
      `📋 *Summary:* ${summary}`,
      actionItems.length > 0
        ? `\n📌 *Action items:*\n${actionItems.map((a) => `• ${a}`).join('\n')}`
        : '',
      sheetLogged
        ? '\n📊 Logged to Google Sheet.'
        : '\n⚠️ Sheet logging failed, saved to database only.',
      summarySource === 'fallback'
        ? '\n⚠️ Summary used fallback mode (AI services unavailable).'
        : '',
    ].filter(Boolean).join('\n');

    await bot.sendMessage(chatId, replyLines, { parse_mode: 'Markdown' });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[bot] Unhandled error:', message);
    await bot.sendMessage(
      chatId,
      '❌ Something went wrong processing that voice note. Please try again in a moment.'
    );
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
});

bot.on('message', async (msg) => {
  if (msg.voice) return; // Already handled by voice handler
  if (!ALLOWED_CHAT_IDS.includes(msg.chat.id)) {
    await bot.sendMessage(msg.chat.id, 'Unauthorized.');
    return;
  }
  await bot.sendMessage(
    msg.chat.id,
    '👋 Send me a voice note and I\'ll transcribe, summarize, and log it to your prospect pipeline.'
  );
});

console.log('🚀 Prospect Pipeline Bot is running...');
