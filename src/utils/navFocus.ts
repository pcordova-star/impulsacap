/**
 * Navegación con destino: que cada botón lleve exactamente al formulario que corresponde.
 *
 * Destinos con formato "pestaña#destino":
 *   'documents#doc-generator'            → Documentos, formulario de cartas (con LOI seleccionada)
 *   'formulator#section:budget'          → Formulador, sección Presupuesto
 *   'formulator#section:next'            → Formulador, primera sección pendiente
 *   'my-company#project-profile'         → Mi empresa, Perfil del Proyecto
 *   'roadmap#guarantees'                 → Hoja de Ruta, simulador de garantías
 *
 * Al llegar, la pantalla baja al elemento con ese id, lo resalta unos segundos y pone el cursor
 * en el primer campo vacío.
 */

export function splitTarget(tab: string): { base: string; target: string | null } {
  const i = tab.indexOf('#');
  return i === -1 ? { base: tab, target: null } : { base: tab.slice(0, i), target: tab.slice(i + 1) || null };
}

// --- Pedidos a componentes que aún no están montados (se consumen al montar) ---
type Key = 'formulatorSection' | 'docType' | 'roadmapView';
const pending: Partial<Record<Key, string>> = {};
const listeners = new Map<Key, Set<(v: string) => void>>();

export function request(key: Key, value: string) {
  pending[key] = value;
  listeners.get(key)?.forEach(l => { try { l(value); } catch (e) { console.warn(e); } });
}

/** Lee y borra un pedido pendiente (al montar el componente). */
export function consume(key: Key): string | null {
  const v = pending[key] ?? null;
  delete pending[key];
  return v;
}

/** Escucha pedidos mientras el componente está montado; los consume al recibirlos. */
export function onRequest(key: Key, l: (v: string) => void): () => void {
  if (!listeners.has(key)) listeners.set(key, new Set());
  const wrapped = (v: string) => { delete pending[key]; l(v); };
  listeners.get(key)!.add(wrapped);
  return () => { listeners.get(key)?.delete(wrapped); };
}

const HIGHLIGHT = ['ring-4', 'ring-amber-400', 'ring-offset-2', 'ring-offset-transparent'];

/**
 * Espera a que exista el elemento con ese id (hasta 4 s), baja hasta él, lo resalta
 * y enfoca el primer campo vacío.
 */
export function focusSection(id: string, opts: { focusInput?: boolean; delayMs?: number } = {}) {
  if (typeof document === 'undefined') return;
  const { focusInput = true, delayMs = 300 } = opts;
  const started = Date.now();
  const tick = () => {
    const el = document.getElementById(id);
    if (!el) {
      if (Date.now() - started < 4000) setTimeout(tick, 120);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add(...HIGHLIGHT, 'transition-shadow');
    setTimeout(() => el.classList.remove(...HIGHLIGHT), 2600);
    if (focusInput) {
      const fields = Array.from(el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([type=hidden]):not([type=checkbox]):not([disabled]), textarea:not([disabled]), select:not([disabled])'
      ));
      const target = fields.find(f => !(f as HTMLInputElement).value) || fields[0];
      if (target) setTimeout(() => target.focus({ preventScroll: true }), 450);
    }
  };
  setTimeout(tick, delayMs);
}

// --- "Volver a donde estabas" al salir de una postulación hacia Mi empresa ---
export interface ReturnContext {
  label: string;      // p. ej. nombre del fondo
  subTab: string;     // pestaña de la postulación a la que volver
  target?: string;    // destino dentro de esa pestaña
}
let returnCtx: ReturnContext | null = null;
const returnListeners = new Set<(c: ReturnContext | null) => void>();
export function setReturnContext(c: ReturnContext | null) {
  returnCtx = c;
  returnListeners.forEach(l => l(c));
}
export function getReturnContext() { return returnCtx; }
export function onReturnContext(l: (c: ReturnContext | null) => void): () => void {
  returnListeners.add(l);
  return () => { returnListeners.delete(l); };
}

export const LOI_DOC_TYPE = 'Carta de Manifestación de Interés Comercial (LOI)';

/** Resuelve el destino dentro de la pestaña ya elegida. */
export function goToTarget(target: string | null) {
  if (!target) return;
  if (target.startsWith('section:')) {
    request('formulatorSection', target.slice('section:'.length));
    focusSection('formulator-main');
    return;
  }
  if (target === 'doc-generator' || target.startsWith('doc-generator:')) {
    const type = target.includes(':') ? target.slice(target.indexOf(':') + 1) : LOI_DOC_TYPE;
    request('docType', type);
    focusSection('doc-generator');
    return;
  }
  if (target === 'guarantees' || target === 'admissibility' || target === 'timeline') {
    request('roadmapView', target);
    focusSection('roadmap-views', { focusInput: false });
    return;
  }
  focusSection(target);
}
