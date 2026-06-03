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

/** Formats the header row, freezes it, auto-resizes columns, and inserts a row if headers are missing. */
async function ensureSheetHeadersAndFormatting(spreadsheetId: string): Promise<void> {
  const sheets = getSheetsClient();

  // Fetch metadata to obtain numerical sheetId for 'Sheet1'
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === 'Sheet1');
  const sheetId = sheet?.properties?.sheetId ?? 0;

  // Retrieve row 1 values to inspect
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Sheet1!A1:G1',
  });

  const row1 = res.data.values?.[0] || [];
  const expectedHeaders = [
    'Timestamp',
    'Contact Name',
    'Company',
    'Contact Email',
    'Summary',
    'Action Items',
    'Transcript',
  ];

  const matchesHeaders = expectedHeaders.every((h, i) => row1[i] === h);

  if (!matchesHeaders) {
    // If A1 contains a timestamp, date or email, it is a data row. Shift it down.
    const isDataRow =
      row1[0] &&
      (row1[0].includes('T') ||
        row1[0].includes('-') ||
        row1[2]?.includes('@') ||
        row1[3]?.includes('@'));

    if (isDataRow) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: 0,
                  endIndex: 1,
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
      });
    }

    // Write header labels
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:G1',
      valueInputOption: SHEETS_VALUE_INPUT_OPTION,
      requestBody: {
        values: [expectedHeaders],
      },
    });

    // Format header style: bold, white text, deep steel blue bg, frozen row 1
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  frozenRowCount: 1,
                },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
          {
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 7,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: {
                    red: 0.12,
                    green: 0.23,
                    blue: 0.35,
                  },
                  textFormat: {
                    foregroundColor: {
                      red: 1.0,
                      green: 1.0,
                      blue: 1.0,
                    },
                    bold: true,
                    fontSize: 10,
                  },
                  horizontalAlignment: 'LEFT',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
        ],
      },
    });
  }

  // Adjust column widths automatically based on cell content size
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 7,
            },
          },
        },
      ],
    },
  }).catch((err) => console.warn('[sheets] Column auto-resize failed:', err));
}

export async function logToSheet(entry: SheetEntry): Promise<void> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) {
    throw new Error('GOOGLE_SHEET_ID environment variable is not set');
  }

  // Ensure headers exist and formatting is applied
  await ensureSheetHeadersAndFormatting(sheetId);

  const sheets = getSheetsClient();
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
