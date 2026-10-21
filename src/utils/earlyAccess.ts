import { auth } from '../firebase';
import { apiFetch } from './apiFetch';
/**
 * Acceso anticipado (lanzamiento sin pago en línea): el servidor responde { earlyAccess: true, ... }
 * a /api/pagos/crear y la app muestra EarlyAccessModal en vez de ir a Mercado Pago.
 */
export interface EarlyAccessInfo {
  earlyAccess: true;
  expiresAt?: string | null;
  alreadyGranted?: boolean;
  alreadyPaid?: boolean;
  price?: number;
}

type Listener = (info: EarlyAccessInfo) => void;
const listeners = new Set<Listener>();

export function onEarlyAccess(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function announceEarlyAccess(info: EarlyAccessInfo): void {
  listeners.forEach(l => { try { l(info); } catch (e) { console.warn(e); } });
}

/**
 * Modo de pagos (con la sesión, si hay): con PAGOS_MODO=anticipado, los correos de prueba
 * configurados en el servidor ven el pago real; el resto, la prueba gratis.
 */
const modeCache = new Map<string, Promise<{ paymentsEnabled: boolean; testMode?: boolean }>>();
export async function getPaymentsMode(): Promise<{ paymentsEnabled: boolean; testMode?: boolean }> {
  try { await auth.authStateReady?.(); } catch { /* sin efecto */ }
  const key = auth.currentUser?.uid || 'anon';
  if (!modeCache.has(key)) {
    modeCache.set(key, apiFetch('/api/pagos/modo', { requireAuth: false })
      .then(r => (r.ok ? r.json() : { paymentsEnabled: true }))
      .then(j => ({ paymentsEnabled: j?.paymentsEnabled !== false, testMode: j?.testMode === true }))
      .catch(() => ({ paymentsEnabled: true })));
  }
  return modeCache.get(key)!;
}
