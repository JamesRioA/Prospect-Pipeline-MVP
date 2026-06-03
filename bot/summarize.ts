import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GROQ_FALLBACK_MODEL = 'llama-3.3-70b-versatile';
const MAX_SUMMARY_TOKENS = 300;
const MAX_FALLBACK_SUMMARY_LENGTH = 150;

export interface SummaryResult {
  summary: string;
  actionItems: string[];
  extractedContact?: {
    name: string | null;
    company: string | null;
  } | null;
  source: 'gemini' | 'groq' | 'fallback';
}

function buildSummaryPrompt(transcript: string): string {
  return `Summarize this voice note in 1-2 sentences, extract action items as a list, and extract the primary contact name (prospect) and company name mentioned (if any).
Transcript: "${transcript}"
Respond ONLY in raw JSON, no markdown, no backticks:
{
  "summary": "...",
  "actionItems": ["..."],
  "extractedContact": {
    "name": "Full name or null",
    "company": "Company name or null"
  }
}`;
}

/** Strip markdown code fences that LLMs sometimes add despite instructions */
function parseJsonResponse(text: string): {
  summary: string;
  actionItems: string[];
  extractedContact?: { name: string | null; company: string | null } | null;
} {
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

export async function summarizeTranscript(transcript: string): Promise<SummaryResult> {
  const prompt = buildSummaryPrompt(transcript);

  // Primary: Gemini
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = parseJsonResponse(text);

    return {
      summary: parsed.summary,
      actionItems: parsed.actionItems,
      extractedContact: parsed.extractedContact ?? null,
      source: 'gemini',
    };
  } catch (geminiError) {
    const message = geminiError instanceof Error ? geminiError.message : String(geminiError);
    console.warn(`[summarize] Gemini failed: ${message}, falling back to Groq LLaMA`);
  }

  // Fallback: Groq LLaMA
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: GROQ_FALLBACK_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: MAX_SUMMARY_TOKENS,
    });

    const text = completion.choices[0]?.message?.content ?? '';
    if (!text) throw new Error('Empty Groq response');

    const parsed = parseJsonResponse(text);
    return {
      summary: parsed.summary,
      actionItems: parsed.actionItems,
      extractedContact: parsed.extractedContact ?? null,
      source: 'groq',
    };
  } catch (groqError) {
    const message = groqError instanceof Error ? groqError.message : String(groqError);
    console.error(`[summarize] Both Gemini and Groq failed: ${message}`);
  }

  // Final fallback: truncated transcript
  const truncated = transcript.length > MAX_FALLBACK_SUMMARY_LENGTH
    ? transcript.slice(0, MAX_FALLBACK_SUMMARY_LENGTH) + '...'
    : transcript;

  return {
    summary: truncated,
    actionItems: [],
    extractedContact: null,
    source: 'fallback',
  };
}
