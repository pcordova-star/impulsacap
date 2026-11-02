/**
 * Confirmación dentro de la app (en vez de window.confirm): se ve igual en todos los navegadores,
 * no se bloquea en celulares ni en navegadores integrados, y respeta el diseño de la plataforma.
 * Uso: if (!(await askConfirm('¿Seguro?'))) return;
 */
export interface ConfirmRequest { message: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean; resolve: (ok: boolean) => void }
type Listener = (r: ConfirmRequest) => void;
let listener: Listener | null = null;

export function onConfirmRequest(l: Listener): () => void {
  listener = l;
  return () => { if (listener === l) listener = null; };
}

export function askConfirm(message: string, opts: { confirmLabel?: string; cancelLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise(resolve => {
    if (!listener) { resolve(typeof window !== 'undefined' ? window.confirm(message) : false); return; }
    listener({ message, ...opts, resolve });
  });
}
