import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CompanyProfile, ChileanFund, FormulationOutput, BlindAuditResult, CompanyUser } from './types/funds';
import { CHILEAN_FUNDS } from './data/chileanFunds';
import { Navbar } from './components/Navbar';
import { InstantWowMatcher } from './components/InstantWowMatcher';
import { SmartDiagnostic } from './components/SmartDiagnostic';
import { FundCatalog } from './components/FundCatalog';
import { AiFormulator } from './components/AiFormulator';
import { BlindAuditor } from './components/BlindAuditor';
import { DocumentManager } from './components/DocumentManager';
import { ExpertChat } from './components/ExpertChat';
import { SiiUploaderModal } from './components/SiiUploaderModal';
import { MyActiveApplication } from './components/MyActiveApplication';
import { MyApplicationsDashboard } from './components/MyApplicationsDashboard';
import { NewApplicationModal } from './components/NewApplicationModal';
import { ConvocatoriasView } from './components/ConvocatoriasView';
import { useApplications } from './hooks/useApplications';
import { useConvocatorias } from './hooks/useConvocatorias';
import { ExpedienteData } from './types/expediente';
import { PaymentResult } from './components/PaymentResult';
import { AuthModal } from './components/AuthModal';
import { AuthGateView } from './components/AuthGateView';
import { validateRut, formatRut } from './utils/rutValidator';
import { 
  saveActiveProfile, 
  loadActiveProfile, 
  saveActiveFormulation, 
  loadActiveFormulation, 
  saveActiveAudit, 
  loadActiveAudit,
  getCurrentUser,
  logoutCompanyUser,
  getCleanDefaultProfile
} from './utils/storage';
import { initFirebaseService, syncCompanyToFirestore } from './utils/firebaseSync';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Building2, 
  X, 
  Check, 
  TrendingUp, 
  ShieldCheck, 
  Coins, 
  Sparkles,
  ExternalLink,
  ArrowLeft,
  Lock,
  LogOut,
  UserCheck,
  Clock,
  Upload
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/pago/resultado')) {
      return 'pago-resultado';
    }
    return getCurrentUser() ? 'my-applications' : 'diagnostic';
  });

  // URL sync for /pago/resultado
  useEffect(() => {
    const handleUrlRoute = () => {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/pago/resultado')) {
        setActiveTab('pago-resultado');
      }
    };
    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, []);

  // Authenticated Company Session
  const [currentUser, setCurrentUser] = useState<CompanyUser | null>(() => getCurrentUser());
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Formulations & Audits scoped to user
  const [activeFormulation, setActiveFormulation] = useState<FormulationOutput | null>(() => 
    loadActiveFormulation(getCurrentUser()?.id)
  );
  const [auditResult, setAuditResult] = useState<BlindAuditResult | null>(() => 
    loadActiveAudit(getCurrentUser()?.id)
  );

  // Profile Modal & SII Uploader Modal
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showSiiModal, setShowSiiModal] = useState<boolean>(false);

  // Active Chilean Company Profile with local persistence scoped per user
  const [profile, setProfile] = useState<CompanyProfile>(() => {
    const user = getCurrentUser();
    return loadActiveProfile(getCleanDefaultProfile(user), user?.id);
  });

  // Track the user ID that owns the currently active in-memory profile
  const activeUserIdRef = useRef<string | undefined>(currentUser?.id);

  // Applications & Multi-Fund Management (Requirement 1, 4, 11)
  const {
    applications,
    activeApplications,
    archivedApplications,
    activeApplication,
    activeApplicationId,
    activeFund,
    setActiveApplicationId,
    createApplication,
    archiveApplication,
    reactivateApplication,
    updateActiveFormulation,
    updateActiveAuditResult,
    updateActiveRoadmapConfirmations,
    updateActiveDocStatuses,
    addActiveGeneratedDoc,
    updateActiveGeneratedDocStatus,
    deleteActiveGeneratedDoc,
    saveActiveSectionAnswers
  } = useApplications(profile);

  // Monitor de convocatorias oficiales en vivo desde Firestore (Requirement 1, 2, 5, 7)
  const {
    convocatorias,
    activeConvocatorias,
    syncMeta,
    isStale: isConvocatoriasStale,
    loading: convocatoriasLoading,
    liveFunds,
    refreshConvocatorias
  } = useConvocatorias();

  const [showNewAppModal, setShowNewAppModal] = useState<boolean>(false);

  // Firebase Auth listener: session driven by onAuthStateChanged
  useEffect(() => {
    initFirebaseService();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        let cached: Partial<CompanyUser> = {};
        try {
          const raw = localStorage.getItem(`impulsacap_user_meta_${fbUser.uid}`);
          if (raw) cached = JSON.parse(raw);
        } catch {}

        let companyName = cached.companyName || fbUser.displayName || 'Mi Empresa SpA';
        let rut = cached.rut || '';
        let representativeName = cached.representativeName || fbUser.displayName || '';
        let phone = cached.phone || '';
        let seenAlerts: string[] = cached.seenAlerts || [];

        try {
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
          if (userDoc.exists()) {
            const uData = userDoc.data();
            if (uData.companyName) companyName = uData.companyName;
            if (uData.companyRut) rut = uData.companyRut;
            if (uData.displayName) representativeName = uData.displayName;
            if (uData.phone) phone = uData.phone;
            if (Array.isArray(uData.seenAlerts)) seenAlerts = uData.seenAlerts;
          }
        } catch (e) {
          console.warn('Could not read user profile from Firestore:', e);
        }

        const user: CompanyUser = {
          id: fbUser.uid,
          email: fbUser.email || '',
          companyName,
          rut,
          representativeName,
          phone,
          seenAlerts,
          createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
          lastLogin: new Date().toISOString()
        };

        try {
          localStorage.setItem(`impulsacap_user_meta_${fbUser.uid}`, JSON.stringify(user));
        } catch {}

        activeUserIdRef.current = user.id;
        setCurrentUser(user);
        setProfile(loadActiveProfile(getCleanDefaultProfile(user), user.id));
        setActiveFormulation(loadActiveFormulation(user.id));
        setAuditResult(loadActiveAudit(user.id));
        setActiveTab(prev => (prev === 'diagnostic' ? 'my-applications' : prev));
      } else {
        activeUserIdRef.current = undefined;
        setCurrentUser(null);
        setProfile(getCleanDefaultProfile(null));
        setActiveFormulation(null);
        setAuditResult(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-save changes strictly under current user scope
  useEffect(() => {
    if (activeUserIdRef.current === currentUser?.id) {
      saveActiveProfile(profile, currentUser?.id);
      if (currentUser?.id) {
        syncCompanyToFirestore(profile, currentUser.id).catch(() => {});
      }
    }
  }, [profile, currentUser]);

  useEffect(() => {
    if (activeUserIdRef.current === currentUser?.id) {
      saveActiveFormulation(activeFormulation, currentUser?.id);
    }
  }, [activeFormulation, currentUser]);

  useEffect(() => {
    if (activeUserIdRef.current === currentUser?.id) {
      saveActiveAudit(auditResult, currentUser?.id);
    }
  }, [auditResult, currentUser]);

  // Active postulation expediente (Single Source of Truth per application, Requirement 1, 2, 4)
  const activeExpediente: ExpedienteData = useMemo(() => {
    const fund = activeFund;
    const app = activeApplication;
    return {
      id: app?.id || `exp_guest_${fund.id}`,
      ownerId: currentUser?.id || 'guest',
      fundId: fund.id,
      fundName: fund.name,
      createdAt: app?.createdAt || new Date().toISOString(),
      updatedAt: app?.updatedAt || new Date().toISOString(),
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
      roadmapConfirmations: app?.roadmapConfirmations || {
        confirmedInicioActividades: false,
        confirmedEstatutoSocial: false,
        confirmedGarantia: false
      },
      docStatuses: app?.docStatuses || {
        f29_sii: Boolean(profile.taxFolderUploaded),
        estatuto_res: false,
        deuda_tgr: false,
        previsional_f30: false,
        carta_interes_loi: false
      },
      generatedDocs: app?.generatedDocs || [],
      answersBySection: app?.answersBySection || {},
      generatedTextsBySection: app?.generatedTextsBySection || {},
      formulation: app?.formulation || null,
      auditResult: app?.auditResult || null
    };
  }, [activeApplication, activeFund, profile, currentUser]);

  const handleAuthSuccess = (user: CompanyUser) => {
    activeUserIdRef.current = user.id;
    setCurrentUser(user);
    setProfile(loadActiveProfile(getCleanDefaultProfile(user), user.id));
    setActiveFormulation(loadActiveFormulation(user.id));
    setAuditResult(loadActiveAudit(user.id));
    setShowAuthModal(false);
  };

  const handleLogout = () => {
    logoutCompanyUser();
    activeUserIdRef.current = undefined;
    setCurrentUser(null);
    setProfile(getCleanDefaultProfile(null));
    setActiveFormulation(null);
    setAuditResult(null);
    setActiveTab('diagnostic');
  };

  const handleApplySiiData = (updated: Partial<CompanyProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updated };
      saveActiveProfile(next, currentUser?.id);
      return next;
    });
  };

  // Flow handlers
  const handleSelectFundToFormulate = async (fund: ChileanFund) => {
    const existing = activeApplications.find(a => a.fundId === fund.id);
    if (existing) {
      setActiveApplicationId(existing.id);
      setActiveTab('my-application');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const res = await createApplication(fund.id);
    if (res.ok && res.application) {
      setActiveApplicationId(res.application.id);
      setActiveTab('my-application');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowNewAppModal(true);
    }
  };

  const handleSelectFundToViewDocs = async (fund: ChileanFund) => {
    const existing = activeApplications.find(a => a.fundId === fund.id);
    if (existing) {
      setActiveApplicationId(existing.id);
      setActiveTab('documents');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const res = await createApplication(fund.id);
      if (res.ok && res.application) {
        setActiveApplicationId(res.application.id);
        setActiveTab('documents');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setActiveTab('documents');
      }
    }
  };

  const handleSendToAudit = (formulation: FormulationOutput, fund: ChileanFund) => {
    setActiveFormulation(formulation);
    updateActiveFormulation(formulation);
    setActiveTab('auditor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Ticker / Chilean Venture Context Bar - Institutional Navy Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-slate-300">
          <div className="flex items-center gap-4 text-[11px] overflow-x-auto no-scrollbar">
            {/* Authenticated User Status in Ticker */}
            {currentUser ? (
              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold whitespace-nowrap">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>Bóveda Privada: {currentUser.companyName}</span>
              </span>
            ) : (
              <button
                onClick={() => { setAuthModalMode('login'); setShowAuthModal(true); }}
                className="inline-flex items-center gap-1.5 text-emerald-300 hover:text-emerald-200 font-bold whitespace-nowrap cursor-pointer transition-colors"
              >
                <Lock className="w-3 h-3" />
                <span>Acceso Empresas: Iniciar Sesión / Registrar</span>
              </button>
            )}

            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="hidden sm:inline whitespace-nowrap">
              Bono Género: <strong className="text-emerald-300">+10% Subsidio Estatal</strong>
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="hidden md:inline whitespace-nowrap">
              Ley I+D 20.241: <strong className="text-blue-300">35% Crédito Tributario</strong>
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] shrink-0">
            {currentUser ? (
              <>
                <button
                  onClick={() => setShowSiiModal(true)}
                  className="text-emerald-300 hover:text-emerald-200 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>📄 Subir F29 SII</span>
                </button>
                <span className="text-slate-600">•</span>
                <button
                  onClick={() => setShowProfileModal(true)}
                  className="text-blue-300 hover:text-blue-200 font-semibold font-mono cursor-pointer"
                >
                  RUT: {profile.rut || currentUser.rut || 'Configurar'}
                </button>
              </>
            ) : (
              <button
                onClick={() => { setAuthModalMode('register'); setShowAuthModal(true); }}
                className="text-emerald-300 hover:text-emerald-200 font-bold cursor-pointer"
              >
                Crear Cuenta de Empresa
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        companyName={currentUser?.companyName || ''}
        currentUser={currentUser}
        onOpenProfile={() => setShowProfileModal(true)}
        onOpenAuthModal={(mode) => { setAuthModalMode(mode || 'login'); setShowAuthModal(true); }}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 pb-28 sm:py-8">
        {/* Persistent Return to Active Postulation Button Bar - Visible when logged in and outside of application views */}
        {currentUser && activeTab !== 'my-application' && activeTab !== 'my-applications' && activeApplication && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-emerald-200/90 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                    Postulación Activa: {activeFund.name}
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                    Convocatoria 2026
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span>Empresa: <strong className="text-slate-800">{currentUser.companyName}</strong></span>
                  <span className="text-slate-300">•</span>
                  {profile.taxFolderUploaded ? (
                    <span className="text-emerald-600 font-semibold">📄 Carpeta Tributaria Subida ({profile.taxFolderFileName || 'F29.pdf'})</span>
                  ) : (
                    <button 
                      onClick={() => setShowSiiModal(true)} 
                      className="text-blue-700 hover:text-blue-800 font-semibold underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      <span>Subir Carpeta Tributaria F29</span>
                    </button>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('my-application')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Volver a Mi Hoja de Ruta</span>
            </button>
          </div>
        )}

        {/* Tab: Pago Resultado (Mercado Pago) */}
        {activeTab === 'pago-resultado' && (
          <PaymentResult
            onNavigateToRoadmap={() => {
              window.history.pushState({}, '', '/');
              setActiveTab('my-applications');
            }}
          />
        )}

        {/* Tab: Mis Postulaciones Dashboard (Requirement 5) */}
        {activeTab === 'my-applications' && (
          currentUser ? (
            <MyApplicationsDashboard
              profile={profile}
              activeApplications={activeApplications}
              archivedApplications={archivedApplications}
              convocatorias={activeConvocatorias}
              funds={liveFunds}
              currentUser={currentUser}
              onContinueApplication={(appId) => {
                setActiveApplicationId(appId);
                setActiveTab('my-application');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onArchiveApplication={archiveApplication}
              onReactivateApplication={reactivateApplication}
              onOpenNewApplicationModal={() => setShowNewAppModal(true)}
              onOpenProfile={() => setShowProfileModal(true)}
              onOpenSiiModal={() => setShowSiiModal(true)}
              onSelectFundToFormulate={handleSelectFundToFormulate}
              onNavigateTab={setActiveTab}
            />
          ) : (
            <AuthGateView
              onOpenAuthModal={(mode) => { setAuthModalMode(mode); setShowAuthModal(true); }}
              onNavigateHome={() => setActiveTab('diagnostic')}
              title="Bóveda de Mis Postulaciones a Fondos Concursables"
              description="Gestiona hasta 3 postulaciones simultáneas con tu empresa, resguarda tus expedientes oficiales y formula propuestas con IA en tu entorno privado."
            />
          )
        )}

        {/* Tab: Convocatorias Abiertas Oficiales de CORFO (Requirement 7) */}
        {activeTab === 'convocatorias' && (
          <ConvocatoriasView
            convocatorias={convocatorias}
            syncMeta={syncMeta}
            isStale={isConvocatoriasStale}
            loading={convocatoriasLoading}
            onRefresh={refreshConvocatorias}
            onSelectFundToFormulate={handleSelectFundToFormulate}
            onOpenNewApplicationModal={() => setShowNewAppModal(true)}
          />
        )}

        {/* Tab: Quick Diagnostic Matcher */}
        {activeTab === 'diagnostic' && (
          <InstantWowMatcher
            onSelectFundToFormulate={handleSelectFundToFormulate}
            onNavigateTab={setActiveTab}
            setProfile={setProfile}
            currentUser={currentUser}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

        {/* Tab: Advanced Diagnostic */}
        {activeTab === 'advanced-diagnostic' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <button
                onClick={() => setActiveTab('diagnostic')}
                className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver al Calce Rápido de Fondos</span>
              </button>
              <span className="text-[11px] font-semibold text-slate-500 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                Página de Diagnóstico Avanzado
              </span>
            </div>

            <SmartDiagnostic
              profile={profile}
              setProfile={setProfile}
              onSelectFundToFormulate={handleSelectFundToFormulate}
              onSelectFundToViewDocs={handleSelectFundToViewDocs}
            />
          </div>
        )}

        {/* Tab: Fund Catalogue */}
        {activeTab === 'catalog' && (
          <FundCatalog
            funds={liveFunds}
            onSelectFundToFormulate={handleSelectFundToFormulate}
            onSelectFundToViewDocs={handleSelectFundToViewDocs}
          />
        )}

        {/* Tab: AI Formulator */}
        {activeTab === 'formulator' && (
          currentUser ? (
            <AiFormulator
              selectedFund={activeFund}
              setSelectedFund={() => {}}
              profile={activeExpediente.profile || profile}
              initialFormulation={activeExpediente.formulation || activeFormulation}
              expediente={activeExpediente}
              onSaveSectionAnswers={saveActiveSectionAnswers}
              onSaveFormulation={(f) => {
                setActiveFormulation(f);
                saveActiveFormulation(f, currentUser?.id);
                updateActiveFormulation(f);
              }}
              onSendToAudit={(f, fund) => {
                handleSendToAudit(f, fund);
                updateActiveFormulation(f);
              }}
              onNavigateTab={setActiveTab}
            />
          ) : (
            <AuthGateView
              onOpenAuthModal={(mode) => { setAuthModalMode(mode); setShowAuthModal(true); }}
              onNavigateHome={() => setActiveTab('diagnostic')}
              title="Formulador Técnico IA para Fondos Concursables"
              description="La redacción técnica con Inteligencia Artificial, estructura de presupuesto Corfo y definición de objetivos queda guardada en la bóveda privada de tu empresa."
            />
          )
        )}

        {/* Tab: Blind Auditor */}
        {activeTab === 'auditor' && (
          currentUser ? (
            <BlindAuditor
              initialFund={activeFund}
              initialFormulation={activeExpediente.formulation || activeFormulation}
              onSaveAudit={(res) => {
                setAuditResult(res);
                saveActiveAudit(res, currentUser?.id);
                updateActiveAuditResult(res);
              }}
              onNavigateTab={setActiveTab}
            />
          ) : (
            <AuthGateView
              onOpenAuthModal={(mode) => { setAuthModalMode(mode); setShowAuthModal(true); }}
              onNavigateHome={() => setActiveTab('diagnostic')}
              title="Auditor Ciego y Simulado de Comités Evaluadores"
              description="Para simular la evaluación oficial y calificar las debilidades críticas de tu postulación antes del cierre, inicia sesión con tu empresa."
            />
          )
        )}

        {/* Tab: Roadmap / My Active Application */}
        {activeTab === 'my-application' && (
          currentUser ? (
            <MyActiveApplication
              profile={activeExpediente.profile || profile}
              selectedFund={activeFund}
              formulation={activeExpediente.formulation || activeFormulation}
              auditResult={activeExpediente.auditResult || auditResult}
              currentUser={currentUser}
              expediente={activeExpediente}
              onUpdateRoadmapConfirmations={updateActiveRoadmapConfirmations}
              onUpdateDocStatuses={updateActiveDocStatuses}
              onNavigateTab={setActiveTab}
              onOpenSiiModal={() => setShowSiiModal(true)}
              onOpenAuthModal={() => { setAuthModalMode('login'); setShowAuthModal(true); }}
              onSelectFund={(fund) => handleSelectFundToFormulate(fund)}
            />
          ) : (
            <AuthGateView
              onOpenAuthModal={(mode) => { setAuthModalMode(mode); setShowAuthModal(true); }}
              onNavigateHome={() => setActiveTab('diagnostic')}
              title="Bóveda Privada de Postulación y Hoja de Ruta"
              description="Para acceder a tu Hoja de Ruta personalizada, revisar las etapas de tu postulación y proteger tus antecedentes tributarios, debes iniciar sesión o registrar tu empresa en ImpulsaCap."
            />
          )
        )}

        {/* Tab: Document Manager */}
        {activeTab === 'documents' && (
          currentUser ? (
            <DocumentManager
              profile={activeExpediente.profile || profile}
              activeFund={activeFund}
              formulation={activeExpediente.formulation || activeFormulation}
              currentUser={currentUser}
              expediente={activeExpediente}
              onUpdateDocStatuses={updateActiveDocStatuses}
              onAddGeneratedDoc={addActiveGeneratedDoc}
              onUpdateGeneratedDocStatus={updateActiveGeneratedDocStatus}
              onDeleteGeneratedDoc={deleteActiveGeneratedDoc}
              onNavigateTab={setActiveTab}
              onOpenSiiModal={() => setShowSiiModal(true)}
              onUpdateValidationCount={(count: number) => {
                setProfile(prev => {
                  const updated = { ...prev, customerValidationCount: count };
                  saveActiveProfile(updated, currentUser?.id);
                  return updated;
                });
              }}
            />
          ) : (
            <AuthGateView
              onOpenAuthModal={(mode) => { setAuthModalMode(mode); setShowAuthModal(true); }}
              onNavigateHome={() => setActiveTab('diagnostic')}
              title="Carpeta de Documentos y SII Privada"
              description="Los antecedentes del SII, estatutos de sociedad y cartas de cofinanciamiento están resguardados en tu bóveda empresarial privada. Inicia sesión para consultarlos."
            />
          )
        )}

        {/* Tab: AI Advisor */}
        {activeTab === 'advisor' && (
          <ExpertChat
            profile={profile}
            currentFund={activeFund}
          />
        )}
      </main>

      {/* New Application Modal (Requirement 7, 8, 9, 10, 11) */}
      <NewApplicationModal
        isOpen={showNewAppModal}
        onClose={() => setShowNewAppModal(false)}
        profile={profile}
        activeApplications={activeApplications}
        funds={liveFunds}
        onCreateApplication={async (fundId) => {
          const res = await createApplication(fundId);
          if (res.ok && res.application) {
            setActiveTab('my-application');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return res;
        }}
        onOpenExistingApplication={(appId) => {
          setActiveApplicationId(appId);
          setActiveTab('my-application');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onArchiveApplication={archiveApplication}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      {/* Quick Profile Modal - Clean Light SaaS */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Editar Perfil de la Empresa</h3>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Account Status / Privacy info */}
            {currentUser ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cuenta de Empresa: {currentUser.email}</span>
                  </p>
                  <p className="text-[10px] text-slate-500">Datos protegidos con contraseña privada</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-slate-700 hover:text-rose-600 text-xs font-semibold cursor-pointer"
                >
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Sin Sesión Activa</span>
                  </p>
                  <p className="text-[10px] text-slate-500">Inicia sesión con mail y contraseña</p>
                </div>
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    setAuthModalMode('register');
                    setShowAuthModal(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  Registrar
                </button>
              </div>
            )}

            {/* Quick SII Autofill Button */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-50 to-emerald-50 border border-blue-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">Autocompletar con Carpeta Tributaria</p>
                <p className="text-[10px] text-slate-500">Extrae RUT, ventas y fecha de inicio automáticamente</p>
              </div>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setShowSiiModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Subir F29 con IA
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Razón Social</label>
                <input
                  type="text"
                  value={profile.companyName}
                  onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
                  placeholder="Ej: Mi Empresa SpA"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">RUT Empresa</label>
                    {profile.rut && (
                      <span className={`text-[10px] font-bold ${validateRut(profile.rut) ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {validateRut(profile.rut) ? '✓ Válido Módulo 11' : '⚠ Inválido'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={profile.rut}
                    onChange={(e) => setProfile({ ...profile, rut: formatRut(e.target.value) })}
                    placeholder="77.123.456-K"
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 border text-slate-900 font-mono focus:bg-white focus:outline-hidden ${
                      profile.rut && validateRut(profile.rut) ? 'border-emerald-500' : 'border-slate-300 focus:border-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Tipo de Sociedad</label>
                  <select
                    value={profile.companyType}
                    onChange={(e) => setProfile({ ...profile, companyType: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="spa">SpA</option>
                    <option value="srl">SRL</option>
                    <option value="eirl">EIRL</option>
                    <option value="sa">S.A.</option>
                    <option value="persona_natural">Persona Natural (1ª Cat)</option>
                    <option value="sin_iniciar">Sin Inicio de Actividades</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sector Económico</label>
                <input
                  type="text"
                  value={profile.sector}
                  onChange={(e) => setProfile({ ...profile, sector: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Región</label>
                <input
                  type="text"
                  value={profile.region}
                  onChange={(e) => setProfile({ ...profile, region: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowProfileModal(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sii Tax Folder Uploader Modal */}
      <SiiUploaderModal
        isOpen={showSiiModal}
        onClose={() => setShowSiiModal(false)}
        onApplyProfile={handleApplySiiData}
      />

      {/* Clean Light Footer */}
      <footer className="border-t border-slate-200 bg-white pt-8 pb-24 sm:py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="font-black text-slate-900 tracking-tight text-sm">
              Impulsa<span className="text-emerald-600">Cap</span>
            </span>
            <span>— Plataforma Inteligente para Fondos Concursables en Chile</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400 font-medium">
            <span>CORFO</span>
            <span>•</span>
            <span>SERCOTEC</span>
            <span>•</span>
            <span>ANID</span>
            <span>•</span>
            <span>Start-Up Chile</span>
            <span>•</span>
            <span>FIA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
