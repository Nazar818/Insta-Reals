import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../../lib/api';
import type { Message, Page } from '../../types';
import { errorText } from '../social/use-paged-resource';
import { mergeMessages } from './message-order';

export function useMessageThread(id: string | undefined) {
  const api = useApi();
  const path = id ? `/conversations/${encodeURIComponent(id)}/messages` : null;
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(Boolean(path));
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadedPath, setLoadedPath] = useState<string | null>(path);
  const current = useRef<Message[]>([]);
  const cursor = useRef<string | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const merge = useCallback((items: Message[]) => {
    current.current = mergeMessages(items, current.current);
    setMessages(current.current);
  }, []);

  const refresh = useCallback(async () => {
    if (!path || busy.current) return;
    const request = generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    busy.current = true;
    setRefreshing(true);
    try {
      const known = new Set(current.current.map((message) => message.id));
      const first = await api.get<Page<Message>>(path, requestController.signal);
      let page = first;
      let incoming = page.items;
      // If more than one page arrived between polls, fill the gap before
      // merging so an active conversation never silently skips messages.
      while (known.size > 0 && page.nextCursor && !page.items.some((message) => known.has(message.id))) {
        if (request !== generation.current) return;
        page = await api.get<Page<Message>>(`${path}?cursor=${encodeURIComponent(page.nextCursor)}`, requestController.signal);
        incoming = [...incoming, ...page.items];
      }
      if (request !== generation.current) return;
      if (!current.current.length) cursor.current = first.nextCursor;
      merge(incoming);
      setLoadedPath(path);
      setHasMore(Boolean(cursor.current));
      setError(null);
    } catch (cause) {
      if (request === generation.current) { setError(errorText(cause)); setLoadedPath(path); }
    } finally {
      if (request === generation.current) { busy.current = false; setLoading(false); setRefreshing(false); }
    }
  }, [api, merge, path]);

  useEffect(() => {
    const request = ++generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    current.current = []; cursor.current = null; busy.current = Boolean(path);
    if (path) {
      api.get<Page<Message>>(path, requestController.signal).then((page) => {
        if (request !== generation.current) return;
        merge(page.items); cursor.current = page.nextCursor;
        setHasMore(Boolean(page.nextCursor)); setError(null); setLoadedPath(path);
      }).catch((cause: unknown) => {
        if (request !== generation.current) return;
        setMessages([]); setHasMore(false); setError(errorText(cause)); setLoadedPath(path);
      }).finally(() => {
        if (request !== generation.current) return;
        busy.current = false; setLoading(false); setRefreshing(false); setLoadingMore(false);
      });
    }
    return () => { generation.current += 1; controller.current?.abort(); };
  }, [api, merge, path]);

  const loadMore = useCallback(async () => {
    if (!path || !cursor.current || busy.current) return;
    const request = generation.current;
    const requestController = new AbortController();
    controller.current = requestController;
    busy.current = true; setLoadingMore(true);
    try {
      const page = await api.get<Page<Message>>(`${path}?cursor=${encodeURIComponent(cursor.current)}`, requestController.signal);
      if (request !== generation.current) return;
      merge(page.items);
      cursor.current = page.nextCursor;
      setHasMore(Boolean(page.nextCursor)); setError(null);
    } catch (cause) { if (request === generation.current) setError(errorText(cause)); }
    finally { if (request === generation.current) { busy.current = false; setLoadingMore(false); } }
  }, [api, merge, path]);

  const currentPath = loadedPath === path && path !== null;
  return {
    messages: currentPath ? messages : [], addMessage: (message: Message) => merge([message]),
    loading: currentPath ? loading : Boolean(path), refreshing: currentPath && refreshing,
    loadingMore: currentPath && loadingMore, hasMore: currentPath && hasMore,
    error: currentPath ? error : null, refresh, loadMore,
  };
}
