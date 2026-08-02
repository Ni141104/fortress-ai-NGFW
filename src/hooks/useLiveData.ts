import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveDataState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
  lastUpdated: number | null;
}

/**
 * One polling primitive for every widget: SSR-safe (fetches after mount),
 * pauses while the tab is hidden, and exposes an explicit refresh.
 * Replaces the ~20 duplicated useEffect + setInterval blocks in the reference.
 */
export function useLiveData<T>(
  fetcher: () => T | Promise<T>,
  deps: unknown[] = [],
  intervalMs = 5000,
): LiveDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
      setLastUpdated(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void run();
    if (intervalMs <= 0) return;

    let timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") void run();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      timer = 0;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, ...deps]);

  return { data, isLoading: data === null && error === null, error, refresh: run, lastUpdated };
}
