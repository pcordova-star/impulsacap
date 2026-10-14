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
  RotateCcw
} from 'lucide-react';
import { validateRut } from '../utils/rutValidator';
import { getGoogleCalendarUrl, downloadIcsFile } from '../utils/calendarExport';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { OfficialDossierModal } from './OfficialDossierModal';
import { AdmissibilityChecker } from './AdmissibilityChecker';
import { GuaranteesCalculator } from './GuaranteesCalculator';

interface MyActiveApplicationProps {
  profile: CompanyProfile;
  selectedFund: ChileanFund;
  formulation: FormulationOutput | null;
  auditResult?: BlindAuditResult | null;
  currentUser?: CompanyUser | null;
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
  onNavigateTab,
  onOpenSiiModal,
  onOpenAuthModal,
  onSelectFund
}) => {
  const [activeView, setActiveView] = useState<'timeline' | 'admissibility' | 'guarantees'>('timeline');
  const [showDossierModal, setShowDossierModal] = useState<boolean>(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showFundSelector, setShowFundSelector] = useState<boolean>(false);

  // Use the verified company name from session or profile, never a stale placeholder
  const activeCompanyName = currentUser?.companyName?.trim() || profile.companyName?.trim() || 'Mi Empresa';
  const activeRut = currentUser?.rut?.trim() || profile.rut?.trim() || '';

  const isRutValid = validateRut(activeRut);
  const hasTaxFolder = !!profile.taxFolderUploaded;
  const hasFormulation = !!formulation && (formulation.problemStatement?.length || 0) > 30;
  const hasBudget = (formulation?.budgetBreakdown?.length || 0) > 0;
  const hasLetters = (profile.customerValidationCount || 0) > 0;
  const hasAudit = !!auditResult && (auditResult.overallScore || 0) > 0;
  const isAuditApproved = hasAudit && (auditResult?.overallScore || 0) >= 3.5;

  // Real-time Countdown Timer to grant closure
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  }>({ days: 18, hours: 14, minutes: 25, seconds: 40, isPast: false });

  useEffect(() => {
    // Target close date: 18 days from current local schedule, or end of month
    const now = new Date();
    // Deterministic deadline based on fund name to stay consistent across reloads
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 18, 16, 0, 0);

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
  }, [selectedFund.id]);

  // Define the 6 sequential steps of the application roadmap
  const steps = useMemo(() => [
    {
      stepNumber: 1,
      id: 'step_tax_sii',
      title: 'Validación Tributaria & Requisitos SII',
      subtitle: 'RUT verificado, antigüedad según bases e inicio de actividades en 1ª Categoría',
      badge: 'Requisito Excluyente',
      status: (isRutValid && hasTaxFolder) ? ('completed' as const) : ('in_progress' as const),
      items: [
        { label: 'RUT de la empresa válido (Módulo 11)', done: isRutValid, detail: isRutValid ? activeRut : 'Ingresa un RUT válido' },
        { label: 'Inicio de actividades en 1ª Categoría', done: isRutValid, detail: profile.monthsActive ? `${profile.monthsActive} meses de antigüedad tributaria` : 'Acreditado para persona jurídica' },
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
      status: hasLetters ? ('completed' as const) : (isRutValid ? ('in_progress' as const) : ('pending' as const)),
      items: [
        { label: 'Estatuto social y poderes de representación', done: isRutValid, detail: 'Certificado de vigencia de sociedad' },
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
      status: hasBudget ? ('completed' as const) : (hasFormulation ? ('in_progress' as const) : ('pending' as const)),
      items: [
        { label: 'Desglose en Cuentas Oficiales CORFO', done: hasBudget, detail: hasBudget ? `${formulation?.budgetBreakdown?.length} ítems presupuestados` : 'Recursos humanos, operaciones, difusión' },
        { label: 'Verificación de IVA no imputado al subsidio', done: hasBudget, detail: 'El subsidio fiscal no subsidia IVA recuperable' },
        { label: 'Aporte empresarial pecuniario', done: hasBudget, detail: `Hasta ${selectedFund.maxCoFinancePct}% subsidio / ${(100 - selectedFund.maxCoFinancePct)}% aporte privado` },
        { label: 'Simulación de póliza de garantía para anticipo', done: true, detail: 'Permite recibir el 100% de los fondos sin esperar rendición' }
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
      actionLabel: 'Ver / Descargar Dossier PDF Oficial',
      onAction: () => setShowDossierModal(true)
    }
  ], [isRutValid, activeRut, hasLetters, profile.customerValidationCount, profile.isFemaleLed, selectedFund, hasFormulation, formulation, hasBudget, hasAudit, isAuditApproved, auditResult, onOpenSiiModal, onNavigateTab]);

  // Calculate overall progress based on steps completed
  const completedStepsCount = steps.filter(s => s.status === 'completed').length;
  const progressPercent = Math.round((completedStepsCount / steps.length) * 100);

  // Identify the immediate next action to prevent user confusion
  const nextStep = steps.find(s => s.status === 'in_progress') || steps.find(s => s.status === 'pending') || steps[steps.length - 1];

  // Auto-expand the active next step by default
  useEffect(() => {
    if (expandedStep === null && nextStep) {
      setExpandedStep(nextStep.stepNumber);
    }
  }, [nextStep]);

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
                <span>RUT: <strong className="font-mono text-blue-700">{activeRut || 'No configurado'}</strong></span>
              </span>
            </div>

            {/* Title & Fund Selector */}
            <div className="flex flex-wrap items-baseline gap-2 pt-1">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {activeCompanyName}
              </h1>
              <span className="text-slate-400 text-xl font-light">/</span>
              <div className="relative inline-block">
                <button
                  onClick={() => setShowFundSelector(!showFundSelector)}
                  className="inline-flex items-center gap-2 text-xl sm:text-2xl font-black text-blue-700 hover:text-blue-800 transition-colors group cursor-pointer"
                  title="Cambiar fondo objetivo"
                >
                  <span>{selectedFund.name}</span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-transform" />
                </button>

                {/* Dropdown to switch fund */}
                {showFundSelector && (
                  <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95">
                    <p className="text-[10px] uppercase font-bold text-slate-500 px-3 py-1.5 tracking-wider">
                      Seleccionar Fondo de Postulación
                    </p>
                    <div className="space-y-1 max-h-64 overflow-y-auto no-scrollbar">
                      {CHILEAN_FUNDS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => {
                            onSelectFund?.(f);
                            setShowFundSelector(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                            f.id === selectedFund.id
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <p className="font-bold">{f.name}</p>
                            <p className="text-[10px] text-slate-500">{f.agency} • {f.subsidyFormatted}</p>
                          </div>
                          {f.id === selectedFund.id && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Organismo Convocante: <strong className="text-slate-800">{selectedFund.agency}</strong> • 
              Subsidio Máximo: <strong className="text-emerald-700">{selectedFund.subsidyFormatted}</strong> (hasta {selectedFund.maxCoFinancePct}% no reembolsable)
            </p>
          </div>

          {/* Quick PDF Dossier Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
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

      {/* 2. PROMINENT DEADLINE COUNTDOWN: "NO QUEDAR FUERA DE PLAZO" */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-50/90 via-white to-emerald-50/80 border border-blue-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                Cierre de Convocatoria Oficial
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

          {/* Big Digital Countdown Clock */}
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
              const isExpanded = expandedStep === step.stepNumber;
              const isCompleted = step.status === 'completed';
              const isInProgress = step.status === 'in_progress';

              return (
                <div
                  key={step.id}
                  className={`relative rounded-3xl transition-all border ${
                    isInProgress
                      ? 'bg-slate-900/90 border-cyan-500/50 shadow-lg shadow-cyan-950/20'
                      : isCompleted
                      ? 'bg-slate-900/60 border-slate-800/90'
                      : 'bg-slate-950/50 border-slate-800/50 opacity-80'
                  }`}
                >
                  {/* Step Timeline Indicator Node */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-5 -translate-x-1/2 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shadow-md border-2 ${
                      isCompleted
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                        : isInProgress
                        ? 'bg-cyan-500 border-cyan-300 text-slate-950 animate-pulse'
                        : 'bg-slate-900 border-slate-700 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : step.stepNumber}
                  </div>

                  {/* Step Header (Clickable Accordion) */}
                  <div
                    onClick={() => setExpandedStep(isExpanded ? null : step.stepNumber)}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
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
                            : isInProgress
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {step.badge}
                        </span>

                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completado
                          </span>
                        )}
                        {isInProgress && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                            En Curso
                          </span>
                        )}
                      </div>

                      <h4 className="text-base sm:text-lg font-bold text-white">
                        {step.title}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {step.subtitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          step.onAction();
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isInProgress
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-600/20'
                            : isCompleted
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        <span>{step.actionLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300">
                        <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                  </div>

                  {/* Step Expanded Content (Checklist of documents and processes) */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-800/70 space-y-4 animate-in fade-in">
                      <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          Documentos y Criterios a Cumplir para {selectedFund.agency}:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {step.items.map((item, idx) => (
                            <div
                              key={idx}
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
                          ))}
                        </div>
                      </div>

                      {/* Bottom action bar inside expanded step */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 text-xs">
                        <span className="text-slate-400">
                          ¿Dudas con este paso? El Asesor INKI puede orientarte según las bases 2026.
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
      <OfficialDossierModal
        isOpen={showDossierModal}
        onClose={() => setShowDossierModal(false)}
        profile={profile}
        fund={selectedFund}
        formulation={formulation}
        auditResult={auditResult}
      />
    </div>
  );
};
