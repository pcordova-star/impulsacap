import { REQUIREMENT_GUIDES } from '../data/requirementGuides';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  CompanyProfile, 
  ChileanFund, 
  FormulationOutput, 
  BlindAuditResult, 
  CompanyUser 
} from '../types/funds';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  FileText, 
  ArrowRight, 
  Download, 
  Calendar, 
  Building2, 
  Printer, 
  Award,
  ShieldCheck,
  Coins,
  FileCheck2,
  CalendarPlus,
  ChevronRight,
  ChevronDown,
  Lock,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Flame,
  Check,
  RotateCcw,
  Archive,
  ArrowLeft
} from 'lucide-react';
import { validateRut, formatRut } from '../utils/rutValidator';
import { getGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarExport';
const OfficialDossierModal = React.lazy(() => 
  import('./OfficialDossierModal').then(m => ({ default: m.OfficialDossierModal }))
);
import { AdmissibilityChecker } from './AdmissibilityChecker';
import { GuaranteesCalculator } from './GuaranteesCalculator';
import { usePlan } from '../hooks/usePlan';
import { PlanPaywallCard } from './PlanPaywallCard';
import { apiFetch } from '../utils/apiFetch';
import { announceEarlyAccess } from '../utils/earlyAccess';
import { auth } from '../firebase';
import { requestLogin } from '../utils/authEvents';
import { ExpedienteData, RoadmapConfirmations, DocChecklistStatuses } from '../types/expediente';

interface MyActiveApplicationProps {
  profile: CompanyProfile;
  selectedFund: ChileanFund;
  formulation: FormulationOutput | null;
  auditResult?: BlindAuditResult | null;
  currentUser?: CompanyUser | null;
  expediente?: ExpedienteData;
  onUpdateRoadmapConfirmations?: (patch: Partial<RoadmapConfirmations>) => void;
  onUpdateDocStatuses?: (patch: Partial<DocChecklistStatuses>) => void;
  onNavigateTab: (tab: string) => void;
  onOpenSiiModal: () => void;
  onOpenAuthModal?: () => void;
  onSelectFund?: (fund: ChileanFund) => void;
}

export const MyActiveApplication: React.FC<MyActiveApplicationProps> = ({
  profile,
  selectedFund,
  formulation,
  auditResult,
  currentUser,
  expediente,
  onUpdateRoadmapConfirmations,
  onUpdateDocStatuses,
  onNavigateTab,
  onOpenSiiModal,
  onOpenAuthModal,
  onSelectFund
}) => {
  const [activeView, setActiveView] = useState<'timeline' | 'admissibility' | 'guarantees'>('timeline');
  const { hasActivePlan, expiresAt, daysLeft, isExpiringSoon, isExpired, refresh } = usePlan();
  const [archiving, setArchiving] = useState<boolean>(false);

  const handleArchivePostulation = async () => {
    if (!window.confirm(`¿Deseas archivar la postulación al fondo "${selectedFund.name}" para liberar uno de tus 3 cupos simultáneos?`)) return;
    setArchiving(true);
    try {
      const res = await apiFetch('/api/postulaciones/archivar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fundId: selectedFund.id })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Postulación archivada con éxito. Cupo liberado.');
        refresh();
      } else {
        alert(data.error || 'Error al archivar la postulación.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error de conexión al archivar postulación.');
    } finally {
      setArchiving(false);
    }
  };

  const handleRenewPlan = async () => {
    // 1. Espera a que Firebase termine de restaurar la sesión
    if (auth.authStateReady) {
      try {
        await auth.authStateReady();
      } catch (err) {
        console.warn('authStateReady error:', err);
      }
    }

    // 2. Si no hay sesión, abre el modal de inicio de sesión en vez de mostrar error, y continúa con el pago
    if (!auth.currentUser) {
      requestLogin({
        message: 'Inicia sesión o crea tu cuenta para continuar con el Plan Semestral.',
        mode: 'login',
        onSuccess: async () => {
          await handleRenewPlan();
        }
      });
      return;
    }

    try {
      const res = await apiFetch('/api/pagos/crear', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data?.earlyAccess) { announceEarlyAccess(data); return; }
      if (res.ok && data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert(data.error || 'Error al conectar con Mercado Pago.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error de conexión.');
    }
  };
  const [showDossierModal, setShowDossierModal] = useState<boolean>(false);
  const [expandedStep, setExpandedStep] = useState<number>(1);
  const [openGuide, setOpenGuide] = useState<string | null>(null);

  // Agency official URL
  const agencyUrls: Record<string, string> = {
    'CORFO': 'https://www.corfo.cl',
    'SERCOTEC': 'https://www.sercotec.cl',
    'ANID': 'https://www.anid.cl',
    'START-UP CHILE': 'https://www.startupchile.org',
    'FIA': 'https://www.fia.cl',
    'PROCHILE': 'https://www.prochile.gob.cl',
  };
  const agencyUrl = agencyUrls[selectedFund.agency] || 'https://www.corfo.cl';

  // User-confirmed steps (read from unified Expediente as single source of truth)
  const userKey = (currentUser as any)?.uid || currentUser?.id || currentUser?.email || 'guest';
  const [localConfirmedInicio, setLocalConfirmedInicio] = useState<boolean>(() => {
    return localStorage.getItem(`confirmed_inicio_${userKey}`) === 'true';
  });
  const [localConfirmedEstatuto, setLocalConfirmedEstatuto] = useState<boolean>(() => {
    return localStorage.getItem(`confirmed_estatuto_${userKey}`) === 'true';
  });
  const [localConfirmedGarantia, setLocalConfirmedGarantia] = useState<boolean>(() => {
    return localStorage.getItem(`confirmed_garantia_${userKey}`) === 'true';
  });

  const confirmedInicioActividades = expediente ? expediente.roadmapConfirmations.confirmedInicioActividades : localConfirmedInicio;
  const confirmedEstatutoSocial = expediente ? expediente.roadmapConfirmations.confirmedEstatutoSocial : localConfirmedEstatuto;
  const confirmedGarantia = expediente ? expediente.roadmapConfirmations.confirmedGarantia : localConfirmedGarantia;

  const toggleInicioActividades = () => {
    const next = !confirmedInicioActividades;
    if (onUpdateRoadmapConfirmations) {
      onUpdateRoadmapConfirmations({ confirmedInicioActividades: next });
    }
    setLocalConfirmedInicio(next);
    localStorage.setItem(`confirmed_inicio_${userKey}`, String(next));
  };

  const toggleEstatutoSocial = () => {
    const next = !confirmedEstatutoSocial;
    if (onUpdateRoadmapConfirmations) {
      onUpdateRoadmapConfirmations({ confirmedEstatutoSocial: next });
    }
    setLocalConfirmedEstatuto(next);
    localStorage.setItem(`confirmed_estatuto_${userKey}`, String(next));
  };

  const toggleGarantia = () => {
    const next = !confirmedGarantia;
    if (onUpdateRoadmapConfirmations) {
      onUpdateRoadmapConfirmations({ confirmedGarantia: next });
    }
    setLocalConfirmedGarantia(next);
    localStorage.setItem(`confirmed_garantia_${userKey}`, String(next));
  };

  // Close date check: only show countdown if closeDate exists and is in the future
  const hasFutureCloseDate = useMemo(() => {
    if (!selectedFund.closeDate) return false;
    const t = new Date(selectedFund.closeDate).getTime();
    return !isNaN(t) && t > Date.now();
  }, [selectedFund.closeDate]);

  // Use the verified company name from session or profile, never a stale placeholder
  const activeCompanyName = currentUser?.companyName?.trim() || profile.companyName?.trim() || 'Sin completar';
  const activeRut = currentUser?.rut?.trim() || profile.rut?.trim() || '';

  const isRutValid = validateRut(activeRut);
  const hasTaxFolder = expediente ? Boolean(expediente.taxFolder.taxFolderUploaded) : Boolean(profile.taxFolderUploaded);
  const hasFormulation = !!formulation && (formulation.problemStatement?.length || 0) > 30;
  // Requirement 12: Presupuesto solo se completa si el usuario ingresó un presupuesto real
  const currentBudget = expediente?.formulation?.budgetBreakdown || formulation?.budgetBreakdown || [];
  const hasBudget = currentBudget.length > 0 && currentBudget.some((b: any) => (b.corfoContributionCLP || 0) > 0);
  const signedLoiCount = expediente ? expediente.generatedDocs.filter((d: any) => (d.tipo.includes('LOI') || d.tipo.includes('Interés')) && d.status === 'firmada').length : (profile.customerValidationCount || 0);
  const hasLetters = signedLoiCount > 0;
  const hasAudit = !!auditResult && (auditResult.overallScore || 0) > 0;
  const isAuditApproved = hasAudit && (auditResult?.overallScore || 0) >= 3.5;

  // Real-time Countdown Timer to grant closure
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  useEffect(() => {
    if (!hasFutureCloseDate || !selectedFund.closeDate) {
      return;
    }
    const targetDate = new Date(selectedFund.closeDate);
    const updateTimer = () => {
      const current = new Date().getTime();
      const difference = targetDate.getTime() - current;
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
      } else {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours, minutes, seconds, isPast: false });
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [hasFutureCloseDate, selectedFund.closeDate]);

  // Define the 6 sequential steps of the application roadmap
  // Compute current active step: only ONE step open at a time (first incomplete step)
  const currentStepNumber = useMemo(() => {
    const s1Done = isRutValid && confirmedInicioActividades && hasTaxFolder;
    if (!s1Done) return 1;

    const s2Done = confirmedEstatutoSocial && hasLetters;
    if (!s2Done) return 2;

    const s3Done = hasFormulation;
    if (!s3Done) return 3;

    const s4Done = hasBudget && confirmedGarantia;
    if (!s4Done) return 4;

    const s5Done = isAuditApproved;
    if (!s5Done) return 5;

    return 6;
  }, [isRutValid, confirmedInicioActividades, hasTaxFolder, confirmedEstatutoSocial, hasLetters, hasFormulation, hasBudget, confirmedGarantia, isAuditApproved]);

  // Persist current active step for the user and auto-open next step
  useEffect(() => {
    const storageKey = `impulsacap_${userKey}_active_step`;
    localStorage.setItem(storageKey, String(currentStepNumber));
    // Al completarse el paso actual y avanzar, abrir automáticamente el siguiente
    setExpandedStep(currentStepNumber);
  }, [currentStepNumber, userKey]);

  const steps = useMemo(() => [
    {
      stepNumber: 1,
      id: 'step_tax_sii',
      title: 'Validación Tributaria & Requisitos SII',
      subtitle: 'RUT verificado, antigüedad según bases e inicio de actividades en 1ª Categoría',
      badge: 'Requisito Excluyente',
      status: (isRutValid && confirmedInicioActividades && hasTaxFolder) ? ('completed' as const) : ('in_progress' as const),
      items: [
        { label: 'RUT de la empresa válido (Módulo 11)', done: isRutValid, detail: isRutValid ? activeRut : 'Ingresa un RUT válido' },
        { label: 'Inicio de actividades en 1ª Categoría', done: confirmedInicioActividades, interactive: true, onToggle: toggleInicioActividades, detail: confirmedInicioActividades ? 'Confirmado por la empresa' : 'Haz clic para confirmar que ya cuentas con esto' },
        { 
          label: 'Carpeta Tributaria Electrónica F29', 
          done: hasTaxFolder, 
          detail: hasTaxFolder 
            ? `Archivo oficial subido: ${profile.taxFolderFileName || 'Carpeta_Tributaria_SII.pdf'} (Validada)` 
            : 'Sube tu archivo PDF o XML del SII para adjuntarlo a tu expediente' 
        },
      ],
      actionLabel: hasTaxFolder ? 'Revisar / Cambiar Carpeta F29' : 'Subir Carpeta Tributaria (PDF/XML)',
      onAction: () => onOpenSiiModal()
    },
    {
      stepNumber: 2,
      id: 'step_legal_letters',
      title: 'Acreditación Legal & Cartas de Interés (LOI)',
      subtitle: 'Estatutos actualizados y cartas de respaldo comercial firmadas por clientes o aliados',
      badge: 'Pertinencia Comercial',
      status: (confirmedEstatutoSocial && hasLetters) ? ('completed' as const) : ('in_progress' as const),
      items: [
        { label: 'Estatuto social y poderes de representación', done: confirmedEstatutoSocial, interactive: true, onToggle: toggleEstatutoSocial, detail: confirmedEstatutoSocial ? 'Confirmado por la empresa' : 'Haz clic para confirmar que ya cuentas con esto' },
        { label: 'Cartas de Intención de Compra / LOI', done: hasLetters, detail: hasLetters ? `${profile.customerValidationCount} cartas registradas` : 'Mínimo 2 cartas recomendadas' },
        { label: 'Acreditación de Liderazgo Femenino', done: profile.isFemaleLed, detail: profile.isFemaleLed ? `+${selectedFund.femaleBonusPct || 10}% cofinanciamiento adicional` : 'No postulado con bono de género' }
      ],
      actionLabel: hasLetters ? 'Ver / Agregar Más Cartas LOI' : 'Generar Carta de Intención (LOI) Oficial',
      onAction: () => onNavigateTab('documents')
    },
    {
      stepNumber: 3,
      id: 'step_tech_formulation',
      title: 'Formulación Técnica del Proyecto',
      subtitle: 'Problema, solución de alto impacto, grado de novedad técnica y pitch de 30 segundos',
      badge: 'Criterio 40% Ponderación',
      status: hasFormulation ? ('completed' as const) : (isRutValid ? ('in_progress' as const) : ('pending' as const)),
      items: [
        { label: 'Problema / Oportunidad de mercado', done: hasFormulation, detail: hasFormulation ? 'Estructurado según rúbrica CORFO' : 'Pendiente redactar' },
        { label: 'Solución innovadora y grado de novedad', done: hasFormulation, detail: hasFormulation ? 'Diferenciación competitiva definida' : 'Pendiente redactar' },
        { label: 'Plan de trabajo y hitos a 12 meses', done: hasFormulation, detail: hasFormulation ? 'Objetivos técnicos y comerciales listos' : 'Pendiente estructurar' },
        { label: 'Elevator Pitch de 30 segundos', done: !!formulation?.pitchSummary30s, detail: formulation?.pitchSummary30s ? 'Pitch de alto impacto listo' : 'Requerido en formulario oficial' }
      ],
      actionLabel: hasFormulation ? 'Editar Formulación Técnica' : 'Redactar Propuesta con Formulador IA',
      onAction: () => onNavigateTab('formulator')
    },
    {
      stepNumber: 4,
      id: 'step_budget_accounts',
      title: 'Presupuesto Oficial & Co-financiamiento',
      subtitle: 'Cuentas presupuestarias aprobadas sin IVA imputado y cálculo de garantías de anticipo',
      badge: 'Financiero',
      status: (hasBudget && confirmedGarantia) ? ('completed' as const) : (hasFormulation ? ('in_progress' as const) : ('pending' as const)),
      items: [
        { label: 'Desglose en Cuentas Oficiales CORFO', done: hasBudget, detail: hasBudget ? `${formulation?.budgetBreakdown?.length} ítems presupuestados` : 'Recursos humanos, operaciones, difusión' },
        { label: 'Verificación de IVA no imputado al subsidio', done: hasBudget, detail: 'El subsidio fiscal no subsidia IVA recuperable' },
        { label: 'Aporte empresarial pecuniario', done: hasBudget, detail: `Hasta ${selectedFund.maxCoFinancePct}% subsidio / ${(100 - selectedFund.maxCoFinancePct)}% aporte privado` },
        { label: 'Simulación de póliza de garantía para anticipo', done: confirmedGarantia, interactive: true, onToggle: toggleGarantia, detail: confirmedGarantia ? 'Simulación realizada y confirmada' : 'Haz clic para confirmar que ya cuentas con esto' }
      ],
      actionLabel: hasBudget ? 'Revisar Presupuesto & Garantías' : 'Configurar Presupuesto en Formulador',
      onAction: () => onNavigateTab('formulator')
    },
    {
      stepNumber: 5,
      id: 'step_blind_audit',
      title: 'Auditoría Ciega Pre-Envío (Simulación de Rúbrica)',
      subtitle: 'Detección automática de brechas de admisibilidad y nota estimada de evaluador oficial',
      badge: 'Filtro de Éxito',
      status: isAuditApproved ? ('completed' as const) : (hasAudit ? ('in_progress' as const) : (hasFormulation ? ('in_progress' as const) : ('pending' as const))),
      items: [
        { label: 'Simulación de evaluador ciego oficial', done: hasAudit, detail: hasAudit ? `Nota obtenida: ${auditResult?.overallScore || 0}/5.0 (Escala CORFO)` : 'Aún no has ejecutado la simulación' },
        { label: 'Umbral mínimo de aprobación (>= 3.5 / 70%)', done: isAuditApproved, detail: isAuditApproved ? 'Cumple umbral de corte de adjudicación' : 'Requiere optimización de brechas' },
        { label: 'Revisión de alertas críticas de rechazo (Red Flags)', done: hasAudit && (auditResult?.redFlags?.length || 0) === 0, detail: hasAudit ? `${auditResult?.redFlags?.length || 0} alertas de rechazo detectadas` : 'Pendiente' }
      ],
      actionLabel: hasAudit ? 'Volver a Auditar Expediente' : 'Simular Jurado Evaluador Ciego',
      onAction: () => onNavigateTab('auditor')
    },
    {
      stepNumber: 6,
      id: 'step_official_submission',
      title: 'Cierre de Expediente & Envío Oficial',
      subtitle: 'Exportación del Dossier Oficial consolidado (PDF) y carga en el portal e-CORFO / Sercotec',
      badge: 'Postulación Final',
      status: (isAuditApproved && hasBudget) ? ('in_progress' as const) : ('pending' as const),
      items: [
        { label: 'Dossier Consolidado Oficial en PDF listo', done: isRutValid && hasFormulation, detail: 'Incluye memoria técnica, balances y anexos' },
        { label: 'Checklist de documentación de admisibilidad', done: isRutValid && hasFormulation && hasBudget, detail: 'Listo para copiar respuestas al portal' },
        { label: 'Subida formal a la plataforma oficial', done: false, detail: `Portal oficial ${selectedFund.agency} (e-CORFO o Sercotec)` }
      ],
      actionLabel: 'Ver / Descargar expediente PDF',
      onAction: () => setShowDossierModal(true)
    }
  ], [isRutValid, activeRut, hasLetters, profile.customerValidationCount, profile.isFemaleLed, selectedFund, hasFormulation, formulation, hasBudget, hasAudit, isAuditApproved, auditResult, onOpenSiiModal, onNavigateTab, confirmedInicioActividades, confirmedEstatutoSocial, confirmedGarantia]);

  // Calculate overall progress based on steps completed
  const completedStepsCount = steps.filter(s => s.status === 'completed').length;
  const progressPercent = Math.round((completedStepsCount / steps.length) * 100);

  // Identify the immediate next action to prevent user confusion
  const nextStep = steps.find(s => s.status === 'in_progress') || steps.find(s => s.status === 'pending') || steps[steps.length - 1];

  // Requirement 3: Only ONE step open at a time: the current step!
  useEffect(() => {
    setExpandedStep(currentStepNumber);
  }, [currentStepNumber]);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* 1. CLEAN EXECUTIVE HEADER: Company & Grant Context - Light Professional SaaS */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/50 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Hoja de Ruta de Postulación Guiada
              </span>

              {currentUser ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
                  <Lock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Bóveda Privada: <strong className="text-slate-900">{activeCompanyName}</strong></span>
                </div>
              ) : (
                <button
                  onClick={onOpenAuthModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Modo Borrador • Iniciar sesión para resguardar</span>
                </button>
              )}

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>RUT: <strong className={`font-mono ${activeRut ? 'text-blue-700' : 'text-slate-400 italic'}`}>{activeRut ? (validateRut(activeRut) ? formatRut(activeRut) : activeRut) : 'Sin completar'}</strong></span>
              </span>
            </div>

            {/* Title & Fund Name (No dropdown selector, Requirement 6) */}
            <div className="flex flex-wrap items-baseline gap-2 pt-1">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {activeCompanyName === 'Sin completar' ? <span className="text-slate-400 italic">Sin completar</span> : activeCompanyName}
              </h1>
              <span className="text-slate-400 text-xl font-light">/</span>
              <span className="text-xl sm:text-2xl font-black text-blue-700">
                {selectedFund.name}
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Organismo Convocante: <strong className="text-slate-800">{selectedFund.agency}</strong> • 
              Subsidio Máximo: <strong className="text-emerald-700">{selectedFund.subsidyFormatted}</strong> (hasta {selectedFund.maxCoFinancePct}% no reembolsable)
            </p>
          </div>

          {/* Quick PDF Dossier & Archive Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {currentUser && (
              <button
                onClick={handleArchivePostulation}
                disabled={archiving}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 transition-all cursor-pointer disabled:opacity-50"
                title="Archivar postulación para liberar uno de tus 3 cupos simultáneos"
              >
                <Archive className="w-4 h-4 text-slate-500" />
                <span>{archiving ? 'Archivando...' : 'Archivar Cupo'}</span>
              </button>
            )}
            <button
              onClick={() => setShowDossierModal(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span>Ver Dossier Oficial de Postulación (PDF)</span>
            </button>
          </div>
        </div>
      </div>

      {/* AVISOS DE VIGENCIA DEL PLAN SEMESTRAL */}
      {isExpiringSoon && expiresAt && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-orange-500/20 border-2 border-amber-400 text-slate-900 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-400 text-slate-950 font-black">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">
                Tu plan vence el {new Date(expiresAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })} ({daysLeft} {daysLeft === 1 ? 'día restante' : 'días restantes'}).
              </h4>
              <p className="text-xs text-slate-600">
                Renueva para no perder el acceso a las herramientas de formulación, auditoría y dossier oficial.
              </p>
            </div>
          </div>
          <button
            onClick={handleRenewPlan}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer shrink-0"
          >
            Renovar Plan Semestral
          </button>
        </div>
      )}

      {isExpired && expiresAt && (
        <div className="p-4 rounded-3xl bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-pink-500/20 border-2 border-rose-400 text-slate-900 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500 text-white font-black">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900">
                Tu plan semestral venció el {new Date(expiresAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}.
              </h4>
              <p className="text-xs text-slate-600">
                Conservas acceso de solo lectura a lo que ya generaste, pero no puedes generar contenido nuevo con IA.
              </p>
            </div>
          </div>
          <button
            onClick={handleRenewPlan}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-md transition-all cursor-pointer shrink-0"
          >
            Reactivar Plan Semestral
          </button>
        </div>
      )}

      {/* 2. PROMINENT DEADLINE COUNTDOWN: "NO QUEDAR FUERA DE PLAZO" */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-50/90 via-white to-emerald-50/80 border border-blue-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                Cierre de la convocatoria
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {selectedFund.status}
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>Plazo Límite de Envío:</span>
              <span className="text-blue-700 font-extrabold">{selectedFund.callSchedule}</span>
            </h3>
            <p className="text-xs text-slate-600">
              Las plataformas oficiales de CORFO y Sercotec bloquean el ingreso automáticamente a las 16:00 hrs. Completa tu expediente con anticipación.
            </p>
          </div>

          {/* Big Digital Countdown Clock: solo si hay una fecha de cierre futura */}
          {hasFutureCloseDate ? (
          <div className="flex items-center gap-2 sm:gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-center px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 min-w-[58px]">
              <span className="text-2xl sm:text-3xl font-black text-blue-700 font-mono tracking-tight">
                {String(timeLeft.days).padStart(2, '0')}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Días</p>
            </div>
            <span className="text-xl font-bold text-slate-400">:</span>

            <div className="text-center px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 min-w-[58px]">
              <span className="text-2xl sm:text-3xl font-black text-slate-800 font-mono tracking-tight">
                {String(timeLeft.hours).padStart(2, '0')}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Horas</p>
            </div>
            <span className="text-xl font-bold text-slate-400">:</span>

            <div className="text-center px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 min-w-[58px]">
              <span className="text-2xl sm:text-3xl font-black text-slate-800 font-mono tracking-tight">
                {String(timeLeft.minutes).padStart(2, '0')}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Min</p>
            </div>
            <span className="text-xl font-bold text-slate-400">:</span>

            <div className="text-center px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 min-w-[58px]">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono tracking-tight">
                {String(timeLeft.seconds).padStart(2, '0')}
              </span>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Seg</p>
            </div>
          </div>
          ) : (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-sm text-slate-600 max-w-xs">
              Este fondo no tiene una fecha de cierre publicada. Revisa la convocatoria vigente en el monitor antes de postular.
            </div>
          )}
        </div>

        {/* Quick Calendar Reminders Buttons */}
        <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-600 font-medium flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-amber-500" />
            <span>Evita quedar fuera de plazo por saturación del sistema fiscal.</span>
          </span>

          <div className="flex items-center gap-2">
            <a
              href={getGoogleCalendarUrl(selectedFund)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold transition-all shadow-xs"
            >
              <CalendarPlus className="w-3.5 h-3.5 text-blue-600" />
              <span>Agendar en Google Calendar</span>
            </a>

            <button
              onClick={() => downloadIcsFile(selectedFund)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold transition-all cursor-pointer shadow-xs"
              title="Descargar archivo de calendario .ics para Outlook o Apple Calendar"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Descargar .ics</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. OVERALL PROGRESS BAR & NEXT IMMEDIATE ACTION */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Progress Card */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Avance Global del Expediente
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
              {completedStepsCount} de {steps.length} Pasos
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-3xl font-black text-slate-900">{progressPercent}%</span>
              <span className="text-xs font-semibold text-slate-500">
                {progressPercent === 100 ? '¡Expediente Completo!' : 'En Preparación'}
              </span>
            </div>
            <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden p-0.5 border border-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Cada paso completado reduce el riesgo de inadmisibilidad técnica ante los evaluadores del Estado.
          </p>
        </div>

        {/* Immediate Next Action Card */}
        <div className="md:col-span-2 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-50/80 via-white to-emerald-50/40 border border-blue-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-blue-700">
                Tu Siguiente Acción Inmediata:
              </span>
            </div>
            <h4 className="text-base sm:text-lg font-bold text-slate-900">
              Paso {nextStep.stepNumber}: {nextStep.title}
            </h4>
            <p className="text-xs text-slate-600 mt-1 line-clamp-2">
              {nextStep.subtitle}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Sin desorden ni pasos confusos: avanza uno a la vez.
            </span>
            <button
              onClick={nextStep.onAction}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <span>{nextStep.actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. NAVIGATION VIEW SELECTOR: TIMELINE VS DEEP DIVE TOOLS */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('timeline')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === 'timeline'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>Línea de Tiempo (6 Pasos)</span>
          </button>

          <button
            onClick={() => setActiveView('admissibility')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === 'admissibility'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <FileCheck2 className="w-4 h-4 text-emerald-400" />
            <span>Auditoría de Admisibilidad (7 Filtros)</span>
          </button>

          <button
            onClick={() => setActiveView('guarantees')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeView === 'guarantees'
                ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span>Simulador de Garantías & Anticipo</span>
          </button>
        </div>
      </div>

      {/* 5. VIEW 1: THE SEQUENTIAL INTERACTIVE TIMELINE (HOJA DE RUTA) */}
      {activeView === 'timeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Pasos Secuenciales para Adjudicar {selectedFund.name}
            </h3>
            <span className="text-xs text-slate-500">
              Haz clic en cualquier paso para ver sus documentos y requisitos
            </span>
          </div>

          <div className="relative pl-6 sm:pl-8 space-y-4 before:content-[''] before:absolute before:left-3 sm:before:left-4 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-800">
            {steps.map((step) => {
              const requiresPlan = step.stepNumber >= 3;
              const isPlanLocked = requiresPlan && !hasActivePlan;
              const isCurrent = step.stepNumber === currentStepNumber && !isPlanLocked;
              const isCompleted = (step.stepNumber < currentStepNumber || step.status === 'completed') && !isPlanLocked;
              // Los pasos no se bloquean por orden: solo por plan. El orden recomendado se muestra con el estado.
              const isLocked = isPlanLocked;
              const isAhead = !isPlanLocked && !isCompleted && step.stepNumber > currentStepNumber;
              const isExpanded = !isLocked && (expandedStep === step.stepNumber || (!expandedStep && isCurrent));

              return (
                <React.Fragment key={step.id}>
                  {step.stepNumber === 3 && !hasActivePlan && (
                    <div id="plan-paywall-step" className="my-6">
                      <PlanPaywallCard
                        highlightText="Desbloquea el Formulador Técnico por Secciones, la Auditoría Ciega oficial y la generación del Dossier Oficial para postular a este fondo."
                      />
                    </div>
                  )}
                  <div
                  className={`relative rounded-3xl transition-all border ${
                    isCurrent
                      ? 'bg-slate-900/95 border-emerald-500/60 shadow-xl shadow-emerald-950/20 ring-1 ring-emerald-500/30'
                      : isCompleted
                      ? 'bg-slate-900/60 border-slate-800/90'
                      : isAhead
                      ? 'bg-slate-900/50 border-slate-800'
                      : 'bg-slate-950/40 border-slate-900 opacity-60'
                  }`}
                >
                  {/* Step Timeline Indicator Node */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-5 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 ${
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                        : isCurrent
                        ? 'bg-emerald-500 border-emerald-300 text-slate-950 ring-4 ring-emerald-500/20 animate-pulse'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : isLocked ? <Lock className="w-3.5 h-3.5 text-slate-500" /> : step.stepNumber}
                  </div>

                  {/* Step Header (Clickable Accordion for unlocked steps only) */}
                  <div
                    onClick={() => {
                      if (isLocked) return;
                      setExpandedStep(isExpanded ? 0 : step.stepNumber);
                    }}
                    className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none ${
                      isLocked ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Paso {step.stepNumber} de 6
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isCurrent
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {isLocked ? 'Bloqueado' : step.badge}
                        </span>
                        {isAhead && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                            <Clock className="w-3 h-3" />
                            Pendiente · se recomienda después del paso {currentStepNumber}
                          </span>
                        )}

                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completado
                          </span>
                        )}
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Paso Actual en Curso
                          </span>
                        )}
                        {isLocked && (
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${isPlanLocked ? 'text-amber-300' : 'text-slate-500'}`}>
                            <Lock className={`w-3 h-3 ${isPlanLocked ? 'text-amber-400' : 'text-slate-500'}`} />
                            Requiere Plan Semestral
                          </span>
                        )}
                      </div>

                      <h4 className={`text-base sm:text-lg font-bold ${isLocked ? 'text-slate-400' : 'text-white'}`}>
                        {step.title}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {isLocked ? 'Esta herramienta requiere el Plan Semestral activo.' : step.subtitle}
                      </p>
                    </div>

                    {/* Single Main Action Button per step */}
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      {isLocked ? (
                        isPlanLocked ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              document.getElementById('plan-paywall-step')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 cursor-pointer flex items-center gap-1.5 transition-all shadow-sm"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Desbloquear con Plan</span>
                          </button>
                        ) : (
                          <button
                            disabled
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed flex items-center gap-1.5 opacity-60"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Completa el paso anterior</span>
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            step.onAction();
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isCurrent
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-950/40 active:scale-95'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                          }`}
                        >
                          <span>{step.actionLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!isLocked && (
                        <div className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300">
                          <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step Expanded Content (Checklist of documents and processes) */}
                  {isExpanded && !isLocked && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-800/70 space-y-4 animate-in fade-in">
                      <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Documentos y Criterios a Cumplir para {selectedFund.agency}:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {step.items.map((item, idx) => {
                            const isItemInteractive = Boolean((item as any).interactive && (item as any).onToggle);
                            const itemToggle = (item as any).onToggle;
                            const itemDetail = (isItemInteractive && !item.done)
                              ? 'Haz clic para confirmar que ya cuentas con esto'
                              : item.detail;

                            const guide = REQUIREMENT_GUIDES[item.label];
                            const guideKey = `${step.id}-${idx}`;
                            const guideOpen = openGuide === guideKey;
                            const guideBlock = guide ? (
                              <div className="mt-1.5">
                                <button
                                  type="button"
                                  onClick={() => setOpenGuide(guideOpen ? null : guideKey)}
                                  aria-expanded={guideOpen}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:text-sky-200 underline underline-offset-2 cursor-pointer"
                                >
                                  {guideOpen ? 'Ocultar guía' : '¿Qué es y cómo lo consigo?'}
                                </button>
                                {guideOpen && (
                                  <div className="mt-2 rounded-xl bg-slate-900/90 border border-slate-700 p-3 space-y-2 text-[12px] text-slate-200 leading-relaxed">
                                    <p>{guide.what}</p>
                                    {guide.why && <p className="text-slate-400"><strong className="text-slate-300">Para qué lo piden:</strong> {guide.why}</p>}
                                    <ol className="list-decimal pl-4 space-y-1">
                                      {guide.steps.map((st, i) => <li key={i}>{st}</li>)}
                                    </ol>
                                    {guide.cost && <p className="text-slate-400"><strong className="text-slate-300">Costo:</strong> {guide.cost}</p>}
                                    {guide.tip && <p className="text-amber-200/90">{guide.tip}</p>}
                                    {guide.links && guide.links.length > 0 && (
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                                        {guide.links.map(l => (
                                          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200 underline underline-offset-2">
                                            {l.label}
                                          </a>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : null;

                            if (isItemInteractive) {
                              return (
                                <div key={idx}>
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={item.done}
                                  onClick={itemToggle}
                                  onKeyDown={(e) => {
                                    if (e.key === ' ' || e.key === 'Enter') {
                                      e.preventDefault();
                                      itemToggle?.();
                                    }
                                  }}
                                  className={`w-full text-left p-3 rounded-xl border flex items-start gap-2.5 text-xs transition-all cursor-pointer group focus:outline-hidden focus:ring-2 focus:ring-emerald-400/50 ${
                                    item.done
                                      ? 'bg-emerald-950/25 border-emerald-500/40 text-slate-200 hover:bg-emerald-950/40 hover:border-emerald-500/60'
                                      : 'bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800/90 hover:border-emerald-500/50 hover:shadow-md'
                                  }`}
                                >
                                  {/* Casilla de verificación visible */}
                                  {item.done ? (
                                    <div className="w-4 h-4 rounded bg-emerald-500 border border-emerald-400 text-slate-950 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                                      <Check className="w-3 h-3 stroke-[3]" />
                                    </div>
                                  ) : (
                                    <div className="w-4 h-4 rounded border-2 border-slate-500 bg-slate-950/80 group-hover:border-emerald-400 transition-colors shrink-0 mt-0.5" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1">
                                      <p className={`font-semibold ${item.done ? 'text-white' : 'text-slate-200 group-hover:text-emerald-300 transition-colors'}`}>
                                        {item.label}
                                      </p>
                                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                        item.done
                                          ? 'text-emerald-400 bg-emerald-950/50'
                                          : 'text-amber-300/80 bg-amber-950/30'
                                      }`}>
                                        {item.done ? 'Confirmado' : 'Pendiente'}
                                      </span>
                                    </div>
                                    <p className={`text-[11px] mt-0.5 ${
                                      item.done ? 'text-slate-400' : 'text-emerald-400/90 font-medium'
                                    }`}>
                                      {itemDetail}
                                    </p>
                                  </div>
                                </button>
                                {guideBlock}
                                </div>
                              );
                            }

                            return (
                              <div key={idx}>
                              <div
                                className={`p-3 rounded-xl border flex items-start gap-2.5 text-xs ${
                                  item.done
                                    ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-200'
                                    : 'bg-slate-900 border-slate-800 text-slate-400'
                                }`}
                              >
                                {item.done ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                )}
                                <div>
                                  <p className={`font-semibold ${item.done ? 'text-white' : 'text-slate-300'}`}>
                                    {item.label}
                                  </p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {item.detail}
                                  </p>
                                </div>
                              </div>
                              {guideBlock}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Bottom action bar inside expanded step */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs">
                        <span className="text-slate-400">
                          ¿Dudas con este paso? El Asesor ImpulsaCap puede orientarte según las bases 2026.
                        </span>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => onNavigateTab('advisor')}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                          >
                            Consultar con Asesor
                          </button>
                          <button
                            onClick={step.onAction}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow"
                          >
                            <span>Ejecutar {step.actionLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </React.Fragment>
              );
            })}
          </div>

          {/* Bottom Consolidated Actions */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                <Printer className="w-4 h-4 text-cyan-400" />
                <span>Expediente Completo Consolidado</span>
              </h4>
              <p className="text-xs text-slate-400">
                Descarga en un solo PDF todas las memorias técnicas, desglose presupuestario y anexos oficiales.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={() => setShowDossierModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer shadow transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Descargar Dossier Oficial (PDF)</span>
              </button>

              <button
                onClick={() => onNavigateTab('auditor')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-all"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Simular Jurado Evaluador</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. VIEW 2: ADMISSIBILITY DEEP-DIVE CHECKER */}
      {activeView === 'admissibility' && (
        <AdmissibilityChecker
          profile={profile}
          fund={selectedFund}
          onOpenSiiModal={onOpenSiiModal}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* 7. VIEW 3: GUARANTEES AND ADVANCE SIMULATOR */}
      {activeView === 'guarantees' && (
        <GuaranteesCalculator fund={selectedFund} />
      )}

      {/* 8. OFFICIAL DOSSIER MODAL */}
      <React.Suspense fallback={null}>
        <OfficialDossierModal
          isOpen={showDossierModal}
          onClose={() => setShowDossierModal(false)}
          expediente={expediente || {
            id: `exp_guest_${selectedFund.id}`,
            ownerId: currentUser?.id || 'guest',
            fundId: selectedFund.id,
            fundName: selectedFund.name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            profile,
            taxFolder: {
              fileName: profile.taxFolderFileName,
              uploadDate: profile.taxFolderUploadDate,
              rut: profile.rut,
              companyName: profile.companyName,
              monthsActive: profile.monthsActive,
              annualSalesCLP: profile.annualSalesCLP,
              salesBracket: profile.salesBracket,
              f29Periods: profile.taxFolderF29Periods || 0,
              siiStatusObservations: profile.taxFolderSummary,
              admissibilityVerdict: profile.taxFolderUploaded ? 'aprobado' : null,
              taxFolderUploaded: Boolean(profile.taxFolderUploaded)
            },
            roadmapConfirmations: {
              confirmedInicioActividades,
              confirmedEstatutoSocial,
              confirmedGarantia
            },
            docStatuses: {
              f29_sii: Boolean(profile.taxFolderUploaded),
              estatuto_res: confirmedEstatutoSocial,
              deuda_tgr: false,
              previsional_f30: false,
              carta_interes_loi: signedLoiCount > 0
            },
            generatedDocs: [],
            answersBySection: {},
            generatedTextsBySection: {},
            formulation,
            auditResult: auditResult || null
          }}
          fund={selectedFund}
          onNavigateTab={onNavigateTab}
          onOpenSiiModal={onOpenSiiModal}
        />
      </React.Suspense>
    </div>
  );
};
