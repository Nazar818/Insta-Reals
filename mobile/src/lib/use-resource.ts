import { useCallback, useEffect, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { useApi, errorMessage } from './api';

export function useResource<T>(path: string | null) {
  const api = useApi();
  const [resource, setResource] = useState({ api, path, data: null as T | null, loading: Boolean(path), error: null as string | null });
  const currentRequest = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const resourceIdentity = useRef({ api, path });
  useEffect(() => { resourceIdentity.current = { api, path }; }, [api, path]);

  const fetchResource = useCallback(async (controller: AbortController, request: number) => {
    if (path === null) return;
    try {
      const data = await api.get<T>(path, controller.signal);
      if (!controller.signal.aborted && request === generation.current) setResource({ api, path, data, loading: false, error: null });
    } catch (err) {
      if (!controller.signal.aborted && request === generation.current) setResource(previous => ({
        api, path, data: previous.api === api && previous.path === path ? previous.data : null,
        loading: false, error: errorMessage(err),
      }));
    }
  }, [api, path]);

  const refresh = useCallback(async () => {
    currentRequest.current?.abort();
    const request = ++generation.current;
    if (path === null) { setResource({ api, path, data: null, loading: false, error: null }); return; }
    const controller = new AbortController();
    currentRequest.current = controller;
    setResource(previous => ({ api, path, data: previous.api === api && previous.path === path ? previous.data : null, loading: true, error: null }));
    await fetchResource(controller, request);
  }, [api, fetchResource, path]);

  useEffect(() => {
    const controller = new AbortController();
    currentRequest.current = controller;
    const request = ++generation.current;
    void fetchResource(controller, request);
    return () => { generation.current += 1; controller.abort(); currentRequest.current?.abort(); };
  }, [fetchResource]);

  const setData = useCallback((update: SetStateAction<T | null>) => {
    if (resourceIdentity.current.api !== api || resourceIdentity.current.path !== path) return;
    currentRequest.current?.abort();
    generation.current += 1;
    setResource(previous => {
      const current = previous.api === api && previous.path === path ? previous.data : null;
      const data = typeof update === 'function' ? (update as (value: T | null) => T | null)(current) : update;
      return { api, path, data, loading: false, error: null };
    });
  }, [api, path]);

  const current = resource.api === api && resource.path === path;
  return { data: current ? resource.data : null, setData, loading: current ? resource.loading : Boolean(path), error: current ? resource.error : null, refresh };
}
