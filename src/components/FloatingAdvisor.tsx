import React from 'react';
import { CompanyProfile, ChileanFund, CompanyUser } from '../types/funds';
import { ExpertChat } from './ExpertChat';
import { Sparkles, X, MessageSquareCode } from 'lucide-react';
import { usePlan } from '../hooks/usePlan';

interface FloatingAdvisorProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  profile: CompanyProfile;
  currentFund: ChileanFund | null;
  currentUser: CompanyUser | null;
  onOpenAuthModal: (mode?: 'login' | 'register') => void;
}

export const FloatingAdvisor: React.FC<FloatingAdvisorProps> = ({
  isOpen,
  onToggle,
  onClose,
  profile,
  currentFund,
  currentUser,
  onOpenAuthModal
}) => {
  const { hasActivePlan } = usePlan();

  return (
    <>
      {/* Floating Action Button (Requirement 1) - Visible across all screens */}
      {!isOpen && (
        <button
          onClick={onToggle}
          title="Consultar al Asesor Especialista en Fondos"
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold text-xs shadow-xl shadow-blue-600/30 active:scale-95 transition-all cursor-pointer group border border-white/20"
        >
          <div className="relative">
            <Sparkles className="w-4 h-4 text-amber-300 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <span className="tracking-tight">Asesor IA</span>
          {hasActivePlan && (
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              PRO
            </span>
          )}
        </button>
      )}

      {/* Slide-out Drawer / Floating Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-4 bg-slate-950/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full sm:max-w-lg h-[85vh] sm:h-[650px] bg-white rounded-t-3xl sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-zoom-in">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Asesor Inteligente ImpulsaCap</h3>
                  <p className="text-[11px] text-blue-100/80">
                    Consultoría experta en bases administrativas y rendición
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              <ExpertChat
                profile={profile}
                currentFund={currentFund}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
