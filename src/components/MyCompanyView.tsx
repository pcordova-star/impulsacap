import { ReferralCodeField } from './ReferralCodeField';
import React, { useState, useEffect, useMemo } from 'react';
import { ProfileAutofill } from './ProfileAutofill';
import { notifySaved } from '../utils/guideEvents';
import { 
  CompanyProfile, 
  CompanyUser, 
  CompanyType, 
  SalesBracket, 
  ProjectProfile, 
  calculateProjectProfileCompletion 
} from '../types/funds';
import { validateRut, formatRut, formatRutInput, formatPhoneCLInput } from '../utils/rutValidator';
import { usePlan } from '../hooks/usePlan';
import { apiFetch } from '../utils/apiFetch';
import { announceEarlyAccess } from '../utils/earlyAccess';
import { auth } from '../firebase';
import { requestLogin } from '../utils/authEvents';
import { 
  Building2, 
  FileText, 
  User, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  Sparkles, 
  LogOut, 
  CreditCard, 
  Clock, 
  Layers, 
  RotateCcw, 
  ExternalLink,
  Target,
  Users,
  Briefcase,
  HelpCircle,
  Calendar,
  Check
} from 'lucide-react';

interface MyCompanyViewProps {
  profile: CompanyProfile;
  currentUser: CompanyUser | null;
  onUpdateProfile: (updated: CompanyProfile) => void;
  onOpenSiiModal: () => void;
  onLogout: () => void;
  onNavigateTab?: (tab: string) => void;
}

interface PaymentRecord {
  id: string;
  paymentId: string;
  amount: number;
  currencyId: string;
  status: string;
  approvedAt: string | null;
  paymentMethodId: string;
  externalReference: string;
}

export const MyCompanyView: React.FC<MyCompanyViewProps> = ({
  profile,
  currentUser,
  onUpdateProfile,
  onOpenSiiModal,
  onLogout,
  onNavigateTab
}) => {
  // Plan hook
  const { 
    hasActivePlan, 
    expiresAt, 
    daysLeft, 
    activeFundIds, 
    isExpiringSoon, 
    isExpired,
    price,
    isFirstPurchase,
    provisional,
    referralCode,
    referralDiscountPct,
    refresh: refreshPlan 
  } = usePlan();

  // Local form state initialized from profile & currentUser
  const [companyName, setCompanyName] = useState(profile.companyName || currentUser?.companyName || '');
  const [rut, setRut] = useState(profile.rut || currentUser?.rut || '');
  const [companyType, setCompanyType] = useState<CompanyType>(profile.companyType || 'spa');
  const [sector, setSector] = useState(profile.sector || 'Tecnología e Innovación');
  const [region, setRegion] = useState(profile.region || 'Región Metropolitana');
  const [salesBracket, setSalesBracket] = useState<SalesBracket>(profile.salesBracket || 'sin_ventas');
  const [isFemaleLed, setIsFemaleLed] = useState<boolean>(profile.isFemaleLed || false);
  const [femaleEquityPct, setFemaleEquityPct] = useState<number>(profile.femaleEquityPct || 0);

  // Representative state
  // Lo guardado en el perfil manda; la cuenta solo sirve de valor inicial
  // (antes la cuenta tenía prioridad y mostraba el nombre de la empresa como representante)
  const repNameFromAccount = currentUser?.representativeName && currentUser.representativeName !== currentUser.companyName ? currentUser.representativeName : '';
  const [representativeName, setRepresentativeName] = useState(profile.representativeName || repNameFromAccount || '');
  const [representativeRut, setRepresentativeRut] = useState(profile.representativeRut || currentUser?.representativeRut || '');
  const [representativeEmail, setRepresentativeEmail] = useState(profile.representativeEmail || currentUser?.email || '');
  const [representativePhone, setRepresentativePhone] = useState(profile.representativePhone || currentUser?.phone || '');

  // Project Profile state (Requirement A.1)
  const initialProject = profile.projectProfile || ({} as Partial<ProjectProfile>);
  const [whatItDoes, setWhatItDoes] = useState(initialProject.whatItDoes || profile.projectSummary || '');
  const [problemAndTarget, setProblemAndTarget] = useState(initialProject.problemAndTarget || '');
  const [currentSolutionAndDiff, setCurrentSolutionAndDiff] = useState(initialProject.currentSolutionAndDiff || '');
  const [currentProgress, setCurrentProgress] = useState(initialProject.currentProgress || '');
  const [teamDetails, setTeamDetails] = useState(initialProject.teamDetails || '');
  const [businessModel, setBusinessModel] = useState(initialProject.businessModel || '');
  const [fundingPurpose, setFundingPurpose] = useState(initialProject.fundingPurpose || '');
  const [websiteOrSocial, setWebsiteOrSocial] = useState(initialProject.websiteOrSocial || '');

  // Payment history state (Requirement C.9)
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [renewingPlan, setRenewingPlan] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Current project profile object
  const currentProjectProfile: ProjectProfile = useMemo(() => ({
    whatItDoes,
    problemAndTarget,
    currentSolutionAndDiff,
    currentProgress,
    teamDetails,
    businessModel,
    fundingPurpose,
    websiteOrSocial
  }), [whatItDoes, problemAndTarget, currentSolutionAndDiff, currentProgress, teamDetails, businessModel, fundingPurpose, websiteOrSocial]);

  // Project completion percentage (Requirement A.1)
  const projectCompletionPct = useMemo(() => {
    return calculateProjectProfileCompletion(currentProjectProfile);
  }, [currentProjectProfile]);

  // Load payment history on mount (Requirement C.9)
  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const res = await apiFetch('/api/pagos/historial');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setPaymentHistory(data.payments || []);
          }
        }
      } catch (err) {
        console.warn('Could not load payment history:', err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };

    fetchHistory();
    return () => { isMounted = false; };
  }, []);

  // Cambios sin guardar: si el perfil llega después (desde la nube) y no has editado, se muestra el guardado
  const dirtyRef = React.useRef(false);
  const selfSaveRef = React.useRef(false);
  const [autoSavedAt, setAutoSavedAt] = useState<string | null>(null);
  useEffect(() => {
    if (selfSaveRef.current) { selfSaveRef.current = false; return; }
    if (dirtyRef.current) return;
    setCompanyName(profile.companyName || currentUser?.companyName || '');
    setRut(profile.rut || currentUser?.rut || '');
    if (profile.companyType) setCompanyType(profile.companyType);
    if (profile.sector) setSector(profile.sector);
    if (profile.region) setRegion(profile.region);
    if (profile.salesBracket) setSalesBracket(profile.salesBracket);
    setIsFemaleLed(Boolean(profile.isFemaleLed));
    setFemaleEquityPct(profile.femaleEquityPct || 0);
    if (profile.representativeName) setRepresentativeName(profile.representativeName);
    if (profile.representativeRut) setRepresentativeRut(profile.representativeRut);
    if (profile.representativeEmail) setRepresentativeEmail(profile.representativeEmail);
    if (profile.representativePhone) setRepresentativePhone(profile.representativePhone);
    const pp = profile.projectProfile || ({} as Partial<ProjectProfile>);
    setWhatItDoes(pp.whatItDoes || profile.projectSummary || '');
    setProblemAndTarget(pp.problemAndTarget || '');
    setCurrentSolutionAndDiff(pp.currentSolutionAndDiff || '');
    setCurrentProgress(pp.currentProgress || '');
    setTeamDetails(pp.teamDetails || '');
    setBusinessModel(pp.businessModel || '');
    setFundingPurpose(pp.fundingPurpose || '');
    setWebsiteOrSocial(pp.websiteOrSocial || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Guardado automático: 1,2 s después de dejar de escribir (no hace falta apretar "Guardar")
  const saveRef = React.useRef<() => void>(() => {});
  const markDirty = () => {
    dirtyRef.current = true;
    setAutoSavedAt(null);
  };
  useEffect(() => {
    if (!dirtyRef.current) return;
    const t = setTimeout(() => { saveRef.current(); }, 1200);
    return () => clearTimeout(t);
  }, [companyName, rut, companyType, sector, region, salesBracket, isFemaleLed, femaleEquityPct, representativeName, representativeRut, representativeEmail, representativePhone, currentProjectProfile]);
  // Al salir de la pantalla con cambios pendientes, se guardan igual
  useEffect(() => () => { if (dirtyRef.current) saveRef.current(); }, []);

  // Save handler for company & project profile
  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    // Guardado pedido por el usuario (botón): el consultor propone el siguiente paso
    if (e) setTimeout(() => notifySaved('Mi empresa'), 0);
    dirtyRef.current = false;
    selfSaveRef.current = true;
    setAutoSavedAt(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }));
    const updated: CompanyProfile = {
      ...profile,
      companyName: companyName.trim() || 'Mi Empresa',
      rut: rut.trim(),
      companyType,
      sector: sector.trim(),
      region: region.trim(),
      salesBracket,
      isFemaleLed,
      femaleEquityPct: isFemaleLed ? (femaleEquityPct || 100) : 0,
      representativeName: representativeName.trim(),
      representativeRut: representativeRut.trim(),
      representativeEmail: representativeEmail.trim(),
      representativePhone: representativePhone.trim(),
      projectProfile: currentProjectProfile,
      projectSummary: whatItDoes.trim() || profile.projectSummary
    };
    onUpdateProfile(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  saveRef.current = () => handleSave();

  // Renew / Upgrade plan handler (Mercado Pago Checkout Pro)
  const handleRenewPlan = async () => {
    if (auth.authStateReady) {
      try {
        await auth.authStateReady();
      } catch (err) {
        console.warn('authStateReady error:', err);
      }
    }

    if (!auth.currentUser) {
      requestLogin({
        message: 'Inicia sesión o crea tu cuenta para continuar con el Plan Trimestral.',
        mode: 'login',
        onSuccess: async () => {
          await handleRenewPlan();
        }
      });
      return;
    }

    setRenewingPlan(true);
    try {
      const res = await apiFetch('/api/pagos/crear', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data?.earlyAccess) { announceEarlyAccess(data); return; }
      if (res.ok && data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert(data.error || 'No se pudo iniciar el pago de renovación.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error de conexión al renovar.');
    } finally {
      setRenewingPlan(false);
    }
  };

  const isCompanyRutValid = rut ? validateRut(rut) : true;
  const isRepRutValid = representativeRut ? validateRut(representativeRut) : true;

  // Format dates for plan
  const formattedExpiry = expiresAt 
    ? new Date(expiresAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'No definido';

  const formattedStart = useMemo(() => {
    if (!expiresAt) return null;
    const expDate = new Date(expiresAt);
    const startDate = new Date(expDate);
    startDate.setMonth(startDate.getMonth() - 3);
    return startDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [expiresAt]);

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-12 min-w-0 max-w-full">
      {/* 1. Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/70 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold tracking-wider uppercase">
                BÓVEDA EMPRESARIAL
              </span>
              {hasActivePlan ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Plan Trimestral Activo</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  <span>Sin plan</span>
                </span>
              )}
              {currentUser && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Sesión Segura</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight truncate">
              {companyName || 'Mi Empresa'}
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Gestiona el perfil de tu empresa, el perfil de tu proyecto para que la IA redacte con hechos reales, tus antecedentes tributarios del SII y el estado de tu plan.
            </p>
          </div>

          {currentUser && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <form noValidate onSubmit={handleSave} onInputCapture={markDirty} onChangeCapture={markDirty} onClickCapture={(e) => { const t = e.target as HTMLElement; if (t.closest('[role="radio"],[role="switch"],[type="checkbox"],[data-dirty]')) markDirty(); }} className="space-y-6">
        
        {/* ========================================================================= */}
        {/* SECCIÓN A: PERFIL DEL PROYECTO (Requirement A.1) */}
        {/* ========================================================================= */}
        <div id="project-profile" className="scroll-mt-28 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0">
                <Target className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Perfil del Proyecto
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800">
                    IA Con Hechos Reales
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  La IA utilizará estos datos para formular secciones, redactar cartas LOI y simular comités sin inventar información.
                </p>
              </div>
            </div>

            {/* Completion Indicator (Requirement A.1) */}
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-2xl shrink-0">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                  Perfil del proyecto:
                </span>
                <span className={`text-xs font-black font-mono ${
                  projectCompletionPct >= 60 ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {projectCompletionPct}% completo
                </span>
              </div>
              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 rounded-full ${
                    projectCompletionPct >= 60 ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.max(6, projectCompletionPct)}%` }}
                />
              </div>
            </div>
          </div>

          {projectCompletionPct < 60 && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Perfil del proyecto incompleto ({projectCompletionPct}%)</p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Se requiere al menos un 60% para desbloquear la redacción técnica precisa con IA y evitar marcas [COMPLETAR: dato faltante].
                </p>
              </div>
            </div>
          )}

          <ProfileAutofill
            values={{ whatItDoes, problemAndTarget, currentSolutionAndDiff, currentProgress, businessModel, teamDetails, websiteOrSocial }}
            projectSummary={whatItDoes}
            onApply={(field, value) => {
              markDirty();
              const setters: Record<string, (v: string) => void> = {
                whatItDoes: setWhatItDoes, problemAndTarget: setProblemAndTarget, currentSolutionAndDiff: setCurrentSolutionAndDiff,
                currentProgress: setCurrentProgress, businessModel: setBusinessModel, teamDetails: setTeamDetails, websiteOrSocial: setWebsiteOrSocial
              };
              setters[field]?.(value);
            }}
          />

          <div className="space-y-4 text-xs">
            {/* 1. ¿Qué hace tu empresa o proyecto? */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                ¿Qué hace tu empresa o proyecto? <span className="font-normal text-slate-500">(producto o servicio)</span>
              </label>
              <textarea
                rows={3}
                value={whatItDoes}
                onChange={(e) => setWhatItDoes(e.target.value)}
                placeholder="Ej: Desarrollamos una plataforma SaaS con algoritmos de IA y sensores IoT para optimizar el riego y fertilización en viñedos y frutales..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-cyan-600 focus:outline-hidden leading-relaxed"
              />
            </div>

            {/* 2. ¿Qué problema resuelve y a quién? */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                ¿Qué problema resuelve y a quién? <span className="font-normal text-slate-500">(cliente objetivo)</span>
              </label>
              <textarea
                rows={3}
                value={problemAndTarget}
                onChange={(e) => setProblemAndTarget(e.target.value)}
                placeholder="Ej: Los productores agrícolas y viticultores pierden hasta un 35% de su producción por heladas imprevistas y sobre-riego, afectando a más de 4.000 pymes agrícolas en Chile..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-cyan-600 focus:outline-hidden leading-relaxed"
              />
            </div>

            {/* 3. ¿Cómo lo resuelven hoy tus clientes y qué te diferencia? */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                ¿Cómo lo resuelven hoy tus clientes y qué te diferencia?
              </label>
              <textarea
                rows={3}
                value={currentSolutionAndDiff}
                onChange={(e) => setCurrentSolutionAndDiff(e.target.value)}
                placeholder="Ej: Hoy usan estaciones meteorológicas importadas de alto costo ($15.000 USD) o planillas Excel manuales. Nuestra solución cuesta un 80% menos y entrega alertas predictivas en tiempo real..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-cyan-600 focus:outline-hidden leading-relaxed"
              />
            </div>

            {/* 4. Avance actual */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                Avance actual <span className="font-normal text-slate-500">(prototipo, clientes, ventas, pilotos, cartas de interés)</span>
              </label>
              <textarea
                rows={3}
                value={currentProgress}
                onChange={(e) => setCurrentProgress(e.target.value)}
                placeholder="Ej: Contamos con prototipo funcional TRL 4 validado en laboratorio, 2 pilotos en terreno en el Valle de Colchagua y 3 cartas de interés comercial (LOI) firmadas por viñas locales..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-cyan-600 focus:outline-hidden leading-relaxed"
              />
            </div>

            {/* 5. Equipo */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                Equipo <span className="font-normal text-slate-500">(nombre, rol y experiencia de cada integrante clave)</span>
              </label>
              <textarea
                rows={3}
                value={teamDetails}
                onChange={(e) => setTeamDetails(e.target.value)}
                placeholder="Ej: Rodrigo Muñoz (CEO, Ing. Agrónomo U. de Chile, 8 años en gestión de predios), Camila Sepúlveda (CTO, Master en Ciencias de la Computación, 5 años en IoT)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-cyan-600 focus:outline-hidden leading-relaxed"
              />
            </div>

            {/* 6. Modelo de negocio */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                Modelo de negocio <span className="font-normal text-slate-500">(cómo cobras y cuánto)</span>
              </label>
              <textarea
                rows={2}
                value={businessModel}
                onChange={(e) => setBusinessModel(e.target.value)}
                placeholder="Ej: Modelo B2B SaaS con suscripción mensual de $180.000 CLP por hectárea monitoreada más arriendo de hardware IoT por $50.000 CLP mensuales..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-cyan-600 focus:outline-hidden leading-relaxed"
              />
            </div>

            {/* 7. ¿Para qué necesitas el financiamiento y en qué lo usarías? */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                ¿Para qué necesitas el financiamiento y en qué lo usarías?
              </label>
              <textarea
                rows={2}
                value={fundingPurpose}
                onChange={(e) => setFundingPurpose(e.target.value)}
                placeholder="Ej: El subsidio de CORFO ($15M) se destinará en un 55% a contratación de desarrolladores de software, 30% en adquisición de sensores para validación y 15% en prospección comercial..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-cyan-600 focus:outline-hidden leading-relaxed"
              />
            </div>

            {/* 8. Sitio web o redes (opcional) */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-800 block">
                Sitio web o redes <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={websiteOrSocial}
                onChange={(e) => setWebsiteOrSocial(e.target.value)}
                placeholder="Ej: https://miempresa.cl o @miempresa_cl"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-cyan-600 focus:outline-hidden font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECCIÓN B: CARPETA TRIBUTARIA ELECTRÓNICA SII */}
        {/* ========================================================================= */}
        <div id="tax-folder" className="scroll-mt-28 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Carpeta Tributaria Electrónica SII (F29)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Acredita inicio de actividades en 1ª categoría y facturación de los últimos periodos ante CORFO
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenSiiModal}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{profile.taxFolderUploaded ? 'Actualizar Carpeta Tributaria' : 'Subir Carpeta Tributaria (PDF/XML)'}</span>
            </button>
          </div>

          {profile.taxFolderUploaded ? (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Carpeta Tributaria Verificada y Vinculada</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-700 font-bold">
                  {profile.taxFolderUploadDate || 'Reciente'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Archivo:</span>
                  <p className="font-semibold text-slate-900 truncate mt-0.5" title={profile.taxFolderFileName}>
                    {profile.taxFolderFileName || 'Carpeta_SII.pdf'}
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Periodos F29:</span>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {profile.taxFolderF29Periods || 12} meses declarados
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Ventas 12 Meses:</span>
                  <p className="font-bold text-blue-700 mt-0.5">
                    ${(profile.annualSalesCLP || 0).toLocaleString('es-CL')} CLP
                  </p>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-emerald-200/80">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Antigüedad SII:</span>
                  <p className="font-bold text-emerald-700 mt-0.5">
                    {profile.monthsActive ? `${profile.monthsActive} meses` : 'Acreditada'}
                  </p>
                </div>
              </div>

              {profile.taxFolderSummary && (
                <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-emerald-100">
                  💡 {profile.taxFolderSummary}
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold">Aún no has subido tu Carpeta Tributaria Electrónica</p>
                  <p className="text-[11px] text-amber-800">
                    Sube el PDF que descargas gratis desde www.sii.cl para autovalidar ventas y requisitos excluyentes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenSiiModal}
                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer shrink-0 text-center"
              >
                Subir con IA
              </button>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* SECCIÓN C: IDENTIFICACIÓN Y PERFIL DE LA EMPRESA */}
        {/* ========================================================================= */}
        <div id="company-identity" className="scroll-mt-28 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Identificación y Datos de la Empresa
              </h3>
              <p className="text-[11px] text-slate-500">
                Datos constitutivos y características legales de la sociedad
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Razón Social */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Razón Social</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Ej: Innovaciones Tecnológicas SpA"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden font-semibold"
              />
            </div>

            {/* RUT */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">RUT Empresa</label>
                {rut && (
                  <span className={`text-[10px] font-bold ${isCompanyRutValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isCompanyRutValid ? '✓ Válido Módulo 11' : '⚠ RUT inválido'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={rut}
                onChange={(e) => setRut(formatRutInput(e.target.value))}
                placeholder="77.123.456-K"
                className={`w-full px-3.5 py-2 rounded-xl bg-slate-50 border text-slate-900 font-mono font-semibold focus:bg-white focus:outline-hidden ${
                  rut && isCompanyRutValid ? 'border-emerald-400' : 'border-slate-300 focus:border-blue-500'
                }`}
              />
            </div>

            {/* Tipo de Sociedad */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Tipo de Sociedad</label>
              <select
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden font-medium cursor-pointer"
              >
                <option value="spa">Sociedad por Acciones (SpA)</option>
                <option value="srl">Sociedad de Resp. Ltda. (SRL)</option>
                <option value="eirl">Empresa Individual (EIRL)</option>
                <option value="sa">Sociedad Anónima (S.A.)</option>
                <option value="persona_natural">Persona Natural con Giro 1ª Categoría</option>
                <option value="sin_iniciar">Sin Inicio de Actividades ante el SII</option>
              </select>
            </div>

            {/* Tramo de Ventas */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Tramo de Ventas (Últimos 12 Meses)</label>
              <select
                value={salesBracket}
                onChange={(e) => setSalesBracket(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden font-medium cursor-pointer"
              >
                <option value="sin_ventas">Sin Ventas ($0)</option>
                <option value="menor_60m">Menor a $60.000.000 CLP</option>
                <option value="micro_200_a_2400uf">Microempresa (200 a 2.400 UF)</option>
                <option value="pequena_2400_a_25000uf">Pequeña Empresa (2.400 a 25.000 UF)</option>
                <option value="mediana_25000_a_100000uf">Mediana Empresa (25.000 a 100.000 UF)</option>
                <option value="grande_mayor_100000uf">Gran Empresa (&gt; 100.000 UF)</option>
              </select>
            </div>

            {/* Sector */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Sector Económico</label>
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Ej: Software, Biotecnología, Agroalimentos, Minería"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* Región */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Región de Ejecución</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Ej: Región de Valparaíso, Metropolitana, Biobío"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Liderazgo Femenino */}
          <div className="p-3.5 rounded-2xl bg-pink-50/50 border border-pink-200 space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={isFemaleLed}
                onChange={(e) => setIsFemaleLed(e.target.checked)}
                className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 border-slate-300"
              />
              <span>Empresa liderada por mujeres (Bono de Género CORFO / SERCOTEC)</span>
            </label>
            {isFemaleLed && (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-slate-600 text-[11px]">Porcentaje accionario o de participación femenina:</span>
                <input
                  type="number"
                  min="51"
                  max="100"
                  value={femaleEquityPct || 100}
                  onChange={(e) => setFemaleEquityPct(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded-lg border border-pink-300 text-slate-900 font-bold text-center"
                />
                <span className="text-slate-600 text-[11px]">%</span>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECCIÓN D: DATOS DEL REPRESENTANTE LEGAL */}
        {/* ========================================================================= */}
        <div id="legal-rep" className="scroll-mt-28 p-6 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Representante Legal
              </h3>
              <p className="text-[11px] text-slate-500">
                Persona natural facultada con poder notarial para firmar convenios y recibir subsidios estatales
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Nombre Representante */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Nombre Completo</label>
              <input
                type="text"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                placeholder="Ej: Carolina Andrea Sepúlveda Ríos"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            {/* RUT Representante */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700">RUT Personal</label>
                {representativeRut && (
                  <span className={`text-[10px] font-bold ${isRepRutValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isRepRutValid ? '✓ Válido Módulo 11' : '⚠ RUT inválido'}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={representativeRut}
                onChange={(e) => setRepresentativeRut(formatRutInput(e.target.value))}
                placeholder="15.123.456-7"
                className={`w-full px-3.5 py-2 rounded-xl bg-slate-50 border text-slate-900 font-mono font-semibold focus:bg-white focus:outline-hidden ${
                  representativeRut && isRepRutValid ? 'border-emerald-400' : 'border-slate-300 focus:border-blue-500'
                }`}
              />
            </div>

            {/* Correo Electrónico */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Correo Electrónico de Contacto</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={representativeEmail}
                  onChange={(e) => setRepresentativeEmail(e.target.value)}
                  placeholder="contacto@miempresa.cl"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Teléfono */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 block">Teléfono / WhatsApp</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  value={representativePhone}
                  onChange={(e) => setRepresentativePhone(formatPhoneCLInput(e.target.value))}
                  placeholder="+56 9 8765 4321"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-hidden font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5. Save Button Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div>
            {savedSuccess ? (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Guardado{autoSavedAt ? ` a las ${autoSavedAt}` : ''}</span>
              </span>
            ) : autoSavedAt ? (
              <span className="text-xs text-slate-500 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" />Cambios guardados a las {autoSavedAt}</span>
            ) : (
              <span className="text-xs text-slate-500">
                Tus cambios se guardan solos mientras escribes.
              </span>
            )}
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Guardar ahora</span>
          </button>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* SECCIÓN E: MI PLAN Y FACTURACIÓN (Requirement C.9) */}
      {/* ========================================================================= */}
      <div id="mi-plan" className="scroll-mt-24 p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Mi Plan y Suscripción</span>
                {hasActivePlan && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Trimestral Activo
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-500">
                Información de vigencia, cupos de postulación e historial de pagos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRenewPlan}
            disabled={renewingPlan}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Sparkles className="w-4 h-4" />
            <span>{hasActivePlan ? 'Renovar Plan Trimestral' : 'Activar Plan Trimestral'}</span>
          </button>
        </div>

        {/* Plan Status Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Card 1: Plan Actual */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Plan Actual</span>
            <p className="text-base font-black text-slate-900">
              {hasActivePlan ? (provisional ? 'Acceso temporal' : 'Plan Trimestral') : 'Sin plan'}
            </p>
            <p className="text-[11px] text-slate-500">
              {hasActivePlan ? (provisional ? 'Activa tu plan para seguir usando las herramientas' : 'Acceso completo a las herramientas') : 'Diagnóstico, monitor y carpeta tributaria'}
            </p>
          </div>

          {/* Card 2: Vigencia */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Vigencia</span>
            <p className="text-base font-black text-slate-900">
              {hasActivePlan ? formattedExpiry : 'Sin plan activo'}
            </p>
            <p className="text-[11px] text-slate-500">
              {hasActivePlan && formattedStart ? `Inicio: ${formattedStart}` : 'Vencimiento no aplicable'}
            </p>
          </div>

          {/* Card 3: Días Restantes */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Días Restantes</span>
            <p className={`text-base font-black ${
              hasActivePlan ? 'text-emerald-700 font-mono' : 'text-slate-400 font-mono'
            }`}>
              {hasActivePlan ? `${daysLeft} días` : '0 días'}
            </p>
            <p className="text-[11px] text-slate-500">
              {isExpiringSoon ? '⚠️ Próximo a vencer' : hasActivePlan ? 'Plan vigente' : 'Sin días disponibles'}
            </p>
          </div>

          {/* Card 4: Postulaciones Activas */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Postulaciones Activas</span>
            <p className="text-base font-black text-blue-700 font-mono">
              {activeFundIds.length} de 3 usadas
            </p>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${(Math.min(3, activeFundIds.length) / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {isFirstPurchase && (
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-700">
              Precio de tu primer trimestre: <strong className="text-slate-900">${price.toLocaleString('es-CL')}</strong> (IVA incluido)
              {referralCode && typeof referralDiscountPct === 'number' ? <>, {referralDiscountPct}% de descuento con el código <strong>{referralCode}</strong></> : <>, 50% de descuento de primera compra</>}.
            </p>
            <ReferralCodeField tone="light" />
          </div>
        )}

        {/* Historial de Pagos (Requirement C.9) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Historial de Pagos</span>
            </h4>
            <span className="text-[11px] text-slate-400">
              {paymentHistory.length} transacciones registradas
            </span>
          </div>

          {loadingHistory ? (
            <div className="p-6 text-center text-xs text-slate-400">
              Cargando historial de pagos...
            </div>
          ) : paymentHistory.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1 text-xs text-slate-500">
              <p className="font-semibold text-slate-700">No registras pagos previos</p>
              <p className="text-[11px]">
                Cuando adquieras o renueves el Plan Trimestral, tus comprobantes de pago aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3.5">Fecha</th>
                    <th className="py-2.5 px-3.5">Operación MP</th>
                    <th className="py-2.5 px-3.5">Monto</th>
                    <th className="py-2.5 px-3.5">Estado</th>
                    <th className="py-2.5 px-3.5">Medio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentHistory.map((pay) => {
                    const formattedDate = pay.approvedAt 
                      ? new Date(pay.approvedAt).toLocaleDateString('es-CL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Fecha no registrada';

                    const isApproved = pay.status === 'approved';

                    return (
                      <tr key={pay.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3.5 text-slate-700 font-mono">
                          {formattedDate}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-slate-600 font-semibold">
                          #{pay.paymentId}
                        </td>
                        <td className="py-2.5 px-3.5 font-bold text-slate-900 font-mono">
                          ${pay.amount.toLocaleString('es-CL')} {pay.currencyId}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isApproved 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {isApproved ? '✓ Aprobado' : pay.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-500 uppercase font-mono text-[11px]">
                          {pay.paymentMethodId || 'Pago en línea'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
