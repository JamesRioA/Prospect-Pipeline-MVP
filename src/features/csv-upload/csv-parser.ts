import Papa from 'papaparse';

export interface ContactRow {
  name: string;
  email: string;
  company?: string;
  role?: string;
  linkedin_url?: string;
  [key: string]: string | undefined;
}

const REQUIRED_FIELDS = ['name', 'email'] as const;

export interface ParseResult {
  rows: ContactRow[];
  errors: string[];
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, '_'),
      complete: (results) => {
        const errors: string[] = [];
        const rows: ContactRow[] = [];

        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i] as Record<string, string>;
          const missingFields = REQUIRED_FIELDS.filter((field) => !row[field]?.trim());

          if (missingFields.length > 0) {
            errors.push(`Row ${i + 1}: missing ${missingFields.join(', ')}`);
            continue;
          }

          rows.push({
            name: row.name.trim(),
            email: row.email.trim().toLowerCase(),
            company: row.company?.trim() || undefined,
            role: row.role?.trim() || undefined,
            linkedin_url: row.linkedin_url?.trim() || undefined,
          });
        }

        resolve({ rows, errors });
      },
      error: (err) => {
        resolve({ rows: [], errors: [err.message] });
      },
    });
  });
}
