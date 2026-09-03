import { useEffect, useState } from 'react';

const BASE = import.meta.env.BASE_URL || '/';

const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

async function fetchJson<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;
  const p = fetch(`${BASE}data/${path}`)
    .then(r => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    })
    .then(data => {
      cache.set(path, data);
      inflight.delete(path);
      return data;
    })
    .catch(err => {
      inflight.delete(path);
      throw err;
    });
  inflight.set(path, p);
  return p;
}

export interface UseJsonResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useJson<T>(path: string): UseJsonResult<T> {
  const [state, setState] = useState<UseJsonResult<T>>(() => {
    const cached = cache.get(path);
    return cached !== undefined
      ? { data: cached as T, error: null, loading: false }
      : { data: null, error: null, loading: true };
  });

  useEffect(() => {
    let cancelled = false;
    setState(prev => (prev.data ? prev : { data: null, error: null, loading: true }));
    fetchJson<T>(path)
      .then(data => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch(error => {
        if (!cancelled) setState({ data: null, error, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return state;
}
