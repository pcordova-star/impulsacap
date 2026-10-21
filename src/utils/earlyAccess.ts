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

/** Modo de pagos público (sin sesión), con caché en memoria. */
let modeCache: Promise<{ paymentsEnabled: boolean }> | null = null;
export function getPaymentsMode(): Promise<{ paymentsEnabled: boolean }> {
  if (!modeCache) {
    modeCache = fetch('/api/pagos/modo')
      .then(r => (r.ok ? r.json() : { paymentsEnabled: true }))
      .then(j => ({ paymentsEnabled: j?.paymentsEnabled !== false }))
      .catch(() => ({ paymentsEnabled: true }));
  }
  return modeCache;
}
