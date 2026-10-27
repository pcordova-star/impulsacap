/**
 * Encuesta rápida ("¿Cómo te está funcionando ImpulsaCap?"): las pantallas avisan cuando la
 * persona termina un momento clave y el componente QuickFeedback decide si preguntar.
 */
export type FeedbackMoment = 'seccion_ia' | 'documento_ia' | 'expediente';
export interface FeedbackRequest { moment: FeedbackMoment; fundId?: string; fundName?: string; detail?: string }

type Listener = (r: FeedbackRequest) => void;
const listeners = new Set<Listener>();

export function onFeedbackRequest(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function askFeedback(r: FeedbackRequest): void {
  listeners.forEach(l => { try { l(r); } catch { /* sin efecto */ } });
}

export const MOMENT_LABEL: Record<FeedbackMoment, string> = {
  seccion_ia: 'Redactar una sección con IA',
  documento_ia: 'Generar un documento con IA',
  expediente: 'Revisar el expediente'
};
