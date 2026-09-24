import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, useWindowDimensions } from 'react-native';

import { WIDE_BREAKPOINT } from './theme';

/** Tiny data loader: runs `fn` whenever deps change, exposes reload(). */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

export function useIsWide() {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}

/** Re-render every `ms` (for live clocks). */
export function useTicker(ms = 30000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmAsync(title: string, message = '', okLabel = 'Delete'): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

/** Wraps an async action with error reporting. Returns true on success. */
export async function attempt(fn: () => Promise<unknown>, success?: string) {
  try {
    await fn();
    if (success) notify(success);
    return true;
  } catch (e) {
    notify('Something went wrong', (e as Error).message);
    return false;
  }
}
