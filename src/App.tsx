import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { CompanyProfile, ChileanFund, FormulationOutput, BlindAuditResult, CompanyUser } from './types/funds';
import { CHILEAN_FUNDS } from './data/chileanFunds';
import { Navbar } from './components/Navbar';
import { InstantWowMatcher } from './components/InstantWowMatcher';
import { SearchFundsView } from './components/SearchFundsView';
import { MyCompanyView } from './components/MyCompanyView';
import { PostulationWorkspace, PostulationSubTab } from './components/PostulationWorkspace';
import { MyApplicationsDashboard } from './components/MyApplicationsDashboard';
import { NewApplicationModal } from './components/NewApplicationModal';
import { HelpBot } from './components/HelpBot';
import { MonitorHero } from './components/MonitorHero';
import { HowItWorks, PlanComparison, LandingFaq } from './components/LandingSections';
import { SiiUploaderModal } from './components/SiiUploaderModal';
import { AuthModal } from './components/AuthModal';
import { TermsPage, PrivacyPage } from './components/LegalPages';
import { ServiceStartModal } from './components/ServiceStartModal';
import { WelcomeStartModal } from './components/WelcomeStartModal';
import { ToastCenter } from './components/ToastCenter';
import { EarlyAccessModal } from './components/EarlyAccessModal';
import { AdminDashboard } from './components/AdminDashboard';
import { SellerPanel } from './components/SellerPanel';
import { showToast } from './utils/toast';
import { splitTarget, goToTarget, setReturnContext } from './utils/navFocus';
import { fundFromConvocatoria } from './utils/convocatoriaFund';
import { ReturnBar } from './components/ReturnBar';
import { captureRefFromUrl, previewCode, clearStoredRef, notifyReferralChanged } from './utils/referral';
import { trackPageview } from './utils/pageviews';
import { AuthGateView } from './components/AuthGateView';
import { PaymentResult } from './components/PaymentResult';
import { useApplications } from './hooks/useApplications';
import { useConvocatorias } from './hooks/useConvocatorias';
import { ExpedienteData } from './types/expediente';
import { Convocatoria } from './types/convocatoria';
import { 
  saveActiveProfile, 
  getProfileSavedAt,
  setProfileSavedAt,
  loadActiveProfile, 
  saveActiveFormulation, 
  loadActiveFormulation, 
  saveActiveAudit, 
  loadActiveAudit,
  getCurrentUser,
  logoutCompanyUser,
  getCleanDefaultProfile
} from './utils/storage';
import { initFirebaseService, syncCompanyToFirestore, loadCompanyFromFirestore } from './utils/firebaseSync';
import { auth, db } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Lock, Sparkles, Building2, Upload } from 'lucide-react';
import { apiFetch } from './utils/apiFetch';
import { 
  onRequestLogin, 
  executePendingPostLoginAction, 
  clearPendingPostLoginAction 
} from './utils/authEvents';

// Lazy-loaded components for optimal performance (Requirement 9)
const SmartDiagnostic = React.lazy(() => 
  import('./components/SmartDiagnostic').then(m => ({ default: m.SmartDiagnostic }))
);

// Páginas con URL propia: legales públicas (/terminos, /privacidad) y panel de administración (/admin)
const ROUTED_TABS = ['terminos', 'privacidad', 'admin', 'vendedor'] as const;
function legalTabForPath(pathname: string): 'terminos' | 'privacidad' | 'admin' | 'vendedor' | null {
  if (pathname.startsWith('/terminos')) return 'terminos';
  if (pathname.startsWith('/privacidad')) return 'privacidad';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/vendedor')) return 'vendedor';
  return null;
}

/** Combina dos perfiles: gana el valor con dato (texto no vacío, número > 0, true); el de `a` primero. */
function mergeProfilesPreferFilled(a: any, b: any): any {
  const filled = (v: any) =>
    v !== undefined && v !== null &&
    !(typeof v === 'string' && v.trim() === '') &&
    !(typeof v === 'number' && v === 0) &&
    v !== false &&
    !(Array.isArray(v) && v.length === 0);
  const out: any = { ...(b || {}), ...(a || {}) };
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const va = a?.[k];
    const vb = b?.[k];
    if (va && vb && typeof va === 'object' && typeof vb === 'object' && !Array.isArray(va)) {
      out[k] = mergeProfilesPreferFilled(va, vb);
    } else {
      out[k] = filled(va) ? va : (filled(vb) ? vb : (va ?? vb));
    }
  }
  return out;
}

export default function App() {
  // Loading state while Firebase verifies initial session (Requirement 2)
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/pago/resultado')) {
      return 'pago-resultado';
    }
    const legal = typeof window !== 'undefined' ? legalTabForPath(window.location.pathname) : null;
    if (legal) return legal;
    return 'diagnostic';
  });

  // Active sub-tab inside a postulation workspace (Requirement 2)
  const [postulationSubTab, setPostulationSubTab] = useState<PostulationSubTab>('roadmap');

  // URL sync for /pago/resultado
  useEffect(() => {
    const handleUrlRoute = () => {
      if (typeof window === 'undefined') return;
      if (window.location.pathname.startsWith('/pago/resultado')) {
        setActiveTab('pago-resultado');
        return;
      }
      const legal = legalTabForPath(window.location.pathname);
      if (legal) {
        setActiveTab(legal);
      } else {
        setActiveTab(prev => ((ROUTED_TABS as readonly string[]).includes(prev) ? 'diagnostic' : prev));
      }
    };
    handleUrlRoute();
    window.addEventListener('popstate', handleUrlRoute);
    return () => window.removeEventListener('popstate', handleUrlRoute);
  }, []);

  // Link de vendedor (?ref=CODIGO): guarda el código y avisa el precio
  useEffect(() => {
    const code = captureRefFromUrl();
    if (!code) return;
    previewCode(code).then(p => {
      if ('error' in p) {
        clearStoredRef();
        showToast({ id: `ref-invalid-${code}`, level: 'warning', title: `El código ${code} no está vigente`, message: 'Puedes seguir con el precio de primera compra.' });
      } else {
        showToast({
          id: `ref-ok-${code}`,
          level: 'success',
          title: `Código ${p.code} aplicado`,
          message: `Tu primer trimestre del Plan Trimestral queda en $${p.price.toLocaleString('es-CL')} (IVA incluido)${p.sellerName ? `. Te atiende ${p.sellerName}.` : '.'}`
        });
      }
      notifyReferralChanged();
    });
  }, []);

  // El modo "elige tu concurso" termina al salir del buscador
  useEffect(() => {
    if (!['search-funds', 'catalog', 'convocatorias'].includes(activeTab)) setMonitorPickMode(false);
  }, [activeTab]);

  // Al salir de una página legal por la navegación de la app, la URL vuelve a "/"
  useEffect(() => {
    if (!(ROUTED_TABS as readonly string[]).includes(activeTab) && legalTabForPath(window.location.pathname)) {
      window.history.replaceState({}, '', '/');
    }
    // Conteo de visitas por sección (sin cookies)
    trackPageview(activeTab);
  }, [activeTab]);

  const openLegalPage = (tab: 'terminos' | 'privacidad') => {
    window.history.pushState({}, '', tab === 'terminos' ? '/terminos' : '/privacidad');
    setActiveTab(tab);
    window.scrollTo({ top: 0 });
  };

  const leaveLegalPage = () => {
    window.history.pushState({}, '', '/');
    setActiveTab('diagnostic');
    window.scrollTo({ top: 0 });
  };

  // Authenticated Company Session - STRICTLY initialized via onAuthStateChanged
  const [currentUser, setCurrentUser] = useState<CompanyUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authModalMessage, setAuthModalMessage] = useState<string>('');

  // Formulations & Audits scoped to user
  const [activeFormulation, setActiveFormulation] = useState<FormulationOutput | null>(null);
  const [auditResult, setAuditResult] = useState<BlindAuditResult | null>(null);

  // SII Uploader Modal
  const [showSiiModal, setShowSiiModal] = useState<boolean>(false);

  // Bienvenida para cuentas sin postulaciones: el usuario elige cómo empezar (no se crea nada automáticamente)
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [suggestedFund, setSuggestedFund] = useState<ChileanFund | null>(null);

  // Active Chilean Company Profile with local persistence scoped per user
  const [profile, setProfile] = useState<CompanyProfile>(() => {
    return getCleanDefaultProfile(null);
  });

  // Track the user ID that owns the currently active in-memory profile
  const activeUserIdRef = useRef<string | undefined>(undefined);
  const profileHydratedRef = useRef<boolean>(false);

  // Applications & Multi-Fund Management
  const {
    applications,
    activeApplications,
    archivedApplications,
    loading: applicationsLoading,
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

  // Monitor de convocatorias oficiales en vivo desde Firestore
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
  const [intendedConvocatoria, setIntendedConvocatoria] = useState<Convocatoria | null>(null);
  // Modo "elige tu concurso" en el monitor (al crear una nueva postulación)
  const [monitorPickMode, setMonitorPickMode] = useState<boolean>(false);
  const [highlightedConvocatoriaId, setHighlightedConvocatoriaId] = useState<string | null>(null);

  // Listen for login requests from components (PlanPaywallCard, PaymentResult) or 401 handler
  useEffect(() => {
    const unsubscribe = onRequestLogin((options) => {
      setAuthModalMode(options.mode || 'login');
      setAuthModalMessage(options.message || '');
      setShowAuthModal(true);
    });
    return () => unsubscribe();
  }, []);

  // Firebase Auth listener: session driven strictly by onAuthStateChanged (Requirement 2)
  useEffect(() => {
    initFirebaseService();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      try {
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

          // Correo de bienvenida para cuentas nuevas (el servidor garantiza un solo envío por usuario)
          try {
            const createdMs = new Date(fbUser.metadata.creationTime || 0).getTime();
            const welcomeKey = `impulsacap_welcome_requested_${fbUser.uid}`;
            if (createdMs && Date.now() - createdMs < 7 * 24 * 3600 * 1000 && !localStorage.getItem(welcomeKey)) {
              // Se marca como resuelto solo cuando el servidor confirma (enviado o no corresponde);
              // si falla o pide reintentar, se vuelve a intentar en la próxima carga.
              // Reintenta unas veces: justo después del registro el perfil puede no estar guardado aún
              const requestWelcome = (attempt: number) => {
                apiFetch('/api/cuenta/bienvenida', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ createdAt: fbUser.metadata.creationTime || null }) })
                  .then(r => r.json())
                  .then((r: { sent?: boolean; retry?: boolean }) => {
                    if (r && (r.sent || !r.retry)) { localStorage.setItem(welcomeKey, '1'); return; }
                    if (attempt < 4) setTimeout(() => requestWelcome(attempt + 1), 20000 * attempt);
                  })
                  .catch(() => { if (attempt < 4) setTimeout(() => requestWelcome(attempt + 1), 20000 * attempt); });
              };
              setTimeout(() => requestWelcome(1), 4000);
            }
          } catch {}

          activeUserIdRef.current = user.id;
          setCurrentUser(user);
          // Perfil: primero el del navegador y luego el de Firestore si es más reciente.
          // Hasta tenerlo no se guarda nada, para que un perfil vacío (otro dispositivo) no pise el bueno.
          profileHydratedRef.current = false;
          setProfile(loadActiveProfile(getCleanDefaultProfile(user), user.id));
          const hydratingUid = user.id;
          loadCompanyFromFirestore(hydratingUid)
            .then(remote => {
              if (!remote || activeUserIdRef.current !== hydratingUid) return;
              const localSavedAt = getProfileSavedAt(hydratingUid);
              const local = loadActiveProfile(getCleanDefaultProfile(user), hydratingUid);
              let merged: CompanyProfile | null = null;
              if (!localSavedAt) {
                // Perfil del navegador sin fecha (guardado antes de este cambio): se combina campo por campo,
                // conservando lo que tenga dato y completando lo vacío con Firestore
                merged = mergeProfilesPreferFilled(local, remote.profile);
              } else if (remote.updatedAt && remote.updatedAt > localSavedAt) {
                merged = { ...getCleanDefaultProfile(user), ...remote.profile } as CompanyProfile;
              }
              if (merged) {
                saveActiveProfile(merged, hydratingUid);
                setProfile(merged);
              }
            })
            .catch(err => console.warn('No se pudo leer el perfil desde Firestore:', err))
            .finally(() => {
              if (activeUserIdRef.current === hydratingUid) profileHydratedRef.current = true;
            });
          setActiveFormulation(loadActiveFormulation(user.id));
          setAuditResult(loadActiveAudit(user.id));
          setActiveTab(prev => (prev === 'diagnostic' ? 'my-applications' : prev));
        } else {
          activeUserIdRef.current = undefined;
          setCurrentUser(null);
          setProfile(getCleanDefaultProfile(null));
          setActiveFormulation(null);
          setAuditResult(null);
          setActiveTab(prev => (prev === 'my-applications' || prev === 'postulation' || prev === 'my-company' ? 'diagnostic' : prev));
        }
      } catch (err) {
        console.error('Error processing onAuthStateChanged in App:', err);
      } finally {
        setIsAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Auto-save changes strictly under current user scope (solo después de cargar el perfil de Firestore)
  useEffect(() => {
    if (activeUserIdRef.current !== currentUser?.id) return;
    if (currentUser?.id && !profileHydratedRef.current) return;
    saveActiveProfile(profile, currentUser?.id);
    if (currentUser?.id) {
      const now = new Date().toISOString();
      setProfileSavedAt(now, currentUser.id);
      const t = setTimeout(() => { syncCompanyToFirestore(profile, currentUser.id, now).catch(() => {}); }, 600);
      return () => clearTimeout(t);
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

  // Active postulation expediente (Single Source of Truth per application)
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

  // Enlace del correo "Ya puedes completar tu pago" (/?pagar=1): lleva a "Mi plan"
  useEffect(() => {
    if (!currentUser) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('pagar') !== '1') return;
    window.history.replaceState({}, '', window.location.pathname);
    setActiveTab('my-company');
    setTimeout(() => document.getElementById('mi-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
  }, [currentUser]);

  const welcomeKey = (uid?: string) => `impulsacap_welcome_start_done_${uid || 'guest'}`;
  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    try { localStorage.setItem(welcomeKey(currentUser?.id), '1'); } catch { /* sin efecto */ }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser || applicationsLoading || applications.length > 0) return;
    let done = false;
    try { done = localStorage.getItem(welcomeKey(currentUser.id)) === '1'; } catch { done = false; }
    if (!done) setWelcomeOpen(true);
  }, [currentUser, applicationsLoading, applications.length]);

  const handleSuggestFund = (fund: ChileanFund | null) => {
    setSuggestedFund(fund);
    setWelcomeOpen(true);
  };

  const handleAuthSuccess = async (user: CompanyUser) => {
    activeUserIdRef.current = user.id;
    setCurrentUser(user);
    setProfile(loadActiveProfile(getCleanDefaultProfile(user), user.id));
    setActiveFormulation(loadActiveFormulation(user.id));
    setAuditResult(loadActiveAudit(user.id));
    setShowAuthModal(false);
    setAuthModalMessage('');

    // Execute any pending post-login action (like continuing payment!)
    await executePendingPostLoginAction();

    if (intendedConvocatoria) {
      const conv = intendedConvocatoria;
      setIntendedConvocatoria(null);
      if (conv.fundId) {
        const matched = liveFunds.find(f => f.id === conv.fundId) || CHILEAN_FUNDS.find(f => f.id === conv.fundId);
        if (matched) {
          handleSelectFundToFormulate(matched);
          return;
        }
      }
      handleSelectFundToFormulate(fundFromConvocatoria(conv));
    }
  };

  const handleQualifyCall = (conv: Convocatoria) => {
    setHighlightedConvocatoriaId(conv.id);
    setActiveTab('diagnostic');
    setTimeout(() => {
      const el = document.getElementById('asistente-5-preguntas');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  const handlePostularConvocatoria = (conv: Convocatoria) => {
    if (!currentUser) {
      setIntendedConvocatoria(conv);
      setAuthModalMode('register');
      setShowAuthModal(true);
      return;
    }

    setMonitorPickMode(false);
    if (conv.fundId) {
      const fund = liveFunds.find(f => f.id === conv.fundId) || CHILEAN_FUNDS.find(f => f.id === conv.fundId);
      if (fund) {
        handleSelectFundToFormulate(fund);
        return;
      }
    }
    // Cualquier convocatoria del monitor se puede postular: se arma la ficha del concurso
    handleSelectFundToFormulate(fundFromConvocatoria(conv));
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
      setActiveTab('postulation');
      setPostulationSubTab('roadmap');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const res = await createApplication(fund);
    if (res.ok && res.application) {
      setActiveApplicationId(res.application.id);
      setActiveTab('postulation');
      setPostulationSubTab('roadmap');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (res.limitReached) {
      showToast({ id: `limite-${Date.now()}`, level: 'warning', title: 'Usaste tus 3 cupos', message: 'Archiva una postulación en "Mis postulaciones" para empezar otra.', action: { label: 'Ir a Mis postulaciones', onClick: () => setActiveTab('my-applications') } });
    } else {
      setShowNewAppModal(true);
    }
  };

  // "Nueva postulación": lleva al monitor para elegir un concurso abierto
  const openMonitorToPick = () => {
    setMonitorPickMode(true);
    setActiveTab('convocatorias');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectFundToViewDocs = async (fund: ChileanFund) => {
    const existing = activeApplications.find(a => a.fundId === fund.id);
    if (existing) {
      setActiveApplicationId(existing.id);
      setActiveTab('postulation');
      setPostulationSubTab('documents');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const res = await createApplication(fund.id);
      if (res.ok && res.application) {
        setActiveApplicationId(res.application.id);
        setActiveTab('postulation');
        setPostulationSubTab('documents');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setActiveTab('postulation');
        setPostulationSubTab('documents');
      }
    }
  };

  const handleSendToAudit = (f: FormulationOutput, fund: ChileanFund) => {
    setActiveFormulation(f);
    updateActiveFormulation(f);
    setPostulationSubTab('auditor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Generalized tab navigation mapper
  const handleNavigateTab = (rawTab: string) => {
    const { base: tab, target } = splitTarget(rawTab);
    if (tab !== 'my-company' && tab !== 'profile') setReturnContext(null);
    if (tab === 'catalog') {
      setActiveTab('search-funds');
    } else if (tab === 'convocatorias') {
      setActiveTab('convocatorias');
    } else if (tab === 'my-application') {
      setActiveTab('postulation');
      setPostulationSubTab('roadmap');
    } else if (tab === 'formulator') {
      setActiveTab('postulation');
      setPostulationSubTab('formulator');
    } else if (tab === 'documents') {
      setActiveTab('postulation');
      setPostulationSubTab('documents');
    } else if (tab === 'auditor') {
      setActiveTab('postulation');
      setPostulationSubTab('auditor');
    } else if (tab === 'profile') {
      setActiveTab('my-company');
    } else if (tab === 'advisor') {
      if (activeApplicationId) {
        setActiveTab('postulation');
        setPostulationSubTab('advisor');
      } else {
        setActiveTab('my-applications');
      }
    } else {
      setActiveTab(tab);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    goToTarget(target);
  };

  // Loading state while Firebase verifies initial session (Requirement 2)
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white selection:bg-blue-600">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-500/10">
            <Sparkles className="w-7 h-7 text-cyan-400 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-black text-white tracking-tight">ImpulsaCap</h2>
            <p className="text-xs text-slate-400 font-mono flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>Verificando sesión segura...</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white overflow-x-hidden w-full max-w-full">
      {/* Top Ticker / Chilean Venture Context Bar - Institutional Navy Bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-3 sm:px-4 py-2 text-xs overflow-x-hidden max-w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-slate-300 min-w-0">
          <div className="flex items-center gap-2 sm:gap-4 text-[11px] overflow-x-auto no-scrollbar min-w-0">
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
                <span>Acceso Empresas: Iniciar Sesión / Registrarse</span>
              </button>
            )}

            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="hidden sm:inline whitespace-nowrap text-slate-400">
              Convocatorias Corfo y Sercotec actualizadas
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
                  onClick={() => setActiveTab('my-company')}
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

      {/* Main Navbar (Requirements 1, 4, 5) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        companyName={currentUser?.companyName || ''}
        currentUser={currentUser}
        onOpenProfile={() => setActiveTab('my-company')}
        onOpenAuthModal={(mode) => { setAuthModalMode(mode || 'login'); setShowAuthModal(true); }}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 pb-28 sm:py-8 min-w-0 max-w-full overflow-x-hidden">
        {/* Tab: Pago Resultado (Mercado Pago) */}
        {activeTab === 'pago-resultado' && (
          <PaymentResult
            onNavigateToRoadmap={() => {
              window.history.pushState({}, '', '/');
              setActiveTab('my-applications');
            }}
            onNavigateToPlan={() => {
              window.history.pushState({}, '', '/');
              setActiveTab('my-company');
              setTimeout(() => {
                document.getElementById('mi-plan')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 300);
            }}
          />
        )}

        {/* Panel de administración (solo correos autorizados en el servidor) */}
        {activeTab === 'admin' && <AdminDashboard />}
        {activeTab === 'vendedor' && <SellerPanel />}

        {/* Páginas legales */}
        {activeTab === 'terminos' && (
          <TermsPage onBack={leaveLegalPage} onOpenOther={() => openLegalPage('privacidad')} />
        )}
        {activeTab === 'privacidad' && (
          <PrivacyPage onBack={leaveLegalPage} onOpenOther={() => openLegalPage('terminos')} />
        )}

        {/* Tab: Inicio (Guest Visitor Home - Requirements 1 & 4: Hero -> Asistente -> Beneficios Plan) */}
        {activeTab === 'diagnostic' && (
          <div className="space-y-10 min-w-0 max-w-full">
            {/* 1. HERO "MONITOR EN VIVO" (Protagonista del inicio para visitantes) */}
            <MonitorHero
              convocatorias={convocatorias}
              syncMeta={syncMeta}
              loading={convocatoriasLoading}
              onViewAllConvocatorias={() => handleNavigateTab('convocatorias')}
              onScrollToAssistant={() => {
                const el = document.getElementById('asistente-5-preguntas');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            />

            {/* 2. CÓMO FUNCIONA: las 3 etapas del recorrido */}
            <HowItWorks />

            {/* 3. ASISTENTE DE 5 PREGUNTAS */}
            <div id="asistente-5-preguntas" className="min-w-0 max-w-full scroll-mt-24">
              <InstantWowMatcher
                onSelectFundToFormulate={handleSelectFundToFormulate}
                onNavigateTab={handleNavigateTab}
                setProfile={setProfile}
                currentUser={currentUser}
                onAuthSuccess={handleAuthSuccess}
                onSuggestFund={handleSuggestFund}
              />
            </div>

            {/* 4. GRATIS VS. PLAN TRIMESTRAL */}
            <PlanComparison
              onStartFree={() => {
                document.getElementById('asistente-5-preguntas')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />

            {/* 5. PREGUNTAS FRECUENTES */}
            <LandingFaq />
          </div>
        )}

        {/* Tab 1: Mis Postulaciones Dashboard (Requirement 1) */}
        {activeTab === 'my-applications' && (
          currentUser ? (
            <MyApplicationsDashboard
              profile={profile}
              activeApplications={activeApplications}
              archivedApplications={archivedApplications}
              convocatorias={activeConvocatorias}
              funds={liveFunds}
              currentUser={currentUser}
              onContinueApplication={(appId, target) => {
                setActiveApplicationId(appId);
                if (target) {
                  handleNavigateTab(target);
                  return;
                }
                setActiveTab('postulation');
                setPostulationSubTab('roadmap');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onArchiveApplication={archiveApplication}
              onReactivateApplication={reactivateApplication}
              onOpenNewApplicationModal={openMonitorToPick}
              onOpenProfile={() => setActiveTab('my-company')}
              onOpenSiiModal={() => setShowSiiModal(true)}
              onSelectFundToFormulate={handleSelectFundToFormulate}
              onNavigateTab={handleNavigateTab}
            />
          ) : (
            <AuthGateView
              onOpenAuthModal={(mode) => { setAuthModalMode(mode); setShowAuthModal(true); }}
              onNavigateHome={() => setActiveTab('diagnostic')}
              title="Bóveda de Mis Postulaciones a Fondos Concursables"
              description="Gestiona tus postulaciones simultáneas con tu empresa, resguarda tus expedientes y formula propuestas con IA en tu entorno privado."
            />
          )
        )}

        {/* In-Postulation Workspace (Requirements 2, 3, 4) */}
        {(activeTab === 'postulation' || activeTab === 'my-application') && (
          currentUser ? (
            <PostulationWorkspace
              fund={activeFund}
              application={activeApplication}
              profile={activeExpediente.profile || profile}
              expediente={activeExpediente}
              formulation={activeExpediente.formulation || activeFormulation}
              auditResult={activeExpediente.auditResult || auditResult}
              currentUser={currentUser}
              activeSubTab={postulationSubTab}
              onChangeSubTab={setPostulationSubTab}
              onBackToApplications={() => {
                setActiveTab('my-applications');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenSiiModal={() => setShowSiiModal(true)}
              onUpdateRoadmapConfirmations={updateActiveRoadmapConfirmations}
              onUpdateDocStatuses={updateActiveDocStatuses}
              onAddGeneratedDoc={addActiveGeneratedDoc}
              onUpdateGeneratedDocStatus={updateActiveGeneratedDocStatus}
              onDeleteGeneratedDoc={deleteActiveGeneratedDoc}
              onSaveSectionAnswers={saveActiveSectionAnswers}
              onSaveFormulation={(f) => {
                setActiveFormulation(f);
                saveActiveFormulation(f, currentUser?.id);
                updateActiveFormulation(f);
              }}
              onSendToAudit={handleSendToAudit}
              onSaveAudit={(res) => {
                setAuditResult(res);
                saveActiveAudit(res, currentUser?.id);
                updateActiveAuditResult(res);
              }}
              onUpdateProfile={setProfile}
              onOpenAuthModal={(mode) => { setAuthModalMode(mode || 'login'); setShowAuthModal(true); }}
              onSelectFund={handleSelectFundToFormulate}
              onNavigateTab={handleNavigateTab}
            />
          ) : (
            <AuthGateView
              onOpenAuthModal={(mode) => { setAuthModalMode(mode); setShowAuthModal(true); }}
              onNavigateHome={() => setActiveTab('diagnostic')}
              title="Bóveda Privada de Postulación y Expediente"
              description="Para acceder a las herramientas de formulación, hoja de ruta y auditoría, debes iniciar sesión con tu empresa."
            />
          )
        )}

        {/* Tab 2: Buscar Fondos (Catálogo + Convocatorias - Requirement 1 & 2) */}
        {(activeTab === 'search-funds' || activeTab === 'catalog' || activeTab === 'convocatorias') && (
          <SearchFundsView
            funds={liveFunds}
            convocatorias={convocatorias}
            syncMeta={syncMeta}
            isStale={isConvocatoriasStale}
            loading={convocatoriasLoading}
            currentUser={currentUser}
            onRefreshConvocatorias={refreshConvocatorias}
            onSelectFundToFormulate={handleSelectFundToFormulate}
            onSelectFundToViewDocs={handleSelectFundToViewDocs}
            onOpenNewApplicationModal={openMonitorToPick}
            onQualifyCall={handleQualifyCall}
            onPostularCall={handlePostularConvocatoria}
            onOpenAuthModal={(mode) => { setAuthModalMode(mode || 'login'); setShowAuthModal(true); }}
            initialTab={activeTab === 'convocatorias' ? 'calls' : 'programs'}
            pickMode={monitorPickMode && Boolean(currentUser)}
            freeSlots={Math.max(0, 3 - activeApplications.length)}
            onCancelPick={() => { setMonitorPickMode(false); setActiveTab('my-applications'); }}
          />
        )}

        {/* Tab 3: Mi Empresa (Perfil + Carpeta SII + Representante Legal - Requirement 1) */}
        {activeTab === 'my-company' && (
          currentUser ? (
            <MyCompanyView
              profile={profile}
              currentUser={currentUser}
              onUpdateProfile={(updated) => {
                setProfile(updated);
                saveActiveProfile(updated, currentUser?.id);
              }}
              onOpenSiiModal={() => setShowSiiModal(true)}
              onLogout={handleLogout}
            />
          ) : (
            <AuthGateView
              onOpenAuthModal={(mode) => { setAuthModalMode(mode); setShowAuthModal(true); }}
              onNavigateHome={() => setActiveTab('diagnostic')}
              title="Bóveda de Mi Empresa"
              description="Inicia sesión o registra tu empresa para gestionar el perfil, los antecedentes del SII y los datos del representante legal."
            />
          )
        )}

        {/* Legacy / Direct Route Fallback: SmartDiagnostic (Requirement 9: lazy loaded) */}
        {activeTab === 'advanced-diagnostic' && (
          <Suspense fallback={<div className="p-12 text-center text-xs text-slate-500">Cargando diagnóstico...</div>}>
            <SmartDiagnostic
              profile={profile}
              setProfile={setProfile}
              onSelectFundToFormulate={handleSelectFundToFormulate}
              onSelectFundToViewDocs={handleSelectFundToViewDocs}
            />
          </Suspense>
        )}
      </main>

      {/* Robot de Ayuda de la Plataforma (Visible en todas las pantallas con y sin sesión - Requisito 2) */}
      <HelpBot
        currentUser={currentUser}
        currentSection={activeTab}
        onNavigateTab={(tab) => {
          handleNavigateTab(tab);
        }}
        onOpenAuthModal={(mode) => {
          setAuthModalMode(mode || 'login');
          setShowAuthModal(true);
        }}
      />

      {/* New Application Modal */}
      <NewApplicationModal
        isOpen={showNewAppModal}
        onClose={() => setShowNewAppModal(false)}
        profile={profile}
        activeApplications={activeApplications}
        funds={liveFunds}
        onOpenMonitor={() => { setShowNewAppModal(false); openMonitorToPick(); }}
        onCreateApplication={async (fundId) => {
          const res = await createApplication(fundId);
          if (res.ok && res.application) {
            setActiveTab('postulation');
            setPostulationSubTab('roadmap');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
          return res;
        }}
        onOpenExistingApplication={(appId) => {
          setActiveApplicationId(appId);
          setActiveTab('postulation');
          setPostulationSubTab('roadmap');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onArchiveApplication={archiveApplication}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setAuthModalMessage('');
          clearPendingPostLoginAction();
        }}
        onAuthSuccess={handleAuthSuccess}
        initialMode={authModalMode}
        initialMessage={authModalMessage}
      />

      {/* Avisos emergentes (burbujas con sonido) */}
      <ToastCenter />

      {/* Acceso anticipado (lanzamiento sin pago en línea) */}
      <EarlyAccessModal onStart={() => { if (activeTab !== 'postulation') setActiveTab('my-applications'); }} />
      <ReturnBar
        activeTab={activeTab}
        onReturn={(ctx) => {
          setActiveTab('postulation');
          setPostulationSubTab(ctx.subTab as any);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          if (ctx.target) goToTarget(ctx.target);
        }}
      />

      {/* Aviso de inicio del servicio del plan (derecho a retracto) */}
      <ServiceStartModal onOpenTerms={() => openLegalPage('terminos')} />

      <WelcomeStartModal
        open={welcomeOpen && Boolean(currentUser)}
        suggestedFund={suggestedFund}
        onStartWithFund={(fund) => { closeWelcome(); handleSelectFundToFormulate(fund); }}
        onUploadTaxFolder={() => { closeWelcome(); setShowSiiModal(true); }}
        onBrowseFunds={() => { closeWelcome(); openMonitorToPick(); }}
        onClose={closeWelcome}
      />

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
          <nav aria-label="Información legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-medium">
            <button type="button" onClick={() => openLegalPage('terminos')} className="hover:text-slate-900 underline-offset-2 hover:underline cursor-pointer">
              Términos y Condiciones
            </button>
            <button type="button" onClick={() => openLegalPage('privacidad')} className="hover:text-slate-900 underline-offset-2 hover:underline cursor-pointer">
              Política de Privacidad
            </button>
            <a href="mailto:contacto@impulsacap.cl" className="hover:text-slate-900 underline-offset-2 hover:underline">
              contacto@impulsacap.cl
            </a>
          </nav>
        </div>
        <p className="max-w-7xl mx-auto mt-4 text-[11px] text-slate-400">
          ImpulsaCap es operado por Tresna SpA. No somos un organismo público ni representamos a CORFO, SERCOTEC u otras instituciones.
        </p>
      </footer>
    </div>
  );
}
