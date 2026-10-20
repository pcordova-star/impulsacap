import React, { useState, Suspense } from 'react';
import { ChileanFund } from '../types/funds';
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
  onRefreshConvocatorias: () => Promise<void>;
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onSelectFundToViewDocs: (fund: ChileanFund) => void;
  onOpenNewApplicationModal: () => void;
  initialTab?: 'programs' | 'calls';
}

export const SearchFundsView: React.FC<SearchFundsViewProps> = ({
  funds,
  convocatorias,
  syncMeta,
  isStale,
  loading,
  onRefreshConvocatorias,
  onSelectFundToFormulate,
  onSelectFundToViewDocs,
  onOpenNewApplicationModal,
  initialTab = 'programs'
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'programs' | 'calls'>(initialTab);

  const activeCallsCount = convocatorias.filter(c => c.vigente).length;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Top Tab Bar: Programas vs Convocatorias Abiertas (Requirement 1) */}
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
      {activeSubTab === 'programs' && (
        <FundCatalog
          funds={funds}
          convocatorias={convocatorias}
          onSelectFundToFormulate={onSelectFundToFormulate}
          onSelectFundToViewDocs={onSelectFundToViewDocs}
        />
      )}

      {activeSubTab === 'calls' && (
        <ConvocatoriasView
          convocatorias={convocatorias}
          syncMeta={syncMeta}
          isStale={isStale}
          loading={loading}
          onRefresh={onRefreshConvocatorias}
          onSelectFundToFormulate={onSelectFundToFormulate}
          onOpenNewApplicationModal={onOpenNewApplicationModal}
        />
      )}
    </div>
  );
};
