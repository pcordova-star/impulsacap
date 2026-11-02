/**
 * Cuánto falta: tiempo estimado de trabajo para tener la postulación lista, y qué es obligatorio
 * para enviarla y qué es recomendado. Son estimaciones para una persona que lo hace por primera vez
 * con la ayuda de la plataforma (se puede hacer en partes: todo queda guardado).
 */
import type { RoadmapStep, RoadmapItem } from './fundStandards';
import type { ChileanFund, CompanyProfile } from '../types/funds';
import { getFundRules } from './fundStandards';

/** Lo que conviene hacer, pero no impide enviar la postulación */
export function isRecommendedItem(stepId: string, itemId: string): boolean {
  return stepId === 'step_audit' || itemId === 'dossier' || itemId === 'garantia' || itemId === 'budget_review';
}

export function itemMinutes(stepId: string, it: RoadmapItem): number {
  if (it.done) return 0;
  switch (stepId) {
    case 'step_requirements':
      if (it.warn) return 0; // no se cumple: no es tiempo, es un bloqueo
      return it.go?.target === 'sii' ? 5 : 1;
    case 'step_form':
      return it.warn ? 5 : 10;
    case 'step_budget':
      return it.id === 'budget' ? 15 : it.id === 'garantia' ? 5 : it.id === 'budget_review' ? 15 : 0;
    case 'step_documents':
      if (/carpeta|taxfolder/i.test(it.id) || it.go?.target === 'sii') return 5;
      if (it.go?.target?.startsWith('documents#doc-generator')) return 15;
      if (it.go?.target === 'formulator#section:title_pitch') return 30; // grabar el video
      return 10;
    case 'step_audit':
      if (it.id === 'audit') return 5;
      if (it.id === 'audit_pass' && it.warn) return 20; // mejorar lo que bajó la nota
      return 0;
    case 'step_submit':
      return it.id === 'portal' ? 30 : 5;
  }
  return 5;
}

export function stepMinutes(step: RoadmapStep): number {
  return step.items.reduce((s, it) => s + itemMinutes(step.id, it), 0);
}

/** Tiempo de las etapas previas (empresa) que aún faltan */
export function companyMinutes(stages: { id: string; done: boolean }[]): number {
  const M: Record<string, number> = { empresa: 5, proyecto: 10, carpeta: 5, fondo: 3 };
  return stages.filter(s => !s.done && M[s.id]).reduce((sum, s) => sum + M[s.id], 0);
}

export function remainingMinutes(steps: RoadmapStep[], stages: { id: string; done: boolean }[] = []) {
  const byStep: Record<string, number> = {};
  let total = companyMinutes(stages);
  let toSubmit = total; // sin lo recomendado (evaluación simulada y expediente)
  for (const st of steps) {
    const m = stepMinutes(st);
    byStep[st.id] = m;
    total += m;
    toSubmit += st.items.filter(it => !isRecommendedItem(st.id, it.id)).reduce((s, it) => s + itemMinutes(st.id, it), 0);
  }
  return { total, toSubmit, byStep };
}

/** "45 min", "1 h 20 min", "2 h" (redondeado a 5 minutos) */
export function fmtMinutes(m: number): string {
  if (m <= 0) return '0 min';
  const r = Math.max(5, Math.round(m / 5) * 5);
  const h = Math.floor(r / 60), min = r % 60;
  if (h === 0) return `${min} min`;
  return min ? `${h} h ${min} min` : `${h} h`;
}

/** ¿Puede enviarla ya? Todo lo obligatorio listo (requisitos, formulario, presupuesto y documentos) */
export function readyToSubmit(steps: RoadmapStep[]): boolean {
  return steps
    .filter(s => ['step_requirements', 'step_form', 'step_budget', 'step_documents'].includes(s.id))
    .every(s => s.items.length > 0 && s.items.every(i => i.done || isRecommendedItem(s.id, i.id)));
}

export interface PrepItem { id: string; label: string; why: string; how?: string; done?: boolean; link?: string }

/** "Antes de empezar, ten a mano": lo que pide este fondo, para no detenerse a mitad de camino */
export function prepChecklist(fund: ChileanFund, profile: Partial<CompanyProfile>): PrepItem[] {
  let r: ReturnType<typeof getFundRules> | null = null;
  try { r = getFundRules(fund); } catch { r = null; }
  const out: PrepItem[] = [];
  const isPerson = profile.companyType === 'sin_iniciar';
  const needsTax = !isPerson && Boolean(r?.requirements.some(q => ['age', 'sales', 'firstCategory', 'taxFolder'].includes(String(q.check?.kind))) || r?.applicationDocs.some(d => d.link === 'taxFolder'));
  out.push({ id: 'empresa', label: isPerson ? 'Tu RUT y tus datos de contacto' : 'RUT de la empresa y datos del representante legal', why: 'Para revisar los requisitos y llenar los datos del formulario.', done: Boolean(profile.rut) });
  if (needsTax) out.push({ id: 'carpeta', label: 'Carpeta tributaria del SII (PDF)', why: 'Con ella revisamos solos tu antigüedad y tus ventas.', how: 'Gratis en sii.cl → Servicios online → Situación tributaria → Carpeta tributaria electrónica: elige la regular o una personalizada con F29 y F22. Tarda 5 minutos.', link: 'https://www.sii.cl', done: Boolean(profile.taxFolderUploaded) });
  out.push({ id: 'idea', label: 'Tu idea clara en 3 frases: qué haces, para quién y qué te diferencia', why: 'Es la base de todo el formulario; la IA la ordena y redacta contigo.', done: Boolean(profile.projectProfile?.whatItDoes && profile.projectProfile?.problemAndTarget) });
  out.push({ id: 'cotizaciones', label: 'Precios o cotizaciones de lo que quieres comprar o contratar', why: 'Para armar el presupuesto con montos reales (no inventados).', how: 'Basta con capturas de precios de internet o un correo del proveedor.' });
  if (r?.formSections.some(s => s.blocks.includes('team'))) out.push({ id: 'equipo', label: 'Currículums o perfiles de LinkedIn del equipo', why: 'El equipo pesa mucho en la nota; con ellos armamos esa sección sola.', how: 'En LinkedIn: Más → Guardar en PDF.' });
  if (r?.applicationDocs.some(d => d.link === 'letters')) out.push({ id: 'cartas', label: 'Uno o dos contactos que te firmen una carta de apoyo o interés', why: 'Las cartas de clientes o socios suman puntos; la plataforma te las redacta.' });
  if (r?.pitch) out.push({ id: 'video', label: `Celular para grabar el ${r.pitch.label.toLowerCase()} (${r.pitch.seconds >= 60 ? `${Math.round(r.pitch.seconds / 60 * 10) / 10} min` : `${r.pitch.seconds} s`})`, why: 'Te damos el guion listo; solo lo grabas.' });
  if (r?.portal) out.push({ id: 'portal', label: `Cuenta en ${r.portal.name}`, why: 'Ahí envías la postulación al final; créala con tiempo.', link: r.portal.url });
  return out;
}
