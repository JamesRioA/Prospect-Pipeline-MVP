'use client';

import { useState, useCallback, useEffect } from 'react';
import { X, Globe, Linkedin, Mail, Briefcase, FileText, Mic, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Contact } from '@/features/contacts/contacts.types';
import EmailDraftPanel from '@/features/email-drafts/components/EmailDraftPanel';
import VoiceLogList from '@/features/voice-logs/components/VoiceLogList';
import CompanyLogo from './CompanyLogo';

interface ContactDetailPanelProps {
  contactId: string | null;
  onClose: () => void;
}

type TabType = 'draft' | 'voice' | 'notes';

export default function ContactDetailPanel({ contactId, onClose }: ContactDetailPanelProps) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('draft');
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const fetchContactDetails = useCallback(async () => {
    if (!contactId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          companies (*),
          contact_sources (*),
          email_statuses (*),
          email_drafts!email_drafts_contact_id_fkey (*),
          voice_logs!voice_logs_contact_id_fkey (
            *,
            action_items (*)
          )
        `)
        .eq('id', contactId)
        .single();

      if (error) throw error;
      setContact(data as Contact);
      setNotes(data.notes || '');
    } catch (err) {
      console.error('[ContactDetailPanel] Fetch details failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    fetchContactDetails();
  }, [contactId, fetchContactDetails]);

  // Subscribe to changes on this specific contact to enable Realtime
  useEffect(() => {
    if (!contactId) return;

    const channel = supabase
      .channel(`contact-detail-${contactId}`)
      .on(
        'postgres_changes',
        { event: '*', filter: `id=eq.${contactId}`, schema: 'public', table: 'contacts' },
        () => {
          fetchContactDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, fetchContactDetails]);

  const handleNotesBlur = async () => {
    if (!contactId || notes === (contact?.notes || '')) return;
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ notes: notes.trim(), updated_at: new Date().toISOString() })
        .eq('id', contactId);

      if (error) throw error;
    } catch (err) {
      console.error('[ContactDetailPanel] Failed to save notes:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  if (!contactId) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-foreground/40 glass-card">
        <Briefcase className="mb-4 h-12 w-12 text-foreground/20 animate-pulse" />
        <h3 className="text-lg font-medium text-foreground/80">No Contact Selected</h3>
        <p className="mt-1 text-sm max-w-xs">Select a contact from the pipeline list to view their profiles, emails, voice notes, and actions.</p>
      </div>
    );
  }

  if (isLoading && !contact) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center glass-card">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        <p className="mt-4 text-sm text-foreground/60">Loading profile details...</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-status-bounced glass-card">
        <X className="mb-4 h-12 w-12 text-status-bounced/50" />
        <h3 className="text-lg font-medium">Error Loading Contact</h3>
        <p className="mt-1 text-sm max-w-xs">The requested profile details could not be retrieved from the database.</p>
      </div>
    );
  }

  const activeDraft = contact.email_drafts?.find((d) => d.is_active) ?? null;
  const draftHistory = contact.email_drafts?.filter((d) => !d.is_active)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) ?? [];

  return (
    <div className="flex h-full flex-col overflow-hidden glass-card animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
            <CompanyLogo
              logoUrl={contact.companies?.logo_url}
              name={contact.companies?.name}
              className="h-8 w-8"
            />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{contact.name}</h3>
            <p className="text-xs text-foreground/55">
              {contact.role ? `${contact.role} @ ` : ''}
              {contact.companies?.name || 'Unknown Company'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-foreground/45 hover:bg-surface-elevated hover:text-foreground transition-colors"
          aria-label="Close details panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Info Quick Bar */}
      <div className="grid grid-cols-2 gap-2 p-5 border-b border-surface-border bg-surface/30">
        <a
          href={`mailto:${contact.email}`}
          className="flex items-center gap-2 rounded-lg p-2 bg-surface hover:bg-surface-elevated border border-surface-border text-xs text-foreground/75 hover:text-foreground transition-colors overflow-hidden text-ellipsis"
        >
          <Mail className="h-3.5 w-3.5 flex-shrink-0 text-foreground/40" />
          <span className="truncate">{contact.email}</span>
        </a>
        {contact.linkedin_url ? (
          <a
            href={contact.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg p-2 bg-surface hover:bg-surface-elevated border border-surface-border text-xs text-foreground/75 hover:text-foreground transition-colors"
          >
            <Linkedin className="h-3.5 w-3.5 flex-shrink-0 text-foreground/40" />
            <span className="truncate">LinkedIn</span>
          </a>
        ) : (
          <div className="flex items-center gap-2 rounded-lg p-2 bg-surface/10 border border-dashed border-surface-border text-xs text-foreground/30">
            <Linkedin className="h-3.5 w-3.5 flex-shrink-0 text-foreground/20" />
            <span className="truncate">No Profile</span>
          </div>
        )}
        {contact.companies?.domain ? (
          <a
            href={`https://${contact.companies.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="col-span-2 flex items-center gap-2 rounded-lg p-2 bg-surface hover:bg-surface-elevated border border-surface-border text-xs text-foreground/75 hover:text-foreground transition-colors"
          >
            <Globe className="h-3.5 w-3.5 text-foreground/40" />
            <span>{contact.companies.domain}</span>
          </a>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-surface-border bg-surface/20">
        <button
          onClick={() => setActiveTab('draft')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'draft'
              ? 'border-brand-500 text-brand-500 bg-brand-500/5'
              : 'border-transparent text-foreground/60 hover:text-foreground hover:bg-surface/30'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Email Draft</span>
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'voice'
              ? 'border-brand-500 text-brand-500 bg-brand-500/5'
              : 'border-transparent text-foreground/60 hover:text-foreground hover:bg-surface/30'
          }`}
        >
          <Mic className="h-4 w-4" />
          <span>Voice Logs</span>
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium border-b-2 transition-all ${
            activeTab === 'notes'
              ? 'border-brand-500 text-brand-500 bg-brand-500/5'
              : 'border-transparent text-foreground/60 hover:text-foreground hover:bg-surface/30'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Notes</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === 'draft' && (
          <EmailDraftPanel
            contactId={contact.id}
            activeDraft={activeDraft}
            draftHistory={draftHistory}
          />
        )}

        {activeTab === 'voice' && (
          <VoiceLogList
            voiceLogs={contact.voice_logs || []}
            onUpdate={fetchContactDetails}
          />
        )}

        {activeTab === 'notes' && (
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-foreground/50">
              <span>Enter custom outreach insights or history</span>
              {isSavingNotes ? (
                <span className="flex items-center gap-1 text-brand-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                </span>
              ) : (
                <span>Auto-saves on blur</span>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="e.g. Met at regional conference. Interested in scaling their outreach. Follow up early Q3."
              className="flex-1 w-full rounded-lg border border-surface-border bg-surface p-4 text-sm text-foreground placeholder:text-foreground/30 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30 resize-none min-h-[250px]"
            />
          </div>
        )}
      </div>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`lucide lucide-loader-2 ${className}`}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
