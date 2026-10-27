import React, { useEffect, useState } from 'react';
import { FundUseFinder } from './FundUseFinder';
import { ChileanFund, CompanyUser, CompanyProfile } from '../types/funds';
import { Convocatoria } from '../types/convocatoria';
import { FundCatalog } from './FundCatalog';
import { ConvocatoriasView } from './ConvocatoriasView';
import { Award, Clock, Sparkles, RefreshCw } from 'lucide-react';

interface SearchFundsViewProps {
  funds: ChileanFund[];
  convocatorias: Convocatoria[];
  syncMeta: any;
  isStale: boolean;
  loading: boolean;
  currentUser?: CompanyUser | null;
  onRefreshConvocatorias: () => Promise<void>;
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onSelectFundToViewDocs: (fund: ChileanFund) => void;
  onOpenNewApplicationModal: () => void;
  onQualifyCall?: (conv: Convocatoria) => void;
  onPostularCall?: (conv: Convocatoria) => void;
  onOpenAuthModal?: (mode?: 'login' | 'register') => void;
  initialTab?: 'programs' | 'calls';
  /** Elegir un concurso para una nueva postulación */
  pickMode?: boolean;
  freeSlots?: number;
  onCancelPick?: () => void;
  profile?: CompanyProfile | null;
}

export const SearchFundsView: React.FC<SearchFundsViewProps> = ({
  funds,
  convocatorias,
  syncMeta,
  isStale,
  loading,
  currentUser,
  onRefreshConvocatorias,
  onSelectFundToFormulate,
  onSelectFundToViewDocs,
  onOpenNewApplicationModal,
  onQualifyCall,
  onPostularCall,
  onOpenAuthModal,
  initialTab = 'programs',
  pickMode = false,
  freeSlots = 3,
  onCancelPick,
  profile
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'programs' | 'calls'>(initialTab);
  // Si se llega desde otro botón ("Nueva postulación", "Ver convocatorias"), mostrar la pestaña pedida
  useEffect(() => { setActiveSubTab(initialTab); }, [initialTab]);

  const activeCallsCount = convocatorias.filter(c => c.vigente).length;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {pickMode && (
        <div className="rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-cyan-700 text-white p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black">Elige el concurso para tu nueva postulación</p>
            <p className="text-xs text-blue-100">
              Elige un programa del catálogo o una convocatoria abierta y presiona <strong>"Postular"</strong>. {freeSlots > 0 ? `Te quedan ${freeSlots} ${freeSlots === 1 ? 'cupo' : 'cupos'} de 3.` : 'Usaste tus 3 cupos: archiva una postulación para empezar otra.'}
            </p>
          </div>
          {onCancelPick && (
            <button type="button" onClick={onCancelPick} className="shrink-0 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold cursor-pointer">
              Volver a Mis postulaciones
            </button>
          )}
        </div>
      )}
      {/* Top Tab Bar: Programas vs Convocatorias Abiertas (Requirement 1 & 2) */}
      <div className="flex items-center justify-center">
        <div className="inline-flex p-1.5 rounded-2xl bg-slate-100 border border-slate-200 shadow-xs">
          <button
            onClick={() => setActiveSubTab('programs')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'programs'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4 text-blue-600" />
            <span>Programas (Catálogo)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('calls')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'calls'
                ? 'bg-white text-emerald-800 shadow-sm border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Convocatorias abiertas (Monitor CORFO)</span>
            {activeCallsCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                {activeCallsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Subview Content */}
      {activeSubTab === 'programs' && !pickMode && (
        <FundUseFinder compact funds={funds} pickLabel="Postular a este fondo" onPickFund={onSelectFundToFormulate} />
      )}

      {activeSubTab === 'programs' && (
        <FundCatalog
          funds={funds}
          convocatorias={convocatorias}
          onSelectFundToFormulate={onSelectFundToFormulate}
          onSelectFundToViewDocs={onSelectFundToViewDocs}
          profile={currentUser ? profile : null}
        />
      )}

      {activeSubTab === 'calls' && (
        <ConvocatoriasView
          convocatorias={convocatorias}
          syncMeta={syncMeta}
          isStale={isStale}
          loading={loading}
          currentUser={currentUser}
          onRefresh={onRefreshConvocatorias}
          onSelectFundToFormulate={onSelectFundToFormulate}
          onOpenNewApplicationModal={onOpenNewApplicationModal}
          onQualifyCall={onQualifyCall}
          onPostularCall={onPostularCall}
          onOpenAuthModal={onOpenAuthModal}
          userRegion={currentUser ? profile?.region : undefined}
        />
      )}
    </div>
  );
};
