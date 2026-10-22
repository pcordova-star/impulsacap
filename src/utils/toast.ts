/**
 * Avisos emergentes (burbujas) de la app. Cualquier componente llama showToast(...)
 * y ToastCenter, montado en App, los muestra con un sonido suave.
 */
export type ToastLevel = 'info' | 'success' | 'warning' | 'error';

export interface ToastOptions {
  /** Identificador estable: con oncePerSession, el mismo aviso no se repite en la sesión */
  id: string;
  level?: ToastLevel;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  /** Milisegundos antes de cerrarse solo (0 = no se cierra solo). Por defecto 10 s. */
  durationMs?: number;
  oncePerSession?: boolean;
  /** Sin sonido (avisos frecuentes como 'guardado') */
  silent?: boolean;
}

type Listener = (t: ToastOptions) => void;
const listeners = new Set<Listener>();

export function onToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function showToast(t: ToastOptions): void {
  if (t.oncePerSession) {
    const key = `impulsacap_toast_seen_${t.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* sin almacenamiento: se muestra igual */ }
  }
  listeners.forEach(l => {
    try { l(t); } catch (e) { console.warn('toast listener error', e); }
  });
}

const SOUND_KEY = 'impulsacap_toast_sound';
export function isToastSoundOn(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}
export function setToastSoundOn(on: boolean): void {
  try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* sin efecto */ }
}

let audioCtx: AudioContext | null = null;
/** Dos notas cortas y suaves generadas en el navegador (sin archivos de audio). */
export function playToastSound(level: ToastLevel = 'info'): void {
  if (!isToastSoundOn() || typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const notes = level === 'warning' || level === 'error' ? [660, 880] : [880, 1320];
    const t0 = audioCtx.currentTime;
    notes.forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = t0 + i * 0.13;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.07, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch { /* el navegador puede bloquear el audio; el aviso se muestra igual */ }
}
