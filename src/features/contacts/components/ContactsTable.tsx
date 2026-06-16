'use client';

import { Users, AlertCircle, Loader2 } from 'lucide-react';
import type { Contact } from '@/features/contacts/contacts.types';
import CompanyLogo from './CompanyLogo';

interface ContactsTableProps {
  contacts: Contact[];
  isLoading: boolean;
  error: string | null;
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  onRetry: () => void;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: 'badge-pending',
  draft_generated: 'badge-draft_generated',
  sent: 'badge-sent',
  replied: 'badge-replied',
  bounced: 'badge-bounced',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-5 py-4">
            <div className="h-4 w-32 rounded bg-surface-elevated" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-40 rounded bg-surface-elevated" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-24 rounded bg-surface-elevated" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-20 rounded bg-surface-elevated" />
          </td>
          <td className="px-5 py-4">
            <div className="h-5 w-16 rounded-full bg-surface-elevated" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-16 rounded bg-surface-elevated" />
          </td>
          <td className="px-5 py-4">
            <div className="h-4 w-20 rounded bg-surface-elevated" />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function ContactsTable({
  contacts,
  isLoading,
  error,
  selectedContactId,
  onSelectContact,
  onRetry,
}: ContactsTableProps) {
  /* ── Error state ───────────────────────────────────────── */
  if (error) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-4 p-12 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-sm text-foreground/70">{error}</p>
        <button
          onClick={onRetry}
          className="rounded-lg bg-surface-elevated px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-border"
        >
          Retry
        </button>
      </div>
    );
  }

  /* ── Empty state ───────────────────────────────────────── */
  if (!isLoading && contacts.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center justify-center gap-4 p-16 text-center">
        <div className="rounded-xl bg-surface-elevated p-4">
          <Users className="h-10 w-10 text-foreground/30" />
        </div>
        <h3 className="text-lg font-semibold text-foreground/70">No contacts yet</h3>
        <p className="max-w-xs text-sm text-foreground/40">
          Upload a CSV or add contacts manually to get started with your pipeline.
        </p>
      </div>
    );
  }

  /* ── Table ─────────────────────────────────────────────── */
  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table" aria-label="Contacts table">
          <thead className="border-b border-surface-border bg-surface text-left text-xs uppercase tracking-wider text-foreground/40">
            <tr>
              <th className="px-5 py-3.5 font-medium">Name</th>
              <th className="px-5 py-3.5 font-medium">Email</th>
              <th className="px-5 py-3.5 font-medium">Company</th>
              <th className="px-5 py-3.5 font-medium">Role</th>
              <th className="px-5 py-3.5 font-medium">Status</th>
              <th className="px-5 py-3.5 font-medium">Source</th>
              <th className="px-5 py-3.5 font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border/50">
            {isLoading ? (
              <SkeletonRows />
            ) : (
              contacts.map((contact, index) => {
                const statusName = contact.email_statuses?.name ?? 'pending';
                const isSelected = contact.id === selectedContactId;

                return (
                  <tr
                    key={contact.id}
                    role="row"
                    tabIndex={0}
                    onClick={() => onSelectContact(contact.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSelectContact(contact.id);
                    }}
                    className={`cursor-pointer transition-colors duration-150 animate-slide-up ${
                      isSelected
                        ? 'bg-brand-500/10'
                        : 'hover:bg-surface-elevated/50'
                    }`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-foreground">
                      {contact.name}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground/70">
                      {contact.email}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <CompanyLogo
                          logoUrl={contact.companies?.logo_url}
                          name={contact.companies?.name}
                          className="h-5 w-5"
                        />
                        <span className="text-foreground/70">
                          {contact.companies?.name ?? '—'}
                        </span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground/60">
                      {contact.role ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_BADGE_CLASS[statusName] ?? 'badge-pending'
                        }`}
                      >
                        {statusName.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground/50 text-xs">
                      {contact.contact_sources?.name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground/50 text-xs">
                      {formatDate(contact.created_at)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 border-t border-surface-border py-3 text-xs text-foreground/40">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading contacts…
        </div>
      )}
    </div>
  );
}
