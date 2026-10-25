import type { ChileanFund, FormulationOutput } from '../types/funds';
import type { ApplicationItem, ExecutionData, ExecutionExpense, ExecutionMilestone, ExecutionBudgetLine } from '../types/application';
import { getFundRules } from './fundStandards';

/**
 * Etapa 4 — Ejecución de un proyecto ganado.
 * Todo lo que está aquí son guías generales: las reglas exactas de gastos y rendición
 * las fija el contrato o convenio de cada fondo, y se confirman con el ejecutivo.
 */

export const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Quién acompaña la ejecución según la institución */
export function operatorName(fund: ChileanFund): string {
  const ag = (fund.agency || '').toUpperCase();
  if (ag.includes('SERCOTEC')) return 'tu Agente Operador de Sercotec';
  if (ag.includes('CORFO')) return 'tu Agente Operador o ejecutivo de Corfo';
  if (ag.includes('START-UP')) return 'tu ejecutivo de Start-Up Chile';
  if (ag.includes('ANID')) return 'tu ejecutivo de ANID';
  if (ag.includes('FIA')) return 'tu ejecutivo de FIA';
  return 'tu ejecutivo del fondo';
}

/** Duración del proyecto en meses, leída de las bases (si se puede) */
export function fundDurationMonths(fund: ChileanFund): number | undefined {
  let txt = '';
  try { txt = getFundRules(fund).duration || ''; } catch { txt = ''; }
  const m = txt.match(/ejecuci[oó]n[^.;]*?(\d+)\s*meses/i) || txt.match(/(\d+)\s*meses/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 60 ? n : undefined;
}

/** "Mes 1-2", "Meses 3 a 4", "Mes 6" → último mes mencionado */
export function monthOffset(label: string): number | undefined {
  const nums = (String(label || '').match(/\d+/g) || []).map(Number).filter(n => n > 0 && n <= 60);
  return nums.length ? nums[nums.length - 1] : undefined;
}

export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (m - 1) + months, d));
  return dt.toISOString().slice(0, 10);
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Lista para después de ganar (general; se ajusta con lo que diga la carta de adjudicación) */
export function postAwardChecklist(fund: ChileanFund): { id: string; label: string; detail: string }[] {
  const op = operatorName(fund);
  return [
    { id: 'carta', label: 'Lee la carta o correo de adjudicación', detail: 'Anota el monto adjudicado, quién es tu ejecutivo y el plazo para firmar. Si algo no se entiende, pregúntalo antes de firmar.' },
    { id: 'docs_firma', label: 'Reúne los documentos para firmar el contrato', detail: `Pregúntale a ${op} qué te piden. Suelen pedir documentos legales vigentes de la empresa y datos de una cuenta bancaria a su nombre.` },
    { id: 'contrato', label: 'Firma el contrato o convenio', detail: 'Desde la firma corren los plazos del proyecto. Guarda una copia: ahí están las reglas de gastos y rendición que vas a tener que cumplir.' },
    { id: 'garantia', label: 'Si pides anticipo, contrata la garantía', detail: 'Normalmente se pide una póliza o boleta de garantía por el monto anticipado. Si no pides anticipo, los gastos se te reembolsan contra rendición.' },
    { id: 'inicio', label: 'Define la fecha de inicio del proyecto', detail: 'Anótala aquí abajo: con ella calculamos las fechas de tus hitos e informes.' },
    { id: 'reunion', label: `Coordina una reunión de inicio con ${op}`, detail: 'Pregunta cómo y cada cuánto se rinde, qué gastos no se aceptan y cuándo vencen los informes.' },
    { id: 'orden', label: 'Ordena tus gastos desde el primer día', detail: 'Registra aquí cada compra con su factura y comprobante de pago. Es mucho más fácil que reconstruirlo al final.' }
  ];
}

/** Arma la ejecución inicial a partir de lo que ya está en la postulación */
export function initExecution(app: ApplicationItem, fund: ChileanFund): ExecutionData {
  const f: FormulationOutput | null | undefined = app.formulation;
  const budget: ExecutionBudgetLine[] = (f?.budgetBreakdown || [])
    .map((b, i) => ({
      id: `l${i}`,
      account: b.account || 'Otros',
      item: b.item || b.account || `Ítem ${i + 1}`,
      approvedCLP: Math.max(0, Math.round((Number(b.corfoContributionCLP) || 0) + (Number(b.companyPecuniaryCLP) || 0)))
    }))
    .filter(b => b.approvedCLP > 0 || b.item);
  if (budget.length === 0) {
    let accounts: string[] = [];
    try { accounts = getFundRules(fund).budget.map(b => b.account); } catch { accounts = []; }
    (accounts.length ? accounts : ['Gastos del proyecto']).forEach((a, i) => budget.push({ id: `l${i}`, account: a, item: a, approvedCLP: 0 }));
  }
  const duration = fundDurationMonths(fund);
  const milestones: ExecutionMilestone[] = (f?.workPlanMilestones || [])
    .filter(m => m.title)
    .map((m, i) => ({ id: `h${i}`, title: m.title + (m.deliverable ? ` — entregable: ${m.deliverable}` : ''), done: false, kind: 'plan' as const, offsetMonths: monthOffset(m.month) }));
  if (duration) {
    if (duration >= 4) milestones.push({ id: 'inf_avance', title: 'Informe de avance (fecha estimada: confírmala con tu ejecutivo)', done: false, kind: 'informe', offsetMonths: Math.max(1, Math.round(duration / 2)) });
    milestones.push({ id: 'inf_final', title: 'Informe final y cierre del proyecto (fecha estimada)', done: false, kind: 'informe', offsetMonths: duration });
  } else {
    milestones.push({ id: 'inf_final', title: 'Informe final y cierre del proyecto', done: false, kind: 'informe' });
  }
  return { checklist: {}, budget, expenses: [], milestones, reports: [], ...(duration ? { durationMonths: duration } : {}) };
}

/** Recalcula las fechas de los hitos con mes asignado cuando cambia el inicio */
export function withDueDates(ex: ExecutionData, startDate?: string): ExecutionData {
  if (!startDate) return { ...ex, startDate: undefined };
  return {
    ...ex,
    startDate,
    milestones: ex.milestones.map(m => (m.offsetMonths ? { ...m, dueDate: addMonths(startDate, m.offsetMonths) } : m))
  };
}

export const spentByLine = (ex: ExecutionData) => {
  const out: Record<string, number> = {};
  for (const e of ex.expenses) out[e.lineId] = (out[e.lineId] || 0) + (Number(e.amountCLP) || 0);
  return out;
};

export function executionTotals(ex: ExecutionData) {
  const approved = ex.budget.reduce((s, b) => s + (Number(b.approvedCLP) || 0), 0);
  const spent = ex.expenses.reduce((s, e) => s + (Number(e.amountCLP) || 0), 0);
  const rendered = ex.expenses.filter(e => e.rendered).reduce((s, e) => s + (Number(e.amountCLP) || 0), 0);
  const pendingDocs = ex.expenses.filter(e => !e.paid || !e.rendered).length;
  return { approved, spent, rendered, pendingDocs, pct: approved > 0 ? Math.round((spent / approved) * 100) : 0 };
}

/** Avisos de un gasto antes de guardarlo (reglas generales, no reemplazan el contrato) */
export function expenseWarnings(e: Partial<ExecutionExpense>, ex: ExecutionData, editingId?: string): string[] {
  const w: string[] = [];
  const line = ex.budget.find(b => b.id === e.lineId);
  if (line && e.amountCLP) {
    const spentOther = ex.expenses.filter(x => x.lineId === line.id && x.id !== editingId).reduce((s, x) => s + (Number(x.amountCLP) || 0), 0);
    const left = (Number(line.approvedCLP) || 0) - spentOther;
    if (line.approvedCLP > 0 && Number(e.amountCLP) > left) {
      w.push(`Te pasas del monto aprobado para "${line.item}" (te quedan $${Math.max(0, left).toLocaleString('es-CL')}). Antes de comprar, pide una reasignación de presupuesto a tu ejecutivo: un gasto fuera de presupuesto puede no aceptarse.`);
    }
  }
  if (e.date && ex.startDate && e.date < ex.startDate) {
    w.push('La fecha es anterior al inicio del proyecto. Por lo general, los gastos anteriores al inicio no se aceptan.');
  }
  if (e.date && ex.startDate && ex.durationMonths && e.date > addMonths(ex.startDate, ex.durationMonths)) {
    w.push('La fecha queda después del término del proyecto. Si necesitas más tiempo, pide una prórroga antes de que venza.');
  }
  if (e.docType === 'boleta') {
    w.push('Una boleta de venta no muestra el RUT de tu empresa como comprador. Normalmente se pide factura a nombre de la empresa: confírmalo con tu ejecutivo antes de comprar.');
  }
  if (e.docType === 'otro') {
    w.push('Revisa que el documento sirva para rendir: normalmente se pide factura o boleta de honorarios a nombre de la empresa.');
  }
  return w;
}

/** Próximos vencimientos (no hechos) ordenados por fecha */
export function upcomingMilestones(ex: ExecutionData | null | undefined, limit = 3): ExecutionMilestone[] {
  if (!ex) return [];
  return ex.milestones.filter(m => !m.done && m.dueDate).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1)).slice(0, limit);
}

export const clp = (n: number) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

export const fmtDay = (iso?: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
};
