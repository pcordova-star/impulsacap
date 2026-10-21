import { splitTarget, goToTarget, setReturnContext } from '../utils/navFocus';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { showToast } from '../utils/toast';
import { ChileanFund, CompanyProfile, FormulationOutput, BlindAuditResult, CompanyUser, calculateProjectProfileCompletion } from '../types/funds';
import { ExpedienteData } from '../types/expediente';
import { ApplicationItem } from '../types/application';
import { validateRut } from '../utils/rutValidator';
import { 
  ArrowLeft, 
  ArrowRight,
  Clock, 
  Sparkles, 
  FileText, 
  ShieldCheck, 
  Award, 
  CheckCircle2, 
  ExternalLink,
  ChevronRight,
  Printer,
  Copy,
  FolderOpen,
  MessageSquareCode,
  AlertTriangle
} from 'lucide-react';
import { MyActiveApplication } from './MyActiveApplication';
import { ExpertChat } from './ExpertChat';

// Lazy-loaded components for optimal performance (Requirement 9)
const AiFormulator = React.lazy(() => 
  import('./AiFormulator').then(m => ({ default: m.AiFormulator }))
);
const DocumentManager = React.lazy(() => 
  import('./DocumentManager').then(m => ({ default: m.DocumentManager }))
);
const BlindAuditor = React.lazy(() => 
  import('./BlindAuditor').then(m => ({ default: m.BlindAuditor }))
);
const OfficialDossierModal = React.lazy(() => 
  import('./OfficialDossierModal').then(m => ({ default: m.OfficialDossierModal }))
);

export type PostulationSubTab = 'roadmap' | 'formulator' | 'documents' | 'auditor' | 'advisor' | 'expediente';

interface PostulationWorkspaceProps {
  fund: ChileanFund;
  application?: ApplicationItem | null;
  profile: CompanyProfile;
  expediente: ExpedienteData;
  formulation: FormulationOutput | null;
  auditResult: BlindAuditResult | null;
  currentUser: CompanyUser | null;
  activeSubTab: PostulationSubTab;
  onChangeSubTab: (tab: PostulationSubTab) => void;
  onBackToApplications: () => void;
  onOpenSiiModal: () => void;
  onUpdateRoadmapConfirmations: (confirmations: any) => void;
  onUpdateDocStatuses: (statuses: any) => void;
  onAddGeneratedDoc: (doc: any) => void;
  onUpdateGeneratedDocStatus: (id: string, status: any) => void;
  onDeleteGeneratedDoc: (id: string) => void;
  onSaveSectionAnswers: (sectionId: string, answers: any, texts?: any) => void;
  onSaveFormulation: (formulation: FormulationOutput) => void;
  onSendToAudit: (formulation: FormulationOutput, fund: ChileanFund) => void;
  onSaveAudit: (result: BlindAuditResult) => void;
  onUpdateProfile: (profile: CompanyProfile) => void;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
  onSelectFund: (fund: ChileanFund) => void;
  onNavigateTab: (tab: string) => void;
}

export const PostulationWorkspace: React.FC<PostulationWorkspaceProps> = ({
  fund,
  application,
  profile,
  expediente,
  formulation,
  auditResult,
  currentUser,
  activeSubTab,
  onChangeSubTab,
  onBackToApplications,
  onOpenSiiModal,
  onUpdateRoadmapConfirmations,
  onUpdateDocStatuses,
  onAddGeneratedDoc,
  onUpdateGeneratedDocStatus,
  onDeleteGeneratedDoc,
  onSaveSectionAnswers,
  onSaveFormulation,
  onSendToAudit,
  onSaveAudit,
  onUpdateProfile,
  onOpenAuthModal,
  onSelectFund,
  onNavigateTab
}) => {
  const [showDossierModal, setShowDossierModal] = useState<boolean>(false);

  // Compute 6-step progress for the header
  const progress = useMemo(() => {
    const isRutValid = validateRut(profile.rut);
    const isTaxFolderDone = Boolean(profile.taxFolderUploaded);
    const step1 = isRutValid && isTaxFolderDone;

    const step2 = Boolean(
      (application?.roadmapConfirmations?.confirmedEstatutoSocial || expediente?.roadmapConfirmations?.confirmedEstatutoSocial) &&
      ((expediente?.generatedDocs && expediente.generatedDocs.length > 0) || (profile.customerValidationCount && profile.customerValidationCount > 0))
    );

    const step3 = Boolean(formulation || expediente?.formulation);

    const hasBudget = Boolean(
      formulation?.budgetBreakdown && formulation.budgetBreakdown.some(b => (b.corfoContributionCLP || 0) > 0)
    );
    const step4 = hasBudget && Boolean(application?.roadmapConfirmations?.confirmedGarantia || expediente?.roadmapConfirmations?.confirmedGarantia);

    const currentAudit = auditResult || expediente?.auditResult;
    const step5 = Boolean(currentAudit && (currentAudit.overallScore || 0) >= 3.5);

    const step6 = step1 && step2 && step3 && step4 && step5;

    const completedCount = [step1, step2, step3, step4, step5, step6].filter(Boolean).length;
    const percentage = Math.round((completedCount / 6) * 100);

    return { completedCount, percentage };
  }, [profile, application, expediente, formulation, auditResult]);

  // Project profile completion percentage (Requirement A.2)
  const projectCompletion = useMemo(() => {
    return calculateProjectProfileCompletion(profile.projectProfile);
  }, [profile.projectProfile]);

  // Tab definitions: includes Asesor Experto inside each postulation (Requirement 3)
  // Aviso emergente (una vez por sesión y por fondo) si el perfil del proyecto está incompleto
  useEffect(() => {
    if (activeSubTab !== 'roadmap' || projectCompletion >= 60) return;
    const t = setTimeout(() => showToast({
      id: `perfil-incompleto-${fund.id}`,
      oncePerSession: true,
      level: 'warning',
      title: `Tu perfil de proyecto está al ${projectCompletion}%`,
      message: 'Complétalo para que la IA redacte con tus datos reales y no deje marcas [COMPLETAR].',
      action: { label: 'Completar perfil', onClick: () => routeTab('my-company#project-profile') }
    }), 600);
    return () => clearTimeout(t);
  }, [activeSubTab, projectCompletion, fund.id]);

  // Navegación con destino ("pestaña#destino"): pestañas de la postulación o el resto de la app.
  // Al salir hacia Mi empresa se recuerda a dónde volver.
  const routeTab = (tab: string) => {
    const { base, target } = splitTarget(tab);
    if (base === 'sii') { onOpenSiiModal(); return; }
    const sub: PostulationSubTab | null =
      base === 'my-application' || base === 'roadmap' ? 'roadmap'
      : (['formulator', 'documents', 'auditor', 'advisor', 'expediente'] as const).includes(base as any) ? (base as PostulationSubTab)
      : null;
    if (sub) {
      onChangeSubTab(sub);
      goToTarget(target);
      return;
    }
    if (base === 'my-company' || base === 'profile') {
      setReturnContext({ label: fund.name, subTab: activeSubTab });
    }
    onNavigateTab(tab);
  };

  // Al cambiar de pestaña, volver al inicio para no quedar a mitad de página
  const firstTabRender = useRef(true);
  useEffect(() => {
    if (firstTabRender.current) { firstTabRender.current = false; return; }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSubTab]);

  // Encabezado compacto al bajar: solo pestañas y nombre del fondo, para no tapar el contenido
  const headerSentinelRef = useRef<HTMLDivElement | null>(null);
  const [compactHeader, setCompactHeader] = useState(false);
  useEffect(() => {
    const el = headerSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const obs = new IntersectionObserver(([entry]) => setCompactHeader(!entry.isIntersecting), { rootMargin: '-72px 0px 0px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const tabs: { id: PostulationSubTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'roadmap', label: 'Hoja de Ruta', icon: CheckCircle2 },
    { id: 'formulator', label: 'Formulador', icon: Sparkles },
    { id: 'documents', label: 'Documentos y cartas', icon: FileText },
    { id: 'auditor', label: 'Auditoría', icon: ShieldCheck },
    { id: 'advisor', label: 'Asesor', icon: MessageSquareCode },
    { id: 'expediente', label: 'Expediente', icon: Award },
  ];

  return (
    <div className="space-y-4 animate-fade-in max-w-7xl mx-auto">
      {/* 1. ENCABEZADO: completo arriba; al bajar queda fijo y compacto (solo pestañas) */}
      <div ref={headerSentinelRef} aria-hidden="true" className="h-px -mb-4" />
      <div className={`sticky top-16 z-30 bg-white/95 backdrop-blur-md border border-slate-200 shadow-sm transition-all ${compactHeader ? 'rounded-2xl px-3 py-2 sm:px-4 space-y-0' : 'rounded-3xl p-4 sm:p-5 space-y-3'}`}>
        {compactHeader && (
          <div className="flex items-center gap-2 px-1 pb-1 min-w-0">
            <button
              type="button"
              onClick={onBackToApplications}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer shrink-0"
              aria-label="Volver a Mis postulaciones"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mis postulaciones</span>
            </button>
            <p className="text-xs font-bold text-slate-900 truncate">{fund.name}</p>
          </div>
        )}
        <div className={`flex-col sm:flex-row sm:items-center justify-between gap-3 ${compactHeader ? 'hidden' : 'flex'}`}>
          {/* Back button + Fund Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBackToApplications}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Mis postulaciones</span>
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono text-[9px] font-bold">
                  {fund.agency}
                </span>
                <h1 className="text-sm sm:text-base font-black text-slate-900 truncate">
                  {fund.name}
                </h1>
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                Subsidio: <strong className="text-emerald-700 font-mono">{fund.subsidyFormatted}</strong> • {fund.callSchedule}
              </p>
            </div>
          </div>

          {/* Progress / Avance + Expediente action */}
          <div className="flex items-center gap-3 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
            <div className="text-left sm:text-right">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs font-bold text-slate-700">Avance:</span>
                <span className="text-xs font-black text-blue-700">{progress.percentage}%</span>
                <span className="text-[10px] text-slate-400">({progress.completedCount}/6)</span>
              </div>
              <div className="w-28 sm:w-36 h-2 bg-slate-100 rounded-full overflow-hidden mt-1 border border-slate-200/80">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-emerald-600 transition-all duration-500 rounded-full"
                  style={{ width: `${Math.max(8, progress.percentage)}%` }}
                />
              </div>
            </div>

            <button
              onClick={() => setShowDossierModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span className="hidden sm:inline">Ver PDF Expediente</span>
              <span className="sm:hidden">PDF</span>
            </button>
          </div>
        </div>

        {/* 2. TABS BAR - With Horizontal Scroll on Mobile (Requirement 4) */}
        <div className={`overflow-x-auto no-scrollbar ${compactHeader ? '' : 'border-t border-slate-100 pt-2'}`}>
          <div className="flex items-center gap-1.5 min-w-max pb-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onChangeSubTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs shadow-blue-600/30'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. TOOL CONTENT AREA WITH LAZY LOADING SUSPENSE */}
      <div className="min-h-[400px]">
        {activeSubTab === 'roadmap' && (
          <div className="space-y-4">
            <MyActiveApplication
              profile={profile}
              selectedFund={fund}
              formulation={formulation}
              auditResult={auditResult}
              currentUser={currentUser}
              expediente={expediente}
              onUpdateRoadmapConfirmations={onUpdateRoadmapConfirmations}
              onUpdateDocStatuses={onUpdateDocStatuses}
              onNavigateTab={routeTab}
              onOpenSiiModal={onOpenSiiModal}
              onOpenAuthModal={() => onOpenAuthModal('login')}
              onSelectFund={onSelectFund}
            />
          </div>
        )}

        {activeSubTab === 'formulator' && (
          <Suspense fallback={
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <Sparkles className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Cargando Formulador Técnico...</p>
            </div>
          }>
            <AiFormulator
              selectedFund={fund}
              setSelectedFund={() => {}}
              profile={profile}
              initialFormulation={formulation}
              expediente={expediente}
              onSaveSectionAnswers={onSaveSectionAnswers}
              onSaveFormulation={onSaveFormulation}
              onSendToAudit={onSendToAudit}
              onNavigateTab={routeTab}
            />
          </Suspense>
        )}

        {activeSubTab === 'documents' && (
          <Suspense fallback={
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <FileText className="w-8 h-8 text-blue-600 animate-pulse mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Cargando Gestor de Documentos y Cartas...</p>
            </div>
          }>
            <DocumentManager
              profile={profile}
              activeFund={fund}
              formulation={formulation}
              currentUser={currentUser}
              expediente={expediente}
              onUpdateDocStatuses={onUpdateDocStatuses}
              onAddGeneratedDoc={onAddGeneratedDoc}
              onUpdateGeneratedDocStatus={onUpdateGeneratedDocStatus}
              onDeleteGeneratedDoc={onDeleteGeneratedDoc}
              onNavigateTab={routeTab}
              onOpenSiiModal={onOpenSiiModal}
              onUpdateValidationCount={(count: number) => {
                onUpdateProfile({ ...profile, customerValidationCount: count });
              }}
            />
          </Suspense>
        )}

        {activeSubTab === 'auditor' && (
          <Suspense fallback={
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <ShieldCheck className="w-8 h-8 text-blue-600 animate-pulse mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Cargando Auditor Ciego...</p>
            </div>
          }>
            <BlindAuditor
              initialFund={fund}
              initialFormulation={formulation}
              onSaveAudit={onSaveAudit}
              onNavigateTab={routeTab}
            />
          </Suspense>
        )}

        {/* Asesor Experto Tab (Requirement 3) */}
        {activeSubTab === 'advisor' && (
          <div className="animate-fade-in">
            <ExpertChat
              profile={profile}
              currentFund={fund}
            />
          </div>
        )}

        {activeSubTab === 'expediente' && (
          <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Expediente Consolidado de Postulación
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Revisa el dossier completo con antecedentes tributarios, formulación técnica y cartas de interés antes de enviar a e-CORFO.
                </p>
              </div>

              <button
                onClick={() => setShowDossierModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Abrir Expediente Completo (PDF / Imprimir)</span>
              </button>
            </div>

            {/* Checklist of Expediente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">1. Ficha de Empresa</span>
                <p className="font-bold text-xs text-slate-900 mt-1">{profile.companyName}</p>
                <p className="text-[11px] text-slate-500">RUT: {profile.rut || 'Pendiente'}</p>
                <button type="button" onClick={() => routeTab('my-company#company-identity')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline cursor-pointer">
                  Editar datos →
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">2. Carpeta Tributaria F29</span>
                <p className="font-bold text-xs text-slate-900 mt-1">
                  {profile.taxFolderUploaded ? 'Acreditada ante SII' : 'Pendiente de Cargar'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {profile.taxFolderUploaded ? `${profile.taxFolderF29Periods || 12} meses declarados` : 'Sube tu PDF F29'}
                </p>
                <button type="button" onClick={() => routeTab('sii')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline cursor-pointer">
                  {profile.taxFolderUploaded ? 'Ver carpeta' : 'Subir carpeta'} →
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">3. Formulación Técnica</span>
                <p className="font-bold text-xs text-slate-900 mt-1">
                  {formulation ? 'Redactada con IA' : 'Sin Formular'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {formulation ? `${formulation.projectTitle}` : 'Ve a la pestaña Formulador'}
                </p>
                <button type="button" onClick={() => routeTab('formulator#section:next')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline cursor-pointer">
                  {formulation ? 'Editar formulación' : 'Redactar con IA'} →
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">4. Cartas de Respaldo LOI</span>
                <p className="font-bold text-xs text-slate-900 mt-1">
                  {expediente.generatedDocs.length > 0 ? `${expediente.generatedDocs.length} generadas` : 'Sin cartas aún'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Validadas comercialmente
                </p>
                <button type="button" onClick={() => routeTab('documents#doc-generator')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline cursor-pointer">
                  Generar carta →
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">5. Simulación de Auditoría</span>
                <p className="font-bold text-xs text-slate-900 mt-1">
                  {auditResult ? `Nota: ${auditResult.overallScore}/5.0` : 'Sin auditar'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {auditResult ? (auditResult.overallScore >= 3.5 ? 'Aprobada' : 'Observada') : 'Simula antes de postular'}
                </p>
                <button type="button" onClick={() => routeTab('auditor')} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:underline cursor-pointer">
                  {auditResult ? 'Ver auditoría' : 'Simular evaluación'} →
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase">6. Fondo Seleccionado</span>
                <p className="font-bold text-xs text-slate-900 mt-1">{fund.name}</p>
                <p className="text-[11px] text-slate-500">{fund.subsidyFormatted}</p>
              </div>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                onClick={() => setShowDossierModal(true)}
                className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Visualizar e Imprimir Expediente Completo</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navegación al final de cada pestaña: no hace falta subir para volver */}
      {activeSubTab !== 'roadmap' && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={() => onChangeSubTab('roadmap')}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a la Hoja de Ruta
          </button>
          <button
            type="button"
            onClick={onBackToApplications}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer"
          >
            Ir a Mis postulaciones
          </button>
        </div>
      )}

      {/* Official Dossier Modal */}
      {showDossierModal && (
        <Suspense fallback={null}>
          <OfficialDossierModal
            isOpen={showDossierModal}
            onClose={() => setShowDossierModal(false)}
            expediente={expediente}
            fund={fund}
            onNavigateTab={routeTab}
            onOpenSiiModal={onOpenSiiModal}
          />
        </Suspense>
      )}
    </div>
  );
};
