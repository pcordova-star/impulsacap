/**
 * Contadores agrupados en memoria: en vez de escribir el mismo documento de Firestore en cada visita
 * o llamada a la IA (Firestore acepta ~1 escritura por segundo sostenida por documento y, con mucho
 * tráfico, las escrituras empiezan a fallar), se suman aquí y se escriben juntas cada pocos segundos.
 *
 * Cloud Run puede pausar la CPU entre solicitudes, así que además del temporizador se escribe
 * al recibir nuevas sumas si ya pasó el intervalo, y al apagarse la instancia.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

type Pending = { incs: Map<string, number>; fields: Record<string, any> };

export function createCounterBuffer(getDb: () => Promise<Firestore | null>, intervalMs = 5000) {
  const pending = new Map<string, Pending>();
  /** Lo que ya se sumó en esta instancia y aún no se escribe (para que los controles de gasto lo vean) */
  let lastFlush = Date.now();
  let flushing: Promise<void> | null = null;

  const toNested = (incs: Map<string, number>, fields: Record<string, any>) => {
    const out: Record<string, any> = { ...fields };
    for (const [path, n] of incs) {
      const parts = path.split('.');
      let node = out;
      for (let i = 0; i < parts.length - 1; i++) node = node[parts[i]] = node[parts[i]] || {};
      node[parts[parts.length - 1]] = FieldValue.increment(n);
    }
    return out;
  };

  async function flush() {
    if (flushing) return flushing;
    if (pending.size === 0) { lastFlush = Date.now(); return; }
    const batch = Array.from(pending.entries());
    pending.clear();
    lastFlush = Date.now();
    flushing = (async () => {
      try {
        const db = await getDb();
        if (!db) return;
        await Promise.all(batch.map(async ([docPath, p]) => {
          try {
            await db.doc(docPath).set(toNested(p.incs, p.fields), { merge: true });
          } catch (err: any) {
            // Si falla, se vuelve a sumar para el próximo intento (no se pierden las cuentas)
            const cur = pending.get(docPath) || { incs: new Map(), fields: {} };
            for (const [k, v] of p.incs) cur.incs.set(k, (cur.incs.get(k) || 0) + v);
            cur.fields = { ...p.fields, ...cur.fields };
            pending.set(docPath, cur);
            console.warn('[contadores] No se pudo escribir', docPath, err?.message);
          }
        }));
      } finally {
        flushing = null;
      }
    })();
    return flushing;
  }

  const timer = setInterval(() => { flush().catch(() => {}); }, intervalMs);
  (timer as any).unref?.();
  const onExit = () => { flush().catch(() => {}); };
  process.once('SIGTERM', onExit);
  process.once('beforeExit', onExit);

  return {
    /** Suma valores (claves con puntos = campos anidados) y fija campos simples del documento */
    add(docPath: string, incs: Record<string, number>, fields: Record<string, any> = {}) {
      const cur = pending.get(docPath) || { incs: new Map<string, number>(), fields: {} };
      for (const [k, v] of Object.entries(incs)) {
        if (!Number.isFinite(v) || v === 0) continue;
        cur.incs.set(k, (cur.incs.get(k) || 0) + v);
      }
      cur.fields = { ...cur.fields, ...fields };
      pending.set(docPath, cur);
      if (Date.now() - lastFlush > intervalMs) flush().catch(() => {});
    },
    /** Valor aún no escrito de un campo (para sumarlo a lo leído de Firestore) */
    pendingValue(docPath: string, field: string): number {
      return pending.get(docPath)?.incs.get(field) || 0;
    },
    flush
  };
}
