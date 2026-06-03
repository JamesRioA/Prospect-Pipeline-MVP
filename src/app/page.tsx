'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, Users, FileText, Mic, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CsvUploader from '@/features/csv-upload/components/CsvUploader';

interface PipelineStats {
  contactsCount: number;
  draftsCount: number;
  voiceLogsCount: number;
}

interface RecentContact {
  id: string;
  name: string;
  email: string;
  created_at: string;
  companies?: { name: string } | null;
}

export default function Home() {
  const [stats, setStats] = useState<PipelineStats>({
    contactsCount: 0,
    draftsCount: 0,
    voiceLogsCount: 0,
  });
  const [recentContacts, setRecentContacts] = useState<RecentContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const [contactsRes, draftsRes, voiceRes] = await Promise.all([
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('email_drafts').select('*', { count: 'exact', head: true }),
        supabase.from('voice_logs').select('*', { count: 'exact', head: true }),
      ]);

      // Fetch recent 5 imports
      const { data: recentData } = await supabase
        .from('contacts')
        .select('id, name, email, created_at, companies(name)')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        contactsCount: contactsRes.count || 0,
        draftsCount: draftsRes.count || 0,
        voiceLogsCount: voiceRes.count || 0,
      });

      setRecentContacts((recentData as unknown as RecentContact[]) || []);
    } catch (err) {
      console.error('[LandingPage] Failed to fetch stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Set up Realtime listener to update stats when new contacts are added
    const contactsChannel = supabase
      .channel('landing-stats-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contacts' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contactsChannel);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-background overflow-hidden selection:bg-brand-500/30 selection:text-white">
      {/* Background Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] h-[600px] w-[600px] rounded-full bg-brand-glow filter blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-brand-glow filter blur-[120px] pointer-events-none opacity-50" />
      
      {/* Subtle Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-surface-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-transparent">
              Prospect Pipeline
            </span>
          </div>
          <Link
            href="/pipeline"
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Open Pipeline</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        
        {/* Left Hero & Uploader Column */}
        <div className="lg:col-span-7 flex flex-col justify-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
              Accelerate outreach,{' '}
              <span className="bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 bg-clip-text text-transparent">
                automated in seconds
              </span>
            </h1>
            <p className="text-base text-foreground/60 max-w-xl leading-relaxed">
              Upload contact lists, enrich company profiles automatically, generate personalized AI draft campaigns, and sync voice call logs in one unified lead management cockpit.
            </p>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-surface-border bg-surface/30 p-4 transition-colors hover:bg-surface/50">
              <div className="text-foreground/45 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                <Users className="h-3.5 w-3.5 text-brand-500" />
                <span>Contacts</span>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-foreground">
                {isLoading ? '—' : stats.contactsCount}
              </div>
            </div>
            
            <div className="rounded-xl border border-surface-border bg-surface/30 p-4 transition-colors hover:bg-surface/50">
              <div className="text-foreground/45 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                <FileText className="h-3.5 w-3.5 text-status-generated" />
                <span>AI Drafts</span>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-foreground">
                {isLoading ? '—' : stats.draftsCount}
              </div>
            </div>

            <div className="rounded-xl border border-surface-border bg-surface/30 p-4 transition-colors hover:bg-surface/50">
              <div className="text-foreground/45 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
                <Mic className="h-3.5 w-3.5 text-status-pending" />
                <span>Voice Logs</span>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-foreground">
                {isLoading ? '—' : stats.voiceLogsCount}
              </div>
            </div>
          </div>

          {/* CSV Uploader Zone */}
          <div className="pt-2">
            <CsvUploader />
          </div>
        </div>

        {/* Right Recent Activity Sidebar Column */}
        <div className="lg:col-span-5 flex flex-col justify-start">
          <div className="rounded-xl border border-surface-border bg-surface/40 backdrop-blur-md p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-brand-500" />
                <span>Recent Imports</span>
              </h2>
              <p className="text-xs text-foreground/45 mt-0.5">Realtime additions from CSV and Telegram Bot</p>
            </div>

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-9 w-9 rounded-full bg-surface-elevated" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3.5 w-24 rounded bg-surface-elevated" />
                      <div className="h-3 w-40 rounded bg-surface-elevated" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-foreground/30">
                <Users className="h-10 w-10 text-foreground/15 mb-3" />
                <p className="text-xs font-semibold">No contacts imported yet</p>
                <p className="text-[11px] max-w-xs mt-1">Drag a CSV list to the uploader area to populate the pipeline.</p>
              </div>
            ) : (
              <div className="flow-root">
                <ul className="-my-5 divide-y divide-surface-border">
                  {recentContacts.map((contact) => (
                    <li key={contact.id} className="py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/10 text-brand-500 text-xs font-bold">
                            {contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-foreground">
                            {contact.name}
                          </p>
                          <p className="truncate text-[11px] text-foreground/45 mt-0.5">
                            {contact.companies?.name ? `${contact.companies.name} • ` : ''}
                            {contact.email}
                          </p>
                        </div>
                        <div className="inline-flex items-center text-[10px] text-foreground/45 font-mono">
                          {new Date(contact.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 border-t border-surface-border">
              <Link
                href="/pipeline"
                className="flex items-center justify-center gap-1.5 rounded-lg py-2.5 bg-surface-elevated hover:bg-surface-border border border-surface-border text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors w-full"
              >
                <span>View Full Pipeline Board</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
