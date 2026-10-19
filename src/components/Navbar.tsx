import React from 'react';
import { 
  Award, 
  FileText, 
  ShieldAlert,
  ShieldCheck, 
  MessageSquareCode, 
  Sparkles, 
  Building2,
  Zap,
  Lock,
  LogOut,
  UserCheck,
  Clock,
  ArrowLeft,
  UserPlus
} from 'lucide-react';

import { ImpulsaCapLogo } from './ImpulsaCapLogo';
import { CompanyUser } from '../types/funds';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  companyName: string;
  currentUser?: CompanyUser | null;
  onOpenProfile: () => void;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  companyName,
  currentUser,
  onOpenProfile,
  onOpenAuthModal,
  onLogout
}) => {
  // Mobile bottom tabs
  const mobileNavTabs = currentUser ? [
    { id: 'my-application', label: 'Mi Postulación', icon: Clock },
    { id: 'catalog', label: 'Catálogo', icon: Award },
    { id: 'formulator', label: 'Formulador', icon: Sparkles },
    { id: 'documents', label: 'Carpeta SII', icon: FileText },
    { id: 'auditor', label: 'Auditor', icon: ShieldCheck },
  ] : [
    { id: 'diagnostic', label: 'Diagnóstico', icon: Zap },
    { id: 'catalog', label: 'Catálogo', icon: Award },
    { id: 'advisor', label: 'Asesor', icon: MessageSquareCode },
  ];

  return (
    <>
      {/* Top App Bar - Clean Light Professional SaaS Style */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo ImpulsaCap */}
            <div 
              className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform" 
              onClick={() => setActiveTab('diagnostic')}
            >
              <ImpulsaCapLogo size={34} withText withTagline={false} />
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1.5 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('diagnostic')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'diagnostic'
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Calculadora & Matcher
              </button>
              <button
                onClick={() => setActiveTab('catalog')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  activeTab === 'catalog'
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Catálogo de Fondos
              </button>

              {currentUser && (
                <>
                  <button
                    onClick={() => setActiveTab('my-application')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'my-application'
                        ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Hoja de Ruta 2026
                  </button>
                  <button
                    onClick={() => setActiveTab('formulator')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'formulator'
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Formulador IA
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'documents'
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Carpeta SII
                  </button>
                  <button
                    onClick={() => setActiveTab('auditor')}
                    className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                      activeTab === 'auditor'
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Auditor Ciego
                  </button>
                </>
              )}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              
              {/* Authenticated Company Badge or Login Button */}
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onOpenProfile}
                    title="Editar perfil y datos tributarios"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-emerald-300 hover:bg-emerald-50/50 text-xs text-slate-700 transition-all cursor-pointer group shadow-xs"
                  >
                    <div className="w-5 h-5 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                      {currentUser.companyName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold truncate max-w-[120px] sm:max-w-[160px] text-xs text-slate-900">
                      {currentUser.companyName}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </button>

                  <button
                    onClick={onLogout}
                    title="Cerrar sesión de la empresa"
                    className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>

                  {/* Return to Dashboard Button - STRICTLY ONLY IF LOGGED IN */}
                  {activeTab !== 'my-application' ? (
                    <button
                      onClick={() => setActiveTab('my-application')}
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                      title="Volver a la Hoja de Ruta y Dashboard principal"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Volver al Dashboard</span>
                    </button>
                  ) : (
                    <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Dashboard Activo</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Unauthenticated Guest Actions: NO "Volver al Dashboard" button! */
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenAuthModal('login')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Iniciar Sesión</span>
                  </button>

                  <button
                    onClick={() => onOpenAuthModal('register')}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold active:scale-95 transition-all cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Registrar Empresa</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </header>

      {/* FIXED MOBILE BOTTOM APP BAR - Clean Light Style */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className={`grid grid-cols-${mobileNavTabs.length} h-16 max-w-md mx-auto px-1`}>
          {mobileNavTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`relative flex flex-col items-center justify-center gap-1 w-full h-full transition-all active:scale-90 ${
                  isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {/* Active Indicator Top Line */}
                {isActive && (
                  <span className="absolute top-0 w-8 h-1 rounded-full bg-blue-600 shadow-xs" />
                )}

                <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-blue-50 text-blue-600' : ''}`}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />
                </div>
                <span className={`text-[10px] tracking-tight ${isActive ? 'text-blue-700 font-extrabold' : 'text-slate-500'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
