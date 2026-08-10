import { useEffect, useRef, useState } from 'react';

/**
 * Keyboard-first billing.
 *
 * A till is fast because a trained hand never leaves the keys. Every shortcut
 * here is additive — nothing on the touch path changes — but on the counter
 * tablet with a Bluetooth keyboard, or on a laptop, this is the difference
 * between "an app" and "a till".
 */

export interface Hotkey {
  /** Matched against `KeyboardEvent.key`, case-insensitively for letters. */
  key: string;
  handler: (event: KeyboardEvent) => void;
  /**
   * Fire even while the caret is in a text field. Off by default, because
   * "/" and "+" are characters someone may legitimately be typing.
   */
  whileTyping?: boolean;
}

const EDITABLE = /^(input|textarea|select)$/i;

/** Is the keystroke landing in something the user is typing into? */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (!EDITABLE.test(target.tagName)) return false;
  // A search box the user tabbed into still counts as typing, but a checkbox
  // or a button-like input does not.
  if (target instanceof HTMLInputElement) {
    return !['checkbox', 'radio', 'button', 'submit', 'range'].includes(target.type);
  }
  return true;
}

/**
 * Bind a set of shortcuts for as long as `enabled` is true.
 *
 * Handlers are read through a ref, so a screen can pass fresh closures on
 * every render without re-binding the listener on every keystroke.
 */
export function useHotkeys(hotkeys: Hotkey[], enabled = true): void {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // Never steal a browser or OS combination.
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const typing = isTypingTarget(event.target);
      for (const hotkey of ref.current) {
        if (hotkey.key.toLowerCase() !== event.key.toLowerCase()) continue;
        if (typing && !hotkey.whileTyping) continue;
        event.preventDefault();
        hotkey.handler(event);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/** Keys that only a physical keyboard produces. */
const HARDWARE_ONLY = new Set([
  'Tab',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'F1',
  'F2',
  'F3',
  'F9',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

/**
 * True once the shopkeeper has demonstrably used a hardware keyboard.
 *
 * The shortcut hint should not clutter a phone that will never have one, and
 * a discoverable affordance the user has to be told about is not discoverable.
 * A phone's on-screen keyboard only ever fires while a field is focused and
 * never emits the keys above, so this stays false on touch-only devices.
 */
export function useKeyboardUser(): boolean {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false);

  useEffect(() => {
    if (isKeyboardUser) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (HARDWARE_ONLY.has(event.key) || !isTypingTarget(event.target)) {
        setIsKeyboardUser(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isKeyboardUser]);

  return isKeyboardUser;
}
