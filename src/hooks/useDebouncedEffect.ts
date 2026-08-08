import { useEffect, useRef } from 'react';

/**
 * Run an effect after `delay` ms of quiet.
 *
 * Used for cart draft auto-save (doc 07): a burst of "+" taps must not cause a
 * write per tap, but the cart must be on disk within a moment of the last one.
 */
export function useDebouncedEffect(effect: () => void, deps: unknown[], delay: number): void {
  const callback = useRef(effect);
  callback.current = effect;

  useEffect(() => {
    const timer = setTimeout(() => callback.current(), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
