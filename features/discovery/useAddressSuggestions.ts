'use client';
import { useEffect, useState } from 'react';
import type { AddressSearchResult } from '@/lib/places/search';

/** Query keys hide stale results immediately; abort also stops obsolete provider work. */
export function useAddressSuggestions(query: string, enabled: boolean) {
  const [result, setResult] = useState<{
    query: string;
    value: AddressSearchResult;
  } | null>(null);
  const term = query.trim();
  useEffect(() => {
    if (!enabled || term.length < 3 || term.length > 180) return;
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(async () => {
      const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const response = await fetch('/api/places/search', {
          method: 'POST',
          credentials: 'same-origin',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: term }),
        });
        const value: AddressSearchResult = await response.json();
        if (!response.ok && value.status !== 'error')
          throw new Error('Search failed');
        if (current) setResult({ query: term, value });
      } catch {
        if (current)
          setResult({
            query: term,
            value: {
              status: 'error',
              message:
                'Adressesøket er utilgjengelig. Bruk et eksempelsted eller velg et kartpunkt.',
            },
          });
      } finally {
        clearTimeout(timeout);
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, enabled]);
  const value = enabled && result?.query === term ? result.value : null;
  return {
    suggestions: value?.status === 'ready' ? value.suggestions : [],
    error: value?.status === 'error' ? value.message : '',
    loading: enabled && term.length >= 3 && term.length <= 180 && !value,
  };
}
