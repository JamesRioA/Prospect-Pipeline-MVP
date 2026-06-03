import { google } from 'googleapis';

const SHEETS_RANGE = 'Sheet1!A:F';
const SHEETS_VALUE_INPUT_OPTION = 'USER_ENTERED';

export interface SheetEntry {
  timestamp: string;
  contactName: string;
  contactEmail: string;
  summary: string;
  actionItems: string;
  transcript: string;
}

let sheetsClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient(): ReturnType<typeof google.sheets> {
  if (sheetsClient) return sheetsClient;

  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable is not set');
  }

  const credentials = JSON.parse(credentialsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

export async function logToSheet(entry: SheetEntry): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: SHEETS_RANGE,
    valueInputOption: SHEETS_VALUE_INPUT_OPTION,
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
