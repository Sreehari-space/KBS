import { useEffect, useState } from 'react';

/**
 * Network state, for a status dot — never for gating anything.
 *
 * This app is offline-first: nothing it does at the till requires a
 * connection, so being offline is a normal state, not an error. It gets a
 * quiet dot; the banner treatment is reserved for actual problems like
 * ephemeral storage.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  return online;
}
