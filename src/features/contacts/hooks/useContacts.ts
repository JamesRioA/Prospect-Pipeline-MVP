'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Contact, ContactFilters } from '@/features/contacts/contacts.types';

const CONTACTS_SELECT = `
  *,
  companies (*),
  contact_sources (*),
  email_statuses (*),
  email_drafts!email_drafts_contact_id_fkey (*),
  voice_logs!voice_logs_contact_id_fkey (
    *,
    action_items (*)
  )
` as const;

interface UseContactsReturn {
  contacts: Contact[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useContacts(filters: ContactFilters): UseContactsReturn {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('contacts')
        .select(CONTACTS_SELECT)
        .order('created_at', { ascending: false });

      if (filters.sourceId !== null) {
        query = query.eq('source_id', filters.sourceId);
      }

      if (filters.emailStatusId !== null) {
        query = query.eq('email_status_id', filters.emailStatusId);
      }

      if (filters.search.trim().length > 0) {
        const term = `%${filters.search.trim()}%`;
        query = query.or(`name.ilike.${term},email.ilike.${term}`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      /* Filter email_drafts to only active ones client-side
         (PostgREST embedded filters don't support filtering on FK joins easily) */
      const enriched = (data as Contact[]).map((contact) => ({
        ...contact,
        email_drafts: contact.email_drafts?.filter((d) => d.is_active) ?? [],
      }));

      setContacts(enriched);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch contacts';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters.sourceId, filters.emailStatusId, filters.search]);

  /* Initial fetch and re-fetch on filter change */
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  /* Realtime subscription */
  useEffect(() => {
    const channel = supabase
      .channel('contacts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          fetchContacts();
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchContacts]);

  return { contacts, isLoading, error, refetch: fetchContacts };
}
