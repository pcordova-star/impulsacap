import React from 'react';
import { 
  Award, 
  FileText, 
  ShieldCheck, 
  Sparkles, 
  Building2,
  Lock,
  LogOut,
  Clock,
  ArrowLeft,
  UserPlus,
  Compass,
  Layers,
  Search,
  MessageSquareCode
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
  onToggleAdvisor?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  companyName,
  currentUser,
  onOpenProfile,
  onOpenAuthModal,
  onLogout,
  onToggleAdvisor
}) => {
  // Mobile bottom tabs - Requirements 1 & 4
  const mobileNavTabs = currentUser ? [
    { id: 'my-applications', label: 'Mis postulaciones', icon: Layers },
    { id: 'search-funds', label: 'Buscar fondos', icon: Search },
    { id: 'my-company', label: 'Mi empresa', icon: Building2 },
    { id: 'advisor-button', label: 'Asesor', icon: Sparkles, action: onToggleAdvisor },
  ] : [
    { id: 'diagnostic', label: 'Inicio', icon: Sparkles },
    { id: 'search-funds', label: 'Buscar fondos', icon: Search },
    { id: 'login', label: 'Iniciar sesión', icon: Lock, action: () => onOpenAuthModal('login') },
  ];

  const isApplicationsTabActive = activeTab === 'my-applications' || activeTab === 'postulation' || activeTab === 'my-application';

  return (
    <>
      {/* Top App Bar - Clean Light Professional SaaS Style */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 text-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo ImpulsaCap */}
            <div 
              className="flex items-center gap-2 cursor-pointer active:scale-95 transition-transform" 
              onClick={() => setActiveTab(currentUser ? 'my-applications' : 'diagnostic')}
            >
              <ImpulsaCapLogo size={34} withText withTagline={false} />
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-2 text-xs font-semibold">
              {currentUser ? (
                /* Authenticated Menu: Exactly 3 options (Requirement 1) */
                <>
                  <button
                    onClick={() => setActiveTab('my-applications')}
                    className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      isApplicationsTabActive
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-blue-600" />
                    <span>Mis postulaciones</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('search-funds')}
                    className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'search-funds' || activeTab === 'catalog' || activeTab === 'convocatorias'
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Search className="w-4 h-4 text-emerald-600" />
                    <span>Buscar fondos</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('my-company')}
                    className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'my-company'
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    <span>Mi empresa</span>
                  </button>
                </>
              ) : (
                /* Unauthenticated Menu: Inicio, Buscar fondos (Requirement 5) */
                <>
                  <button
                    onClick={() => setActiveTab('diagnostic')}
                    className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'diagnostic'
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>Inicio</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('search-funds')}
                    className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeTab === 'search-funds' || activeTab === 'catalog' || activeTab === 'convocatorias'
                        ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Search className="w-4 h-4 text-emerald-600" />
                    <span>Buscar fondos</span>
                  </button>
                </>
              )}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('my-company')}
                    title="Ver perfil de la empresa y carpeta tributaria"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-emerald-300 hover:bg-emerald-50/50 text-xs text-slate-700 transition-all cursor-pointer group shadow-2xs"
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
                </div>
              ) : (
                /* Unauthenticated Actions (Requirement 5: Iniciar sesión y Registrarse) */
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onOpenAuthModal('login')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Iniciar sesión</span>
                  </button>

                  <button
                    onClick={() => onOpenAuthModal('register')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Registrarse</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      </header>

      {/* FIXED MOBILE BOTTOM APP BAR (Requirement 4) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className={`grid grid-cols-${mobileNavTabs.length} h-16 max-w-md mx-auto px-1`}>
          {mobileNavTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === 'my-applications' 
              ? isApplicationsTabActive 
              : activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.action) {
                    tab.action();
                  } else {
                    setActiveTab(tab.id);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className={`relative flex flex-col items-center justify-center gap-1 w-full h-full transition-all active:scale-90 ${
                  isActive ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
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
