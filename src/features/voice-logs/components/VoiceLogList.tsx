'use client';

import { useState } from 'react';
import { Mic, ChevronDown, ChevronUp, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { VoiceLog } from '@/features/contacts/contacts.types';

interface VoiceLogListProps {
  voiceLogs: VoiceLog[];
  onUpdate: () => void;
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function VoiceLogList({ voiceLogs, onUpdate }: VoiceLogListProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const handleActionToggle = async (itemId: string, currentCompleted: boolean) => {
    try {
      const { error } = await supabase
        .from('action_items')
        .update({
          is_completed: !currentCompleted,
          completed_at: !currentCompleted ? new Date().toISOString() : null,
        })
        .eq('id', itemId);

      if (error) throw error;
      onUpdate();
    } catch (err) {
      console.error('[VoiceLogList] Failed to toggle action item:', err);
    }
  };

  if (!voiceLogs || voiceLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-foreground/40 border border-dashed border-surface-border rounded-xl bg-surface/10">
        <Mic className="mb-2.5 h-7 w-7 text-foreground/20" />
        <h4 className="text-sm font-semibold text-foreground/80">No Voice Notes Yet</h4>
        <p className="mt-1 text-xs max-w-[200px]">Send a voice note to the Telegram bot to log call summaries & action items.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-4 border-l border-surface-border space-y-6">
      {voiceLogs.map((log) => {
        const isExpanded = expandedLogId === log.id;
        const actionItems = log.action_items || [];
        const completedCount = actionItems.filter((item) => item.is_completed).length;

        return (
          <div key={log.id} className="relative group">
            {/* Timeline node marker */}
            <div className="absolute -left-[21px] top-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-brand-500 ring-4 ring-background" />

            {/* Voice Log Card */}
            <div className="rounded-xl border border-surface-border bg-surface/40 hover:bg-surface/60 transition-colors p-4 space-y-3">
              {/* Header metadata */}
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-foreground/45">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatRelativeTime(log.created_at)}
                </span>
                <div className="flex items-center gap-1.5">
                  {log.transcription_source && (
                    <span className="px-1.5 py-0.5 rounded bg-surface-elevated text-[10px] text-foreground/50 border border-surface-border font-medium">
                      {log.transcription_source.toUpperCase()}
                    </span>
                  )}
                  {log.summary_source && (
                    <span className="px-1.5 py-0.5 rounded bg-brand-500/10 text-[10px] text-brand-400 border border-brand-500/20 font-medium">
                      {log.summary_source.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Summary text */}
              <p className="text-sm text-foreground/90 font-medium leading-relaxed">
                {log.summary}
              </p>

              {/* Action items list */}
              {actionItems.length > 0 && (
                <div className="pt-2 border-t border-surface-border space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-foreground/45 font-medium">
                    <span>ACTION ITEMS</span>
                    <span>{completedCount}/{actionItems.length} completed</span>
                  </div>
                  <ul className="space-y-1.5">
                    {actionItems.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={item.is_completed}
                          onChange={() => handleActionToggle(item.id, item.is_completed)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-surface-border bg-surface text-brand-500 focus:ring-brand-500/30"
                        />
                        <span className={`text-xs text-foreground/80 leading-tight transition-all ${
                          item.is_completed ? 'line-through text-foreground/35' : ''
                        }`}>
                          {item.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Transcript toggle */}
              <div className="pt-1">
                <button
                  onClick={() => toggleExpand(log.id)}
                  className="flex items-center gap-1 text-[11px] text-brand-400 hover:text-brand-300 font-medium transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Hide Transcript
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> View Full Transcript
                    </>
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-2.5 rounded-lg bg-surface/60 border border-surface-border/50 p-3 text-xs text-foreground/60 leading-relaxed italic whitespace-pre-line animate-fade-in">
                    &ldquo;{log.transcript}&rdquo;
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
