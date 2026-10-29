/**
 * Aperturas esperadas de convocatorias (calendario anunciado; NO son fechas oficiales confirmadas).
 * Se muestran en el inicio, el panel y el catálogo hasta que abren. Cuando la convocatoria abre de verdad,
 * el monitor la trae sola y la reemplaza. Para agregar o quitar una, edita esta lista.
 */
export interface UpcomingCall {
  id: string;
  /** Nombre corto para mostrar */
  label: string;
  /** Detalle (líneas, foco) */
  detail?: string;
  fundIds: string[];
  /** Fecha estimada de apertura (YYYY-MM-DD, hora de Chile) */
  date: string;
  /** Monto para mostrar */
  amount: string;
}

export const UPCOMING_SOURCE = 'Calendario 2026 anunciado por Corfo. Las fechas son estimadas y pueden cambiar.';

export const UPCOMING_CALLS: UpcomingCall[] = [
  { id: 'suc-nov-2026', label: 'Start-Up Chile', detail: 'Build, Ignite y Growth', fundIds: ['startup_chile_build', 'startup_chile_ignite', 'startup_chile_growth'], date: '2026-11-04', amount: '$15M a $75M' },
  { id: 'cyv-nov-2026', label: 'Corfo Crea y Valida', detail: 'Convocatoria nacional', fundIds: ['corfo_crea_valida'], date: '2026-11-10', amount: 'hasta $180M' },
  { id: 'semilla-nov-2026', label: 'Corfo Semilla Inicia y Semilla Expande', detail: 'Para emprendimientos nuevos y con primeras ventas', fundIds: ['corfo_semilla_inicia', 'corfo_semilla_expande'], date: '2026-11-17', amount: '$15M y $45M' }
];

/** Días hasta la fecha (en Chile). 0 = hoy, negativo = ya pasó. */
export function daysUntil(dateIso: string, now = new Date()): number {
  const todayCl = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  todayCl.setHours(0, 0, 0, 0);
  const [y, m, d] = dateIso.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - todayCl.getTime()) / 86400000);
}

export function fmtShortDate(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
}

/**
 * Aperturas que todavía no ocurren. Se ocultan si el monitor ya muestra una convocatoria abierta
 * de alguno de sus fondos (abrió antes o en la fecha).
 */
export function pendingUpcoming(openFundIds: Set<string> | string[] = [], now = new Date()): (UpcomingCall & { days: number })[] {
  const open = openFundIds instanceof Set ? openFundIds : new Set(openFundIds);
  return UPCOMING_CALLS
    .map(c => ({ ...c, days: daysUntil(c.date, now) }))
    .filter(c => c.days >= 0 && !c.fundIds.some(id => open.has(id)))
    .sort((a, b) => a.days - b.days);
}

/** Apertura esperada de un fondo (para el catálogo) */
export function upcomingForFund(fundId: string, openFundIds: Set<string> | string[] = [], now = new Date()) {
  return pendingUpcoming(openFundIds, now).find(c => c.fundIds.includes(fundId)) || null;
}

export const daysText = (n: number) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`);
