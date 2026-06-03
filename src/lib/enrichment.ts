import { withRetry } from './retry';

const CLEARBIT_AUTOCOMPLETE_URL = 'https://autocomplete.clearbit.com/v1/companies/suggest';
const CLEARBIT_TIMEOUT_MS = 3000;
const CLEARBIT_MAX_ATTEMPTS = 2;
const CLEARBIT_BASE_DELAY_MS = 500;

export interface EnrichmentResult {
  domain: string | null;
  logoUrl: string | null;
  source: 'clearbit' | 'fallback';
}

function buildFallbackDomain(companyName: string): string | null {
  if (!companyName) return null;
  return `${companyName.toLowerCase().replace(/\s+/g, '')}.com`;
}

export async function enrichCompany(companyName: string): Promise<EnrichmentResult> {
  if (!companyName || companyName.trim().length === 0) {
    return { domain: null, logoUrl: null, source: 'fallback' };
  }

  return withRetry<EnrichmentResult>(
    async () => {
      const url = `${CLEARBIT_AUTOCOMPLETE_URL}?query=${encodeURIComponent(companyName)}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(CLEARBIT_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Clearbit responded with ${response.status}`);
      }

      const suggestions = await response.json();

      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error('No Clearbit suggestions returned');
      }

      return {
        domain: suggestions[0].domain ?? null,
        logoUrl: suggestions[0].logo ?? null,
        source: 'clearbit' as const,
      };
    },
    {
      domain: buildFallbackDomain(companyName),
      logoUrl: null,
      source: 'fallback' as const,
    },
    {
      maxAttempts: CLEARBIT_MAX_ATTEMPTS,
      baseDelayMs: CLEARBIT_BASE_DELAY_MS,
    }
  );
}
