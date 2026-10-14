import React from 'react';
import { ShieldCheck, Lock, ArrowRight, Sparkles, FileText, CheckCircle2, UserPlus, ArrowLeft } from 'lucide-react';
import { ImpulsaCapLogo } from './ImpulsaCapLogo';

interface AuthGateViewProps {
  onOpenAuthModal: (mode: 'login' | 'register') => void;
  onNavigateHome: () => void;
  title?: string;
  description?: string;
}

export const AuthGateView: React.FC<AuthGateViewProps> = ({
  onOpenAuthModal,
  onNavigateHome,
  title = "Bóveda Privada de Postulación",
  description = "Para proteger la información tributaria, datos del SII y formulación de tu empresa, el acceso a la Hoja de Ruta y Dashboard está restringido a usuarios autenticados."
}) => {
  return (
    <div className="max-w-3xl mx-auto py-10 px-4 animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden">
        {/* Top Accent Gradient Bar */}
        <div className="h-2.5 bg-gradient-to-r from-blue-600 via-teal-500 to-emerald-500" />
        
        <div className="p-6 sm:p-10 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 shadow-sm mx-auto">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Privacidad & Seguridad Garantizada</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {description}
            </p>
          </div>

          {/* Security Features Checklist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto text-left pt-2">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">Carpeta Tributaria F29 Segura</p>
                <p className="text-[11px] text-slate-500">Tus balances y ventas SII nunca se comparten públicamente.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">Hoja de Ruta Personalizada</p>
                <p className="text-[11px] text-slate-500">Paso a paso adaptado según el fondo de tu elección.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">Contador de Plazos Corfo / Sercotec</p>
                <p className="text-[11px] text-slate-500">Alertas en tiempo real para no quedar fuera de plazo.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">Dossier y Formulación Técnica</p>
                <p className="text-[11px] text-slate-500">Guarda borradores y exporta en formato oficial.</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => onOpenAuthModal('login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Iniciar Sesión con mi Empresa</span>
            </button>

            <button
              onClick={() => onOpenAuthModal('register')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Registrar Nueva Empresa</span>
            </button>
          </div>

          <div className="pt-2">
            <button
              onClick={onNavigateHome}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 font-semibold cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la Calculadora y Matcher de Fondos Públicos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
