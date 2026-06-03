import Groq, { toFile } from 'groq-sdk';
import fs from 'fs';

const MAX_TRANSCRIPTION_ATTEMPTS = 3;
const TRANSCRIPTION_BASE_DELAY_MS = 1000;
const FALLBACK_TRANSCRIPT = '[Transcription unavailable — Groq API did not respond. Raw audio saved.]';

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY environment variable is not set');
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export async function transcribeAudio(filePath: string): Promise<string> {
  const groq = getGroqClient();

  for (let attempt = 1; attempt <= MAX_TRANSCRIPTION_ATTEMPTS; attempt++) {
    try {
      const transcription = await groq.audio.transcriptions.create({
        file: await toFile(fs.createReadStream(filePath), 'voice.ogg'),
        model: 'whisper-large-v3-turbo',
        response_format: 'text',
        language: 'en',
      });

      const transcriptionVal = transcription as any;
      const text = typeof transcriptionVal === 'string'
        ? transcriptionVal.trim()
        : String(transcriptionVal).trim();

      if (!text) throw new Error('Empty transcription returned');
      return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[whisper] Attempt ${attempt}/${MAX_TRANSCRIPTION_ATTEMPTS} failed: ${message}`);

      if (attempt < MAX_TRANSCRIPTION_ATTEMPTS) {
        const delay = TRANSCRIPTION_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error('[whisper] All transcription attempts exhausted, returning fallback');
  return FALLBACK_TRANSCRIPT;
}
