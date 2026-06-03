import { google } from 'googleapis';

const SHEETS_RANGE = 'Sheet1!A:G';
const SHEETS_VALUE_INPUT_OPTION = 'USER_ENTERED';

export interface SheetEntry {
  timestamp: string;
  contactName: string;
  companyName: string;
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

  // Check if header row exists
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1:G1',
    });
    if (!res.data.values || res.data.values.length === 0) {
      // Write header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'Sheet1!A1:G1',
        valueInputOption: SHEETS_VALUE_INPUT_OPTION,
        requestBody: {
          values: [[
            'Timestamp',
            'Contact Name',
            'Company',
            'Contact Email',
            'Summary',
            'Action Items',
            'Transcript',
          ]],
        },
      });
    }
  } catch (err) {
    console.warn('[sheets] Header check/write failed (might be permissions or empty sheet):', err);
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: SHEETS_RANGE,
    valueInputOption: SHEETS_VALUE_INPUT_OPTION,
    requestBody: {
      values: [[
        entry.timestamp,
        entry.contactName,
        entry.companyName,
        entry.contactEmail,
        entry.summary,
        entry.actionItems,
        entry.transcript,
      ]],
    },
  });
}
