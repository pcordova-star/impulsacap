import React, { useState, useMemo, useEffect } from 'react';
import { request as requestNav } from '../utils/navFocus';
import { PLAN_PRICE, PLAN_PRICE_TEXT } from '../data/pricing';
import { usePlan } from '../hooks/usePlan';
import { resolveFund, fundFromConvocatoria } from '../utils/convocatoriaFund';
import { computeJourney, fundFit } from '../data/journey';
import { NewsTeaser } from './NewsView';
import { regionFit } from '../utils/region';
import { apiFetch } from '../utils/apiFetch';
import { announceEarlyAccess, getPaymentsMode } from '../utils/earlyAccess';
import { ChileanFund, CompanyProfile, getFundVisibleStatus, CompanyUser, calculateProjectProfileCompletion } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { ApplicationItem } from '../types/application';
import { Convocatoria } from '../types/convocatoria';
import { calculateDaysRemaining } from '../utils/convocatorias';
import { validateRut, formatRut } from '../utils/rutValidator';
import { 
  Building2, 
  FileText, 
  Clock, 
  ArrowRight, 
  Plus, 
  Archive, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Upload, 
  ShieldCheck,
  ExternalLink,
  Lock,
  Layers,
  X,
  Bell,
  AlertTriangle,
  Trophy,
  Lightbulb
} from 'lucide-react';
import { executionTotals, upcomingMilestones, clp, fmtDay, initExecution } from '../data/execution';

import { db, auth } from '../firebase';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';

interface MyApplicationsDashboardProps {
  profile: CompanyProfile;
  activeApplications: ApplicationItem[];
  archivedApplications: ApplicationItem[];
  /** Con resultado marcado: ganadas (en ejecución) y no ganadas */
  resolvedApplications?: ApplicationItem[];
  convocatorias?: Convocatoria[];
  funds?: ChileanFund[];
  currentUser?: CompanyUser | null;
  onContinueApplication: (applicationId: string, target?: string) => void;
  onArchiveApplication: (applicationId: string) => Promise<{ ok: boolean }>;
  onReactivateApplication: (applicationId: string) => Promise<{ ok: boolean; error?: string }>;
  onOpenNewApplicationModal: () => void;
  onOpenProfile: () => void;
  onOpenSiiModal: () => void;
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onNavigateTab?: (tab: string) => void;
  /** Postular a una convocatoria del monitor (con su región y cierre para la confirmación) */
  onPostularCall?: (conv: any) => void;
}

export const MyApplicationsDashboard: React.FC<MyApplicationsDashboardProps> = ({
  profile,
  activeApplications,
  archivedApplications,
  resolvedApplications = [],
  convocatorias = [],
  funds = CHILEAN_FUNDS,
  currentUser,
  onContinueApplication,
  onArchiveApplication,
  onReactivateApplication,
  onOpenNewApplicationModal,
  onOpenProfile,
  onOpenSiiModal,
  onSelectFundToFormulate,
  onNavigateTab,
  onPostularCall
}) => {
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isRutValid = validateRut(profile.rut);
  const userKey = currentUser?.id || 'default_user';

  // Alertas ya vistas guardadas en el usuario para no repetirlas (Requirement 8)
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(`impulsacap_dismissed_alerts_${userKey}`);
      const localAlerts: string[] = raw ? JSON.parse(raw) : [];
      const userAlerts: string[] = currentUser?.seenAlerts || [];
      return Array.from(new Set([...localAlerts, ...userAlerts]));
    } catch {
      return currentUser?.seenAlerts || [];
    }
  });

  const handleDismissAlert = async (alertId: string) => {
    setDismissedAlerts(prev => {
      const updated = [...prev, alertId];
      try {
        localStorage.setItem(`impulsacap_dismissed_alerts_${userKey}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    const uid = auth.currentUser?.uid || currentUser?.id;
    if (uid) {
      try {
        await setDoc(doc(db, 'users', uid), {
          seenAlerts: arrayUnion(alertId)
        }, { merge: true });
      } catch (e) {
        console.warn('Could not persist seen alert to Firestore:', e);
      }
    }
  };

  // Alerta (a): Nueva convocatoria que calza con el perfil y no tiene postulación (Requirement 8)
  const newCallAlerts = useMemo(() => {
    if (!convocatorias || convocatorias.length === 0) return [];
    const activeFundIds = new Set(activeApplications.map(a => a.fundId));

    return convocatorias.filter(conv => {
      if (!conv.vigente) return false;
      const alertId = `new_call_${conv.id}`;
      if (dismissedAlerts.includes(alertId)) return false;

      // Si ya tiene postulación activa para el fondo vinculado, no alertar
      if (conv.fundId && activeFundIds.has(conv.fundId)) return false;

      // Calce con región: nacionales siempre; regionales solo si coinciden con la región de la empresa
      if (!['nacional', 'tu_region'].includes(regionFit(conv.alcance, profile.region))) return false;

      return true;
    }).slice(0, 2);
  }, [convocatorias, activeApplications, profile.region, dismissedAlerts]);

  // Alerta (b): Postulación activa con cierre en 7 días o menos (Requirement 8)
  const closingSoonAlerts = useMemo(() => {
    const alerts: Array<{ app: ApplicationItem; fund: ChileanFund; daysLeft: number; alertId: string; closeDate: string }> = [];

    for (const app of activeApplications) {
      const fund = resolveFund(app, funds);
      const matchingCall = convocatorias.find(c => c.fundId === app.fundId && c.vigente);
      const closeDate = matchingCall?.cierre || fund?.closeDate;

      if (closeDate) {
        const days = calculateDaysRemaining(closeDate);
        if (days !== null && days <= 7 && days >= 0) {
          const alertId = `close_soon_${app.id}_${closeDate}`;
          if (!dismissedAlerts.includes(alertId)) {
            alerts.push({
              app,
              fund: fund || funds[0],
              daysLeft: days,
              alertId,
              closeDate
            });
          }
        }
      }
    }

    return alerts;
  }, [activeApplications, convocatorias, dismissedAlerts]);

  // Avance de cada postulación: la misma hoja de ruta estándar (según las bases de su fondo)
  function computeApplicationProgress(app: ApplicationItem) {
    const fund = resolveFund(app, funds);
    // Mismo recorrido que el consultor: si falta preparar la empresa o hay un requisito que no se cumple, eso va primero
    const j = computeJourney({
      profile,
      fund,
      application: app as any,
      hasActivePlan
    });
    const rm = j.roadmap!;
    const steps = rm.steps.map(st => st.done);
    const nextIndex = steps.findIndex(x => !x);
    const cur = j.current;
    return {
      completedCount: rm.completed,
      percentage: rm.percentage,
      nextAction: cur ? (cur.next ? `${cur.title}: ${cur.next}` : cur.title) : 'Postulación lista',
      phaseLabel: cur?.phaseLabel || '',
      blocker: Boolean(cur?.blocker),
      steps,
      nextIndex,
      nextTarget: cur?.action.target || null,
      nextLabel: cur?.action.label || ''
    };
  }

  // Sort active applications: closing date closest first, without date at the end (Requirement 5)
  const sortedActiveApplications = useMemo(() => {
    return [...activeApplications].sort((a, b) => {
      const fundA = resolveFund(a, funds);
      const fundB = resolveFund(b, funds);

      const dateA = fundA?.closeDate ? new Date(fundA.closeDate).getTime() : NaN;
      const dateB = fundB?.closeDate ? new Date(fundB.closeDate).getTime() : NaN;

      const hasDateA = !isNaN(dateA);
      const hasDateB = !isNaN(dateB);

      if (hasDateA && hasDateB) {
        return dateA - dateB;
      }
      if (hasDateA && !hasDateB) return -1;
      if (!hasDateA && hasDateB) return 1;
      return 0;
    });
  }, [activeApplications, funds]);

  // Recommended funds for empty state (Requirement 5)
  const recommendedFunds = useMemo(() => {
    // Solo fondos cuyos requisitos de bases comprobables se cumplen con los datos de la empresa
    const withFit = funds.map(f => ({ f, st: fundFit(f, profile).status })).filter(x => x.st !== 'no_cumple');
    return [...withFit.filter(x => x.st === 'cumple'), ...withFit.filter(x => x.st === 'por_confirmar')].map(x => x.f).slice(0, 3);
  }, [profile, funds]);

  const handleArchive = async (appId: string) => {
    if (confirm('¿Estás seguro de archivar esta postulación? Se liberará un cupo de tu plan y podrás reactivarla cuando tengas espacio.')) {
      setActionLoading(appId);
      try {
        await onArchiveApplication(appId);
      } finally {
        setActionLoading(null);
      }
    }
  };

  const handleReactivate = async (appId: string) => {
    setActionLoading(appId);
    try {
      const res = await onReactivateApplication(appId);
      if (!res.ok && res.error) {
        alert(res.error);
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Status mapping labels
  const statusLabels: Record<string, { label: string; badgeClass: string }> = {
    'en_preparacion': { label: 'En Preparación', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    'lista_para_enviar': { label: 'Lista para Enviar', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'enviada': { label: 'Enviada · esperando resultado', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
    'archivada': { label: 'Archivada', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' }
  };

  // Compact monitor calculations (Requirement 4)
  const totalOpenConvocatorias = useMemo(() => {
    return convocatorias.filter(c => c.vigente).length;
  }, [convocatorias]);

  const totalClosingThisWeek = useMemo(() => {
    return convocatorias.filter(c => c.vigente && c.diasRestantes !== null && c.diasRestantes !== undefined && c.diasRestantes <= 7 && c.diasRestantes >= 0).length;
  }, [convocatorias]);

  // --- Plan: tarjeta visible para contratar o ver el plan ---
  const { hasActivePlan, provisional, daysLeft, expiresAt, price, isFirstPurchase } = usePlan();
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  useEffect(() => { getPaymentsMode().then(m => setPaymentsEnabled(m.paymentsEnabled)); }, []);
  const handleActivatePlan = async () => {
    setPlanLoading(true);
    setPlanError(null);
    try {
      const res = await apiFetch('/api/pagos/crear', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.earlyAccess) { announceEarlyAccess(data); return; }
      if (res.ok && data?.init_point) { window.location.href = data.init_point; return; }
      setPlanError(data?.error || 'No se pudo iniciar el pago. Intenta nuevamente.');
    } catch (err: any) {
      setPlanError(err?.message || 'No se pudo iniciar el pago. Intenta nuevamente.');
    } finally {
      setPlanLoading(false);
    }
  };

  const projectPct = calculateProjectProfileCompletion(profile.projectProfile);
  const firstName = (profile.representativeName || currentUser?.representativeName || auth.currentUser?.displayName || '').trim().split(/\s+/)[0] || '';
  const freeSlots = Math.max(0, 3 - activeApplications.length);
  const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  // Convocatorias sugeridas: abiertas, de tu región, sin postulación, y que sean fondos (no créditos ni garantías)
  const suggestedCalls = useMemo(() => {
    // Fuera: créditos y garantías, y concursos que no son para empresas (administradoras de fondos, patrocinadores, entidades)
    const NOT_GRANT = /(garant[ií]a|cr[eé]dito|cobertura|certificaci[oó]n|fogain|fogape|cobex|reprogramaci|seguro|pr[eé]stamo|administradora|patrocinador|entidad(es)? gestora|operador|agente operador|becas?)/i;
    return newCallAlerts.length >= 0
      ? convocatorias
          .filter(c => c.vigente && !NOT_GRANT.test(c.titulo || '') && !dismissedAlerts.includes(`new_call_${c.id}`))
          .filter(c => !(c.fundId && activeApplications.some(a => a.fundId === c.fundId)))
          .filter(c => ['nacional', 'tu_region'].includes(regionFit(c.alcance, profile.region)))
          .sort((a, b) => {
            if (Boolean(a.fundId) !== Boolean(b.fundId)) return a.fundId ? -1 : 1;
            const da = typeof a.diasRestantes === 'number' ? a.diasRestantes : 9999;
            const dbb = typeof b.diasRestantes === 'number' ? b.diasRestantes : 9999;
            return da - dbb;
          })
          .slice(0, 3)
      : [];
  }, [convocatorias, activeApplications, profile.region, dismissedAlerts, newCallAlerts.length]);

  const STEP_NAMES = ['Requisitos', 'Formulario', 'Presupuesto', 'Documentos', 'Evaluación', 'Envío'];

  const goNext = (app: ApplicationItem, target: string) => {
    if (target === 'sii') { onOpenSiiModal(); return; }
    if (target.startsWith('url:')) { window.open(target.slice(4), '_blank', 'noopener,noreferrer'); return; }
    if (target === 'guarantees') requestNav('roadmapView', 'guarantees');
    if (target === 'dossier' || target === 'guarantees') { onContinueApplication(app.id, 'my-application'); return; }
    onContinueApplication(app.id, target);
  };

  return (
    <div className="space-y-7 animate-fade-in max-w-6xl mx-auto">

      {/* 1. SALUDO */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
        <div className="space-y-1 min-w-0">
          <p className="text-sm text-slate-500">{firstName ? `Hola, ${firstName}` : 'Hola'} 👋</p>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">
            {profile.companyName || 'Tu empresa'}
          </h1>
          <p className="text-sm text-slate-600">
            {activeApplications.length === 0 && resolvedApplications.some(a => a.result?.outcome === 'adjudicada')
              ? 'Tienes un proyecto ganado en ejecución. Abajo ves cómo va y qué vence pronto.'
              : activeApplications.length === 0
              ? 'Todavía no tienes postulaciones. Abajo te explico cómo empezar.'
              : `Tienes ${activeApplications.length} ${activeApplications.length === 1 ? 'postulación en curso' : 'postulaciones en curso'}. Sigue con el próximo paso de cada una.`}
          </p>
        </div>
        <button
          onClick={onOpenNewApplicationModal}
          disabled={freeSlots === 0}
          title={freeSlots === 0 ? 'Usaste tus 3 cupos: archiva una postulación para empezar otra' : undefined}
          className="group relative inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-2xl bg-slate-950 text-white text-sm font-black shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/60 hover:ring-cyan-300 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 overflow-hidden"
        >
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-400/25 to-cyan-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" /></span>
          <span className="relative">Nueva postulación</span>
          <span className="relative text-[11px] font-semibold text-cyan-300 hidden sm:inline">· {totalOpenConvocatorias} concursos abiertos</span>
          <ArrowRight className="relative w-4 h-4 text-cyan-300" />
        </button>
      </header>

      {/* Bienvenida del consultor: qué es este panel y cómo se avanza */}
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white p-5 sm:p-7 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wider text-cyan-300">Bienvenido a tu panel de postulaciones</p>
        <h2 className="mt-1.5 text-lg sm:text-xl font-bold leading-snug">
          {activeApplications.length === 0
            ? 'Te acompaño a postular a fondos del Estado, paso a paso y con las reglas de cada concurso.'
            : 'Aquí ves cómo va cada una de tus postulaciones y qué toca hacer ahora.'}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300 max-w-3xl">
          Postular a un fondo no tiene por qué ser un enredo. Cada fondo (Corfo, Sercotec, Start-Up Chile, ANID, FIA) tiene sus propias bases, y yo las uso para decirte si calzas, qué te van a pedir y cómo se evalúa. Tú pones la información de tu negocio; la plataforma la ordena y la redacta en el formato de cada concurso. La postulación final la envías tú en el portal oficial.
        </p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: '1', t: 'Prepara tu empresa', d: 'Tus datos, tu proyecto y la carpeta tributaria. Se hace una sola vez y sirve para todos los fondos.' },
            { n: '2', t: 'Elige un fondo que calce', d: 'Te mostramos qué fondos cumples según tus datos. Puedes tener hasta 3 postulaciones a la vez.' },
            { n: '3', t: 'Postula en 6 pasos', d: 'Requisitos, formulario, presupuesto, documentos, evaluación simulada y envío.' },
            { n: '4', t: 'Gana y ejecuta', d: 'Marca el resultado: si ganas, te acompañamos con gastos, hitos e informes; si no, con un plan para volver a postular.' }
          ].map(s => (
            <li key={s.n} className="rounded-2xl bg-white/5 border border-white/10 p-4">
              <p className="flex items-center gap-2 text-sm font-bold">
                <span className="w-6 h-6 rounded-full bg-cyan-400 text-slate-950 text-xs font-black flex items-center justify-center">{s.n}</span>
                {s.t}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">{s.d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-slate-400">
          En este panel encontrarás: avisos de cierres próximos, tus postulaciones con su avance y el próximo paso de cada una, y tu plan. Si en algún momento no sabes qué hacer, abre tu consultor: siempre te dice cuál es el siguiente paso.
        </p>
      </section>

      {/* 2. CIERRES PRÓXIMOS (solo si hay) */}
      {closingSoonAlerts.map(alert => (
        <div key={alert.alertId} className="p-4 rounded-2xl bg-rose-50 border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-950">
              <strong>{alert.fund.name}</strong> cierra {alert.daysLeft === 0 ? <strong>hoy</strong> : <>en <strong>{alert.daysLeft} {alert.daysLeft === 1 ? 'día' : 'días'}</strong></>} ({alert.closeDate}). Revisa tu expediente y súbelo a tiempo.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => onContinueApplication(alert.app.id)} className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1">
              Abrir postulación <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => handleDismissAlert(alert.alertId)} aria-label="Descartar aviso" className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* 2b. RESULTADOS: proyectos ganados en ejecución y no ganados para mejorar */}
      {resolvedApplications.length > 0 && (
        <section className="space-y-3" aria-labelledby="resultados-titulo">
          <h2 id="resultados-titulo" className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Tus resultados
          </h2>
          <div className={`grid gap-4 ${resolvedApplications.length > 1 ? 'lg:grid-cols-2' : ''}`}>
            {resolvedApplications.map(app => {
              const fund = resolveFund(app, funds);
              const won = app.result?.outcome === 'adjudicada';
              if (won) {
                const ex = app.execution || initExecution(app, fund);
                const t = executionTotals(ex);
                const next = upcomingMilestones(ex, 1)[0];
                return (
                  <article key={app.id} className="rounded-3xl bg-white border-2 border-emerald-300 shadow-sm p-5 sm:p-6 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold"><Trophy className="w-3.5 h-3.5" /> Ganado · en ejecución</span>
                        <h3 className="text-lg font-black text-slate-900 leading-tight">{fund.name}</h3>
                        {app.result?.awardedAmountCLP ? <p className="text-xs text-slate-500">Adjudicado: <strong className="text-emerald-700">{clp(app.result.awardedAmountCLP)}</strong></p> : null}
                      </div>
                      <button title="Archivar (ocultar del panel)" aria-label="Archivar" onClick={() => { if (confirm('¿Archivar este proyecto? Sus datos quedan guardados y puedes reactivarlo después.')) onArchiveApplication(app.id); }} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"><Archive className="w-4 h-4" /></button>
                    </div>
                    <div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${t.pct > 100 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, t.pct)}%` }} /></div>
                      <p className="text-xs text-slate-600 mt-1">Gastado <strong>{clp(t.spent)}</strong>{t.approved ? ` de ${clp(t.approved)} (${t.pct}%)` : ''} · rendido {clp(t.rendered)}</p>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <p className="text-sm text-slate-900 min-w-0">
                        {next ? <><span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">Próximo vencimiento</span><strong>{fmtDay(next.dueDate)}</strong> · {next.title}</> : <><span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">Próximo paso</span>{ex.startDate ? 'Registra tus gastos a medida que compras' : 'Firma el contrato y define la fecha de inicio'}</>}
                      </p>
                      <button onClick={() => onContinueApplication(app.id, 'resultado')} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm cursor-pointer inline-flex items-center gap-1.5 shrink-0">Abrir la ejecución <ArrowRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </article>
                );
              }
              const review = app.rejectionReview;
              return (
                <article key={app.id} className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">No adjudicada</span>
                      <h3 className="text-lg font-black text-slate-900 leading-tight">{fund.name}</h3>
                    </div>
                    <button title="Archivar (ocultar del panel)" aria-label="Archivar" onClick={() => { if (confirm('¿Archivar esta postulación? Sus datos quedan guardados.')) onArchiveApplication(app.id); }} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"><Archive className="w-4 h-4" /></button>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-sm text-slate-900 min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> Siguiente paso</span>
                      {review?.reappliedAs ? 'Ya volviste a postular: corrige lo que falló en la nueva postulación.' : review?.plan ? `Tu plan de mejora está listo (${review.plan.improvements.length} mejoras). Vuelve a postular con todo copiado.` : 'Trae la evaluación del comité y armamos un plan para volver a postular mejor.'}
                    </p>
                    <button onClick={() => review?.reappliedAs ? onNavigateTab?.(`open-app:${review.reappliedAs}`) : onContinueApplication(app.id, 'resultado')} className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm cursor-pointer inline-flex items-center gap-1.5 shrink-0">
                      {review?.reappliedAs ? 'Abrir la nueva' : review?.plan ? 'Ver mi plan de mejora' : 'Armar mi plan de mejora'} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. POSTULACIONES EN CURSO (lo principal) */}
      <section className="space-y-3" aria-labelledby="mis-postulaciones-titulo">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="mis-postulaciones-titulo" className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            Tus postulaciones
          </h2>
          <span className="text-xs font-semibold text-slate-500">{activeApplications.length} de 3 cupos usados</span>
        </div>

        <div className={`grid gap-4 ${sortedActiveApplications.length + (freeSlots > 0 ? 1 : 0) > 1 ? 'lg:grid-cols-2' : ''}`}>
          {sortedActiveApplications.map(app => {
            const fund = resolveFund(app, funds);
            const progress = computeApplicationProgress(app);
            const statusCfg = statusLabels[app.status] || statusLabels['en_preparacion'];
            return (
              <article key={app.id} className="relative rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all overflow-hidden flex flex-col">
                <div className="h-1.5 bg-slate-100">
                  <div className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all" style={{ width: `${Math.max(4, progress.percentage)}%` }} />
                </div>
                <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[10px] font-bold">{fund.agency}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.badgeClass}`}>{statusCfg.label}</span>
                      </div>
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{fund.name}</h3>
                      <p className="text-xs text-slate-500">
                        Hasta <strong className="text-emerald-700">{fund.subsidyFormatted}</strong> · Cierre: {fund.closeDate || 'por definir'}
                      </p>
                    </div>
                    <button
                      title="Archivar esta postulación (libera un cupo)"
                      aria-label="Archivar postulación"
                      disabled={actionLoading === app.id}
                      onClick={() => handleArchive(app.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Pasos */}
                  <ol className="grid grid-cols-6 gap-1.5" aria-label={`Avance: ${progress.completedCount} de 6 pasos`}>
                    {progress.steps.map((done, i) => (
                      <li key={i} className="space-y-1 min-w-0">
                        <div className={`h-2 rounded-full ${done ? 'bg-emerald-500' : i === progress.nextIndex ? 'bg-blue-500 animate-pulse' : 'bg-slate-200'}`} />
                        <p className={`hidden sm:block text-[10px] leading-tight truncate ${done ? 'text-emerald-700 font-semibold' : i === progress.nextIndex ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>{STEP_NAMES[i]}</p>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-slate-600"><strong className="text-slate-900">{progress.completedCount} de 6 pasos</strong> listos ({progress.percentage}%)</p>

                  {/* Próximo paso */}
                  <div className="mt-auto p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${progress.blocker ? 'text-red-700' : 'text-blue-700'}`}>{progress.blocker ? 'Atención: no cumples un requisito' : 'Próximo paso'}{progress.phaseLabel ? ` · ${progress.phaseLabel}` : ''}</p>
                      <p className="text-sm font-bold text-slate-900">{progress.nextAction}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onContinueApplication(app.id)}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-blue-800 hover:bg-blue-100 cursor-pointer"
                      >
                        Ver hoja de ruta
                      </button>
                      {progress.nextTarget && (
                        <button
                          onClick={() => goNext(app, progress.nextTarget!)}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm cursor-pointer inline-flex items-center gap-1.5"
                        >
                          {progress.nextLabel}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Cupos libres */}
          {freeSlots > 0 && (
            <button
              type="button"
              onClick={onOpenNewApplicationModal}
              className={`group relative overflow-hidden rounded-3xl bg-slate-950 text-white ring-1 ring-cyan-500/40 hover:ring-cyan-300 shadow-lg shadow-cyan-900/20 transition-all cursor-pointer p-6 flex flex-col items-center justify-center gap-3 text-center ${activeApplications.length === 0 ? 'min-h-[220px]' : 'min-h-[180px]'}`}
            >
              {/* Fondo tipo radar */}
              <span aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(34,211,238,.15)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,.15)_1px,transparent_1px)] [background-size:24px_24px]" />
              <span aria-hidden="true" className="absolute -inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent opacity-60 group-hover:animate-pulse" />
              <span className="relative w-14 h-14 rounded-full border border-cyan-400/60 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border border-cyan-400/40 animate-ping" />
                <Sparkles className="w-6 h-6 text-cyan-300" />
              </span>
              <span className="relative text-base font-black">{activeApplications.length === 0 ? 'Elige tu primer concurso' : 'Agregar otra postulación'}</span>
              <span className="relative text-xs text-cyan-100/90 max-w-sm">
                Abre el monitor con <strong className="text-white">{totalOpenConvocatorias} concursos abiertos</strong>, elige uno y te guiamos paso a paso. Te quedan {freeSlots} {freeSlots === 1 ? 'cupo' : 'cupos'} de 3.
              </span>
              <span className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-400 text-slate-950 text-xs font-black group-hover:bg-cyan-300">
                Ir al monitor de convocatorias <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          )}
        </div>

        {activeApplications.length === 0 && recommendedFunds.length > 0 && (
          <div className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3">
            <p className="text-sm font-bold text-slate-900">Fondos que calzan con tu empresa</p>
            <div className="grid gap-3 md:grid-cols-3">
              {recommendedFunds.map(fund => (
                <div key={fund.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between gap-3">
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[9px] font-bold">{fund.agency}</span>
                    <p className="text-sm font-bold text-slate-900">{fund.name}</p>
                    <p className="text-xs font-bold text-emerald-700">{fund.subsidyFormatted}</p>
                  </div>
                  <button onClick={() => onSelectFundToFormulate(fund)} className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1">
                    Postular a este fondo <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Novedades de fondos (las más importantes) */}
      <NewsTeaser onOpen={() => onNavigateTab?.('novedades')} />

      {/* 4. MURAL: plan, empresa y monitor */}
      <section className="grid gap-4 md:grid-cols-3" aria-label="Resumen">
        {/* Plan */}
        {hasActivePlan ? (
          <div className="rounded-3xl p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md flex flex-col justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100 flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" /> Tu plan</p>
              <p className="text-xl font-black">{provisional ? 'Acceso temporal' : 'Plan Trimestral activo'}</p>
              <p className="text-sm text-emerald-50">Quedan <strong>{daysLeft} {daysLeft === 1 ? 'día' : 'días'}</strong>{expiresAt ? ` · hasta el ${fmtDate(expiresAt)}` : ''}.</p>
            </div>
            <button onClick={() => onNavigateTab?.('my-company#mi-plan')} className="self-start px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
              {provisional ? 'Activar mi plan' : 'Ver mi plan'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="rounded-3xl p-5 bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white shadow-lg flex flex-col justify-between gap-4 ring-2 ring-amber-300/70">
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-200 flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Plan Trimestral</p>
              <p className="text-xl font-black leading-tight">Prepara tu postulación completa con IA</p>
              <ul className="text-xs text-blue-50 space-y-1">
                <li>✓ Redacción por secciones y cartas</li>
                <li>✓ Auditoría simulada y expediente PDF</li>
                <li>✓ Asesor experto · 3 postulaciones · 3 meses</li>
              </ul>
              <p className="text-sm">
                {isFirstPurchase && price < PLAN_PRICE && <span className="line-through text-blue-200 mr-1.5">{PLAN_PRICE_TEXT}</span>}
                <strong className="text-2xl font-black text-amber-300">${price.toLocaleString('es-CL')}</strong>
                <span className="text-xs text-blue-100"> pago único, IVA incl.</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <button onClick={handleActivatePlan} disabled={planLoading} className="w-full px-4 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                {planLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                Contratar plan
              </button>
              {planError && <p role="alert" className="text-xs text-rose-200">{planError}</p>}
              <p className="text-[11px] text-blue-100 text-center">Pago seguro con Flow (Webpay o tarjeta) · No se renueva solo</p>
            </div>
          </div>
        )}

        {/* Empresa */}
        <div className="rounded-3xl p-5 bg-white border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
          <div className="space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-indigo-600" /> Tu empresa</p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between gap-2">
                <span className="text-slate-600">RUT</span>
                {isRutValid
                  ? <span className="font-mono font-bold text-slate-900 text-xs">{formatRut(profile.rut)} <CheckCircle2 className="inline w-3.5 h-3.5 text-emerald-600" /></span>
                  : <button onClick={() => onNavigateTab?.('my-company#company-identity')} className="text-xs font-bold text-amber-700 hover:underline cursor-pointer">Ingresar RUT</button>}
              </li>
              <li className="flex items-center justify-between gap-2">
                <span className="text-slate-600">Carpeta tributaria</span>
                {profile.taxFolderUploaded
                  ? <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Cargada</span>
                  : <button onClick={onOpenSiiModal} className="text-xs font-bold text-amber-700 hover:underline cursor-pointer inline-flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Subir</button>}
              </li>
              <li className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Perfil del proyecto</span>
                  <span className={`text-xs font-bold ${projectPct >= 70 ? 'text-emerald-700' : 'text-amber-700'}`}>{projectPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${projectPct >= 70 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.max(4, projectPct)}%` }} />
                </div>
              </li>
            </ul>
          </div>
          <button
            onClick={() => onNavigateTab?.(projectPct < 70 ? 'my-company#project-profile' : 'my-company')}
            className="self-start px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
          >
            {projectPct < 70 ? 'Completar perfil' : 'Editar datos'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Monitor */}
        <div className="rounded-3xl p-5 bg-slate-900 text-white shadow-sm flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" /> Monitor CORFO
            </p>
            <p className="text-3xl font-black">{totalOpenConvocatorias}</p>
            <p className="text-sm text-slate-300">convocatorias abiertas hoy</p>
            <p className={`text-sm font-semibold ${totalClosingThisWeek > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
              {totalClosingThisWeek} {totalClosingThisWeek === 1 ? 'cierra' : 'cierran'} esta semana
            </p>
          </div>
          <button onClick={() => onNavigateTab?.('convocatorias')} className="self-start px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5">
            Ver convocatorias <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* 5. CONVOCATORIAS SUGERIDAS (secundario) */}
      {suggestedCalls.length > 0 && (
        <section className="rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 space-y-3" aria-labelledby="sugeridas-titulo">
          <div>
            <h2 id="sugeridas-titulo" className="text-base font-black text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" /> Convocatorias abiertas que podrían servirte
            </h2>
            <p className="text-xs text-slate-500">Abiertas hoy, para todo Chile o tu región, y sin postulación tuya. Primero las que cierran antes.</p>
          </div>
          <ul className="divide-y divide-slate-100">
            {suggestedCalls.map(conv => {
              const linkedFund = conv.fundId ? funds.find(f => f.id === conv.fundId) : null;
              return (
                <li key={conv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{conv.titulo}</p>
                    <p className="text-xs text-slate-500">
                      {conv.alcance || 'Todo Chile'} · {typeof conv.diasRestantes === 'number' ? (conv.diasRestantes === 0 ? 'cierra hoy' : `cierra en ${conv.diasRestantes} días`) : 'sin fecha de cierre'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {conv.url && (
                      <a href={conv.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
                        Bases <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button onClick={() => onPostularCall ? onPostularCall(conv) : onSelectFundToFormulate(linkedFund || fundFromConvocatoria(conv))} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Postular</button>
                    <button onClick={() => handleDismissAlert(`new_call_${conv.id}`)} aria-label="No me interesa" title="No me interesa" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 6. SECCIÓN COLAPSABLE ARCHIVADAS (Requirement 5) */}
      {archivedApplications.length > 0 && (
        <div className="rounded-3xl bg-white border border-slate-200 p-5 space-y-3">
          <button
            onClick={() => setShowArchived(prev => !prev)}
            className="w-full flex items-center justify-between text-left text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-400" />
              <span>Postulaciones Archivadas ({archivedApplications.length})</span>
            </div>
            {showArchived ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showArchived && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Estas postulaciones están pausadas y no ocupan cupo en tu Plan Trimestral. Puedes reactivar una en cualquier momento siempre que tengas menos de 3 postulaciones activas.
              </p>

              <div className="space-y-2">
                {archivedApplications.map(app => {
                  const fund = resolveFund(app, funds);
                  return (
                    <div
                      key={app.id}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800">{fund.name}</span>
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-slate-200 text-slate-600 font-mono">
                            Archivada
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {fund.agency} • Última modificación: {new Date(app.updatedAt).toLocaleDateString('es-CL')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          disabled={actionLoading === app.id}
                          onClick={() => handleReactivate(app.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-blue-700 font-semibold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reactivar postulación</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
