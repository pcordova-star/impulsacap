import React, { useMemo, useState } from 'react';
import { CheckCircle2, Circle, CalendarDays, Wallet, FileText, Plus, Trash2, AlertTriangle, Download, Sparkles, Copy, Info, PartyPopper, ArrowRight } from 'lucide-react';
import type { ChileanFund, CompanyProfile } from '../types/funds';
import type { ApplicationItem, ExecutionData, ExecutionExpense, ExpenseDocType, ExecutionMilestone } from '../types/application';
import {
  postAwardChecklist, withDueDates, spentByLine, executionTotals, expenseWarnings, upcomingMilestones,
  operatorName, clp, fmtDay, todayIso, newId
} from '../data/execution';
import { apiFetch } from '../utils/apiFetch';

const DOC_TYPES: { id: ExpenseDocType; label: string }[] = [
  { id: 'factura', label: 'Factura' },
  { id: 'boleta_honorarios', label: 'Boleta de honorarios' },
  { id: 'boleta', label: 'Boleta de venta' },
  { id: 'otro', label: 'Otro documento' }
];

const card = 'rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4';
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500';
const label = 'block text-xs font-bold text-slate-700 mb-1';

interface Props {
  application: ApplicationItem;
  execution: ExecutionData;
  fund: ChileanFund;
  profile: CompanyProfile;
  onChange: (ex: ExecutionData) => void;
  onNavigate: (target: string) => void;
}

export const ExecutionPanel: React.FC<Props> = ({ application, execution: ex, fund, profile, onChange, onNavigate }) => {
  const checklist = useMemo(() => postAwardChecklist(fund), [fund]);
  const totals = executionTotals(ex);
  const spent = spentByLine(ex);
  const upcoming = upcomingMilestones(ex, 3);
  const op = operatorName(fund);
  // "Define la fecha de inicio" queda hecho apenas se ingresa la fecha
  const isDone = (id: string) => Boolean(ex.checklist?.[id]) || (id === 'inicio' && Boolean(ex.startDate));
  const checklistDone = checklist.filter(c => isDone(c.id)).length;

  // --- Gastos ---
  const emptyExpense = (): Partial<ExecutionExpense> => ({ date: todayIso(), lineId: ex.budget[0]?.id || '', provider: '', description: '', amountCLP: undefined, docType: 'factura', docNumber: '', paid: false, rendered: false });
  const [draft, setDraft] = useState<Partial<ExecutionExpense>>(emptyExpense);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const warnings = expenseWarnings(draft, ex, editingId || undefined);
  const canSave = Boolean(draft.date && draft.lineId && draft.provider?.trim() && Number(draft.amountCLP) > 0);

  const saveExpense = () => {
    if (!canSave) return;
    const item: ExecutionExpense = {
      id: editingId || newId('g'),
      date: draft.date!, lineId: draft.lineId!, provider: draft.provider!.trim().slice(0, 160),
      description: (draft.description || '').trim().slice(0, 300), amountCLP: Math.round(Number(draft.amountCLP)),
      docType: (draft.docType || 'factura') as ExpenseDocType, docNumber: (draft.docNumber || '').trim().slice(0, 40),
      paid: Boolean(draft.paid), rendered: Boolean(draft.rendered)
    };
    const expenses = editingId ? ex.expenses.map(e => (e.id === editingId ? item : e)) : [...ex.expenses, item];
    onChange({ ...ex, expenses: expenses.sort((a, b) => (a.date < b.date ? 1 : -1)) });
    setDraft(emptyExpense());
    setEditingId(null);
    setShowExpenseForm(false);
  };

  const exportCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['Fecha', 'Ítem del presupuesto', 'Cuenta', 'Proveedor', 'Detalle', 'Documento', 'N° documento', 'Monto', 'Pagado', 'Rendido']];
    for (const e of ex.expenses) {
      const l = ex.budget.find(b => b.id === e.lineId);
      rows.push([e.date, l?.item || '', l?.account || '', e.provider, e.description, DOC_TYPES.find(d => d.id === e.docType)?.label || '', e.docNumber || '', String(e.amountCLP), e.paid ? 'Sí' : 'No', e.rendered ? 'Sí' : 'No']);
    }
    const blob = new Blob(['﻿' + rows.map(r => r.map(esc).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gastos-${(fund.name || 'proyecto').toLowerCase().replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // --- Hitos ---
  const [newMilestone, setNewMilestone] = useState({ title: '', dueDate: '' });
  const setMilestone = (id: string, patch: Partial<ExecutionMilestone>) => onChange({ ...ex, milestones: ex.milestones.map(m => (m.id === id ? { ...m, ...patch } : m)) });
  const sortedMilestones = [...ex.milestones].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueDate && b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    return a.dueDate ? -1 : b.dueDate ? 1 : 0;
  });

  // --- Informe con IA ---
  const [activities, setActivities] = useState('');
  const [reportLoading, setReportLoading] = useState<null | 'avance' | 'final'>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const makeReport = async (kind: 'avance' | 'final') => {
    setReportLoading(kind); setReportError(null); setNeedsPlan(false);
    try {
      const res = await apiFetch('/api/gemini/informe-ejecucion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          fund: { id: fund.id, name: fund.name, agency: fund.agency },
          fundName: fund.name,
          companyName: profile.companyName,
          projectTitle: application.formulation?.projectTitle || '',
          summary: application.formulation?.pitchSummary30s || application.formulation?.solutionAndInnovation || profile.projectProfile?.whatItDoes || '',
          startDate: ex.startDate, durationMonths: ex.durationMonths,
          activities,
          milestones: ex.milestones.map(m => ({ title: m.title, done: m.done, dueDate: m.dueDate })),
          budget: ex.budget.map(b => ({ item: b.item, account: b.account, approvedCLP: b.approvedCLP, spentCLP: spent[b.id] || 0 }))
        })
      });
      if (res.status === 402) { setNeedsPlan(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.text) throw new Error(data.error || 'No pudimos redactar el informe. Intenta de nuevo.');
      onChange({ ...ex, reports: [{ id: newId('inf'), kind, createdAt: new Date().toISOString(), text: String(data.text).slice(0, 20000) }, ...(ex.reports || [])].slice(0, 10) });
    } catch (e: any) {
      setReportError(e?.message || 'No pudimos redactar el informe.');
    } finally {
      setReportLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Encabezado */}
      <section className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <PartyPopper className="w-7 h-7 text-amber-200 shrink-0" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-emerald-100">Etapa 4 · Ejecuta tu proyecto</p>
            <h2 className="text-xl sm:text-2xl font-black leading-tight">¡Felicitaciones! Ganaste {fund.name}</h2>
            <p className="text-sm text-emerald-50 mt-1.5 max-w-3xl leading-relaxed">
              Ahora viene la parte que muchos subestiman: firmar, comprar según el presupuesto aprobado, rendir cada gasto y entregar los informes a tiempo. Aquí lo llevas ordenado para que no te rechacen ningún gasto. Las reglas exactas están en tu contrato: ante la duda, pregúntale a {op}.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { k: 'Presupuesto aprobado', v: clp(totals.approved) },
            { k: 'Gastado', v: `${clp(totals.spent)} (${totals.pct}%)` },
            { k: 'Ya rendido', v: clp(totals.rendered) },
            { k: 'Primeros pasos', v: `${checklistDone} de ${checklist.length}` }
          ].map(x => (
            <div key={x.k} className="rounded-2xl bg-white/10 border border-white/15 p-3">
              <p className="text-[11px] text-emerald-100">{x.k}</p>
              <p className="text-sm sm:text-base font-black">{x.v}</p>
            </div>
          ))}
        </div>
        {upcoming.length > 0 && (
          <div className="rounded-2xl bg-white/10 border border-white/15 p-3 text-sm">
            <p className="font-bold flex items-center gap-1.5"><CalendarDays className="w-4 h-4" /> Próximos vencimientos</p>
            <ul className="mt-1 space-y-0.5 text-emerald-50">
              {upcoming.map(m => <li key={m.id}><strong>{fmtDay(m.dueDate)}</strong> · {m.title}</li>)}
            </ul>
          </div>
        )}
      </section>

      {/* 1. Primeros pasos */}
      <section className={card} aria-labelledby="ej-pasos">
        <div>
          <h3 id="ej-pasos" className="text-base font-black text-slate-900">1. Primeros pasos después de ganar</h3>
          <p className="text-xs text-slate-500 mt-0.5">Una guía general: tu carta de adjudicación y tu contrato mandan.</p>
        </div>
        <ul className="space-y-2">
          {checklist.map(c => {
            const done = isDone(c.id);
            return (
              <li key={c.id}>
                <button type="button" onClick={() => onChange({ ...ex, checklist: { ...(ex.checklist || {}), [c.id]: !done } })} className={`w-full text-left flex items-start gap-3 p-3 rounded-2xl border transition-colors cursor-pointer ${done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 hover:border-blue-300'}`} aria-pressed={done}>
                  {done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0 mt-0.5" />}
                  <span>
                    <span className={`block text-sm font-bold ${done ? 'text-emerald-900' : 'text-slate-900'}`}>{c.label}</span>
                    <span className="block text-xs text-slate-600 mt-0.5">{c.detail}</span>
                  </span>
                </button>
                {c.id === 'garantia' && (
                  <button type="button" onClick={() => onNavigate('guarantees')} className="mt-1 ml-11 text-xs font-bold text-blue-700 hover:underline cursor-pointer">Calcular la garantía del anticipo →</button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 2. Fechas e hitos */}
      <section className={card} aria-labelledby="ej-fechas">
        <div>
          <h3 id="ej-fechas" className="text-base font-black text-slate-900 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-blue-600" /> 2. Fechas e hitos del proyecto</h3>
          <p className="text-xs text-slate-500 mt-0.5">Con la fecha de inicio calculamos cuándo vence cada hito de tu plan de trabajo. Confirma las fechas de los informes con tu ejecutivo.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ej-inicio" className={label}>Fecha de inicio del proyecto</label>
            <input id="ej-inicio" type="date" className={input} value={ex.startDate || ''} onChange={e => onChange(withDueDates(ex, e.target.value || undefined))} />
          </div>
          <div>
            <label htmlFor="ej-duracion" className={label}>Duración (meses)</label>
            <input id="ej-duracion" type="number" min={1} max={60} className={input} value={ex.durationMonths ?? ''} placeholder="Ej: 10"
              onChange={e => {
                const n = Math.max(0, Math.min(60, Number(e.target.value) || 0));
                const milestones = ex.milestones.map(m => (m.id === 'inf_final' && n ? { ...m, offsetMonths: n } : m.id === 'inf_avance' && n ? { ...m, offsetMonths: Math.max(1, Math.round(n / 2)) } : m));
                onChange(withDueDates({ ...ex, durationMonths: n || undefined, milestones }, ex.startDate));
              }} />
          </div>
        </div>
        {sortedMilestones.length === 0 && <p className="text-sm text-slate-500">Aún no hay hitos. Agrega los de tu contrato.</p>}
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
          {sortedMilestones.map(m => {
            const late = !m.done && m.dueDate && m.dueDate < todayIso();
            return (
              <li key={m.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-white">
                <button type="button" onClick={() => setMilestone(m.id, { done: !m.done })} className="flex items-start gap-2.5 text-left flex-1 min-w-0 cursor-pointer" aria-pressed={m.done}>
                  {m.done ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" /> : <Circle className={`w-5 h-5 shrink-0 ${late ? 'text-rose-400' : 'text-slate-300'}`} />}
                  <span className={`text-sm ${m.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                    {m.kind === 'informe' && <span className="mr-1.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold no-underline">Informe</span>}
                    {m.title}
                    {late && <span className="ml-1.5 text-[11px] font-bold text-rose-600">· atrasado</span>}
                  </span>
                </button>
                <div className="flex items-center gap-2 pl-7 sm:pl-0 shrink-0">
                  <input type="date" aria-label={`Fecha de ${m.title}`} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" value={m.dueDate || ''} onChange={e => setMilestone(m.id, { dueDate: e.target.value || undefined, offsetMonths: undefined })} />
                  {m.kind === 'propio' && (
                    <button type="button" aria-label="Quitar hito" onClick={() => onChange({ ...ex, milestones: ex.milestones.filter(x => x.id !== m.id) })} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <form className="flex flex-col sm:flex-row gap-2" onSubmit={e => { e.preventDefault(); if (!newMilestone.title.trim()) return; onChange({ ...ex, milestones: [...ex.milestones, { id: newId('h'), title: newMilestone.title.trim().slice(0, 200), dueDate: newMilestone.dueDate || undefined, done: false, kind: 'propio' }] }); setNewMilestone({ title: '', dueDate: '' }); }}>
          <input aria-label="Nuevo hito" className={input} placeholder="Agregar un hito o plazo (ej: entregar informe técnico)" value={newMilestone.title} onChange={e => setNewMilestone(s => ({ ...s, title: e.target.value }))} />
          <input aria-label="Fecha del nuevo hito" type="date" className={`${input} sm:w-44`} value={newMilestone.dueDate} onChange={e => setNewMilestone(s => ({ ...s, dueDate: e.target.value }))} />
          <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer shrink-0"><Plus className="w-4 h-4" /> Agregar</button>
        </form>
      </section>

      {/* 3. Presupuesto y gastos */}
      <section className={card} aria-labelledby="ej-gastos">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h3 id="ej-gastos" className="text-base font-black text-slate-900 flex items-center gap-2"><Wallet className="w-5 h-5 text-emerald-600" /> 3. Presupuesto aprobado y gastos</h3>
            <p className="text-xs text-slate-500 mt-0.5">Partimos con el presupuesto de tu postulación. Ajusta los montos a lo que te aprobaron (subsidio más tu aporte en dinero).</p>
          </div>
          {ex.expenses.length > 0 && (
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer shrink-0"><Download className="w-4 h-4" /> Descargar gastos (Excel)</button>
          )}
        </div>

        <ul className="space-y-2.5">
          {ex.budget.map(b => {
            const s = spent[b.id] || 0;
            const pct = b.approvedCLP > 0 ? Math.round((s / b.approvedCLP) * 100) : 0;
            return (
              <li key={b.id} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <input key={`n-${b.id}-${b.item}`} aria-label="Nombre del ítem" className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none focus:bg-white rounded px-1" defaultValue={b.item} onBlur={e => { const v = e.target.value.trim(); if (v && v !== b.item) onChange({ ...ex, budget: ex.budget.map(x => (x.id === b.id ? { ...x, item: v.slice(0, 160) } : x)) }); }} />
                    <p className="text-[11px] text-slate-500 px-1">{b.account}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-500">Aprobado $</span>
                    <input key={`a-${b.id}-${b.approvedCLP}`} aria-label={`Monto aprobado de ${b.item}`} type="number" min={0} className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm text-right" defaultValue={b.approvedCLP || ''} onBlur={e => { const v = Math.max(0, Math.round(Number(e.target.value) || 0)); if (v !== b.approvedCLP) onChange({ ...ex, budget: ex.budget.map(x => (x.id === b.id ? { ...x, approvedCLP: v } : x)) }); }} />
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className={`h-full rounded-full ${pct > 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <p className={`text-xs ${pct > 100 ? 'text-rose-700 font-bold' : 'text-slate-600'}`}>
                  Gastado {clp(s)}{b.approvedCLP > 0 ? ` de ${clp(b.approvedCLP)} (${pct}%)` : ''}{pct > 100 ? ' · te pasaste: pide una reasignación a tu ejecutivo' : b.approvedCLP > 0 ? ` · quedan ${clp(Math.max(0, b.approvedCLP - s))}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => onChange({ ...ex, budget: [...ex.budget, { id: newId('l'), account: 'Otro', item: 'Nuevo ítem', approvedCLP: 0 }] })} className="text-xs font-bold text-blue-700 hover:underline cursor-pointer">+ Agregar un ítem al presupuesto</button>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-900">Gastos registrados ({ex.expenses.length})</p>
            {!showExpenseForm && (
              <button type="button" onClick={() => { setDraft(emptyExpense()); setEditingId(null); setShowExpenseForm(true); }} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"><Plus className="w-4 h-4" /> Registrar un gasto</button>
            )}
          </div>

          {showExpenseForm && (
            <form className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 space-y-3" onSubmit={e => { e.preventDefault(); saveExpense(); }}>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className={label} htmlFor="g-fecha">Fecha</label><input id="g-fecha" type="date" className={input} value={draft.date || ''} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} /></div>
                <div>
                  <label className={label} htmlFor="g-item">Ítem del presupuesto</label>
                  <select id="g-item" className={input} value={draft.lineId || ''} onChange={e => setDraft(d => ({ ...d, lineId: e.target.value }))}>
                    {ex.budget.map(b => <option key={b.id} value={b.id}>{b.item}</option>)}
                  </select>
                </div>
                <div><label className={label} htmlFor="g-prov">Proveedor</label><input id="g-prov" className={input} placeholder="Ej: Comercial Sur SpA" value={draft.provider || ''} onChange={e => setDraft(d => ({ ...d, provider: e.target.value }))} /></div>
                <div><label className={label} htmlFor="g-monto">Monto total ($)</label><input id="g-monto" type="number" min={0} className={input} placeholder="Ej: 450000" value={draft.amountCLP ?? ''} onChange={e => setDraft(d => ({ ...d, amountCLP: e.target.value === '' ? undefined : Number(e.target.value) }))} /></div>
                <div className="sm:col-span-2"><label className={label} htmlFor="g-det">¿Qué compraste?</label><input id="g-det" className={input} placeholder="Ej: Horno industrial para la producción" value={draft.description || ''} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} /></div>
                <div>
                  <label className={label} htmlFor="g-doc">Documento</label>
                  <select id="g-doc" className={input} value={draft.docType || 'factura'} onChange={e => setDraft(d => ({ ...d, docType: e.target.value as ExpenseDocType }))}>
                    {DOC_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div><label className={label} htmlFor="g-num">N° del documento</label><input id="g-num" className={input} placeholder="Ej: 10234" value={draft.docNumber || ''} onChange={e => setDraft(d => ({ ...d, docNumber: e.target.value }))} /></div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={Boolean(draft.paid)} onChange={e => setDraft(d => ({ ...d, paid: e.target.checked }))} className="w-4 h-4 accent-emerald-600" /> Ya está pagado (tengo el comprobante)</label>
                <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={Boolean(draft.rendered)} onChange={e => setDraft(d => ({ ...d, rendered: e.target.checked }))} className="w-4 h-4 accent-emerald-600" /> Ya lo rendí</label>
              </div>
              {warnings.length > 0 && (
                <ul className="space-y-1.5" role="status">
                  {warnings.map(w => <li key={w} className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-2.5"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />{w}</li>)}
                </ul>
              )}
              <p className="text-[11px] text-slate-500">Recuerda: la factura debe ir a nombre de tu empresa ({profile.rut || 'tu RUT'}), el gasto debe ser del proyecto y debes guardar el comprobante de pago (transferencia desde la cuenta de la empresa).</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="submit" disabled={!canSave} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">{editingId ? 'Guardar cambios' : warnings.length ? 'Guardar igual' : 'Guardar gasto'}</button>
                <button type="button" onClick={() => { setShowExpenseForm(false); setEditingId(null); }} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold cursor-pointer">Cancelar</button>
              </div>
            </form>
          )}

          {ex.expenses.length === 0 && !showExpenseForm && (
            <p className="text-sm text-slate-500">Todavía no registras gastos. Cada vez que compres algo del proyecto, anótalo aquí con su factura: al momento de rendir vas a tener todo listo.</p>
          )}
          {ex.expenses.length > 0 && (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {ex.expenses.map(e => {
                const l = ex.budget.find(b => b.id === e.lineId);
                return (
                  <li key={e.id} className="p-3 bg-white flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{clp(e.amountCLP)} · {e.provider}</p>
                      <p className="text-xs text-slate-500 truncate">{fmtDay(e.date)} · {l?.item || 'Sin ítem'}{e.description ? ` · ${e.description}` : ''} · {DOC_TYPES.find(d => d.id === e.docType)?.label}{e.docNumber ? ` N° ${e.docNumber}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button type="button" onClick={() => onChange({ ...ex, expenses: ex.expenses.map(x => (x.id === e.id ? { ...x, paid: !x.paid } : x)) })} className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${e.paid ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>{e.paid ? 'Pagado' : 'Falta pagar'}</button>
                      <button type="button" onClick={() => onChange({ ...ex, expenses: ex.expenses.map(x => (x.id === e.id ? { ...x, rendered: !x.rendered } : x)) })} className={`px-2 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${e.rendered ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{e.rendered ? 'Rendido' : 'Sin rendir'}</button>
                      <button type="button" onClick={() => { setDraft({ ...e }); setEditingId(e.id); setShowExpenseForm(true); }} className="px-2 py-1 rounded-lg text-[11px] font-bold text-blue-700 hover:bg-blue-50 cursor-pointer">Editar</button>
                      <button type="button" aria-label="Eliminar gasto" onClick={() => { if (confirm('¿Eliminar este gasto?')) onChange({ ...ex, expenses: ex.expenses.filter(x => x.id !== e.id) }); }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {/* 4. Informes */}
      <section className={card} aria-labelledby="ej-informes">
        <div>
          <h3 id="ej-informes" className="text-base font-black text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-violet-600" /> 4. Informes de avance y final</h3>
          <p className="text-xs text-slate-500 mt-0.5">Cuéntanos con tus palabras qué hiciste y armamos un borrador con tus hitos y gastos. Después lo ajustas al formato que te pida tu ejecutivo.</p>
        </div>
        <div>
          <label htmlFor="ej-actividades" className={label}>¿Qué hiciste en este período?</label>
          <textarea id="ej-actividades" rows={4} className={input} value={activities} onChange={e => setActivities(e.target.value)} placeholder="Ej: Compramos el horno y lo instalamos en marzo. Hicimos 3 pruebas de producción y vendimos los primeros 200 frascos a 2 almacenes del barrio. Nos atrasamos un mes con la resolución sanitaria." />
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="button" disabled={Boolean(reportLoading)} onClick={() => makeReport('avance')} className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"><Sparkles className={`w-4 h-4 ${reportLoading === 'avance' ? 'animate-spin' : ''}`} /> {reportLoading === 'avance' ? 'Redactando…' : 'Borrador de informe de avance'}</button>
          <button type="button" disabled={Boolean(reportLoading)} onClick={() => makeReport('final')} className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-violet-300 text-violet-800 hover:bg-violet-50 text-xs font-bold cursor-pointer disabled:opacity-50"><Sparkles className={`w-4 h-4 ${reportLoading === 'final' ? 'animate-spin' : ''}`} /> {reportLoading === 'final' ? 'Redactando…' : 'Borrador de informe final'}</button>
        </div>
        {needsPlan && (
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-sm text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>Los borradores con IA son parte del Plan. El resto de esta etapa (gastos, hitos, lista) es gratis.</span>
            <button type="button" onClick={() => onNavigate('my-company#mi-plan')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:underline cursor-pointer shrink-0">Ver el plan <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
        )}
        {reportError && <p className="text-sm text-rose-700" role="alert">{reportError}</p>}
        {(ex.reports || []).map(r => (
          <article key={r.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">Informe {r.kind === 'final' ? 'final' : 'de avance'} · {new Date(r.createdAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => { navigator.clipboard?.writeText(r.text).then(() => { setCopiedId(r.id); setTimeout(() => setCopiedId(null), 2000); }).catch(() => {}); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-bold text-slate-700 cursor-pointer"><Copy className="w-3.5 h-3.5" /> {copiedId === r.id ? 'Copiado' : 'Copiar'}</button>
                <button type="button" aria-label="Eliminar informe" onClick={() => { if (confirm('¿Eliminar este borrador?')) onChange({ ...ex, reports: (ex.reports || []).filter(x => x.id !== r.id) }); }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {/\[COMPLETAR/i.test(r.text) && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">Tiene datos por completar marcados con [COMPLETAR]: reemplázalos antes de entregarlo.</p>}
            <textarea aria-label="Texto del informe" rows={10} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 font-mono leading-relaxed" defaultValue={r.text}
              onBlur={e => { if (e.target.value !== r.text) onChange({ ...ex, reports: (ex.reports || []).map(x => (x.id === r.id ? { ...x, text: e.target.value.slice(0, 20000) } : x)) }); }} />
          </article>
        ))}
      </section>

      {/* Reglas de oro */}
      <section className="rounded-3xl bg-slate-900 text-white p-5 sm:p-6 space-y-2">
        <p className="text-sm font-black flex items-center gap-2"><Info className="w-4 h-4 text-cyan-300" /> Reglas de oro para que no te rechacen gastos</p>
        <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li>Compra solo lo que está en el presupuesto aprobado. Si necesitas cambiar algo, pide la reasignación <strong className="text-white">antes</strong> de comprar.</li>
          <li>Factura a nombre de tu empresa y pago desde la cuenta de la empresa. Evita pagar en efectivo.</li>
          <li>Guarda todo: factura, comprobante de transferencia y, si aplica, fotos del bien o del servicio realizado.</li>
          <li>No compres a socios, familiares ni a empresas relacionadas sin preguntar antes: suele estar prohibido.</li>
          <li>Rinde a medida que gastas, no todo al final. Y si te vas a atrasar, pide la prórroga antes de que venza el plazo.</li>
        </ul>
        <p className="text-[11px] text-slate-400">Son reglas generales. Las que valen para ti están en tu contrato o convenio y en las instrucciones de rendición de tu fondo.</p>
      </section>
    </div>
  );
};
