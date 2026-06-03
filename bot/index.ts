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

async function handleAudioFile(msg: TelegramBot.Message, fileId: string, extension: string) {
  const chatId = msg.chat.id;
  let tempFilePath: string | null = null;

  try {
    await bot.sendMessage(chatId, '🎙️ Got it, processing your audio...');

    // Download voice/audio file
    const fileLink = await bot.getFileLink(fileId);
    tempFilePath = path.join(TEMP_DIR, `audio_${Date.now()}.${extension}`);
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
      '❌ Something went wrong processing that audio file. Please try again in a moment.'
    );
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

// Listen for voice notes
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  if (!ALLOWED_CHAT_IDS.includes(chatId)) {
    await bot.sendMessage(chatId, 'Unauthorized.');
    return;
  }
  if (msg.voice) {
    await handleAudioFile(msg, msg.voice.file_id, 'ogg');
  }
});

// Listen for audio files (.mp3, etc.)
bot.on('audio', async (msg) => {
  const chatId = msg.chat.id;
  if (!ALLOWED_CHAT_IDS.includes(chatId)) {
    await bot.sendMessage(chatId, 'Unauthorized.');
    return;
  }
  if (msg.audio) {
    let extension = 'mp3';
    if (msg.audio.mime_type) {
      if (msg.audio.mime_type.includes('ogg')) extension = 'ogg';
      else if (msg.audio.mime_type.includes('wav')) extension = 'wav';
      else if (msg.audio.mime_type.includes('m4a') || msg.audio.mime_type.includes('mp4')) extension = 'm4a';
      else if (msg.audio.mime_type.includes('flac')) extension = 'flac';
    }
    await handleAudioFile(msg, msg.audio.file_id, extension);
  }
});

// Listen for documents (for audio uploaded as file attachments)
bot.on('document', async (msg) => {
  const chatId = msg.chat.id;
  if (!ALLOWED_CHAT_IDS.includes(chatId)) {
    await bot.sendMessage(chatId, 'Unauthorized.');
    return;
  }
  if (msg.document) {
    const doc = msg.document;
    const isAudioMime = doc.mime_type?.startsWith('audio/');
    const hasAudioExt = doc.file_name && (
      doc.file_name.endsWith('.mp3') ||
      doc.file_name.endsWith('.wav') ||
      doc.file_name.endsWith('.m4a') ||
      doc.file_name.endsWith('.ogg') ||
      doc.file_name.endsWith('.flac')
    );

    if (isAudioMime || hasAudioExt) {
      let extension = 'mp3';
      if (doc.file_name) {
        const ext = path.extname(doc.file_name).slice(1);
        if (ext) extension = ext;
      }
      await handleAudioFile(msg, doc.file_id, extension);
    }
  }
});

// Listen for text welcome/instruction message
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  if (!ALLOWED_CHAT_IDS.includes(chatId)) {
    await bot.sendMessage(chatId, 'Unauthorized.');
    return;
  }

  // Avoid responding to audio-type media (which are processed by separate event handlers)
  if (msg.voice || msg.audio) return;
  if (msg.document) {
    const doc = msg.document;
    const isAudioMime = doc.mime_type?.startsWith('audio/');
    const hasAudioExt = doc.file_name && (
      doc.file_name.endsWith('.mp3') ||
      doc.file_name.endsWith('.wav') ||
      doc.file_name.endsWith('.m4a') ||
      doc.file_name.endsWith('.ogg') ||
      doc.file_name.endsWith('.flac')
    );
    if (isAudioMime || hasAudioExt) return;
  }

  await bot.sendMessage(
    chatId,
    "👋 Send me a voice note or an audio file (.mp3, .wav, .m4a) and I'll transcribe, summarize, and log it to your prospect pipeline."
  );
});

console.log('🚀 Prospect Pipeline Bot is running...');
