import React, { useState, useMemo } from 'react';
import { ChileanFund, CompanyProfile, getFundVisibleStatus, CompanyUser } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { ApplicationItem } from '../types/application';
import { Convocatoria } from '../types/convocatoria';
import { calculateDaysRemaining } from '../utils/convocatorias';
import { validateRut } from '../utils/rutValidator';
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
  AlertTriangle
} from 'lucide-react';

import { db, auth } from '../firebase';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';

interface MyApplicationsDashboardProps {
  profile: CompanyProfile;
  activeApplications: ApplicationItem[];
  archivedApplications: ApplicationItem[];
  convocatorias?: Convocatoria[];
  funds?: ChileanFund[];
  currentUser?: CompanyUser | null;
  onContinueApplication: (applicationId: string) => void;
  onArchiveApplication: (applicationId: string) => Promise<{ ok: boolean }>;
  onReactivateApplication: (applicationId: string) => Promise<{ ok: boolean; error?: string }>;
  onOpenNewApplicationModal: () => void;
  onOpenProfile: () => void;
  onOpenSiiModal: () => void;
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onNavigateTab?: (tab: string) => void;
}

export const MyApplicationsDashboard: React.FC<MyApplicationsDashboardProps> = ({
  profile,
  activeApplications,
  archivedApplications,
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
  onNavigateTab
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

      // Calce con región
      if (profile.region) {
        const reg = profile.region.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const alc = (conv.alcance || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isRegionOk = alc.includes('todo chile') || alc.includes('nacional') || alc.includes(reg);
        if (!isRegionOk) return false;
      }

      return true;
    }).slice(0, 2);
  }, [convocatorias, activeApplications, profile.region, dismissedAlerts]);

  // Alerta (b): Postulación activa con cierre en 7 días o menos (Requirement 8)
  const closingSoonAlerts = useMemo(() => {
    const alerts: Array<{ app: ApplicationItem; fund: ChileanFund; daysLeft: number; alertId: string; closeDate: string }> = [];

    for (const app of activeApplications) {
      const fund = funds.find(f => f.id === app.fundId);
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

  // Compute 6-step progress for an application
  function computeApplicationProgress(app: ApplicationItem) {
    const isTaxFolderDone = Boolean(profile.taxFolderUploaded);
    const step1 = isRutValid && isTaxFolderDone;

    const step2 = Boolean(
      app.roadmapConfirmations?.confirmedInicioActividades && 
      app.roadmapConfirmations?.confirmedEstatutoSocial &&
      (app.generatedDocs && app.generatedDocs.length > 0)
    );

    const step3 = Boolean(
      app.formulation && 
      app.formulation.problemStatement && 
      app.formulation.solutionAndInnovation
    );

    const hasRealBudget = Boolean(
      app.formulation?.budgetBreakdown && 
      app.formulation.budgetBreakdown.length > 0 &&
      app.formulation.budgetBreakdown.some(i => (i.corfoContributionCLP || 0) > 0)
    );
    const step4 = hasRealBudget && Boolean(app.roadmapConfirmations?.confirmedGarantia);

    const step5 = Boolean(app.auditResult && (app.auditResult.overallScore >= 3.5));
    const step6 = app.status === 'enviada';

    const steps = [step1, step2, step3, step4, step5, step6];
    const completedCount = steps.filter(Boolean).length;

    let nextAction = 'Subir Carpeta Tributaria F29 y validar RUT';
    if (!step1) {
      nextAction = !isRutValid ? 'Configurar RUT válido de empresa' : 'Cargar Carpeta Tributaria F29';
    } else if (!step2) {
      nextAction = 'Confirmar estatutos y generar cartas de respaldo';
    } else if (!step3) {
      nextAction = 'Completar redacción técnica en el Formulador IA';
    } else if (!step4) {
      nextAction = 'Estructurar desglose presupuestario en cuentas CORFO';
    } else if (!step5) {
      nextAction = 'Ejecutar simulación en Auditor Ciego';
    } else if (!step6) {
      nextAction = 'Descargar Dossier Oficial y postular en portal oficial';
    } else {
      nextAction = 'Postulación enviada oficialmente';
    }

    return {
      completedCount,
      percentage: Math.round((completedCount / 6) * 100),
      nextAction
    };
  }

  // Sort active applications: closing date closest first, without date at the end (Requirement 5)
  const sortedActiveApplications = useMemo(() => {
    return [...activeApplications].sort((a, b) => {
      const fundA = funds.find(f => f.id === a.fundId);
      const fundB = funds.find(f => f.id === b.fundId);

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
    return funds.filter(f => {
      const typeOk = f.beneficiaryTypes.includes(profile.companyType);
      const trlOk = !profile.trlStage || f.trlEligible.includes(profile.trlStage);
      const salesOk = !profile.salesBracket || f.salesBracketsEligible.includes(profile.salesBracket);
      return typeOk && trlOk && salesOk;
    }).slice(0, 3);
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
    'enviada': { label: 'Enviada', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
    'archivada': { label: 'Archivada', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      
      {/* 1. RESUMEN DE LA EMPRESA ARRIBA (Requirement 5) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-blue-50/60 to-transparent rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
              {profile.companyName ? profile.companyName.charAt(0).toUpperCase() : <Building2 className="w-6 h-6" />}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {profile.companyName || 'Empresa Sin Registrar'}
                </h1>
                
                <button
                  onClick={onOpenProfile}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  Editar perfil
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-mono">
                  RUT: <strong className={isRutValid ? 'text-slate-800' : 'text-rose-600'}>{profile.rut || 'Sin configurar'}</strong>
                  {profile.rut && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-sans font-bold ${isRutValid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                      {isRutValid ? '✓ Módulo 11' : '✗ Inválido'}
                    </span>
                  )}
                </span>

                <span className="text-slate-300">•</span>

                <div className="flex items-center gap-1.5">
                  <span>Carpeta Tributaria:</span>
                  {profile.taxFolderUploaded ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Cargada ({profile.taxFolderFileName || 'F29.pdf'})
                    </span>
                  ) : (
                    <button
                      onClick={onOpenSiiModal}
                      className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 cursor-pointer transition-colors"
                    >
                      <Upload className="w-3 h-3" />
                      Subir F29 ahora
                    </button>
                  )}
                </div>

                <span className="text-slate-300 hidden sm:inline">•</span>

                <span className="hidden sm:inline">
                  Ventas 12M: <strong className="text-slate-700 font-mono">${(profile.annualSalesCLP || 0).toLocaleString('es-CL')} CLP</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Plan Quota counter & New Postulation Button */}
          <div className="flex flex-wrap items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] font-bold text-slate-600">
                Cupos de Postulación
              </p>
              <p className="text-xs font-mono text-emerald-700 font-bold">
                {activeApplications.length} de 3 activos
              </p>
            </div>

            <button
              onClick={onOpenNewApplicationModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nueva postulación</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1.1 ALERTAS INTELIGENTES (Requirement 8) */}
      {(closingSoonAlerts.length > 0 || newCallAlerts.length > 0) && (
        <div className="space-y-3">
          {/* Alerta (b): Cierre en 7 días o menos */}
          {closingSoonAlerts.map(alert => (
            <div
              key={alert.alertId}
              className="p-4 rounded-2xl bg-gradient-to-r from-rose-50 via-rose-50/70 to-amber-50 border border-rose-300 shadow-xs flex items-start justify-between gap-4 animate-fade-in"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold">
                      CIERRE PRÓXIMO: {alert.daysLeft === 0 ? 'HOY' : `${alert.daysLeft} DÍAS`}
                    </span>
                    <span className="text-xs font-bold text-rose-950">
                      Plazo crítico de postulación
                    </span>
                  </div>
                  <p className="text-xs text-rose-900 leading-snug">
                    La postulación a <strong>{alert.fund.name}</strong> cierra el <strong>{alert.closeDate}</strong>. Revisa tus anexos y descarga tu expediente consolidado para subirlo a tiempo al portal oficial.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onContinueApplication(alert.app.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1 transition-colors"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDismissAlert(alert.alertId)}
                  title="Descartar aviso"
                  className="p-1.5 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100/60 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {/* Alerta (a): Nueva convocatoria para tu perfil */}
          {newCallAlerts.map(conv => (
            <div
              key={conv.id}
              className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/70 to-emerald-50 border border-blue-200 shadow-xs flex items-start justify-between gap-4 animate-fade-in"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700 shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-mono text-[9px] font-bold">
                      NUEVA CONVOCATORIA PARA TU PERFIL
                    </span>
                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-white text-slate-700 border border-slate-200">
                      📍 {conv.alcance}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {conv.titulo}
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-snug line-clamp-1">
                    {conv.tope_aprox ? `Subsidio de ${conv.tope_aprox}. ` : ''}
                    {conv.cierre ? `Cierre oficial: ${conv.cierre}. ` : 'Ventanilla permanente. '}
                    {conv.resumen || ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => {
                    if (conv.fundId) {
                      const fund = funds.find(f => f.id === conv.fundId);
                      if (fund) {
                        onSelectFundToFormulate(fund);
                        return;
                      }
                    }
                    if (onNavigateTab) {
                      onNavigateTab('convocatorias');
                    } else {
                      onOpenNewApplicationModal();
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1 transition-colors"
                >
                  <span>Ver / Postular</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDismissAlert(`new_call_${conv.id}`)}
                  title="Descartar aviso"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. LISTA DE POSTULACIONES ACTIVAS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Postulaciones en Curso ({activeApplications.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Ordenadas por fecha de cierre más próxima
          </span>
        </div>

        {activeApplications.length === 0 ? (
          /* Empty State (Requirement 5) */
          <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-8 h-8" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-bold text-slate-900">
                Aún no tienes postulaciones activas
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Selecciona uno de los fondos recomendados según tu perfil empresarial o explora el catálogo completo para preparar tu expediente.
              </p>
            </div>

            {/* Recommended Funds cards */}
            {recommendedFunds.length > 0 && (
              <div className="max-w-3xl mx-auto pt-2 space-y-3">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider text-left">
                  Fondos recomendados para tu empresa:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {recommendedFunds.map(fund => (
                    <div
                      key={fund.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-blue-50/40 hover:border-blue-300 text-left transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono text-[9px] font-bold">
                          {fund.agency}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-2">
                          {fund.name}
                        </h4>
                        <p className="text-xs font-mono font-bold text-emerald-700">
                          {fund.subsidyFormatted}
                        </p>
                      </div>

                      <button
                        onClick={() => onSelectFundToFormulate(fund)}
                        className="mt-3 w-full py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer transition-colors inline-flex items-center justify-center gap-1"
                      >
                        <span>Formular</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <button
                onClick={onOpenNewApplicationModal}
                className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-2 shadow-xs"
              >
                <span>Elegir otro fondo del catálogo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Cards grid */
          <div className="grid grid-cols-1 gap-4">
            {sortedActiveApplications.map(app => {
              const fund = funds.find(f => f.id === app.fundId) || funds[0];
              const progress = computeApplicationProgress(app);
              const visibleCallStatus = getFundVisibleStatus(fund);
              const statusCfg = statusLabels[app.status] || statusLabels['en_preparacion'];

              return (
                <div
                  key={app.id}
                  className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    
                    {/* Fund info */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-white font-mono text-[10px] font-bold">
                          {fund.agency}
                        </span>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          visibleCallStatus === 'Abierta' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : visibleCallStatus === 'Próxima'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          Convocatoria {visibleCallStatus}
                        </span>

                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.badgeClass}`}>
                          {statusCfg.label}
                        </span>
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {fund.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>Subsidio Máximo: <strong className="text-emerald-700 font-mono font-bold">{fund.subsidyFormatted}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>Cierre: <strong className={fund.closeDate ? 'text-slate-800' : 'text-slate-500 italic'}>{fund.closeDate || 'Ventanilla continua / Por definir'}</strong></span>
                      </div>
                    </div>

                    {/* Actions button */}
                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                      <button
                        title="Archivar esta postulación para liberar cupo"
                        disabled={actionLoading === app.id}
                        onClick={() => handleArchive(app.id)}
                        className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        <Archive className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onContinueApplication(app.id)}
                        className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
                      >
                        <span>Continuar</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress bar (6 steps) */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        Avance del Expediente: <strong className="text-blue-700">{progress.completedCount} de 6 pasos completados</strong> ({progress.percentage}%)
                      </span>

                      <span className="text-slate-500 text-[11px] truncate max-w-xs">
                        Siguiente acción: <strong className="text-slate-800">{progress.nextAction}</strong>
                      </span>
                    </div>

                    {/* Visual Segmented Progress Bar */}
                    <div className="grid grid-cols-6 gap-1.5 h-2">
                      {[1, 2, 3, 4, 5, 6].map(stepNum => (
                        <div
                          key={stepNum}
                          className={`rounded-full transition-all ${
                            stepNum <= progress.completedCount 
                              ? 'bg-emerald-500' 
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. SECCIÓN COLAPSABLE ARCHIVADAS (Requirement 5) */}
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
                Estas postulaciones están pausadas y no ocupan cupo en tu Plan Semestral. Puedes reactivar una en cualquier momento siempre que tengas menos de 3 postulaciones activas.
              </p>

              <div className="space-y-2">
                {archivedApplications.map(app => {
                  const fund = funds.find(f => f.id === app.fundId) || funds[0];
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
