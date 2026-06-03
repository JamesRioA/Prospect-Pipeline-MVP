'use client';

import { Search, Filter } from 'lucide-react';

interface ContactFiltersProps {
  search: string;
  sourceId: number | null;
  emailStatusId: number | null;
  onSearchChange: (value: string) => void;
  onSourceChange: (value: number | null) => void;
  onStatusChange: (value: number | null) => void;
}

const SOURCE_OPTIONS = [
  { label: 'All Sources', value: null },
  { label: 'CSV Import', value: 1 },
  { label: 'Manual', value: 2 },
  { label: 'Telegram Bot', value: 3 },
  { label: 'API', value: 4 },
] as const;

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: null },
  { label: 'Pending', value: 1 },
  { label: 'Draft Generated', value: 2 },
  { label: 'Sent', value: 3 },
  { label: 'Replied', value: 4 },
  { label: 'Bounced', value: 5 },
] as const;

export default function ContactFilters({
  search,
  sourceId,
  emailStatusId,
  onSearchChange,
  onSourceChange,
  onStatusChange,
}: ContactFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center" role="search" aria-label="Filter contacts">
      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/30" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name or email…"
          aria-label="Search contacts"
          className="w-full rounded-lg border border-surface-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-foreground/30 transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
        />
      </div>

      {/* Source filter */}
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30 pointer-events-none" />
        <select
          value={sourceId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onSourceChange(val === '' ? null : Number(val));
          }}
          aria-label="Filter by source"
          className="appearance-none rounded-lg border border-surface-border bg-surface py-2.5 pl-9 pr-8 text-sm text-foreground transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={String(opt.value)} value={opt.value ?? ''}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status filter */}
      <div className="relative">
        <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground/30 pointer-events-none" />
        <select
          value={emailStatusId ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            onStatusChange(val === '' ? null : Number(val));
          }}
          aria-label="Filter by status"
          className="appearance-none rounded-lg border border-surface-border bg-surface py-2.5 pl-9 pr-8 text-sm text-foreground transition-colors focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={String(opt.value)} value={opt.value ?? ''}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
