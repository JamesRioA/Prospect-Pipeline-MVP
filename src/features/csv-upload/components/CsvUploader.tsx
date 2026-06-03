'use client';

import { useCallback, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseCSV, type ContactRow, type ParseResult } from '@/features/csv-upload/csv-parser';
import type { ContactInsertPayload } from '@/features/contacts/contacts.types';

type Stage = 'idle' | 'preview' | 'importing' | 'done' | 'error';

const CSV_IMPORT_SOURCE_ID = 1;

export default function CsvUploader() {
  const [stage, setStage] = useState<Stage>('idle');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── File handling ─────────────────────────────────────── */

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setStage('error');
      setImportMessage('Please upload a .csv file');
      return;
    }

    const result = await parseCSV(file);
    setParseResult(result);

    if (result.rows.length === 0) {
      setStage('error');
      setImportMessage(result.errors[0] ?? 'No valid rows found');
      return;
    }

    setStage('preview');
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  /* ── Import logic ──────────────────────────────────────── */

  const handleImport = useCallback(async () => {
    if (!parseResult) return;

    setStage('importing');
    setProgress(0);

    try {
      const rows = parseResult.rows;
      const totalSteps = rows.length;

      /* 1. Resolve unique companies → upsert & build a name→id map */
      const companyNames = rows
        .map((r) => r.company)
        .filter((val, idx, self) => val && self.indexOf(val) === idx) as string[];
      const companyMap = new Map<string, string>();

      for (const name of companyNames) {
        const { data: existing } = await supabase
          .from('companies')
          .select('id')
          .eq('name', name)
          .maybeSingle();

        if (existing) {
          companyMap.set(name, existing.id as string);
        } else {
          const { data: created, error } = await supabase
            .from('companies')
            .insert({ name })
            .select('id')
            .single();

          if (error) throw new Error(`Failed to create company "${name}": ${error.message}`);
          companyMap.set(name, created.id as string);
        }
      }

      /* 2. Insert contacts in batches of 50 */
      const BATCH_SIZE = 50;
      let imported = 0;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);

        const payloads: ContactInsertPayload[] = batch.map((row: ContactRow) => ({
          name: row.name,
          email: row.email,
          company_id: row.company ? companyMap.get(row.company) ?? null : null,
          role: row.role ?? null,
          linkedin_url: row.linkedin_url ?? null,
          source_id: CSV_IMPORT_SOURCE_ID,
        }));

        const { error } = await supabase.from('contacts').insert(payloads);
        if (error) throw new Error(`Batch insert failed: ${error.message}`);

        imported += batch.length;
        setProgress(Math.round((imported / totalSteps) * 100));
      }

      setStage('done');
      setImportMessage(`Successfully imported ${imported} contacts`);
    } catch (err) {
      setStage('error');
      setImportMessage(err instanceof Error ? err.message : 'Import failed');
    }
  }, [parseResult]);

  const reset = useCallback(() => {
    setStage('idle');
    setParseResult(null);
    setProgress(0);
    setImportMessage('');
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  /* ── Render ────────────────────────────────────────────── */

  if (stage === 'done') {
    return (
      <div className="glass-card p-8 text-center animate-fade-in">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-400" />
        <h3 className="text-lg font-semibold text-foreground">{importMessage}</h3>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-400"
        >
          Upload Another
        </button>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="glass-card p-8 text-center animate-fade-in">
        <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
        <h3 className="text-lg font-semibold text-foreground">Import Failed</h3>
        <p className="mt-2 text-sm text-foreground/60">{importMessage}</p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-surface-elevated px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-border"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (stage === 'importing') {
    return (
      <div className="glass-card p-8 text-center animate-fade-in">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-brand-400" />
        <h3 className="text-lg font-semibold text-foreground">Importing contacts…</h3>
        <div className="mx-auto mt-6 h-2 w-full max-w-md overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-brand-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-foreground/50">{progress}% complete</p>
      </div>
    );
  }

  if (stage === 'preview' && parseResult) {
    return (
      <div className="glass-card overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-6 py-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="h-5 w-5 text-brand-400" />
            <span className="font-medium text-foreground">
              {parseResult.rows.length} contacts ready
            </span>
          </div>
          <button
            onClick={reset}
            aria-label="Close preview"
            className="rounded-md p-1.5 text-foreground/40 transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Parse errors */}
        {parseResult.errors.length > 0 && (
          <div className="border-b border-surface-border bg-red-500/5 px-6 py-3">
            <p className="text-xs font-medium text-red-400">
              {parseResult.errors.length} row(s) skipped:
            </p>
            <ul className="mt-1 max-h-24 overflow-y-auto text-xs text-red-300/70">
              {parseResult.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preview table */}
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm" role="table">
            <thead className="sticky top-0 bg-surface text-left text-xs uppercase text-foreground/40">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {parseResult.rows.slice(0, 100).map((row, i) => (
                <tr key={i} className="text-foreground/80">
                  <td className="whitespace-nowrap px-6 py-2.5">{row.name}</td>
                  <td className="whitespace-nowrap px-6 py-2.5">{row.email}</td>
                  <td className="whitespace-nowrap px-6 py-2.5">{row.company ?? '—'}</td>
                  <td className="whitespace-nowrap px-6 py-2.5">{row.role ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {parseResult.rows.length > 100 && (
            <p className="px-6 py-2 text-xs text-foreground/40">
              Showing first 100 of {parseResult.rows.length} rows
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-surface-border px-6 py-4">
          <button
            onClick={reset}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-foreground/60 transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-400"
          >
            Import {parseResult.rows.length} Contacts
          </button>
        </div>
      </div>
    );
  }

  /* ── Idle: drop zone ───────────────────────────────────── */
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload CSV file"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
      }}
      className={`glass-card flex cursor-pointer flex-col items-center justify-center gap-4 border-2 border-dashed p-12 transition-all duration-200 ${
        isDragOver
          ? 'border-brand-400 bg-brand-500/5 shadow-[0_0_30px_var(--brand-glow)]'
          : 'border-surface-border hover:border-foreground/20'
      }`}
    >
      <div
        className={`rounded-xl bg-surface-elevated p-4 transition-transform duration-200 ${
          isDragOver ? 'scale-110' : ''
        }`}
      >
        <Upload className="h-8 w-8 text-brand-400" />
      </div>
      <div className="text-center">
        <p className="font-medium text-foreground">
          Drop your CSV here or <span className="text-brand-400">browse</span>
        </p>
        <p className="mt-1 text-sm text-foreground/40">
          Required columns: name, email · Optional: company, role, linkedin_url
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={onInputChange}
        aria-hidden="true"
      />
    </div>
  );
}
