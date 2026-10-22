import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Compass, Lock, X } from 'lucide-react';
import type { ChileanFund, CompanyProfile, CompanyUser } from '../types/funds';
import type { ExpedienteData } from '../types/expediente';
import { calculateProjectProfileCompletion } from '../types/funds';
import { validateRut } from '../utils/rutValidator';
import { computeRoadmap } from '../data/fundStandards';
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

interface Stage {
  id: string;
  title: string;
  why: string;
  done: boolean;
  next?: string;
  detail?: string;
  action: { label: string; target: string };
  locked?: boolean;
}

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

  const stages = useMemo<Stage[]>(() => {
    const isPerson = profile.companyType === 'sin_iniciar';
    const rutOk = validateRut(profile.rut || '');
    const projectPct = calculateProjectProfileCompletion(profile.projectProfile);
    const list: Stage[] = [
      {
        id: 'empresa',
        title: 'Completa los datos de tu empresa',
        why: 'Los fondos piden quién postula: nombre, RUT, tipo de empresa y región. Con eso revisamos si cumples las bases.',
        done: Boolean(profile.companyName?.trim() && profile.companyName !== 'Mi Empresa' && (rutOk || isPerson) && profile.region),
        detail: !profile.companyName?.trim() || profile.companyName === 'Mi Empresa' ? 'Falta el nombre o razón social' : !(rutOk || isPerson) ? 'Falta un RUT válido' : !profile.region ? 'Falta la región' : undefined,
        action: { label: 'Completar datos', target: 'my-company#company-identity' }
      },
      {
        id: 'proyecto',
        title: 'Cuéntanos tu proyecto',
        why: 'La IA redacta tu postulación solo con lo que tú le cuentas, sin inventar. Responde las preguntas del perfil del proyecto (5 de 7 como mínimo).',
        done: projectPct >= 70,
        detail: `Perfil del proyecto al ${projectPct}%`,
        action: { label: 'Completar perfil del proyecto', target: 'my-company#project-profile' }
      },
      {
        id: 'carpeta',
        title: 'Sube tu carpeta tributaria',
        why: 'Con ella revisamos tus ventas, antigüedad e inicio de actividades contra los requisitos de cada fondo. Se descarga gratis en sii.cl.',
        done: Boolean(profile.taxFolderUploaded) || isPerson,
        action: { label: 'Subir carpeta', target: 'sii' }
      },
      {
        id: 'fondo',
        title: 'Elige el fondo al que vas a postular',
        why: 'En el monitor ves las convocatorias abiertas y en el diagnóstico los fondos que calzan con tu empresa. Al elegir uno, se arma tu hoja de ruta según sus bases.',
        done: hasActiveApplication,
        action: { label: 'Ver convocatorias', target: 'convocatorias' }
      }
    ];
    if (hasActiveApplication) {
      const rm = computeRoadmap({
        fund,
        profile,
        rutValid: rutOk,
        formulation: expediente.formulation,
        auditResult: expediente.auditResult,
        checks: (expediente.roadmapConfirmations as any)?.checks || {},
        confirmedGarantia: Boolean(expediente.roadmapConfirmations?.confirmedGarantia),
        signedLetters: (expediente.generatedDocs || []).filter((d: any) => d.status === 'firmada').length
      });
      const WHY: Record<string, string> = {
        step_requirements: 'Revisa que cumples cada requisito de las bases. Si uno no se cumple, no conviene seguir con este fondo.',
        step_documents: 'Junta lo que se entrega con la postulación. Marca cada documento cuando lo tengas.',
        step_form: 'Redacta cada sección del formulario oficial. Respondes preguntas simples y la IA escribe el texto; tú lo revisas.',
        step_budget: 'Arma el presupuesto en las cuentas del fondo. Te guiamos con ejemplos y calculamos el aporte de tu empresa.',
        step_audit: 'Simulamos la evaluación con los criterios del fondo para corregir lo débil antes de enviar.',
        step_submit: 'Descarga el expediente y copia cada sección en el portal oficial. La postulación final la envías tú.'
      };
      rm.steps.forEach(st => {
        const pending = st.items.find(i => !i.done);
        const go = pending?.go || (pending?.confirmable ? { label: 'Revisar y marcar en la hoja de ruta', target: 'my-application' } : st.action);
        const target = go.target;
        const needsPlan = st.number >= 3 && !hasActivePlan;
        list.push({
          id: st.id,
          title: st.title,
          why: WHY[st.id] || st.subtitle,
          done: st.done,
          next: pending?.label,
          detail: pending?.detail,
          locked: needsPlan,
          action: needsPlan
            ? { label: 'Activar Plan Trimestral', target: 'my-company#mi-plan' }
            : { label: go.label, target }
        });
      });
    }
    return list;
  }, [profile, hasActiveApplication, fund, expediente, hasActivePlan]);

  const currentIdx = stages.findIndex(s => !s.done);
  const current = currentIdx >= 0 ? stages[currentIdx] : null;
  const total = hasActiveApplication ? stages.length : 10;
  const doneCount = stages.filter(s => s.done).length;

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
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3.5">
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Siguiente paso · {currentIdx + 1} de {total}</p>
              <p className="text-sm font-bold text-slate-900">{current.title}</p>
              <p className="text-xs text-slate-600 mt-0.5">{current.next ? `Ahora: ${current.next}` : current.why}</p>
            </div>
          )}
        </div>
        <div className="px-5 sm:px-6 pb-5 sm:pb-6 flex flex-col gap-2">
          {current && (
            <button type="button" onClick={() => { setPrompt(null); onGo(current.action.target); }} className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer">
              Seguir: {current.action.label} <ArrowRight className="w-4 h-4" />
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
        {current ? `Paso ${currentIdx + 1} de ${total}: ${current.title}` : 'Postulación lista'}
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
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Paso {currentIdx + 1} de {total}{hasActiveApplication && currentIdx >= 4 ? ` · ${fund.name}` : ''}</p>
              <p className="text-base font-black text-slate-900 leading-snug">{current.title}</p>
              <p className="text-[13px] text-slate-600 leading-relaxed mt-1">{current.why}</p>
            </div>
            {(current.next || current.detail) && (
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-[13px]">
                {current.next && <p className="font-semibold text-slate-800">Ahora: {current.next}</p>}
                {current.detail && <p className="text-slate-500 text-xs mt-0.5">{current.detail}</p>}
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
                <button
                  type="button"
                  onClick={() => onGo(s.action.target)}
                  className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer ${i === currentIdx ? 'bg-blue-50 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'}`}
                >
                  {s.done
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    : <span className={`w-4 h-4 rounded-full border-2 shrink-0 ${i === currentIdx ? 'border-blue-600' : 'border-slate-300'}`} />}
                  <span className={s.done ? 'text-slate-400 line-through' : ''}>{i + 1}. {s.title}</span>
                </button>
              </li>
            ))}
            {!hasActiveApplication && (
              <li className="px-2 py-1.5 text-xs text-slate-400">5 a 10. Hoja de ruta del fondo: requisitos, documentos, formulario, presupuesto, evaluación y envío</li>
            )}
          </ol>
        )}
      </div>
    </aside>
    </>
  );
};
