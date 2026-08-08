/**
 * Scan feedback.
 *
 * Counter staff scan without looking at the screen — the beep IS the
 * confirmation. Generated with WebAudio rather than shipping an audio file, so
 * it costs nothing to precache and works offline like everything else.
 */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

/**
 * Browsers suspend audio until a user gesture. Call this from the tap that
 * opens the scanner, so the first successful scan actually makes a sound.
 */
export function primeAudio(): void {
  const audio = audioContext();
  if (audio?.state === 'suspended') void audio.resume();
}

function tone(frequency: number, durationMs: number, volume: number): void {
  const audio = audioContext();
  if (!audio) return;
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audio.currentTime);
    // Ramp down rather than cutting abruptly — a hard stop clicks.
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + durationMs / 1000);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + durationMs / 1000);
  } catch {
    /* audio blocked — the visual confirmation still shows */
  }
}

/** Short high blip: item added. */
export function beepSuccess(): void {
  tone(1720, 90, 0.16);
  vibrate(35);
}

/** Lower double blip: unknown barcode, needs attention. */
export function beepUnknown(): void {
  tone(660, 110, 0.16);
  setTimeout(() => tone(520, 130, 0.16), 120);
  vibrate([40, 60, 40]);
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
