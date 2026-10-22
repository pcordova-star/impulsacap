import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Compass, Lock, X } from 'lucide-react';
import type { ChileanFund, CompanyProfile, CompanyUser } from '../types/funds';
import type { ExpedienteData } from '../types/expediente';
import { computeJourney, type JourneyStage } from '../data/journey';
import { onSaved } from '../utils/guideEvents';

/**
 * El consultor: acompaña al usuario por la línea de pasos completa, siempre visible.
 * Primero prepara la empresa (datos, perfil del proyecto, carpeta, fondo) y luego sigue
 * la hoja de ruta de 6 pasos del fondo elegido, diciendo qué hacer ahora y por qué.
 */
interface Props {
  currentUser: CompanyUser | null;
  profile: CompanyProfile;
  hasActiveApplication: boolean;
  fund: ChileanFund;
  expediente: ExpedienteData;
  hasActivePlan: boolean;
  activeTab: string;
  onGo: (target: string) => void;
}

type Stage = JourneyStage;

const HIDDEN_TABS = new Set(['admin', 'vendedor', 'terminos', 'privacidad', 'pago-resultado']);
const STORAGE_OPEN = 'impulsacap_consultor_open';
const STORAGE_LAST = 'impulsacap_consultor_last';

export const ConsultantGuide: React.FC<Props> = ({ currentUser, profile, hasActiveApplication, fund, expediente, hasActivePlan, activeTab, onGo }) => {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(STORAGE_OPEN);
      if (v) return v === '1';
    } catch { /* sin almacenamiento */ }
    // En celular parte minimizado para no tapar la pantalla
    return typeof window === 'undefined' || window.innerWidth >= 1024;
  });
  const [showAll, setShowAll] = useState(false);
  const setOpenPersist = (v: boolean) => {
    setOpen(v);
    try { localStorage.setItem(STORAGE_OPEN, v ? '1' : '0'); } catch { /* sin almacenamiento */ }
  };

  const journey = useMemo(() => computeJourney({
    profile,
    fund,
    application: hasActiveApplication ? expediente : null,
    hasActivePlan
  }), [profile, hasActiveApplication, fund, expediente, hasActivePlan]);
  const stages: Stage[] = journey.stages;
  const currentIdx = journey.currentIdx;
  const current = journey.current;
  const total = journey.total;
  const doneCount = journey.doneCount;

  // Diálogo "¿qué hacemos ahora?" después de guardar o de completar un paso
  const [prompt, setPrompt] = useState<{ kind: 'done' | 'saved'; label: string } | null>(null);
  const promptRef = useRef(prompt);
  promptRef.current = prompt;
  useEffect(() => onSaved(({ label }) => {
    // Se espera un momento: si el guardado completó un paso, ya se muestra ese aviso
    setTimeout(() => { if (!promptRef.current) setPrompt({ kind: 'saved', label }); }, 700);
  }), []);

  // Al completar una etapa, felicita y propone la siguiente
  const lastRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentUser) return;
    const key = current ? `${current.id}` : 'fin';
    let prev: string | null = lastRef.current;
    if (prev === null) {
      try { prev = sessionStorage.getItem(STORAGE_LAST); } catch { prev = null; }
    }
    lastRef.current = key;
    try { sessionStorage.setItem(STORAGE_LAST, key); } catch { /* sin almacenamiento */ }
    if (!prev || prev === key) return;
    const prevIdx = stages.findIndex(s => s.id === prev);
    const prevStage = stages[prevIdx];
    if (prevStage && prevStage.done && (currentIdx === -1 || currentIdx > prevIdx)) {
      setPrompt({ kind: 'done', label: prevStage.title });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, currentUser]);

  const modal = prompt && currentUser ? (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 bg-slate-950/40 animate-fade-in" role="dialog" aria-modal="true" aria-label="Siguiente paso">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
        <div className="p-5 sm:p-6 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 className="w-6 h-6" /></span>
            <div>
              <p className="text-base font-black text-slate-900 leading-snug">
                {prompt.kind === 'done' ? `¡Paso completado! ${prompt.label}` : `${prompt.label}: guardado`}
              </p>
              <p className="text-[13px] text-slate-600 mt-0.5">
                {current ? (prompt.kind === 'done' ? '¿Seguimos con el siguiente paso?' : 'Todo quedó guardado en tu cuenta. ¿Qué quieres hacer ahora?') : 'Completaste todos los pasos. Tu postulación está lista para enviar en el portal oficial.'}
              </p>
            </div>
          </div>
          {current && (
            <div className={`rounded-2xl p-3.5 border ${current.blocker ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-100'}`}>
              <p className={`text-[11px] font-bold uppercase tracking-wider ${current.blocker ? 'text-rose-700' : 'text-blue-700'}`}>
                {current.blocker ? 'Atención · ' : 'Siguiente: '}{current.phaseLabel}
              </p>
              <p className="text-sm font-bold text-slate-900">{current.blocker ? `No cumples un requisito de ${fund.name}` : current.title}</p>
              {current.blocker ? (
                <>
                  <p className="text-xs text-slate-700 mt-1"><strong>Requisito:</strong> {current.next}</p>
                  {current.detail && <p className="text-xs text-rose-700 mt-0.5">{current.detail}</p>}
                  <p className="text-xs text-slate-600 mt-1.5">Si tus datos están bien, con este fondo no podrías postular. Te conviene buscar uno que calce con tu empresa.</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-600 mt-0.5">{current.why}</p>
                  {current.next && <p className="text-xs text-slate-800 font-semibold mt-1.5">Lo que falta: {current.next}</p>}
                </>
              )}
            </div>
          )}
        </div>
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex flex-col gap-2">
          {current && (
            <button type="button" onClick={() => { setPrompt(null); onGo(current.action.target); }} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer">
              {current.blocker ? current.action.label : `Siguiente: ${current.action.label}`} <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {current?.alt && (
            <button type="button" onClick={() => { setPrompt(null); onGo(current.alt!.target); }} className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer">
              {current.alt.label}
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setPrompt(null); onGo('my-applications'); }} className="px-3 py-2.5 rounded-2xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer">Volver a mi panel</button>
            <button type="button" onClick={() => setPrompt(null)} className="px-3 py-2.5 rounded-2xl border border-slate-200 text-slate-500 text-xs font-bold hover:bg-slate-50 cursor-pointer">Seguir aquí</button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  if (!currentUser || HIDDEN_TABS.has(activeTab)) return null;

  if (!open) {
    return (
      <>
      {modal}
      <button
        type="button"
        onClick={() => setOpenPersist(true)}
        className="fixed z-40 left-3.5 sm:left-6 bottom-20 md:bottom-6 inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 text-white text-xs font-bold shadow-xl shadow-blue-900/20 cursor-pointer"
        aria-label="Abrir el consultor"
      >
        <Compass className="w-4 h-4" />
        {current ? `Siguiente: ${current.title}` : 'Postulación lista'}
      </button>
      </>
    );
  }

  return (
    <>
    {modal}
    <aside
      aria-label="Tu consultor"
      className="fixed z-40 left-3 right-3 sm:right-auto sm:left-6 bottom-20 md:bottom-6 sm:w-[380px] rounded-3xl bg-white border border-slate-200 shadow-2xl shadow-slate-900/15 overflow-hidden"
    >
      <div className="px-4 pt-3.5 pb-3 bg-gradient-to-r from-blue-600 to-emerald-600 text-white">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"><Compass className="w-3.5 h-3.5" /> Tu consultor ImpulsaCap</p>
          <button type="button" onClick={() => setOpenPersist(false)} className="p-1 rounded-lg hover:bg-white/15 cursor-pointer" aria-label="Minimizar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/25 overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
          </div>
          <span className="text-[11px] font-bold tabular-nums">{doneCount}/{total}</span>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
        {current ? (
          <>
            <div>
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">{current.phaseLabel}</p>
              <p className="text-base font-black text-slate-900 leading-snug">{current.blocker ? `No cumples un requisito de este fondo` : current.title}</p>
              <p className="text-[13px] text-slate-600 leading-relaxed mt-1">{current.why}</p>
            </div>
            {(current.next || current.detail) && (
              <div className={`rounded-2xl border p-3 text-[13px] ${current.blocker ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                {current.next && <p className="font-semibold text-slate-800">{current.blocker ? 'Requisito: ' : 'Lo que falta: '}{current.next}</p>}
                {current.detail && <p className={`text-xs mt-0.5 ${current.blocker ? 'text-rose-700' : 'text-slate-500'}`}>{current.detail}</p>}
              </div>
            )}
            {current.locked && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex gap-1.5"><Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Desde este paso se usan las herramientas del Plan Trimestral (redacción con IA, presupuesto guiado y auditoría).</p>
            )}
            <button
              type="button"
              onClick={() => onGo(current.action.target)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer"
            >
              {current.action.label} <ArrowRight className="w-4 h-4" />
            </button>
            {current.alt && (
              <button type="button" onClick={() => onGo(current.alt!.target)} className="w-full px-4 py-2.5 rounded-2xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 cursor-pointer">
                {current.alt.label}
              </button>
            )}
          </>
        ) : (
          <div className="text-center space-y-2 py-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="font-black text-slate-900">Tu postulación está lista</p>
            <p className="text-[13px] text-slate-600">Envíala en el portal oficial antes del cierre y guarda el comprobante.</p>
          </div>
        )}

        <button type="button" onClick={() => setShowAll(v => !v)} className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer pt-1">
          Ver todos los pasos {showAll ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showAll && (
          <ol className="space-y-1">
            {stages.map((s, i) => (
              <li key={s.id}>
                {(i === 0 || stages[i - 1].phase !== s.phase) && (
                  <p className="px-2 pt-2 pb-0.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {s.phase === 'empresa' ? 'A · Prepara tu empresa' : s.phase === 'fondo' ? 'B · Elige tu fondo' : `C · Postula a ${fund.name}`}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onGo(s.action.target)}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${i === currentIdx ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  {s.done
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    : <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${i === currentIdx ? 'border-blue-600' : 'border-slate-300'}`} />}
                  <span className={s.done ? 'text-slate-400 line-through' : ''}>{s.title}</span>
                </button>
              </li>
            ))}
            {!hasActiveApplication && (
              <li className="px-2 py-1.5 text-xs text-slate-400">Después: la hoja de ruta del fondo en 6 pasos (requisitos, formulario, presupuesto, documentos, evaluación y envío)</li>
            )}
          </ol>
        )}
      </div>
    </aside>
    </>
  );
};
