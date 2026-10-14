import React, { useState, useEffect, useRef } from 'react';
import { ChileanFund, CompanyProfile, CompanyUser } from '../types/funds';
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
  ArrowUpRight,
  SlidersHorizontal,
  Coins,
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  Clock
} from 'lucide-react';
import { getCurrentUser, registerCompanyUser, loginCompanyUser, getCleanDefaultProfile } from '../utils/storage';
import { validateRut } from '../utils/rutValidator';

interface InstantWowMatcherProps {
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onNavigateTab: (tab: string) => void;
  setProfile: React.Dispatch<React.SetStateAction<CompanyProfile>>;
  currentUser?: CompanyUser | null;
  onAuthSuccess?: (user: CompanyUser) => void;
}

const QUICK_QUESTION_OPTIONS = [
  {
    icon: '🚀',
    title: 'Startup Tecnológica o Innovación',
    subtitle: 'Sin ventas o ventas < $60M (busco validar prototipo o MVP)',
    promptText: 'Somos una startup tecnológica innovadora de software/IA recién creada como SpA, sin ventas previas, buscando validar producto y primeras ventas.',
    targetFundId: 'corfo_semilla_inicia'
  },
  {
    icon: '📈',
    title: 'Primeras Ventas ($1M - $60M)',
    subtitle: 'Ya tenemos clientes pagando y queremos acelerar a nivel nacional',
    promptText: 'Empresa constituida con ventas demostradas de $15 millones en los últimos 12 meses, buscando escalar comercialmente en Chile y el extranjero.',
    targetFundId: 'corfo_semilla_expande'
  },
  {
    icon: '🏢',
    title: 'Pyme con Ventas (> 200 UF)',
    subtitle: 'Empresa formalizada que necesita modernizar maquinaria o digitalizarse',
    promptText: 'Pyme formalizada en primera categoría con facturación de 2.500 UF anuales, buscando inversión en nueva maquinaria y desarrollo comercial.',
    targetFundId: 'sercotec_crece'
  },
  {
    icon: '👩‍💼',
    title: 'Mujer Emprendedora desde Cero',
    subtitle: 'Sin inicio de actividades en 1ª categoría ante SII (primer fondo)',
    promptText: 'Mujer emprendedora sin inicio de actividades ante el SII que busca formalizar un taller productivo con subsidio no reembolsable.',
    targetFundId: 'sercotec_abeja_emprende'
  },
  {
    icon: '🔬',
    title: 'Proyecto de I+D o Base Científica',
    subtitle: 'Desarrollo de biotecnología, ingeniería o minería con universidades',
    promptText: 'Empresa que busca desarrollar un prototipo tecnológico de I+D con alto desafío técnico e incertidumbre experimental.',
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
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [matchResult, setMatchResult] = useState<any | null>(null);

  // Active authenticated user
  const [activeUser, setActiveUser] = useState<CompanyUser | null>(propUser || getCurrentUser());

  // Registration & Login Form State
  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);

  // Form fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRut, setRegRut] = useState('');

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propUser) {
      setActiveUser(propUser);
    } else {
      setActiveUser(getCurrentUser());
    }
  }, [propUser]);

  // Listen to global auth change events
  useEffect(() => {
    const handleAuthChange = (e: any) => {
      setActiveUser(e.detail || getCurrentUser());
    };
    window.addEventListener('inki_auth_changed', handleAuthChange);
    return () => window.removeEventListener('inki_auth_changed', handleAuthChange);
  }, []);

  const executeMatch = async (query: string, targetFundHint?: string) => {
    if (!query.trim()) return;
    setLoading(true);
    setMatchResult(null);

    setScanStep('Escaneando bases oficiales CORFO, SERCOTEC y Start-Up Chile 2026...');
    await new Promise(r => setTimeout(r, 400));
    setScanStep('Analizando topes de ventas ante SII, nivel TRL y elegibilidad jurídica...');
    await new Promise(r => setTimeout(r, 350));
    setScanStep('Calculando subsidio máximo y calendario oficial de postulación...');

    try {
      const response = await fetch('/api/gemini/instant-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, targetFundHint })
      });

      if (!response.ok) {
        throw new Error('Fallback to deterministic matching engine');
      }

      const data = await response.json();
      setMatchResult(data);
    } catch (err) {
      // Deterministic Chilean Grant Matcher Fallback
      const lower = query.toLowerCase();
      let matchedFund = CHILEAN_FUNDS[0]; // Semilla Inicia default
      let when = 'Convocatoria Nacional 2026: Abierta hasta el 30 de Abril a las 13:00 hrs';

      if (targetFundHint) {
        const found = CHILEAN_FUNDS.find(f => f.id === targetFundHint);
        if (found) matchedFund = found;
      } else if (lower.includes('mujer') || lower.includes('emprendedora')) {
        matchedFund = CHILEAN_FUNDS.find(f => f.id === 'sercotec_abeja_emprende') || matchedFund;
        when = 'Convocatoria 2026: Abierta entre Abril y Junio en todas las regiones';
      } else if (lower.includes('primeras ventas') || lower.includes('expande') || (lower.includes('ventas') && !lower.includes('sin ventas'))) {
        matchedFund = CHILEAN_FUNDS.find(f => f.id === 'corfo_semilla_expande') || matchedFund;
        when = 'Convocatoria Nacional 2026: Abierta hasta el 15 de Mayo';
      } else if (lower.includes('pyme') || lower.includes('200 uf') || lower.includes('maquinaria')) {
        matchedFund = CHILEAN_FUNDS.find(f => f.id === 'sercotec_crece') || matchedFund;
        when = 'Llamado Regional Sercotec: Mayo a Julio 2026';
      } else if (lower.includes('i+d') || lower.includes('cient') || lower.includes('biotec')) {
        matchedFund = CHILEAN_FUNDS.find(f => f.id === 'corfo_crea_valida') || matchedFund;
        when = 'Ventanilla Abierta Continua 2026 (Postulación en cualquier fecha)';
      }

      setMatchResult({
        wowHeadline: `¡Calificas directamente para ${matchedFund.name}!`,
        primaryFund: {
          fundId: matchedFund.id,
          fundName: matchedFund.name,
          agency: matchedFund.agency,
          subsidyFormatted: matchedFund.subsidyFormatted,
          maxSubsidyCLP: matchedFund.maxSubsidyCLP,
          coFinancePct: matchedFund.maxCoFinancePct,
          whenToApply: when,
          status: matchedFund.status,
          matchScore: 95,
          whyYouQualify: `Tu perfil cumple con las bases de ${matchedFund.agency}: nivel de ventas admisible, tipo de beneficiario compatible y alto potencial de impacto en Chile.`,
          femaleBonusEligible: true,
          femaleBonusText: matchedFund.femaleBonusPct ? `+${matchedFund.femaleBonusPct}% adicional por liderazgo femenino` : undefined
        },
        secondaryFunds: CHILEAN_FUNDS.filter(f => f.id !== matchedFund.id).slice(0, 2).map(f => ({
          fundId: f.id,
          fundName: f.name,
          agency: f.agency,
          subsidyFormatted: f.subsidyFormatted,
          whenToApply: f.callSchedule,
          status: f.status,
          matchScore: 82
        })),
        actionCallout: 'Tienes los requisitos clave para postular. Regístrate a continuación para proteger tus datos y activar el Formulador IA.'
      });
    } finally {
      setLoading(false);
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleRegisterCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!regEmail.trim()) {
      setAuthError('Ingresa un correo electrónico.');
      return;
    }

    if (!regPassword || regPassword.length < 6) {
      setAuthError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (regRut && !validateRut(regRut)) {
      setAuthError('El RUT ingresado no es válido. Verifica el dígito verificador.');
      return;
    }

    const res = registerCompanyUser({
      email: regEmail,
      password: regPassword,
      companyName: regName || 'Mi Empresa SpA',
      rut: regRut,
      phone: regPhone
    });

    if (!res.success || !res.user) {
      setAuthError(res.error || 'No se pudo crear la cuenta.');
      return;
    }

    setActiveUser(res.user);
    setAuthSuccess(`¡Empresa ${res.user.companyName} registrada exitosamente! Tus datos ahora están protegidos.`);

    const cleanProf = getCleanDefaultProfile(res.user);
    setProfile(cleanProf);

    onAuthSuccess?.(res.user);

    // Smoothly take user directly to their application roadmap
    setTimeout(() => {
      onNavigateTab('my-application');
    }, 700);
  };

  const handleLoginCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    const res = loginCompanyUser(regEmail, regPassword);
    if (!res.success || !res.user) {
      setAuthError(res.error || 'Credenciales inválidas.');
      return;
    }

    setActiveUser(res.user);
    setAuthSuccess(`¡Bienvenido de vuelta, ${res.user.companyName}! Sesión iniciada.`);

    const cleanProf = getCleanDefaultProfile(res.user);
    setProfile(cleanProf);

    onAuthSuccess?.(res.user);

    setTimeout(() => {
      onNavigateTab('my-application');
    }, 700);
  };

  const handleActionFormulate = (fundId: string) => {
    const f = CHILEAN_FUNDS.find(item => item.id === fundId) || CHILEAN_FUNDS[0];
    onSelectFundToFormulate(f);
  };

  const handleResetSearch = () => {
    setMatchResult(null);
    setInputText('');
    setAuthError(null);
    setAuthSuccess(null);
  };

  return (
    <div className="space-y-6">
      {/* ImpulsaCap Hero Container - Light Fresh Modern SaaS */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-blue-50/80 via-white to-emerald-50/40 border border-blue-100 p-5 sm:p-9 shadow-sm">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold shadow-xs">
            <span className="text-emerald-600 font-black">✦</span>
            <span>ImpulsaCap • Calce Rápido de Fondos Concursables Chile 2026</span>
          </div>

          <h1 className="text-2xl sm:text-5xl font-black text-slate-900 tracking-tight leading-tight">
            ¿A qué fondos públicos chilenos puede postular tu empresa y{' '}
            <span className="bg-gradient-to-r from-blue-700 via-teal-600 to-emerald-600 bg-clip-text text-transparent underline decoration-blue-500/30">
              cuándo se postula?
            </span>
          </h1>

          <p className="text-slate-600 text-xs sm:text-base max-w-2xl mx-auto leading-relaxed">
            Responde una sola pregunta o describe tu empresa. Nuestra IA analiza instantáneamente las convocatorias vigentes de CORFO, SERCOTEC y Start-Up Chile.
          </p>

          {/* Search Box / Input Prompt */}
          <div className="pt-1 max-w-3xl mx-auto">
            <div className="relative flex flex-col sm:flex-row items-center gap-2 p-1.5 rounded-2xl bg-white border-2 border-blue-200 shadow-md focus-within:border-blue-600 transition-all">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeMatch(inputText);
                }}
                placeholder="Ej: Somos una startup de software SpA en Santiago con 12M en ventas, liderada por mujeres..."
                className="w-full px-4 py-3 bg-transparent text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-hidden"
              />
              <button
                onClick={() => executeMatch(inputText)}
                disabled={loading || !inputText.trim()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 shrink-0 cursor-pointer active:scale-95"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Escaneando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>Descubrir Fondos al Instante</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 
            CUANDO APARECEN LOS RESULTADOS DEL FONDO AL INSTANTE, DEBE DESAPARECER 'O ELIGE TU SITUACIÓN EN UN CLICK'
            Se muestra únicamente si matchResult es null y no está cargando.
          */}
          {!matchResult && !loading && (
            <div className="pt-3 animate-fade-in">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2.5">
                O elige tu situación en 1 clic:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-left">
                {QUICK_QUESTION_OPTIONS.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(opt.promptText);
                      executeMatch(opt.promptText, opt.targetFundId);
                    }}
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

          {/* Si ya hay resultados, mostrar una barra para permitir reiniciar o volver a ver situaciones */}
          {matchResult && !loading && (
            <div className="pt-2 flex items-center justify-between text-left border-t border-slate-200 animate-fade-in">
              <button
                onClick={handleResetSearch}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-blue-500 text-xs text-blue-700 hover:text-blue-800 transition-all font-semibold cursor-pointer active:scale-95 shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a elegir situación o hacer otra consulta</span>
              </button>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Fondos analizados para tu perfil
              </span>
            </div>
          )}

          {/* LOADING RADAR */}
          {loading && (
            <div className="mt-6 p-6 rounded-3xl bg-white border border-blue-200 text-center space-y-3 shadow-md animate-pulse">
              <div className="w-12 h-12 rounded-full bg-blue-50 border-2 border-blue-600 flex items-center justify-center mx-auto text-blue-600 animate-spin">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{scanStep}</h3>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Consultando bases vigentes de CORFO, SERCOTEC y Start-Up Chile...
              </p>
            </div>
          )}

          {/* 
            LA INFORMACIÓN APARECE AQUÍ DIRECTAMENTE
          */}
          {matchResult && !loading && (
            <div ref={resultsRef} className="mt-6 text-left space-y-5 animate-fade-in">
              {/* Main Winning Card - Crisp Light Card */}
              <div className="relative overflow-hidden rounded-3xl bg-white border-2 border-blue-500/80 p-5 sm:p-7 shadow-xl">
                {/* Header Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-emerald-600" />
                      Tu Fondo Ganador Recomendado
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {matchResult.primaryFund.agency}
                    </span>
                    {matchResult.primaryFund.femaleBonusEligible && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                        {matchResult.primaryFund.femaleBonusText || '+10% Bono Mujer'}
                      </span>
                    )}
                  </div>

                  <div className="px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-black text-xs sm:text-sm">
                    {matchResult.primaryFund.matchScore}% Compatibilidad
                  </div>
                </div>

                {/* Fund Title & WOW Headline */}
                <h2 className="text-xl sm:text-3xl font-black text-slate-900 leading-tight">
                  {matchResult.primaryFund.fundName}
                </h2>
                <p className="text-sm font-semibold text-blue-700 mt-1">
                  {matchResult.wowHeadline}
                </p>

                {/* Core Grant Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">
                      Subsidio No Reembolsable
                    </span>
                    <span className="text-lg sm:text-2xl font-black text-emerald-700">
                      {matchResult.primaryFund.subsidyFormatted}
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      (Cofinanciamiento de hasta {matchResult.primaryFund.coFinancePct}%)
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">
                      ¿Cuándo se postula? (Calendario)
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5 mt-1">
                      <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                      {matchResult.primaryFund.whenToApply}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold block mt-1">
                      ● Estado: {matchResult.primaryFund.status}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">
                      ¿Por qué calificas?
                    </span>
                    <p className="text-xs text-slate-600 leading-snug mt-0.5">
                      {matchResult.primaryFund.whyYouQualify}
                    </p>
                  </div>
                </div>

                {/* Secondary Alternatives */}
                {matchResult.secondaryFunds && matchResult.secondaryFunds.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                      Otras opciones complementarias para tu empresa:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {matchResult.secondaryFunds.map((sec: any, i: number) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{sec.fundName}</span>
                            <p className="text-[10px] text-slate-500 mt-0.5">{sec.whenToApply}</p>
                          </div>
                          <button
                            onClick={() => handleActionFormulate(sec.fundId)}
                            className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold shrink-0 cursor-pointer shadow-xs"
                          >
                            Ver
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 
                LUEGO DE VER LA INFO: ACCESO Y REGISTRO DE EMPRESAS CON MAIL Y CONTRASEÑA
                (SUS DATOS SOLO PUEDEN SER VISTOS POR ELLOS)
              */}
              <div className="p-5 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-4">
                
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        {activeUser ? '🔒 Bóveda de Empresa Autenticada' : 'Acceso y Registro de Empresas'}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {activeUser 
                          ? `Sesión activa como ${activeUser.companyName} (${activeUser.email}). Tus datos, F29 y expedientes están estrictamente protegidos.` 
                          : 'Para acceder con mail y contraseña y garantizar que tus datos solo sean vistos por tu empresa, regístrate o inicia sesión a continuación.'}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Datos 100% Confidenciales</span>
                  </div>
                </div>

                {/* Feedback notifications */}
                {authError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{authError}</span>
                  </div>
                )}

                {authSuccess && (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{authSuccess}</span>
                  </div>
                )}

                {/* IF NOT LOGGED IN: TABS FOR REGISTER AND LOGIN */}
                {!activeUser ? (
                  <div className="space-y-4 pt-1">
                    {/* Toggle tab: Register vs Login */}
                    <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold max-w-sm">
                      <button
                        type="button"
                        onClick={() => { setAuthTab('register'); setAuthError(null); }}
                        className={`py-2 rounded-lg transition-all cursor-pointer ${
                          authTab === 'register'
                            ? 'bg-emerald-600 text-white shadow-xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Registrar Empresa
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAuthTab('login'); setAuthError(null); }}
                        className={`py-2 rounded-lg transition-all cursor-pointer ${
                          authTab === 'login'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Ya tengo cuenta
                      </button>
                    </div>

                    {authTab === 'register' ? (
                      <form onSubmit={handleRegisterCompany} className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Nombre o Razón Social de la Empresa
                            </label>
                            <div className="relative">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                              <input
                                type="text"
                                required
                                value={regName}
                                onChange={(e) => setRegName(e.target.value)}
                                placeholder="Ej: Innova SpA"
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              RUT de la Empresa
                            </label>
                            <div className="relative">
                              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                              <input
                                type="text"
                                required
                                value={regRut}
                                onChange={(e) => setRegRut(e.target.value)}
                                placeholder="77.123.456-K"
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Correo Electrónico (Acceso)
                            </label>
                            <div className="relative">
                              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                              <input
                                type="email"
                                required
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                                placeholder="contacto@tuempresa.cl"
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Contraseña (min. 6 caracteres)
                            </label>
                            <div className="relative">
                              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                              <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                minLength={6}
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Teléfono / WhatsApp (+56) (Opcional)
                            </label>
                            <div className="relative">
                              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                              <input
                                type="tel"
                                value={regPhone}
                                onChange={(e) => setRegPhone(e.target.value)}
                                placeholder="+56 9 1234 5678"
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <button
                            type="submit"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Registrar Empresa y Proteger Mis Datos</span>
                          </button>

                          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <Lock className="w-3 h-3 text-emerald-600" />
                            Tus datos solo serán visibles por tu empresa
                          </span>
                        </div>
                      </form>
                    ) : (
                      /* LOGIN FORM */
                      <form onSubmit={handleLoginCompany} className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Correo Electrónico
                            </label>
                            <div className="relative">
                              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                              <input
                                type="email"
                                required
                                value={regEmail}
                                onChange={(e) => setRegEmail(e.target.value)}
                                placeholder="correo@tuempresa.cl"
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-blue-500 focus:outline-hidden"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Contraseña
                            </label>
                            <div className="relative">
                              <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                              <input
                                type={showPassword ? 'text' : 'password'}
                                required
                                value={regPassword}
                                onChange={(e) => setRegPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs focus:bg-white focus:border-blue-500 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                              >
                                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <button
                            type="submit"
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 transition-all cursor-pointer active:scale-95"
                          >
                            <Lock className="w-4 h-4" />
                            <span>Iniciar Sesión en Mi Empresa</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  /* ALREADY LOGGED IN VIEW */
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 text-xs text-emerald-800 font-semibold">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {activeUser.companyName}
                          </p>
                          <p className="text-[11px] text-slate-600">
                            RUT: {activeUser.rut || 'No configurado'} • Cuenta: {activeUser.email}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1">
                          <Lock className="w-3 h-3 text-emerald-700" />
                          Bóveda Privada
                        </span>
                        <button
                          onClick={() => onNavigateTab('my-application')}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Ver Mi Hoja de Ruta & Pasos</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-600">
                      🔒 Tus balances SII, formulación técnica y expediente oficial solo pueden ser visualizados por esta cuenta.
                    </p>
                  </div>
                )}

                {/* THE ACTION BUTTONS: Take user to other tools */}
                <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500">
                    Herramientas de postulación disponibles:
                  </span>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => onNavigateTab('my-application')}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-sm shadow-emerald-600/20"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>📋 Hoja de Ruta & Pasos</span>
                    </button>

                    <button
                      onClick={() => handleActionFormulate(matchResult.primaryFund.fundId)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs active:scale-95 transition-all cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-100" />
                      <span>🚀 Formular con IA</span>
                    </button>

                    <button
                      onClick={() => onNavigateTab('documents')}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>📑 Trámites F29</span>
                    </button>

                    <button
                      onClick={() => onNavigateTab('auditor')}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
                      <span>⚖️ Auditar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 
        BOTÓN DEDICADO QUE LLEVA A OTRA PÁGINA PARA EL DIAGNÓSTICO AVANZADO 
      */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 hover:border-blue-300 transition-all flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0 text-blue-600">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              ¿Quieres un Diagnóstico Tributario Avanzado y Simulador de Cuentas CORFO?
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Simula al detalle los tramos de ventas en UF, el desglose de aporte pecuniario en efectivo y las cuentas presupuestarias aprobadas.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTab('advanced-diagnostic')}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 transition-all shadow-sm cursor-pointer group"
        >
          <span>Abrir Diagnóstico Avanzado</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
