import React, { useEffect, useState } from 'react';
import { Trophy, Hourglass, RotateCcw, Sparkles, Upload, ArrowRight, CheckCircle2, Circle, Lightbulb, Search, Info } from 'lucide-react';
import type { ChileanFund, CompanyProfile } from '../types/funds';
import type { ApplicationItem, ApplicationResult, ExecutionData, ImprovementPlan, ReapplyContext } from '../types/application';
import { initExecution } from '../data/execution';
import { ExecutionPanel } from './ExecutionPanel';
import { apiFetch } from '../utils/apiFetch';

const SECTION_LABEL: Record<string, string> = {
  title_pitch: 'Título y pitch', problem: 'Problema', solution: 'Solución', market: 'Mercado', model: 'Modelo de negocio',
  workplan: 'Plan de trabajo', team: 'Equipo', budget: 'Presupuesto', documentos: 'Documentos y cartas', otro: 'Otros'
};
export const sectionTarget = (s: string) =>
  s === 'documentos' ? 'documents' : s === 'otro' ? 'my-application' : `formulator#section:${s}`;
const PRIORITY: Record<string, string> = { alta: 'bg-rose-100 text-rose-800', media: 'bg-amber-100 text-amber-800', baja: 'bg-slate-100 text-slate-700' };

interface Props {
  application: ApplicationItem;
  fund: ChileanFund;
  profile: CompanyProfile;
  onUpdateFields: (fields: Partial<ApplicationItem>) => Promise<boolean> | void;
  onSetResult: (result: ApplicationResult | null, extra?: Partial<ApplicationItem>) => Promise<boolean> | void;
  onReapply: () => Promise<{ ok: boolean; error?: string }>;
  onNavigate: (target: string) => void;
}

/** Pestaña "Resultado": marcar si ganó y, según eso, ejecutar el proyecto o mejorar y volver a postular */
export const ResultPanel: React.FC<Props> = ({ application, fund, profile, onUpdateFields, onSetResult, onReapply, onNavigate }) => {
  const outcome = application.result?.outcome;
  const [confirmWin, setConfirmWin] = useState(false);
  const [amount, setAmount] = useState('');
  useEffect(() => { setConfirmWin(false); }, [outcome]);

  const undo = (
    <p className="text-center">
      <button type="button" onClick={() => { if (confirm('¿Quitar el resultado marcado? Tus gastos, hitos y plan de mejora quedan guardados por si lo vuelves a marcar.')) onSetResult(null); }} className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer">
        Me equivoqué al marcar el resultado
      </button>
    </p>
  );

  if (outcome === 'adjudicada') {
    const execution: ExecutionData = application.execution || initExecution(application, fund);
    return (
      <div className="space-y-4">
        <ExecutionPanel application={application} execution={execution} fund={fund} profile={profile} onChange={ex => onUpdateFields({ execution: ex })} onNavigate={onNavigate} />
        {undo}
      </div>
    );
  }

  if (outcome === 'no_adjudicada') {
    return (
      <div className="space-y-4">
        <ImprovementPanel application={application} fund={fund} onUpdateFields={onUpdateFields} onReapply={onReapply} onNavigate={onNavigate} />
        {undo}
      </div>
    );
  }

  // Sin resultado todavía
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7 space-y-5">
        <div className="flex items-start gap-3">
          <Hourglass className="w-7 h-7 text-violet-600 shrink-0" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-violet-700">Después de postular</p>
            <h2 className="text-xl font-black text-slate-900">¿Ya te avisaron el resultado de {fund.name}?</h2>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed max-w-3xl">
              Los resultados suelen tardar algunas semanas y llegan por correo o al portal del fondo (revisa también la carpeta de spam). Mientras tanto no tienes que hacer nada más.
              Cuando te avisen, márcalo aquí: <strong>si ganaste</strong>, te acompañamos a firmar, comprar, rendir y entregar los informes; <strong>si no</strong>, armamos un plan de mejora con la evaluación del comité y vuelves a postular sin partir de cero.
            </p>
          </div>
        </div>

        {!confirmWin ? (
          <div className="grid sm:grid-cols-2 gap-3">
            <button type="button" onClick={() => setConfirmWin(true)} className="p-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-left cursor-pointer transition-colors">
              <Trophy className="w-6 h-6 text-amber-200" />
              <p className="mt-2 text-lg font-black">¡Gané!</p>
              <p className="text-xs text-emerald-50">Te acompañamos en la ejecución del proyecto.</p>
            </button>
            <button type="button" onClick={() => onSetResult({ outcome: 'no_adjudicada', decidedAt: new Date().toISOString() })} className="p-5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-left cursor-pointer transition-colors border border-slate-200">
              <RotateCcw className="w-6 h-6 text-slate-600" />
              <p className="mt-2 text-lg font-black text-slate-900">No gané esta vez</p>
              <p className="text-xs text-slate-600">Armamos un plan para volver a postular mejor.</p>
            </button>
          </div>
        ) : (
          <form className="p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 space-y-3" onSubmit={e => {
            e.preventDefault();
            const n = Math.round(Number(String(amount).replace(/[^\d]/g, '')) || 0);
            const result: ApplicationResult = { outcome: 'adjudicada', decidedAt: new Date().toISOString(), ...(n > 0 ? { awardedAmountCLP: n } : {}) };
            onSetResult(result, application.execution ? {} : { execution: initExecution(application, fund) });
          }}>
            <p className="text-base font-black text-emerald-900">¡Qué buena noticia! 🎉</p>
            <div>
              <label htmlFor="monto-adjudicado" className="block text-xs font-bold text-slate-700 mb-1">Monto adjudicado (opcional, lo dice tu carta de adjudicación)</label>
              <input id="monto-adjudicado" inputMode="numeric" className="w-full sm:w-64 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" placeholder="Ej: 15000000" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="submit" className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold cursor-pointer">Empezar la ejecución <ArrowRight className="w-4 h-4" /></button>
              <button type="button" onClick={() => setConfirmWin(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold cursor-pointer">Volver</button>
            </div>
          </form>
        )}
        <p className="text-xs text-slate-500 flex items-start gap-1.5"><Info className="w-4 h-4 shrink-0" /> Marcar el resultado libera el cupo de esta postulación: puedes empezar otra mientras ejecutas o mejoras esta.</p>
      </section>
    </div>
  );
};

/** Si no ganó: evaluación del comité → plan de mejora → nueva postulación con todo el trabajo copiado */
const ImprovementPanel: React.FC<{
  application: ApplicationItem;
  fund: ChileanFund;
  onUpdateFields: (fields: Partial<ApplicationItem>) => Promise<boolean> | void;
  onReapply: () => Promise<{ ok: boolean; error?: string }>;
  onNavigate: (target: string) => void;
}> = ({ application, fund, onUpdateFields, onReapply, onNavigate }) => {
  const review = application.rejectionReview || {};
  const plan: ImprovementPlan | null | undefined = review.plan;
  const [text, setText] = useState(review.evaluationText || '');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const [showForm, setShowForm] = useState(!plan);

  const analyze = async () => {
    setLoading(true); setError(null); setNeedsPlan(false);
    try {
      let fileBase64: string | undefined;
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error('El PDF pesa más de 10 MB. Copia y pega el texto de la evaluación.');
        fileBase64 = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error('No pudimos leer el archivo.')); r.readAsDataURL(file); });
      }
      const res = await apiFetch('/api/gemini/plan-mejora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fund: { id: fund.id, name: fund.name, agency: fund.agency, evaluationCriteria: (fund as any).evaluationCriteria }, evaluationText: text, fileBase64, formulation: application.formulation || null })
      });
      if (res.status === 402) { setNeedsPlan(true); return; }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.plan) throw new Error(data.error || 'No pudimos armar el plan. Intenta de nuevo.');
      await onUpdateFields({ rejectionReview: { ...review, evaluationText: String(data.evaluationText || text).slice(0, 20000), plan: data.plan, createdAt: new Date().toISOString() } });
      setShowForm(false);
    } catch (e: any) {
      setError(e?.message || 'No pudimos armar el plan.');
    } finally {
      setLoading(false);
    }
  };

  const reapply = async () => {
    setReapplying(true); setError(null);
    try {
      const r = await onReapply();
      if (!r.ok) setError(r.error || 'No pudimos crear la nueva postulación.');
    } finally {
      setReapplying(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 to-blue-950 text-white p-5 sm:p-7 space-y-2">
        <p className="text-xs font-black uppercase tracking-wider text-cyan-300">No ganaste esta vez · y tiene arreglo</p>
        <h2 className="text-xl sm:text-2xl font-black leading-tight">Muchos proyectos que ganan no lo logran a la primera.</h2>
        <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">
          Lo más valioso que tienes ahora es la evaluación del comité: ahí dice exactamente dónde perdiste puntos. Con ella armamos un plan de mejora y creamos una nueva postulación a {fund.name} con todo tu trabajo copiado, para que solo corrijas lo que falló.
        </p>
      </section>

      {showForm ? (
        <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-900">1. Trae la evaluación del comité</h3>
            <p className="text-xs text-slate-500 mt-0.5">Suele llegar por correo o estar en el portal del fondo junto al resultado (puntajes y comentarios por criterio). Si no te la enviaron, pídela: tienes derecho a conocerla.</p>
          </div>
          <div>
            <label htmlFor="eval-texto" className="block text-xs font-bold text-slate-700 mb-1">Pega aquí los comentarios y puntajes</label>
            <textarea id="eval-texto" rows={7} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" value={text} onChange={e => setText(e.target.value)} placeholder={'Ej: Criterio Equipo: 3,0. "El equipo no demuestra experiencia en ventas…"\nCriterio Mercado: 2,5. "No se identifica con claridad al cliente…"'} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer w-fit">
              <Upload className="w-4 h-4" /> {file ? file.name.slice(0, 40) : 'O sube el PDF de la evaluación'}
              <input type="file" accept="application/pdf" className="sr-only" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
            {file && <button type="button" onClick={() => setFile(null)} className="text-xs text-slate-500 underline cursor-pointer w-fit">Quitar archivo</button>}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="button" disabled={loading || (!text.trim() && !file)} onClick={analyze} className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {loading ? 'Analizando la evaluación…' : 'Armar mi plan de mejora'}
            </button>
            {plan && <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-bold cursor-pointer">Ver mi plan actual</button>}
          </div>
          {needsPlan && (
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-sm text-blue-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>El análisis con IA es parte del Plan. Igual puedes volver a postular con tu trabajo copiado (abajo).</span>
              <button type="button" onClick={() => onNavigate('my-company#mi-plan')} className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 hover:underline cursor-pointer shrink-0">Ver el plan <ArrowRight className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </section>
      ) : plan && (
        <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" /> Tu plan de mejora</h3>
            <button type="button" onClick={() => setShowForm(true)} className="text-xs font-bold text-blue-700 hover:underline cursor-pointer w-fit">Cambiar la evaluación</button>
          </div>
          {plan.summary && <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-2xl p-4">{plan.summary}</p>}

          {plan.scores && plan.scores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-slate-500"><th className="py-1.5 pr-3">Criterio</th><th className="py-1.5 pr-3">Puntaje</th><th className="py-1.5">Lo que dijo el comité</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {plan.scores.map((s, i) => <tr key={i}><td className="py-2 pr-3 font-semibold text-slate-800">{s.criterion}</td><td className="py-2 pr-3 font-mono">{s.score}</td><td className="py-2 text-slate-600 text-xs">{s.comment}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}

          <ol className="space-y-2.5">
            {plan.improvements.map((m, i) => (
              <li key={i} className="p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-slate-400">{i + 1}.</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[11px] font-bold">{SECTION_LABEL[m.section] || 'Otros'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${PRIORITY[m.priority] || PRIORITY.media}`}>Prioridad {m.priority}</span>
                </div>
                {m.problem && <p className="text-sm text-slate-600"><strong className="text-slate-800">Qué falló:</strong> {m.problem}</p>}
                <p className="text-sm text-slate-900"><strong>Qué hacer:</strong> {m.action}</p>
              </li>
            ))}
          </ol>

          {plan.nextSteps?.length > 0 && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-sm font-bold text-emerald-900">Próximos pasos</p>
              <ul className="mt-1 text-sm text-emerald-900 list-disc pl-5 space-y-0.5">{plan.nextSteps.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-3">
        <h3 className="text-base font-black text-slate-900">{plan ? '2. ' : ''}Vuelve a postular sin partir de cero</h3>
        {review.reappliedAs ? (
          <>
            <p className="text-sm text-slate-600">Ya creaste la nueva postulación a {fund.name}, con tu formulario, presupuesto y documentos copiados{plan ? ' y las mejoras como lista de tareas' : ''}.</p>
            <button type="button" onClick={() => onNavigate(`open-app:${review.reappliedAs}`)} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer">Abrir la nueva postulación <ArrowRight className="w-4 h-4" /></button>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Creamos una postulación nueva a {fund.name} con tu formulario, presupuesto y documentos copiados{plan ? ', y con las mejoras como lista de tareas' : ''}. Cuando abra la próxima convocatoria, solo corriges lo que falló y la envías. Ocupa uno de tus 3 cupos.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" disabled={reapplying} onClick={reapply} className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                <RotateCcw className="w-4 h-4" /> {reapplying ? 'Creando…' : `Volver a postular a ${fund.name}`}
              </button>
              <button type="button" onClick={() => onNavigate('search-funds')} className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-bold cursor-pointer">
                <Search className="w-4 h-4" /> Buscar otro fondo que calce
              </button>
            </div>
          </>
        )}
        {error && <p className="text-sm text-rose-700" role="alert">{error}</p>}
      </section>
    </div>
  );
};

/** En una postulación creada a partir de una no ganada: las mejoras pendientes como lista de tareas */
export const ReapplyBanner: React.FC<{
  context: ReapplyContext;
  onToggle: (done: Record<string, boolean>) => void;
  onNavigate: (target: string) => void;
}> = ({ context, onToggle, onNavigate }) => {
  const items = context.improvements || [];
  const doneCount = items.filter((_, i) => context.done?.[String(i)]).length;
  return (
    <section className="rounded-3xl bg-amber-50 border border-amber-200 p-5 space-y-3">
      <div>
        <p className="text-xs font-black uppercase tracking-wider text-amber-800">Segunda oportunidad</p>
        <h3 className="text-base font-black text-slate-900">Copiamos tu postulación anterior: ahora corrige lo que falló</h3>
        <p className="text-xs text-slate-600 mt-0.5">
          {items.length ? `Llevas ${doneCount} de ${items.length} mejoras. Antes de enviar, actualiza también las fechas de tus cartas y revisa que las bases no hayan cambiado.` : 'Antes de enviar, actualiza las fechas de tus cartas, revisa que las bases no hayan cambiado y vuelve a pasar la evaluación simulada.'}
        </p>
      </div>
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((m, i) => {
            const done = Boolean(context.done?.[String(i)]);
            return (
              <li key={i} className={`flex items-start gap-3 p-3 rounded-2xl border ${done ? 'bg-white/60 border-emerald-200' : 'bg-white border-amber-200'}`}>
                <button type="button" aria-label={done ? 'Marcar como pendiente' : 'Marcar como hecha'} aria-pressed={done} onClick={() => onToggle({ ...(context.done || {}), [String(i)]: !done })} className="cursor-pointer shrink-0 mt-0.5">
                  {done ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Circle className="w-5 h-5 text-amber-400" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${done ? 'text-slate-400 line-through' : 'text-slate-900'}`}><strong>{SECTION_LABEL[m.section] || 'Otros'}:</strong> {m.action}</p>
                  {!done && <button type="button" onClick={() => onNavigate(sectionTarget(m.section))} className="mt-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer">Ir a corregirlo →</button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
