import React, { useMemo, useState } from 'react';
import { PLAN_PRICE_TEXT } from '../data/pricing';
import { Timer, CheckCircle2, Circle, ArrowRight, ChevronDown, ChevronUp, ExternalLink, Rocket } from 'lucide-react';
import type { ChileanFund, CompanyProfile } from '../types/funds';
import type { RoadmapStep } from '../data/fundStandards';
import { remainingMinutes, fmtMinutes, readyToSubmit, prepChecklist, isRecommendedItem } from '../data/effort';

/**
 * "Tu camino a la postulación lista": cuánto falta (en tiempo, no solo en pasos), qué es obligatorio
 * para enviarla, cuál es el próximo paso y qué tener a mano. Responde la pregunta "¿lo voy a lograr?".
 */
export const ReadinessCard: React.FC<{
  steps: RoadmapStep[];
  fund: ChileanFund;
  profile: Partial<CompanyProfile>;
  storageKey: string;
  onGo: (target: string) => void;
  hasActivePlan?: boolean;
  /** Plazo de la convocatoria (se detalla más abajo, en "Sobre este fondo") */
  deadlineText?: string;
  /** Próxima acción del recorrido completo (incluye preparar la empresa y bloqueos) */
  nextAction?: { title: string; detail?: string; label: string; target: string; blocker?: boolean; alt?: { label: string; target: string } } | null;
}> = ({ steps, fund, profile, storageKey, onGo, hasActivePlan = true, deadlineText, nextAction }) => {
  const rem = useMemo(() => remainingMinutes(steps), [steps]);
  const ready = readyToSubmit(steps);
  const submitted = steps.find(s => s.id === 'step_submit')?.items.find(i => i.id === 'portal')?.done;
  const doneSteps = steps.filter(s => s.done).length;
  const prep = useMemo(() => prepChecklist(fund, profile), [fund, profile]);
  const prepPending = prep.filter(p => !p.done).length;
  const [prepOpen, setPrepOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(`impulsacap_prep_${storageKey}`) !== 'cerrado' && doneSteps < 2; } catch { return doneSteps < 2; }
  });
  const togglePrep = () => {
    const next = !prepOpen;
    setPrepOpen(next);
    try { localStorage.setItem(`impulsacap_prep_${storageKey}`, next ? 'abierto' : 'cerrado'); } catch { /* sin efecto */ }
  };

  // Próximo paso obligatorio (lo recomendado va después)
  let next: { label: string; target: string; step: string } | null = null;
  for (const st of steps) {
    const it = st.items.find(i => !i.done && !i.warn && !isRecommendedItem(st.id, i.id));
    if (it) { next = { label: it.label, target: (it.go || st.action).target, step: st.title }; break; }
  }
  const auditPending = steps.find(s => s.id === 'step_audit' && !s.done);

  if (submitted) return null;

  return (
    <section aria-labelledby="camino-lista" className={`rounded-3xl border p-5 sm:p-6 space-y-4 ${ready ? 'bg-emerald-950 border-emerald-500/60' : 'bg-slate-900 border-slate-700'}`}>
      <div className="flex items-start gap-3">
        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${ready ? 'bg-emerald-500 text-slate-950' : 'bg-cyan-500/15 text-cyan-300'}`}>
          {ready ? <Rocket className="w-5 h-5" /> : <Timer className="w-5 h-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-cyan-300">Tu camino a la postulación lista</p>
          <h3 id="camino-lista" className="text-lg sm:text-xl font-black text-white leading-tight">
            {ready
              ? '¡Ya puedes enviar tu postulación!'
              : `Te faltan unas ${fmtMinutes(rem.toSubmit)} de trabajo para poder enviarla`}
          </h3>
          <p className="text-xs text-slate-300 mt-1">
            {ready
              ? `Tienes lo obligatorio: requisitos, formulario, presupuesto y documentos.${auditPending ? ' Antes de enviar, te recomendamos la evaluación simulada (unos 5 minutos): te dice qué mejorar para subir la nota.' : ' Abre el expediente, copia cada sección al portal y envíala.'}`
              : 'No tienes que hacerlo todo hoy: puedes avanzar en partes y todo queda guardado. Te guiamos en cada paso.'}
          </p>
          {deadlineText && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">Plazo: {deadlineText}</p>}
        </div>
      </div>

      {!hasActivePlan && !ready && (
        <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-400/30 rounded-xl p-2.5">
          Para que no haya sorpresas: los requisitos y los documentos los avanzas gratis; el formulario, el presupuesto guiado y la evaluación simulada usan la IA del Plan Trimestral ({PLAN_PRICE_TEXT} por 3 meses).{' '}
          <button type="button" onClick={() => onGo('my-company#mi-plan')} className="font-bold underline cursor-pointer">Ver el plan</button>
        </p>
      )}

      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>{doneSteps} de {steps.length} pasos listos</span>
          {!ready && rem.total > rem.toSubmit && <span>+ {fmtMinutes(rem.total - rem.toSubmit)} recomendados</span>}
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map(s => (
            <div key={s.id} title={`${s.title}${s.done ? ' · listo' : rem.byStep[s.id] ? ` · unos ${fmtMinutes(rem.byStep[s.id])}` : ''}`} className={`h-2 rounded-full ${s.done ? 'bg-emerald-500' : 'bg-slate-700'}`} />
          ))}
        </div>
      </div>

      {nextAction ? (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 ${nextAction.blocker ? 'bg-rose-950/40 border-rose-500/50' : 'bg-slate-950/60 border-slate-700'}`}>
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${nextAction.blocker ? 'text-rose-300' : 'text-emerald-300'}`}>{nextAction.blocker ? 'Atención' : 'Ahora toca'}</p>
            <p className="text-sm font-bold text-white">{nextAction.title}</p>
            {nextAction.detail && <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{nextAction.detail}</p>}
            {nextAction.alt && <button type="button" onClick={() => onGo(nextAction.alt!.target)} className="mt-1 text-xs font-bold text-cyan-300 hover:underline cursor-pointer">{nextAction.alt.label}</button>}
          </div>
          <button type="button" onClick={() => onGo(nextAction.target)} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer shrink-0">
            {nextAction.label} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
      {(next || (ready && auditPending)) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-slate-950/60 border border-slate-700 p-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Ahora toca</p>
            <p className="text-sm font-bold text-white">{ready && auditPending ? 'Evaluación simulada (recomendado)' : `${next!.step}: ${next!.label}`}</p>
          </div>
          <button type="button" onClick={() => onGo(ready && auditPending ? 'auditor' : next!.target)} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer shrink-0">
            Seguir <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
      {ready && !auditPending && (
        <button type="button" onClick={() => onGo('dossier')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer">
          Abrir el expediente para enviarla <ArrowRight className="w-4 h-4" />
        </button>
      )}

        </>
      )}

      <div className="border-t border-slate-700/80 pt-3">
        <button type="button" onClick={togglePrep} aria-expanded={prepOpen} className="w-full flex items-center justify-between gap-2 text-left cursor-pointer">
          <span className="text-sm font-bold text-white">Ten esto a mano para no detenerte {prepPending > 0 ? <span className="text-xs font-semibold text-amber-300">· te faltan {prepPending}</span> : <span className="text-xs font-semibold text-emerald-300">· tienes todo</span>}</span>
          {prepOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {prepOpen && (
          <ul className="mt-2 space-y-2">
            {prep.map(p => (
              <li key={p.id} className="flex items-start gap-2.5 text-xs">
                {p.done ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <Circle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />}
                <span className="min-w-0">
                  <span className={`block font-semibold ${p.done ? 'text-slate-400 line-through' : 'text-slate-100'}`}>{p.label}</span>
                  {!p.done && <span className="block text-slate-400">{p.why}{p.how ? ` ${p.how}` : ''}</span>}
                  {!p.done && p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-300 hover:underline mt-0.5">Abrir <ExternalLink className="w-3 h-3" /></a>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
