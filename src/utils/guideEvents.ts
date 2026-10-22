/**
 * Avisos al consultor: cuando el usuario guarda algo importante, el consultor
 * le pregunta si quiere seguir con el siguiente paso o volver al panel.
 */
export interface SavedEvent { label: string }
const NAME = 'impulsacap:guardado';

export function notifySaved(label: string): void {
  try { window.dispatchEvent(new CustomEvent<SavedEvent>(NAME, { detail: { label } })); } catch { /* sin efecto */ }
}

export function onSaved(fn: (e: SavedEvent) => void): () => void {
  const h = (ev: Event) => fn((ev as CustomEvent<SavedEvent>).detail);
  window.addEventListener(NAME, h);
  return () => window.removeEventListener(NAME, h);
}
