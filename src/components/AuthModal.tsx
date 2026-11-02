import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  Mail, 
  Building2, 
  User, 
  Phone, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';
import { CompanyUser } from '../types/funds';
import { validateRut, formatRutInput, rutStatus, formatPhoneCLInput } from '../utils/rutValidator';
import { auth, googleProvider, db } from '../firebase';
import { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { syncUserProfileToFirestore, syncCompanyToFirestore, seedCompanyIfMissing } from '../utils/firebaseSync';
import { getFirebaseAuthErrorMessage } from '../utils/authErrors';
import { setCurrentUser } from '../utils/storage';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: CompanyUser) => void;
  initialMode?: 'login' | 'register';
  customTitle?: string;
  initialMessage?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  initialMode = 'login',
  customTitle,
  initialMessage
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Aviso informativo de por qué se pide iniciar sesión (no es un error)
  const [infoMsg, setInfoMsg] = useState<string | null>(initialMessage || null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialMode) setMode(initialMode);
      setInfoMsg(initialMessage || null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen, initialMode, initialMessage]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regCompanyName, setRegCompanyName] = useState('');
  // Quién postula: cambia los campos, los ejemplos y el tipo con que se crea el perfil
  const [regAs, setRegAs] = useState<'spa' | 'persona_natural' | 'sin_iniciar'>('spa');
  const isPersonReg = regAs !== 'spa';
  const [regRut, setRegRut] = useState('');
  const [regRepName, setRegRepName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail.trim().toLowerCase(), loginPassword);
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
        console.warn('Could not read user profile doc:', err);
      }

      const companyUser: CompanyUser = {
        id: fbUser.uid,
        email: fbUser.email || loginEmail.trim().toLowerCase(),
        companyName,
        rut,
        representativeName: repName,
        phone,
        createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      setCurrentUser(companyUser);
      setSuccessMsg(`¡Bienvenido de vuelta, ${companyUser.companyName}!`);
      setTimeout(() => {
        onAuthSuccess(companyUser);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(getFirebaseAuthErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!acceptedTerms) {
      setErrorMsg('Para crear tu cuenta debes aceptar los Términos y Condiciones y la Política de Privacidad.');
      return;
    }

    const cleanRut = regRut?.trim() || '';
    if (cleanRut && !validateRut(cleanRut)) {
      setErrorMsg('El RUT no es válido: revisa los números y el dígito verificador.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, regEmail.trim().toLowerCase(), regPassword);
      const fbUser = cred.user;

      const cleanCompanyName = regCompanyName.trim() || '';
      const cleanRepName = regRepName.trim() || '';
      const cleanPhone = regPhone.trim() || '';

      const companyUser: CompanyUser = {
        id: fbUser.uid,
        email: fbUser.email || regEmail.trim().toLowerCase(),
        companyName: cleanCompanyName,
        rut: cleanRut,
        representativeName: cleanRepName,
        phone: cleanPhone,
        createdAt: fbUser.metadata.creationTime || new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };

      // Point 4: Save profile in Firestore at users/{uid} and companies/{id} respecting firestore.rules
      await syncUserProfileToFirestore(companyUser);
      await seedCompanyIfMissing({
        companyName: cleanCompanyName,
        rut: cleanRut,
        companyType: regAs,
        monthsActive: null,
        salesBracket: '',
        annualSalesCLP: null,
        sector: '',
        region: '',
        isFemaleLed: false,
        femaleEquityPct: 0,
        trlStage: '',
        innovationLevel: 'incremental',
        projectSummary: '',
        coreTech: '',
        customerValidationCount: 0
      }, fbUser.uid);

      setCurrentUser(companyUser);
      setSuccessMsg(isPersonReg ? `¡Listo, ${cleanCompanyName}! Tu cuenta quedó creada.` : `¡Empresa ${cleanCompanyName} registrada!`);
      setTimeout(() => {
        onAuthSuccess(companyUser);
        onClose();
      }, 600);
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        // Ya tiene cuenta: lo llevamos a iniciar sesión con su correo (sus datos siguen intactos)
        setLoginEmail(regEmail.trim().toLowerCase());
        setMode('login');
        setErrorMsg(null);
        setSuccessMsg('Ya tienes una cuenta con este correo. Inicia sesión con tu contraseña: tus datos siguen guardados.');
      } else {
        setErrorMsg(getFirebaseAuthErrorMessage(err));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const emailToReset = loginEmail.trim().toLowerCase();
    if (!emailToReset) {
      setErrorMsg('Por favor ingresa tu correo electrónico en el campo para enviarte el enlace de recuperación.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, emailToReset);
      setSuccessMsg('Se ha enviado un correo con instrucciones para restablecer tu contraseña. Revisa tu bandeja de entrada o spam.');
    } catch (err: any) {
      setErrorMsg(getFirebaseAuthErrorMessage(err));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsGoogleLoading(true);
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
      } catch (err) {
        console.warn('Could not read user profile doc on Google sign in:', err);
      }

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

      // Ensure user profile in Firestore exists
      await syncUserProfileToFirestore(companyUser);
      await seedCompanyIfMissing({
        companyName,
        rut,
        companyType: 'spa',
        monthsActive: null,
        salesBracket: '',
        annualSalesCLP: null,
        sector: '',
        region: '',
        isFemaleLed: false,
        femaleEquityPct: 0,
        trlStage: '',
        innovationLevel: 'incremental',
        projectSummary: '',
        coreTech: '',
        customerValidationCount: 0
      }, fbUser.uid);

      setCurrentUser(companyUser);
      setSuccessMsg(`¡Autenticado con Google exitosamente como ${companyUser.companyName}!`);
      setTimeout(() => {
        onAuthSuccess(companyUser);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMsg(getFirebaseAuthErrorMessage(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 p-5 sm:p-8 shadow-2xl space-y-5 my-2 sm:my-8">
        
        {/* Close Button */}
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            <span>Acceso Privado y Confidencial</span>
          </div>
          <h2 id="auth-modal-title" className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight pr-8">
            {customTitle || (mode === 'login' ? 'Iniciar sesión en ImpulsaCap' : 'Crear tu cuenta en ImpulsaCap')}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {mode === 'login' 
              ? 'Entra para ver tus postulaciones y los datos de tu empresa.'
              : 'Crea tu cuenta para guardar tu diagnóstico, tu carpeta tributaria y tus postulaciones.'}
          </p>
        </div>

        {/* Firebase Google Auth Button */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={isGoogleLoading || isSubmitting}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2.5 transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{isGoogleLoading ? 'Conectando con Google…' : 'Continuar con Google'}</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[10px] uppercase font-bold tracking-wider text-slate-400 absolute">
              o con tu correo
            </span>
          </div>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`py-2 rounded-lg transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Crear cuenta
          </button>
        </div>

        {/* Alert Feedback */}
        {infoMsg && !errorMsg && !successMsg && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2.5">
            <Info className="w-4 h-4 shrink-0 text-blue-600" />
            <span>{infoMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Mode: LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="auth-login-email" className="block text-xs font-semibold text-slate-700 mb-1">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  id="auth-login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ejemplo@tuempresa.cl"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="auth-login-password" className="text-xs font-semibold text-slate-700">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={isResettingPassword}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                >
                  {isResettingPassword ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                <input
                  id="auth-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-blue-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" />
              <span>{isSubmitting ? 'Entrando…' : 'Entrar'}</span>
            </button>
          </form>
        )}

        {/* Mode: REGISTER */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <fieldset>
              <legend className="block text-xs font-semibold text-slate-700 mb-1.5">¿Cómo vas a postular?</legend>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  ['spa', 'Con una empresa', 'SpA, EIRL, Ltda. u otra'],
                  ['persona_natural', 'Como persona', 'Con inicio de actividades'],
                  ['sin_iniciar', 'Solo tengo una idea', 'Sin inicio de actividades']
                ] as const).map(([v, t, d]) => (
                  <label key={v} className={`cursor-pointer rounded-xl border p-2.5 text-xs ${regAs === v ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 bg-white hover:bg-slate-50'}`}>
                    <input type="radio" name="reg-as" value={v} checked={regAs === v} onChange={() => setRegAs(v)} className="sr-only" />
                    <span className="block font-bold text-slate-900">{t}</span>
                    <span className="block text-slate-500">{d}</span>
                  </label>
                ))}
              </div>
              {regAs === 'sin_iniciar' && <p className="mt-1.5 text-[11px] text-slate-500">Puedes postular a varios fondos como persona; si ganas, te formalizas después. Usa tu RUT personal.</p>}
            </fieldset>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="auth-reg-name" className="block text-xs font-semibold text-slate-700 mb-1">
                  {isPersonReg ? 'Tu nombre o el de tu proyecto' : 'Nombre o razón social'}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="auth-reg-name"
                    type="text"
                    required
                    autoComplete={isPersonReg ? 'name' : 'organization'}
                    value={regCompanyName}
                    onChange={(e) => setRegCompanyName(e.target.value)}
                    placeholder={isPersonReg ? 'Ej: María Soto / Arreglos Costura Fina' : 'Ej: AgroTech Chile SpA'}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-reg-rut" className="block text-xs font-semibold text-slate-700 mb-1">
                  {isPersonReg ? 'Tu RUT' : 'RUT de la empresa'}
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="auth-reg-rut"
                    type="text"
                    required
                    aria-describedby="auth-reg-rut-status"
                    value={regRut}
                    onChange={(e) => setRegRut(formatRutInput(e.target.value))}
                    inputMode="text"
                    autoComplete="off"
                    placeholder={isPersonReg ? '12.345.678-5' : '77.654.321-0'}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-emerald-500 focus:outline-hidden font-mono"
                  />
                </div>
                {rutStatus(regRut) === 'invalido' && (
                  <p id="auth-reg-rut-status" role="alert" className="mt-1 text-[11px] text-rose-600">Revisa el RUT: el dígito verificador no corresponde.</p>
                )}
                {rutStatus(regRut) === 'valido' && (
                  <p id="auth-reg-rut-status" className="mt-1 text-[11px] text-emerald-700">RUT válido</p>
                )}
              </div>

              <div>
                <label htmlFor="auth-reg-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Correo electrónico (para entrar)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="auth-reg-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="tucorreo@gmail.com"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="auth-reg-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Contraseña (mín. 6 caracteres)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="auth-reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="auth-reg-rep" className="block text-xs font-semibold text-slate-700 mb-1">
                  {isPersonReg ? 'Nombre de contacto (opcional)' : 'Representante legal (opcional)'}
                </label>
                <input
                  id="auth-reg-rep"
                  type="text"
                  value={regRepName}
                  onChange={(e) => setRegRepName(e.target.value)}
                  placeholder="Ej: Javier Morales"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="auth-reg-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                  Teléfono / WhatsApp (+56, opcional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="auth-reg-phone"
                    type="tel"
                    autoComplete="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(formatPhoneCLInput(e.target.value))}
                    inputMode="tel"
                    placeholder="+56 9 1234 5678"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs placeholder:text-slate-400 placeholder:italic focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                required
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 shrink-0"
              />
              <span>
                Acepto los{' '}
                <a href="/terminos" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">Términos y Condiciones</a>
                {' '}y la{' '}
                <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">Política de Privacidad</a>
                {' '}de ImpulsaCap, y declaro ser mayor de 18 años.
              </span>
            </label>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Creando tu cuenta…' : 'Crear mi cuenta'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Security / Privacy Guarantee Footer */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-600 leading-relaxed">
            <strong className="text-slate-900">Tus datos solo los ves tú.</strong> Las reglas de la base de datos impiden que otro usuario acceda a tu empresa, tu carpeta tributaria o tus postulaciones. Si ingresas con Google, aceptas los{' '}
            <a href="/terminos" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">Términos y Condiciones</a>
            {' '}y la{' '}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">Política de Privacidad</a>.
          </div>
        </div>
      </div>
    </div>
  );
};
