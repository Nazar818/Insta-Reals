import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useApi } from '../../lib/api';
import type { Page } from '../../types';

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function uniqueItems<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function usePagedResource<T extends { id: string }>(path: string | null) {
  const api = useApi();
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedPath, setLoadedPath] = useState<string | null>(path);
  const generation = useRef(0);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const snapshot = useRef<T[]>([]);

  useEffect(() => {
    snapshot.current = loadedPath === path ? items : [];
  }, [items, loadedPath, path]);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    controller.current?.abort();
    if (!path) {
      busy.current = false; setRefreshing(false); setLoadingMore(false);
      return;
    }
    const requestController = new AbortController();
    controller.current = requestController;
    busy.current = true;
    setRefreshing(true);
    setLoadingMore(false);
    setError(null);
    try {
      const page = await api.get<Page<T>>(path, requestController.signal);
      if (request !== generation.current) return;
      setItems(uniqueItems(page.items));
      setNextCursor(page.nextCursor);
      setLoadedPath(path);
    } catch (cause) {
      if (request === generation.current) { setError(errorText(cause)); setLoadedPath(path); }
    } finally {
      if (request === generation.current) {
        busy.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [api, path]);

  useEffect(() => {
    const request = ++generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    busy.current = Boolean(path);
    if (path) {
      api.get<Page<T>>(path, requestController.signal).then((page) => {
        if (request !== generation.current) return;
        setItems(uniqueItems(page.items)); setNextCursor(page.nextCursor);
        setError(null); setLoadedPath(path);
      }).catch((cause: unknown) => {
        if (request !== generation.current) return;
        setItems([]); setNextCursor(null); setError(errorText(cause)); setLoadedPath(path);
      }).finally(() => {
        if (request !== generation.current) return;
        busy.current = false; setLoading(false); setRefreshing(false); setLoadingMore(false);
      });
    }
    return () => { generation.current += 1; controller.current?.abort(); };
  }, [api, path]);

  const loadMore = useCallback(async () => {
    if (!path || !nextCursor || busy.current) return;
    const request = generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    busy.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const separator = path.includes('?') ? '&' : '?';
      const page = await api.get<Page<T>>(`${path}${separator}cursor=${encodeURIComponent(nextCursor)}`, requestController.signal);
      if (request !== generation.current) return;
      setItems((current) => uniqueItems([...current, ...page.items]));
      setNextCursor(page.nextCursor);
    } catch (cause) {
      if (request === generation.current) setError(errorText(cause));
    } finally {
      if (request === generation.current) { busy.current = false; setLoadingMore(false); }
    }
  }, [api, nextCursor, path]);

  // Poll the front of a live list while preserving older pages the person has
  // explicitly loaded. Walk through new pages until reaching a known item.
  const refreshLatest = useCallback(async () => {
    if (!path || busy.current) return;
    const request = generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    busy.current = true;
    try {
      const known = new Set(snapshot.current.map((item) => item.id));
      const first = await api.get<Page<T>>(path, requestController.signal);
      let page = first;
      let incoming = page.items;
      while (known.size > 0 && page.nextCursor && !page.items.some((item) => known.has(item.id))) {
        if (request !== generation.current) return;
        const separator = path.includes('?') ? '&' : '?';
        page = await api.get<Page<T>>(`${path}${separator}cursor=${encodeURIComponent(page.nextCursor)}`, requestController.signal);
        incoming = [...incoming, ...page.items];
      }
      if (request !== generation.current) return;
      if (known.size === 0) setNextCursor(first.nextCursor);
      setItems((current) => uniqueItems([...incoming, ...current]));
      setLoadedPath(path); setError(null); setLoading(false);
    } catch (cause) {
      if (request === generation.current) setError(errorText(cause));
    } finally {
      if (request === generation.current) busy.current = false;
    }
  }, [api, path]);

  const currentPath = loadedPath === path && path !== null;
  return {
    items: currentPath ? items : [], setItems,
    loading: currentPath ? loading : Boolean(path),
    refreshing: currentPath && refreshing,
    loadingMore: currentPath && loadingMore,
    error: currentPath ? error : null,
    hasMore: currentPath && Boolean(nextCursor), refresh, refreshLatest, loadMore,
  };
}

// Fetch when returning from another screen (for example after editing a profile).
// The resource itself handles the initial mount.
export function useRefreshOnReturn(refresh: () => Promise<void>) {
  const firstFocus = useRef(true);
  const latestRefresh = useRef(refresh);
  useEffect(() => { latestRefresh.current = refresh; }, [refresh]);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    void latestRefresh.current();
  }, []));
}
