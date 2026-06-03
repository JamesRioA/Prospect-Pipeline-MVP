'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users, Upload, ArrowLeft } from 'lucide-react';
import type { ContactFilters } from '@/features/contacts/contacts.types';
import { useContacts } from '@/features/contacts/hooks/useContacts';
import ContactsTable from '@/features/contacts/components/ContactsTable';
import ContactFiltersComponent from '@/features/contacts/components/ContactFilters';
import ContactDetailPanel from '@/features/contacts/components/ContactDetailPanel';

export default function PipelinePage() {
  const [filters, setFilters] = useState<ContactFilters>({
    search: '',
    sourceId: null,
    emailStatusId: null,
  });

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const { contacts, isLoading, error, refetch } = useContacts(filters);

  const handleSearchChange = (search: string) => {
    setFilters((prev) => ({ ...prev, search }));
  };

  const handleSourceChange = (sourceId: number | null) => {
    setFilters((prev) => ({ ...prev, sourceId }));
  };

  const handleStatusChange = (emailStatusId: number | null) => {
    setFilters((prev) => ({ ...prev, emailStatusId }));
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col selection:bg-brand-500/30 selection:text-white">
      {/* Decorative background blur */}
      <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-brand-glow filter blur-[120px] pointer-events-none opacity-40" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-surface-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface border border-surface-border hover:bg-surface-elevated text-foreground/75 hover:text-foreground transition-all"
              aria-label="Back to home page"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                <Users className="h-4.5 w-4.5" />
              </div>
              <span className="text-md font-bold tracking-tight bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                Pipeline Cockpit
              </span>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg py-2 px-3 border border-surface-border bg-surface hover:bg-surface-elevated text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import Contacts</span>
          </Link>
        </div>
      </header>

      {/* Main Page Layout */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-6 py-8 flex flex-col gap-6 overflow-hidden">
        
        {/* Filters Top Bar */}
        <div className="w-full">
          <ContactFiltersComponent
            search={filters.search}
            sourceId={filters.sourceId}
            emailStatusId={filters.emailStatusId}
            onSearchChange={handleSearchChange}
            onSourceChange={handleSourceChange}
            onStatusChange={handleStatusChange}
          />
        </div>

        {/* Dashboard Split View */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[500px]">
          
          {/* Contacts List Column */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col overflow-x-auto min-w-0">
            <ContactsTable
              contacts={contacts}
              isLoading={isLoading}
              error={error}
              selectedContactId={selectedContactId}
              onSelectContact={setSelectedContactId}
              onRetry={refetch}
            />
          </div>

          {/* Details Sidebar Panel Column */}
          <div className="lg:col-span-5 xl:col-span-4 h-full min-h-[300px] lg:min-h-0 flex flex-col">
            <ContactDetailPanel
              contactId={selectedContactId}
              onClose={() => setSelectedContactId(null)}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
