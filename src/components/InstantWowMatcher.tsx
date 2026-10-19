import { apiFetch } from '../utils/apiFetch';
import React, { useState, useEffect, useRef } from 'react';
import { ChileanFund, CompanyProfile, CompanyUser, TRLStage, SalesBracket, CompanyType } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { 
  Sparkles, 
  ArrowRight, 
  Calendar, 
  ShieldCheck, 
  CheckCircle2, 
  RefreshCw, 
  Flame, 
  Building2,
  FileText,
  ShieldAlert,
  User,
  Mail,
  Phone,
  Lock,
  Coins,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  RotateCcw,
  Clock,
  ChevronRight,
  Compass,
  Check
} from 'lucide-react';
import { getCurrentUser, getCleanDefaultProfile, setCurrentUser } from '../utils/storage';
import { auth, googleProvider, db } from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { syncUserProfileToFirestore, syncCompanyToFirestore } from '../utils/firebaseSync';
import { getFirebaseAuthErrorMessage } from '../utils/authErrors';
import { validateRut } from '../utils/rutValidator';

interface InstantWowMatcherProps {
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onNavigateTab: (tab: string) => void;
  setProfile: React.Dispatch<React.SetStateAction<CompanyProfile>>;
  currentUser?: CompanyUser | null;
  onAuthSuccess?: (user: CompanyUser) => void;
}

// 5 Situation Shortcuts
const QUICK_QUESTION_OPTIONS = [
  {
    icon: '🚀',
    title: 'Startup Tecnológica o Innovación',
    subtitle: 'Sin ventas o ventas < $60M (validar prototipo o MVP)',
    stage: 'Prototipo' as const,
    sales: 'Sin ventas' as const,
    constitution: 'SpA, EIRL, SRL o S.A.' as const,
    female: 'No' as const,
    summary: 'Somos una startup tecnológica innovadora de software/IA recién creada como SpA, sin ventas previas, buscando validar producto y primeras ventas.',
    targetFundId: 'corfo_semilla_inicia'
  },
  {
    icon: '📈',
    title: 'Primeras Ventas ($1M - $60M)',
    subtitle: 'Clientes pagando y queremos acelerar a nivel nacional',
    stage: 'Ya vendo' as const,
    sales: 'Menos de $60M' as const,
    constitution: 'SpA, EIRL, SRL o S.A.' as const,
    female: 'No' as const,
    summary: 'Empresa constituida con ventas demostradas de $15 millones en los últimos 12 meses, buscando escalar comercialmente en Chile y el extranjero.',
    targetFundId: 'corfo_semilla_expande'
  },
  {
    icon: '🏢',
    title: 'Pyme con Ventas (> 200 UF)',
    subtitle: 'Empresa formalizada que necesita modernizar maquinaria o digitalizarse',
    stage: 'Ya vendo' as const,
    sales: '$60M a $1.000M' as const,
    constitution: 'SpA, EIRL, SRL o S.A.' as const,
    female: 'No' as const,
    summary: 'Pyme formalizada en primera categoría con facturación de 2.500 UF anuales, buscando inversión en nueva maquinaria y desarrollo comercial.',
    targetFundId: 'sercotec_crece'
  },
  {
    icon: '👩‍💼',
    title: 'Mujer Emprendedora desde Cero',
    subtitle: 'Sin inicio de actividades en 1ª categoría ante SII (primer fondo)',
    stage: 'Idea' as const,
    sales: 'Sin ventas' as const,
    constitution: 'Persona natural sin inicio de actividades' as const,
    female: 'Sí' as const,
    summary: 'Mujer emprendedora sin inicio de actividades ante el SII que busca formalizar un taller productivo con subsidio no reembolsable.',
    targetFundId: 'sercotec_abeja_emprende'
  },
  {
    icon: '🔬',
    title: 'Proyecto de I+D o Base Científica',
    subtitle: 'Desarrollo de biotecnología, ingeniería o minería con universidades',
    stage: 'Prototipo' as const,
    sales: 'Sin ventas' as const,
    constitution: 'SpA, EIRL, SRL o S.A.' as const,
    female: 'No' as const,
    summary: 'Empresa que busca desarrollar un prototipo tecnológico de I+D con alto desafío técnico e incertidumbre experimental.',
    targetFundId: 'corfo_crea_valida'
  }
];

export const InstantWowMatcher: React.FC<InstantWowMatcherProps> = ({
  onSelectFundToFormulate,
  onNavigateTab,
  setProfile,
  currentUser: propUser,
  onAuthSuccess
}) => {
  // Step in guided onboarding: 1 to 5
  const [onboardingStep, setOnboardingStep] = useState<number>(1);

  // Questionnaire responses
  const [stage, setStage] = useState<'Idea' | 'Prototipo' | 'Ya vendo' | ''>('');
  const [sales, setSales] = useState<'Sin ventas' | 'Menos de $60M' | '$60M a $1.000M' | 'Más' | ''>('');
  const [constitution, setConstitution] = useState<'Persona natural sin inicio de actividades' | 'Persona natural con inicio' | 'SpA, EIRL, SRL o S.A.' | ''>('');
  const [isFemale, setIsFemale] = useState<'Sí' | 'No' | ''>('');
  const [projectSummary, setProjectSummary] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [matchResult, setMatchResult] = useState<any | null>(null);
  const [isEstimatedWithoutAi, setIsEstimatedWithoutAi] = useState<boolean>(false);

  // Active authenticated user
  const [activeUser, setActiveUser] = useState<CompanyUser | null>(propUser || getCurrentUser());

  // Registration & Login Form State (shown when guest wants to create roadmap)
  const [selectedFundForRoadmap, setSelectedFundForRoadmap] = useState<ChileanFund | null>(null);
  const [showAuthSection, setShowAuthSection] = useState(false);
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Form fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRut, setRegRut] = useState('');

  const resultsRef = useRef<HTMLDivElement>(null);
  const authSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propUser) {
      setActiveUser(propUser);
    } else {
      setActiveUser(getCurrentUser());
    }
  }, [propUser]);

  useEffect(() => {
    const handleAuthChange = (e: any) => {
      setActiveUser(e.detail || getCurrentUser());
    };
    window.addEventListener('inki_auth_changed', handleAuthChange);
    return () => window.removeEventListener('inki_auth_changed', handleAuthChange);
  }, []);

  // Map answers to CompanyProfile fields
  const buildProfileFromAnswers = (
    ansStage = stage,
    ansSales = sales,
    ansConst = constitution,
    ansFemale = isFemale,
    ansSummary = projectSummary
  ): Partial<CompanyProfile> => {
    let trlStage: TRLStage = 'idea_concepto';
    if (ansStage === 'Prototipo') trlStage = 'mvp_validado';
    else if (ansStage === 'Ya vendo') trlStage = 'primeras_ventas';

    let salesBracket: SalesBracket = 'sin_ventas';
    if (ansSales === 'Menos de $60M') salesBracket = 'menor_60m';
    else if (ansSales === '$60M a $1.000M') salesBracket = 'pequena_2400_a_25000uf';
    else if (ansSales === 'Más') salesBracket = 'mediana_25000_a_100000uf';

    let companyType: CompanyType = 'sin_iniciar';
    if (ansConst === 'Persona natural con inicio') companyType = 'persona_natural';
    else if (ansConst === 'SpA, EIRL, SRL o S.A.') companyType = 'spa';

    const isFemaleLed = ansFemale === 'Sí';
    const femaleEquityPct = isFemaleLed ? 100 : 0;

    return {
      trlStage,
      salesBracket,
      companyType,
      isFemaleLed,
      femaleEquityPct,
      projectSummary: ansSummary.trim()
    };
  };

  // Execute matching with answers
  const executeMatch = async (
    ansStage = stage,
    ansSales = sales,
    ansConst = constitution,
    ansFemale = isFemale,
    ansSummary = projectSummary,
    targetFundHint?: string
  ) => {
    const built = buildProfileFromAnswers(ansStage, ansSales, ansConst, ansFemale, ansSummary);

    // Update parent profile state
    setProfile(prev => ({
      ...prev,
      ...built,
      projectSummary: built.projectSummary || prev.projectSummary
    }));

    setLoading(true);
    setMatchResult(null);
    setIsEstimatedWithoutAi(false);
    setShowAuthSection(false);

    setScanStep('Analizando etapa del proyecto y topes de ventas ante SII...');
    await new Promise(r => setTimeout(r, 350));
    setScanStep('Evaluando admisibilidad en bases vigentes CORFO, SERCOTEC y Start-Up Chile...');
    await new Promise(r => setTimeout(r, 350));
    setScanStep('Calculando subsidio máximo y fechas oficiales de postulación...');

    const promptText = `Etapa: ${ansStage}. Ventas 12 meses: ${ansSales}. Constitución jurídica: ${ansConst}. Liderazgo femenino: ${ansFemale}. Resumen del proyecto: ${ansSummary || 'Emprendimiento de innovación en Chile'}`;

    try {
      const response = await apiFetch('/api/gemini/instant-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: promptText,
          targetFundHint,
          availableFunds: CHILEAN_FUNDS.map(f => ({
            id: f.id,
            name: f.name,
            agency: f.agency,
            maxSubsidyCLP: f.maxSubsidyCLP,
            subsidyFormatted: f.subsidyFormatted,
            maxCoFinancePct: f.maxCoFinancePct,
            femaleBonusPct: f.femaleBonusPct,
            salesRequirement: f.salesRequirement,
            status: f.status,
            callSchedule: f.callSchedule,
            callStatus: f.callStatus,
            closeDate: f.closeDate
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Servicio de IA temporalmente no disponible');
      }

      const data = await response.json();
      setMatchResult(data);
      setIsEstimatedWithoutAi(false);
    } catch (err) {
      console.warn('Using deterministic matching fallback with official CHILEAN_FUNDS:', err);
      setIsEstimatedWithoutAi(true);

      // Deterministic fallback using actual CHILEAN_FUNDS
      let matchedFund = CHILEAN_FUNDS[0]; // Semilla Inicia
      if (targetFundHint) {
        const found = CHILEAN_FUNDS.find(f => f.id === targetFundHint);
        if (found) matchedFund = found;
      } else if (ansFemale === 'Sí' && ansConst === 'Persona natural sin inicio de actividades') {
        matchedFund = CHILEAN_FUNDS.find(f => f.id === 'sercotec_abeja_emprende') || matchedFund;
      } else if (ansSales === 'Menos de $60M' && ansStage === 'Ya vendo') {
        matchedFund = CHILEAN_FUNDS.find(f => f.id === 'corfo_semilla_expande') || matchedFund;
      } else if (ansSales === '$60M a $1.000M' || ansSales === 'Más') {
        matchedFund = CHILEAN_FUNDS.find(f => f.id === 'sercotec_crece') || matchedFund;
      } else if (ansStage === 'Prototipo' && ansSales === 'Sin ventas') {
        matchedFund = CHILEAN_FUNDS.find(f => f.id === 'corfo_semilla_inicia') || matchedFund;
      }

      const isFem = ansFemale === 'Sí';
      const secondary = CHILEAN_FUNDS.filter(f => f.id !== matchedFund.id).slice(0, 2);

      setMatchResult({
        wowHeadline: `¡Calificas directamente para ${matchedFund.name}!`,
        primaryFund: {
          fundId: matchedFund.id,
          fundName: matchedFund.name,
          agency: matchedFund.agency,
          subsidyFormatted: matchedFund.subsidyFormatted,
          maxSubsidyCLP: matchedFund.maxSubsidyCLP,
          coFinancePct: matchedFund.maxCoFinancePct,
          whenToApply: matchedFund.callSchedule || 'Próxima convocatoria por confirmar',
          status: matchedFund.status,
          matchScore: 95,
          whyYouQualify: `Tu perfil cumple con las bases oficiales de ${matchedFund.agency}: nivel de ventas (${ansSales}) y etapa (${ansStage}) plenamente admisibles.`,
          reasons: [
            `Etapa compatible: ${ansStage} se ajusta exactamente al rango de madurez exigido.`,
            `Ventas admisibles: ${ansSales} cumple el tope máximo de bases de ${matchedFund.agency}.`,
            isFem ? 'Califica a bonificación adicional por liderazgo femenino del 10% en evaluación.' : `Financia hasta el ${matchedFund.maxCoFinancePct}% con subsidio estatal no reembolsable.`
          ],
          femaleBonusEligible: isFem,
          femaleBonusText: isFem && matchedFund.femaleBonusPct ? `+${matchedFund.femaleBonusPct}% adicional por liderazgo femenino` : undefined
        },
        secondaryFunds: secondary.map(f => ({
          fundId: f.id,
          fundName: f.name,
          agency: f.agency,
          subsidyFormatted: f.subsidyFormatted,
          coFinancePct: f.maxCoFinancePct,
          whenToApply: f.callSchedule || 'Próxima convocatoria por confirmar',
          status: f.status,
          matchScore: 84,
          reasons: [
            `Alternativa compatible para proyectos en etapa ${ansStage}.`,
            `Monto de hasta ${f.subsidyFormatted} con ${f.maxCoFinancePct}% de subsidio estatal.`
          ]
        }))
      });
    } finally {
      setLoading(false);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  // Handle shortcut selection
  const handleSelectShortcut = (opt: typeof QUICK_QUESTION_OPTIONS[0]) => {
    setStage(opt.stage);
    setSales(opt.sales);
    setConstitution(opt.constitution);
    setIsFemale(opt.female);
    setProjectSummary(opt.summary);
    setOnboardingStep(5);
    executeMatch(opt.stage, opt.sales, opt.constitution, opt.female, opt.summary, opt.targetFundId);
  };

  // Main Action: "Crear mi hoja de ruta para este fondo"
  const handleCreateRoadmap = (fundId: string) => {
    const target = CHILEAN_FUNDS.find(f => f.id === fundId) || CHILEAN_FUNDS[0];
    setSelectedFundForRoadmap(target);

    // If user is already authenticated, go directly to Hoja de Ruta!
    if (activeUser) {
      onSelectFundToFormulate(target);
      onNavigateTab('my-application');
      return;
    }

    // Guest user: show registration/login card directly below results
    setShowAuthSection(true);
    setTimeout(() => {
      authSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  // Auth Submit Handlers
  const handleRegisterCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const cleanEmail = regEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setAuthError('Ingresa un correo electrónico.');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const cleanRut = regRut?.trim() || '';
    if (cleanRut && !validateRut(cleanRut)) {
      setAuthError('El RUT ingresado no es válido. Verifica el dígito verificador.');
      return;
    }

    setIsSubmittingAuth(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, regPassword);
      const fbUser = cred.user;
      const cleanCompanyName = regName?.trim() || 'Mi Empresa SpA';
      const cleanPhone = regPhone?.trim() || '';

      const companyUser: CompanyUser = {
        id: fbUser.uid,
        email: fbUser.email || cleanEmail,
        companyName: cleanCompanyName,
        rut: cleanRut,
        phone: cleanPhone,
        representativeName: '',
        createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      const built = buildProfileFromAnswers();

      await syncUserProfileToFirestore(companyUser);
      await syncCompanyToFirestore({
        companyName: cleanCompanyName,
        rut: cleanRut,
        companyType: (built.companyType as CompanyType) || 'spa',
        monthsActive: 6,
        salesBracket: (built.salesBracket as SalesBracket) || 'menor_60m',
        annualSalesCLP: 0,
        sector: 'Tecnología, Innovación y Servicios',
        region: 'Región Metropolitana',
        isFemaleLed: built.isFemaleLed || false,
        femaleEquityPct: built.femaleEquityPct || 0,
        trlStage: (built.trlStage as TRLStage) || 'mvp_validado',
        innovationLevel: 'incremental',
        projectSummary: built.projectSummary || `Proyecto de ${cleanCompanyName}.`,
        coreTech: 'Tecnología e innovación aplicada.',
        customerValidationCount: 0
      }, fbUser.uid);

      setCurrentUser(companyUser);
      setActiveUser(companyUser);
      setAuthSuccess(`¡Empresa ${cleanCompanyName} registrada! Creando tu Hoja de Ruta...`);

      const cleanProf = getCleanDefaultProfile(companyUser);
      const mergedProf = { ...cleanProf, ...built };
      setProfile(mergedProf);
      onAuthSuccess?.(companyUser);

      const target = selectedFundForRoadmap || (matchResult?.primaryFund ? CHILEAN_FUNDS.find(f => f.id === matchResult.primaryFund.fundId) : null) || CHILEAN_FUNDS[0];
      onSelectFundToFormulate(target);

      setTimeout(() => {
        onNavigateTab('my-application');
      }, 700);
    } catch (err: any) {
      setAuthError(getFirebaseAuthErrorMessage(err));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLoginCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setIsSubmittingAuth(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, regEmail.trim().toLowerCase(), regPassword);
      const fbUser = cred.user;
      let companyName = fbUser.displayName ? `${fbUser.displayName} SpA` : 'Mi Empresa SpA';
      let rut = '';
      let repName = fbUser.displayName || '';
      let phone = '';

      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          if (uData.companyName) companyName = uData.companyName;
          if (uData.companyRut) rut = uData.companyRut;
          if (uData.displayName) repName = uData.displayName;
          if (uData.phone) phone = uData.phone;
        }
      } catch (err) {
        console.warn('Could not read user profile doc on login:', err);
      }

      const companyUser: CompanyUser = {
        id: fbUser.uid,
        email: fbUser.email || regEmail.trim().toLowerCase(),
        companyName,
        rut,
        representativeName: repName,
        phone,
        createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      setCurrentUser(companyUser);
      setActiveUser(companyUser);
      setAuthSuccess(`¡Bienvenido, ${companyUser.companyName}! Redirigiendo a tu Hoja de Ruta...`);

      const cleanProf = getCleanDefaultProfile(companyUser);
      const built = buildProfileFromAnswers();
      const mergedProf = { ...cleanProf, ...built };
      setProfile(mergedProf);
      onAuthSuccess?.(companyUser);

      const target = selectedFundForRoadmap || (matchResult?.primaryFund ? CHILEAN_FUNDS.find(f => f.id === matchResult.primaryFund.fundId) : null) || CHILEAN_FUNDS[0];
      onSelectFundToFormulate(target);

      setTimeout(() => {
        onNavigateTab('my-application');
      }, 700);
    } catch (err: any) {
      setAuthError(getFirebaseAuthErrorMessage(err));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleGoogleSignInMatcher = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    setIsSubmittingAuth(true);

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const fbUser = cred.user;
      let companyName = fbUser.displayName ? `${fbUser.displayName} SpA` : 'Mi Empresa SpA';
      let rut = '';
      let repName = fbUser.displayName || '';
      let phone = '';

      try {
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (userDoc.exists()) {
          const uData = userDoc.data();
          if (uData.companyName) companyName = uData.companyName;
          if (uData.companyRut) rut = uData.companyRut;
          if (uData.displayName) repName = uData.displayName;
          if (uData.phone) phone = uData.phone;
        }
      } catch (err) {}

      const companyUser: CompanyUser = {
        id: fbUser.uid,
        email: fbUser.email || '',
        companyName,
        rut,
        representativeName: repName,
        phone,
        createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      const built = buildProfileFromAnswers();

      await syncUserProfileToFirestore(companyUser);
      await syncCompanyToFirestore({
        companyName,
        rut,
        companyType: (built.companyType as CompanyType) || 'spa',
        monthsActive: 6,
        salesBracket: (built.salesBracket as SalesBracket) || 'menor_60m',
        annualSalesCLP: 0,
        sector: 'Tecnología, Innovación y Servicios',
        region: 'Región Metropolitana',
        isFemaleLed: built.isFemaleLed || false,
        femaleEquityPct: built.femaleEquityPct || 0,
        trlStage: (built.trlStage as TRLStage) || 'mvp_validado',
        innovationLevel: 'incremental',
        projectSummary: built.projectSummary || `Proyecto de innovación de ${companyName}.`,
        coreTech: 'Tecnología digital y desarrollo de soluciones.',
        customerValidationCount: 0
      }, fbUser.uid);

      setCurrentUser(companyUser);
      setActiveUser(companyUser);
      setAuthSuccess(`¡Autenticado con Google! Abriendo tu Hoja de Ruta...`);

      const cleanProf = getCleanDefaultProfile(companyUser);
      const mergedProf = { ...cleanProf, ...built };
      setProfile(mergedProf);
      onAuthSuccess?.(companyUser);

      const target = selectedFundForRoadmap || (matchResult?.primaryFund ? CHILEAN_FUNDS.find(f => f.id === matchResult.primaryFund.fundId) : null) || CHILEAN_FUNDS[0];
      onSelectFundToFormulate(target);

      setTimeout(() => {
        onNavigateTab('my-application');
      }, 700);
    } catch (err: any) {
      setAuthError(getFirebaseAuthErrorMessage(err));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleForgotPassword = async () => {
    const emailToReset = regEmail.trim().toLowerCase();
    if (!emailToReset) {
      setAuthError('Ingresa tu correo electrónico para enviarte el enlace de recuperación.');
      return;
    }
    setAuthError(null);
    setAuthSuccess(null);
    setIsResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, emailToReset);
      setAuthSuccess('Se ha enviado un correo con instrucciones para restablecer tu contraseña. Revisa tu bandeja.');
    } catch (err: any) {
      setAuthError(getFirebaseAuthErrorMessage(err));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleReset = () => {
    setMatchResult(null);
    setOnboardingStep(1);
    setStage('');
    setSales('');
    setConstitution('');
    setIsFemale('');
    setProjectSummary('');
    setShowAuthSection(false);
    setAuthError(null);
    setAuthSuccess(null);
  };

  const progressPct = (onboardingStep / 5) * 100;

  return (
    <div className="space-y-6">
      {/* ImpulsaCap Hero & Guided Onboarding Container */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-blue-50/80 via-white to-emerald-50/40 border border-blue-100 p-5 sm:p-9 shadow-sm">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          {/* Header Tag */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold shadow-xs">
              <span className="text-emerald-600 font-black">✦</span>
              <span>ImpulsaCap • Diagnóstico Asistido y Calce Rápido 2026</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Descubre a qué fondos concursables califica tu empresa
            </h1>
            <p className="text-slate-600 text-xs sm:text-sm max-w-xl mx-auto">
              Responde 5 breves preguntas paso a paso para que nuestra IA analice las bases oficiales de CORFO, SERCOTEC y Start-Up Chile.
            </p>
          </div>

          {/* 1. ONBOARDING GUIADO (ONE QUESTION PER SCREEN + PROGRESS BAR + BACK BUTTON) */}
          {!matchResult && !loading && (
            <div className="max-w-2xl mx-auto bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-md">
              {/* Progress Bar & Header Navigation */}
              <div className="mb-6 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <div className="flex items-center gap-2">
                    {onboardingStep > 1 && (
                      <button
                        onClick={() => setOnboardingStep(prev => prev - 1)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors cursor-pointer py-0.5 px-1.5 rounded-lg hover:bg-blue-50"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Atrás</span>
                      </button>
                    )}
                    <span className="text-slate-400 uppercase tracking-wider text-[11px]">
                      Pregunta {onboardingStep} de 5
                    </span>
                  </div>
                  <span className="text-blue-600 font-extrabold text-[11px]">
                    {progressPct}% Completado
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* QUESTION a: ¿En qué etapa está tu proyecto? */}
              {onboardingStep === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Paso 1</span>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">
                      ¿En qué etapa está tu proyecto?
                    </h2>
                    <p className="text-xs text-slate-500">
                      Selecciona la opción que mejor represente el avance actual de tu producto o servicio.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    {[
                      {
                        val: 'Idea' as const,
                        title: 'Idea',
                        desc: 'Tengo un concepto o diseño inicial sin prototipo probado aún.'
                      },
                      {
                        val: 'Prototipo' as const,
                        title: 'Prototipo',
                        desc: 'Cuento con un MVP funcional o prototipo validado técnicamente.'
                      },
                      {
                        val: 'Ya vendo' as const,
                        title: 'Ya vendo',
                        desc: 'Tengo clientes pagando y facturación comercial demostrable.'
                      }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setStage(opt.val);
                          setOnboardingStep(2);
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer group active:scale-95 ${
                          stage === opt.val
                            ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/30'
                            : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-black text-sm text-slate-900 group-hover:text-blue-700">
                            {opt.title}
                          </span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                            stage === opt.val ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {stage === opt.val && '✓'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* QUESTION b: ¿Cuánto vendiste en los últimos 12 meses? */}
              {onboardingStep === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Paso 2</span>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">
                      ¿Cuánto vendiste en los últimos 12 meses?
                    </h2>
                    <p className="text-xs text-slate-500">
                      Los fondos concursables de Corfo y Sercotec exigen rangos de ventas específicos en F29.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {[
                      {
                        val: 'Sin ventas' as const,
                        title: 'Sin ventas',
                        desc: 'No cuento con facturación en 1ª categoría ante el SII.'
                      },
                      {
                        val: 'Menos de $60M' as const,
                        title: 'Menos de $60M',
                        desc: 'Facturación anual demostrable hasta 60 millones de pesos.'
                      },
                      {
                        val: '$60M a $1.000M' as const,
                        title: '$60M a $1.000M',
                        desc: 'Ventas de pyme formalizada entre 60 y 1.000 millones.'
                      },
                      {
                        val: 'Más' as const,
                        title: 'Más de $1.000M',
                        desc: 'Facturación empresarial superior a 1.000 millones de pesos.'
                      }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setSales(opt.val);
                          setOnboardingStep(3);
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer group active:scale-95 ${
                          sales === opt.val
                            ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/30'
                            : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-sm text-slate-900 group-hover:text-blue-700">
                            {opt.title}
                          </span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                            sales === opt.val ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {sales === opt.val && '✓'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* QUESTION c: ¿Cómo está constituida tu empresa? */}
              {onboardingStep === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Paso 3</span>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">
                      ¿Cómo está constituida tu empresa?
                    </h2>
                    <p className="text-xs text-slate-500">
                      El tipo societario determina si postulas como persona natural o como persona jurídica.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 pt-2">
                    {[
                      {
                        val: 'Persona natural sin inicio de actividades' as const,
                        title: 'Persona natural sin inicio de actividades',
                        desc: 'Aún no formalizo la empresa ante el Servicio de Impuestos Internos.'
                      },
                      {
                        val: 'Persona natural con inicio' as const,
                        title: 'Persona natural con inicio de actividades',
                        desc: 'Tengo inicio de actividades con mi propio RUT en primera categoría.'
                      },
                      {
                        val: 'SpA, EIRL, SRL o S.A.' as const,
                        title: 'SpA, EIRL, SRL o S.A. (Persona Jurídica)',
                        desc: 'Empresa constituida con RUT propio ante el Registro de Empresas y Sociedades.'
                      }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setConstitution(opt.val);
                          setOnboardingStep(4);
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer group active:scale-95 ${
                          constitution === opt.val
                            ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/30'
                            : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-sm text-slate-900 group-hover:text-blue-700">
                            {opt.title}
                          </span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                            constitution === opt.val ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {constitution === opt.val && '✓'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* QUESTION d: ¿La empresa está liderada por mujeres? */}
              {onboardingStep === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Paso 4</span>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">
                      ¿La empresa está liderada por mujeres?
                    </h2>
                    <p className="text-xs text-slate-500">
                      Corfo y Sercotec otorgan bonificación especial de +10% en notas y fondos exclusivos (como Abeja Emprende).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    {[
                      {
                        val: 'Sí' as const,
                        title: 'Sí, liderada por mujeres',
                        desc: 'Una o más mujeres poseen al menos el 50% de las acciones o dirigen la empresa.'
                      },
                      {
                        val: 'No' as const,
                        title: 'No',
                        desc: 'La empresa está liderada por hombres o no alcanza el 50% de participación femenina.'
                      }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => {
                          setIsFemale(opt.val);
                          setOnboardingStep(5);
                        }}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer group active:scale-95 ${
                          isFemale === opt.val
                            ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/30'
                            : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-sm text-slate-900 group-hover:text-blue-700">
                            {opt.title}
                          </span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                            isFemale === opt.val ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                          }`}>
                            {isFemale === opt.val && '✓'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {opt.desc}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* QUESTION e: En una o dos frases: ¿qué hace tu proyecto y qué problema resuelve? */}
              {onboardingStep === 5 && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Paso 5 de 5</span>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900">
                      En una o dos frases: ¿qué hace tu proyecto y qué problema resuelve?
                    </h2>
                    <p className="text-xs text-slate-500">
                      Describe brevemente tu solución. Esto nos ayuda a identificar si calza en Innovación, Sostenibilidad, Pyme o I+D.
                    </p>
                  </div>

                  <div className="space-y-3 pt-1">
                    <textarea
                      rows={3}
                      value={projectSummary}
                      onChange={e => setProjectSummary(e.target.value)}
                      placeholder="Ej: Desarrollamos un software con IA para automatizar la gestión de inventario en restaurantes de Chile, reduciendo mermas de comida en un 30%..."
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-blue-600 focus:bg-white text-slate-900 text-sm focus:outline-hidden transition-all"
                    />

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      <span className="text-[11px] text-slate-400">
                        {projectSummary.trim().length > 0 ? `${projectSummary.length} caracteres` : 'Puedes escribir 1 o 2 líneas sencillas'}
                      </span>
                      <button
                        onClick={() => executeMatch()}
                        disabled={loading || !projectSummary.trim()}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-extrabold text-sm shadow-md shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        <span>Descubrir Fondos al Instante</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SHORTCUT CARDS (5 situaciones como atajo rápido) */}
          {!matchResult && !loading && (
            <div className="pt-2 animate-fade-in max-w-3xl mx-auto">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-extrabold mb-2.5 text-center">
                O elige tu situación en 1 clic como atajo:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-left">
                {QUICK_QUESTION_OPTIONS.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectShortcut(opt)}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 hover:shadow-sm transition-all group cursor-pointer active:scale-95 text-left"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl shrink-0 p-1.5 rounded-xl bg-blue-50 border border-blue-100 group-hover:scale-110 transition-transform">
                        {opt.icon}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 leading-snug">
                          {opt.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {opt.subtitle}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LOADING RADAR */}
          {loading && (
            <div className="p-8 rounded-3xl bg-white border border-blue-200 text-center space-y-3 shadow-md max-w-xl mx-auto animate-pulse">
              <div className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-600 flex items-center justify-center mx-auto text-blue-600 animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{scanStep}</h3>
              <p className="text-xs text-slate-500">
                Comparando contra bases vigentes de CORFO, SERCOTEC y Start-Up Chile...
              </p>
            </div>
          )}

          {/* 2. RESULTADO: FONDO RECOMENDADO Y HASTA 2 ALTERNATIVAS */}
          {matchResult && !loading && (
            <div ref={resultsRef} className="space-y-6 animate-fade-in">
              {/* Reset / Edit Search Button */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-blue-500 text-xs text-blue-700 hover:text-blue-800 transition-all font-semibold cursor-pointer active:scale-95 shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Volver a responder preguntas o cambiar respuestas</span>
                </button>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Resultados calculados con tus respuestas
                </span>
              </div>

              {/* PRIMARY RECOMMENDED FUND */}
              {matchResult.primaryFund && (
                <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 border-emerald-500 shadow-xl space-y-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-[11px] font-black uppercase tracking-wider px-4 py-1 rounded-bl-2xl shadow-xs">
                    ★ Fondo Recomendado Principal
                  </div>

                  {/* Header info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black uppercase">
                        {matchResult.primaryFund.agency}
                      </span>
                      <span className="text-xs font-bold text-emerald-700">
                        {matchResult.primaryFund.matchScore}% de Calce
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-3xl font-black text-slate-900 leading-tight">
                      {matchResult.primaryFund.fundName}
                    </h2>
                  </div>

                  {/* Key Metrics Grid: Monto, Cofinanciamiento, Estado Convocatoria */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                        Monto Máximo Subsidio
                      </span>
                      <span className="text-xl font-black text-emerald-900 mt-0.5 block">
                        {matchResult.primaryFund.subsidyFormatted}
                      </span>
                      <span className="text-[10px] text-emerald-700">Subsidio 100% no reembolsable</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200">
                      <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                        % Co-financiamiento
                      </span>
                      <span className="text-xl font-black text-blue-900 mt-0.5 block">
                        Hasta {matchResult.primaryFund.coFinancePct}%
                      </span>
                      <span className="text-[10px] text-blue-700">
                        {matchResult.primaryFund.femaleBonusEligible ? '+10% bonificación mujer' : 'Aporte del Estado'}
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                        Estado de Convocatoria
                      </span>
                      <span className="text-sm font-bold text-slate-900 mt-1 block">
                        {matchResult.primaryFund.whenToApply || matchResult.primaryFund.status || 'Convocatoria Oficial 2026'}
                      </span>
                      <span className="text-[10px] text-slate-500">Datos oficiales de bases</span>
                    </div>
                  </div>

                  {/* 2 o 3 Razones concretas de por qué califica según sus respuestas */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2.5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                      ¿Por qué califica tu proyecto según tus respuestas?
                    </h4>
                    <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                      {(matchResult.primaryFund.reasons || [
                        `Tu etapa de desarrollo (${stage || 'declarada'}) cumple el nivel de madurez técnica exigido por ${matchResult.primaryFund.agency}.`,
                        `El nivel de facturación (${sales || 'declarado'}) se encuentra dentro del tope máximo permitido por las bases.`,
                        matchResult.primaryFund.femaleBonusEligible
                          ? 'Acreditación de liderazgo femenino activa la bonificación especial de evaluación.'
                          : `Cumple los requisitos jurídicos para postulantes tipo ${constitution || 'formalizados'}.`
                      ]).map((reason: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* UN SOLO BOTÓN PRINCIPAL */}
                  <div>
                    <button
                      onClick={() => handleCreateRoadmap(matchResult.primaryFund.fundId)}
                      className="w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm sm:text-base shadow-lg shadow-emerald-600/30 active:scale-98 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-5 h-5 text-emerald-200" />
                      <span>Crear mi hoja de ruta para este fondo</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                    {!activeUser && (
                      <p className="text-[11px] text-center text-slate-500 mt-2">
                        Te llevará al registro rápido de tu empresa para guardar tu expediente y continuar directo a la Hoja de Ruta.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* SECONDARY ALTERNATIVES (HASTA 2 ALTERNATIVAS) */}
              {matchResult.secondaryFunds && matchResult.secondaryFunds.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 px-1">
                    Fondos Alternativos Compatibles ({matchResult.secondaryFunds.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matchResult.secondaryFunds.slice(0, 2).map((alt: any) => (
                      <div
                        key={alt.fundId}
                        className="p-5 rounded-3xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase">
                              {alt.agency}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">
                              {alt.matchScore ? `${alt.matchScore}% Compatibilidad` : 'Alternativa'}
                            </span>
                          </div>
                          <h4 className="text-base font-bold text-slate-900">
                            {alt.fundName}
                          </h4>

                          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            <div className="p-2.5 rounded-xl bg-slate-50">
                              <span className="text-[10px] text-slate-500 block">Subsidio:</span>
                              <span className="font-extrabold text-slate-900">{alt.subsidyFormatted}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50">
                              <span className="text-[10px] text-slate-500 block">Cofinanciamiento:</span>
                              <span className="font-extrabold text-slate-900">Hasta {alt.coFinancePct || 75}%</span>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 text-xs">
                            <span className="text-[10px] text-slate-500 block">Convocatoria:</span>
                            <span className="font-semibold text-slate-800">
                              {alt.whenToApply || alt.status || 'Convocatoria 2026'}
                            </span>
                          </div>

                          {/* Razones de compatibilidad */}
                          {alt.reasons && (
                            <ul className="text-xs text-slate-600 space-y-1 pt-1">
                              {alt.reasons.map((r: string, rIdx: number) => (
                                <li key={rIdx} className="flex items-start gap-1.5">
                                  <span className="text-blue-500 font-bold">•</span>
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <button
                          onClick={() => handleCreateRoadmap(alt.fundId)}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          <span>Crear mi hoja de ruta para este fondo</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AUTHENTICATION SECTION (FOR GUEST USERS CLICKING CREAR HOJA DE RUTA) */}
              {showAuthSection && !activeUser && (
                <div
                  ref={authSectionRef}
                  className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white to-blue-50/40 border-2 border-blue-500 shadow-xl max-w-lg mx-auto space-y-5 animate-fade-in"
                >
                  <div className="text-center space-y-1">
                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black uppercase tracking-wider">
                      Paso Final: Registro Rápido
                    </span>
                    <h3 className="text-xl font-black text-slate-900">
                      Protege tu Expediente e Inicia tu Hoja de Ruta
                    </h3>
                    <p className="text-xs text-slate-600">
                      {selectedFundForRoadmap?.name ? `Para preparar la postulación a ${selectedFundForRoadmap.name}` : 'Tus antecedentes y formulación quedarán resguardados de forma privada.'}
                    </p>
                  </div>

                  {/* Auth Tabs: Registro vs Iniciar Sesión */}
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => { setAuthTab('register'); setAuthError(null); setAuthSuccess(null); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        authTab === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Registrar Empresa
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthTab('login'); setAuthError(null); setAuthSuccess(null); }}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        authTab === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Ya tengo cuenta
                    </button>
                  </div>

                  {/* Google Auth Button */}
                  <button
                    type="button"
                    onClick={handleGoogleSignInMatcher}
                    disabled={isSubmittingAuth}
                    className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Continuar con Google</span>
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="grow border-t border-slate-200"></div>
                    <span className="shrink mx-3 text-[11px] font-bold text-slate-400 uppercase">o con email</span>
                    <div className="grow border-t border-slate-200"></div>
                  </div>

                  {/* Form */}
                  <form onSubmit={authTab === 'register' ? handleRegisterCompany : handleLoginCompany} className="space-y-3">
                    {authTab === 'register' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Nombre o Razón Social de la Empresa
                        </label>
                        <input
                          type="text"
                          required
                          value={regName}
                          onChange={e => setRegName(e.target.value)}
                          placeholder="Ej: AgroTech SpA o Mi Proyecto"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:border-blue-600 focus:outline-hidden"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={e => setRegEmail(e.target.value)}
                        placeholder="contacto@tuempresa.cl"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:border-blue-600 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Contraseña
                        </label>
                        {authTab === 'login' && (
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={isResettingPassword}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                          >
                            ¿Olvidaste tu contraseña?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={regPassword}
                          onChange={e => setRegPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-xs focus:border-blue-600 focus:outline-hidden pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {authError && (
                      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    {authSuccess && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{authSuccess}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingAuth}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmittingAuth ? 'Procesando...' : (authTab === 'register' ? 'Crear Cuenta y Abrir Hoja de Ruta' : 'Iniciar Sesión y Abrir Hoja de Ruta')}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
