/**
 * Códigos de vendedor del lado del cliente.
 * - impulsacap.cl/?ref=CODIGO guarda el código en el navegador (vale para visitantes sin cuenta).
 * - Con sesión iniciada, el código se asocia a la cuenta en el servidor (que es quien fija el precio).
 */
import { apiFetch } from './apiFetch';

const KEY = 'impulsacap_ref';

export interface CodePreview {
  code: string;
  sellerName: string;
  discountPct: number;
  price: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
export function onReferralChanged(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}
const emit = () => listeners.forEach(l => { try { l(); } catch (e) { console.warn(e); } });
export const notifyReferralChanged = emit;

export function getStoredRef(): { code: string; source: 'link' | 'campo' } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v?.code ? v : null;
  } catch {
    return null;
  }
}
function storeRef(code: string, source: 'link' | 'campo') {
  try { localStorage.setItem(KEY, JSON.stringify({ code, source })); } catch { /* sin almacenamiento */ }
}
export function clearStoredRef() {
  try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
}

export const normalizeCode = (raw: string) =>
  String(raw || '').trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9_-]/g, '').slice(0, 20);

/** Lee ?ref= de la URL, lo guarda y limpia la URL. Devuelve el código si había uno. */
export function captureRefFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('ref');
  if (!raw) return null;
  const code = normalizeCode(raw);
  params.delete('ref');
  const qs = params.toString();
  window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash);
  if (!code) return null;
  storeRef(code, 'link');
  return code;
}

export async function previewCode(code: string): Promise<CodePreview | { error: string }> {
  try {
    const res = await fetch(`/api/vendedores/codigo/${encodeURIComponent(normalizeCode(code))}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body?.valid) return { error: body?.error || 'Ese código no existe o ya no está vigente.' };
    return { code: body.code, sellerName: body.sellerName, discountPct: body.discountPct, price: body.price };
  } catch {
    return { error: 'No se pudo validar el código. Revisa tu conexión.' };
  }
}

/**
 * Aplica un código. Con sesión lo asocia a la cuenta; sin sesión lo deja guardado
 * en el navegador y se asocia al iniciar sesión.
 */
export async function applyCode(code: string, loggedIn: boolean, source: 'link' | 'campo' = 'campo'): Promise<{ ok: true } | { error: string }> {
  const c = normalizeCode(code);
  if (c.length < 3) return { error: 'Escribe un código válido.' };
  if (!loggedIn) {
    const p = await previewCode(c);
    if ('error' in p) return p;
    storeRef(c, source);
    emit();
    return { ok: true };
  }
  try {
    const res = await apiFetch('/api/vendedores/aplicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: c, source })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body?.error || 'No se pudo aplicar el código.' };
    clearStoredRef();
    emit();
    return { ok: true };
  } catch {
    return { error: 'No se pudo aplicar el código. Revisa tu conexión.' };
  }
}

export async function removeCode(loggedIn: boolean): Promise<void> {
  clearStoredRef();
  if (loggedIn) {
    try { await apiFetch('/api/vendedores/quitar', { method: 'POST' }); } catch { /* sin efecto */ }
  }
  emit();
}

/** Al iniciar sesión: asocia a la cuenta el código guardado en el navegador. */
export async function syncStoredRefToAccount(): Promise<void> {
  const stored = getStoredRef();
  if (!stored) return;
  try {
    const res = await apiFetch('/api/vendedores/aplicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stored)
    });
    // Aplicado, inválido o ya compró antes: en todos esos casos se olvida el código local
    if (res.ok || res.status === 404 || res.status === 409) clearStoredRef();
  } catch { /* se reintenta en la próxima carga */ }
}
