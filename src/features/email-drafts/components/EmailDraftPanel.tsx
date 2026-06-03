'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Loader2,
  Copy,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import type { EmailDraft } from '@/features/contacts/contacts.types';

interface EmailDraftPanelProps {
  contactId: string;
  activeDraft: EmailDraft | null;
  draftHistory: EmailDraft[];
}

export default function EmailDraftPanel({
  contactId,
  activeDraft,
  draftHistory,
}: EmailDraftPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentDraft, setCurrentDraft] = useState<EmailDraft | null>(activeDraft);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Sync when parent re-renders with new data */
  useEffect(() => {
    setCurrentDraft(activeDraft);
  }, [activeDraft]);

  /* Cleanup copy timeout */
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const res = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Generation failed' }));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const { draft } = await res.json();
      setCurrentDraft(draft as EmailDraft);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [contactId]);

  const handleCopy = useCallback(async () => {
    if (!currentDraft) return;
    await navigator.clipboard.writeText(currentDraft.body);
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  }, [currentDraft]);

  const sourceBadgeColor: Record<string, string> = {
    gemini: 'bg-blue-500/15 text-blue-400',
    groq: 'bg-purple-500/15 text-purple-400',
    fallback: 'bg-yellow-500/15 text-yellow-400',
  };

  /* ── Empty state ───────────────────────────────────────── */
  if (!currentDraft && !isGenerating) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Sparkles className="h-8 w-8 text-foreground/20" />
        <p className="text-sm text-foreground/50">No email draft generated yet.</p>
        <button
          onClick={handleGenerate}
          className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-400"
        >
          Generate Draft
        </button>
        {generationError && (
          <p className="mt-2 text-xs text-red-400">{generationError}</p>
        )}
      </div>
    );
  }

  /* ── Loading state ─────────────────────────────────────── */
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
        <p className="text-sm text-foreground/50">Generating personalized draft…</p>
      </div>
    );
  }

  /* ── Draft view ────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Active draft */}
      <div className="rounded-lg border border-surface-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              sourceBadgeColor[currentDraft?.generation_source ?? 'fallback'] ??
              sourceBadgeColor.fallback
            }`}
          >
            {currentDraft?.generation_source ?? 'unknown'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              aria-label="Copy draft to clipboard"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-foreground/50 transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              aria-label="Regenerate draft"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-foreground/50 transition-colors hover:bg-surface-elevated hover:text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
          {currentDraft?.body}
        </p>
      </div>

      {generationError && (
        <p className="text-xs text-red-400">{generationError}</p>
      )}

      {/* Draft history */}
      {draftHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-foreground/40 transition-colors hover:text-foreground/60"
          >
            {showHistory ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {draftHistory.length} previous draft{draftHistory.length > 1 ? 's' : ''}
          </button>

          {showHistory && (
            <div className="mt-3 space-y-3">
              {draftHistory.map((draft) => (
                <div
                  key={draft.id}
                  className="rounded-lg border border-surface-border/50 bg-surface/50 p-3 opacity-60"
                >
                  <div className="mb-2 flex items-center justify-between text-xs text-foreground/40">
                    <span>{draft.generation_source}</span>
                    <span>
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(draft.created_at))}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/50">
                    {draft.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
