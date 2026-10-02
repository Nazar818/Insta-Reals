import { ClerkProvider, useAuth, useClerk } from '@clerk/expo';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { tokenCache } from '@clerk/expo/token-cache';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import type { User } from '../types';
import { ApiClient, ApiError, errorMessage } from '../lib/http';

type Session = {
  ready: boolean;
  signedIn: boolean;
  userId: string | null;
  isDemo: boolean;
  error: string | null;
  getToken: () => Promise<string | null>;
  login: (account?: 'alex' | 'sam', mode?: 'sign-in' | 'sign-up') => Promise<void>;
  signOut: () => Promise<void>;
  refreshIdentity: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
const storageKey = 'insta-reals-demo-session';

async function storageRead() {
  if (Platform.OS === 'web') return typeof window === 'undefined' ? null : window.sessionStorage.getItem(storageKey);
  return SecureStore.getItemAsync(storageKey);
}
async function storageWrite(value: string | null) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      if (value) window.sessionStorage.setItem(storageKey, value);
      else window.sessionStorage.removeItem(storageKey);
    }
    return;
  }
  if (value) await SecureStore.setItemAsync(storageKey, value);
  else await SecureStore.deleteItemAsync(storageKey);
}

function DemoSession({ children }: { children: ReactNode }) {
  type Demo = { token: string; user: User };
  const [session, setSession] = useState<Demo | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);
  const revision = useRef(0);
  const currentSession = useRef<Demo | null>(null);
  const operation = useRef<AbortController | null>(null);
  const identityRequest = useRef<AbortController | null>(null);
  const storageQueue = useRef<Promise<void>>(Promise.resolve());
  const assignSession = useCallback((next: Demo | null) => {
    currentSession.current = next;
    setSession(next);
  }, []);
  // A delayed credential write must finish before a later sign-out deletion.
  const persist = useCallback((value: string | null) => {
    storageQueue.current = storageQueue.current.catch(() => {}).then(() => storageWrite(value));
    return storageQueue.current;
  }, []);

  useEffect(() => {
    active.current = true;
    const request = revision.current;
    const controller = new AbortController();
    operation.current = controller;
    const current = () => active.current && revision.current === request && !controller.signal.aborted;
    void storageRead().then(async (raw) => {
      if (!raw || !current()) return;
      const stored = JSON.parse(raw) as Demo;
      if (typeof stored.token !== 'string' || typeof stored.user?.id !== 'string') return;
      const api = new ApiClient(async () => stored.token);
      try {
        const user = await api.get<User>('me', controller.signal);
        if (current()) assignSession({ token: stored.token, user });
      } catch (err) {
        if (!current()) return;
        if (!(err instanceof ApiError) || err.status !== 401) {
          assignSession(stored);
        } else await persist(null);
      }
    }).catch(() => {}).finally(() => { if (current()) setReady(true); });
    return () => { active.current = false; revision.current += 1; controller.abort(); operation.current?.abort(); identityRequest.current?.abort(); };
  }, [assignSession, persist]);
  const getToken = useCallback(async () => {
    const token = session?.token;
    return active.current && token && currentSession.current?.token === token ? token : null;
  }, [session?.token]);
  const login = useCallback(async (account: 'alex' | 'sam' = 'alex') => {
    const request = ++revision.current;
    operation.current?.abort(); identityRequest.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    const current = () => active.current && revision.current === request && !controller.signal.aborted;
    setError(null);
    try {
      const next = await new ApiClient(async () => null).request<Demo>('demo/sessions', 'POST', { account }, controller.signal);
      if (!current()) return;
      await persist(JSON.stringify(next));
      if (current()) { assignSession(next); setReady(true); }
    } catch (err) { if (current()) { setError(errorMessage(err)); throw err; } }
  }, [assignSession, persist]);
  const signOut = useCallback(async () => {
    const request = ++revision.current;
    operation.current?.abort(); identityRequest.current?.abort();
    assignSession(null);
    setError(null);
    setReady(true);
    try { await persist(null); }
    catch (err) { if (active.current && revision.current === request) setError('Could not clear the saved demo session. Please try again.'); throw err; }
  }, [assignSession, persist]);
  const refreshIdentity = useCallback(async () => {
    const previous = currentSession.current;
    if (!previous) return;
    const request = revision.current;
    identityRequest.current?.abort();
    const controller = new AbortController();
    identityRequest.current = controller;
    const current = () => active.current && revision.current === request && currentSession.current?.token === previous.token && !controller.signal.aborted;
    try {
      const user = await new ApiClient(async () => previous.token).get<User>('me', controller.signal);
      if (!current()) return;
      assignSession({ ...previous, user });
      setError(null);
    } catch (err) {
      if (!current()) return;
      if (err instanceof ApiError && err.status === 401) {
        assignSession(null);
        void persist(null).catch(() => {});
        setError('Your demo session expired. Choose an account to continue.');
      } else setError(errorMessage(err));
    }
  }, [assignSession, persist]);
  const value = useMemo<Session>(() => ({ ready, signedIn: Boolean(session), userId: session?.user.id || null, isDemo: true, error, getToken, login, signOut, refreshIdentity }), [ready, session, error, getToken, login, signOut, refreshIdentity]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function ClerkSession({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken: clerkGetToken, sessionId } = useAuth();
  const clerk = useClerk();
  const { startHostedAuth } = useHostedAuth();
  const sessionKey = isSignedIn ? sessionId ?? null : null;
  const [identity, setIdentity] = useState<{ key: string | null; userId: string | null; error: string | null }>({ key: sessionKey, userId: null, error: null });
  const active = useRef(true);
  const generation = useRef(0);
  const identityRequest = useRef<AbortController | null>(null);
  // The SDK getter is stable. Bind this wrapper to its session so a request
  // held by an old screen can never use a newly selected account's token.
  const getToken = useCallback(async () => {
    if (!active.current || !sessionKey || clerk.session?.id !== sessionKey) return null;
    const token = await clerkGetToken();
    return active.current && clerk.session?.id === sessionKey ? token : null;
  }, [clerk, clerkGetToken, sessionKey]);
  const api = useMemo(() => new ApiClient(getToken), [getToken]);
  const fetchIdentity = useCallback(async (controller: AbortController, request: number) => {
    if (!sessionKey) return;
    try {
      const user = await api.get<User>('me', controller.signal);
      if (active.current && !controller.signal.aborted && request === generation.current) setIdentity({ key: sessionKey, userId: user.id, error: null });
    } catch (err) {
      if (active.current && !controller.signal.aborted && request === generation.current) setIdentity({ key: sessionKey, userId: null, error: errorMessage(err) });
    }
  }, [api, sessionKey]);
  const refreshIdentity = useCallback(async () => {
    identityRequest.current?.abort();
    const controller = new AbortController();
    identityRequest.current = controller;
    await fetchIdentity(controller, ++generation.current);
  }, [fetchIdentity]);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; generation.current += 1; identityRequest.current?.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    identityRequest.current = controller;
    void fetchIdentity(controller, ++generation.current);
    return () => { generation.current += 1; controller.abort(); };
  }, [fetchIdentity]);
  const login = useCallback(async (_account?: 'alex' | 'sam', mode: 'sign-in' | 'sign-up' = 'sign-in') => {
    setIdentity(previous => ({ key: sessionKey, userId: previous.key === sessionKey ? previous.userId : null, error: null }));
    try {
      if (Platform.OS === 'web') {
        if (mode === 'sign-up') clerk.openSignUp(); else clerk.openSignIn();
      } else await startHostedAuth({ mode });
    }
    catch (err) {
      if (active.current && (clerk.session?.id ?? null) === sessionKey) setIdentity({ key: sessionKey, userId: null, error: errorMessage(err) });
      throw err;
    }
  }, [clerk, sessionKey, startHostedAuth]);
  const signOut = useCallback(async () => {
    generation.current += 1; identityRequest.current?.abort();
    try { await clerk.signOut(); }
    catch (err) {
      if (active.current && (clerk.session?.id ?? null) === sessionKey) setIdentity(previous => previous.key === sessionKey ? { ...previous, error: errorMessage(err) } : previous);
      throw err;
    }
  }, [clerk, sessionKey]);
  const userId = identity.key === sessionKey ? identity.userId : null;
  const error = identity.key === sessionKey ? identity.error : null;
  const value = useMemo<Session>(() => ({ ready: isLoaded, signedIn: Boolean(isSignedIn), userId, isDemo: false, error, getToken, login, signOut, refreshIdentity }), [isLoaded, isSignedIn, userId, error, getToken, login, signOut, refreshIdentity]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (key) return <ClerkProvider publishableKey={key} tokenCache={tokenCache}><ClerkSession>{children}</ClerkSession></ClerkProvider>;
  return <DemoSession>{children}</DemoSession>;
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is required');
  return value;
}
