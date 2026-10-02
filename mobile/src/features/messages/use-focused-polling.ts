import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function useFocusedPolling(refresh: () => Promise<void>) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);
  useFocusEffect(useCallback(() => {
    let focused = true;
    let running = false;
    async function poll() {
      if (!focused || running || AppState.currentState !== 'active') return;
      running = true;
      try { await latest.current(); }
      finally { running = false; }
    }
    const interval = setInterval(() => { void poll(); }, 5000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void poll(); });
    return () => { focused = false; clearInterval(interval); subscription.remove(); };
  }, []));
}
