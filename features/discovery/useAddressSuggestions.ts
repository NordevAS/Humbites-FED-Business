'use client';
import { useEffect, useState } from 'react';
import type { AddressSearchResult } from '@/lib/places/search';
import type { OsmAddressSearchResult } from '@/lib/places/osm-search';

/** Query keys hide stale results immediately; abort also stops obsolete provider work. */
export function useAddressSuggestions(
  query: string,
  enabled: boolean,
  provider: 'kartverket' | 'osm' = 'kartverket',
) {
  const [result, setResult] = useState<{
    query: string;
    value: AddressSearchResult | OsmAddressSearchResult;
  } | null>(null);
  const term = query.trim();
  useEffect(() => {
    if (!enabled || term.length < 3 || term.length > 180) return;
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(async () => {
      const timeout = setTimeout(() => controller.abort(), 9000);
      try {
        const response = await fetch(
          provider === 'osm' ? '/api/places/osm-search' : '/api/places/search',
          {
            method: 'POST',
            credentials: 'same-origin',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: term }),
          },
        );
        const value: AddressSearchResult | OsmAddressSearchResult =
          await response.json();
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
                provider === 'osm'
                  ? 'OpenStreetMap-adressesøket er utilgjengelig. Prøv igjen eller velg et kartpunkt.'
                  : 'Adressesøket er utilgjengelig. Bruk et eksempelsted eller velg et kartpunkt.',
            },
          });
      } finally {
        clearTimeout(timeout);
      }
    }, 500);
    return () => {
      current = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, enabled, provider]);
  const value = enabled && result?.query === term ? result.value : null;
  return {
    suggestions: value?.status === 'ready' ? value.suggestions : [],
    error: value?.status === 'error' ? value.message : '',
    loading: enabled && term.length >= 3 && term.length <= 180 && !value,
  };
}
