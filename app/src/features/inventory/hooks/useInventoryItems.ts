import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  InventoryItem,
  InventoryRepository,
} from '../data/InventoryRepository';

export const SEARCH_DEBOUNCE_MS = 150;

export interface InventoryItemsState {
  query: string;
  setQuery: (query: string) => void;
  items: InventoryItem[];
  /** True until the first load completes. */
  loading: boolean;
  /** Reloads with the current search; resolves to the items, or null if it failed. */
  refresh: () => Promise<InventoryItem[] | null>;
}

/**
 * Items for the inventory list, filtered by a debounced search. Responses that arrive
 * after a newer request has started are dropped, so fast typing never shows stale
 * results. Failures are fatal and handled by the guarded repository, so they are only
 * swallowed here.
 */
export function useInventoryItems(
  repository: InventoryRepository,
): InventoryItemsState {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const latestRequest = useRef(0);
  const typedQuery = useRef(query);
  typedQuery.current = query;

  const load = useCallback(
    async (search: string): Promise<InventoryItem[] | null> => {
      const request = ++latestRequest.current;
      try {
        const result = await repository.listItems(search);
        if (request === latestRequest.current) {
          setItems(result);
          setLoading(false);
        }
        return result;
      } catch {
        return null;
      }
    },
    [repository],
  );

  // Every change of the search reloads: clearing it at once, typing after a pause.
  useEffect(() => {
    if (query.trim() === '') {
      load(query);
      return;
    }
    const timer = setTimeout(() => load(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, load]);

  // Uses the search as typed, even if its debounced load hasn't run yet.
  const refresh = useCallback(() => load(typedQuery.current), [load]);

  return { query, setQuery, items, loading, refresh };
}
