/**
 * Confirmación de inicio del servicio del Plan Semestral (derecho a retracto, Ley 19.496 art. 3 bis).
 * apiFetch la pide cuando el servidor responde 409 SERVICE_START_CONFIRMATION_REQUIRED;
 * App monta el modal que la responde.
 */
type Handler = () => Promise<boolean>;

let handler: Handler | null = null;
let pending: Promise<boolean> | null = null;

export function setServiceStartConfirmationHandler(fn: Handler): () => void {
  handler = fn;
  return () => {
    if (handler === fn) handler = null;
  };
}

export function requestServiceStartConfirmation(): Promise<boolean> {
  if (!handler) return Promise.resolve(false);
  // Si varias llamadas piden confirmación a la vez, se muestra un solo aviso
  if (!pending) {
    pending = handler().finally(() => {
      pending = null;
    });
  }
  return pending;
}
