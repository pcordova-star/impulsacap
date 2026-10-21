import React, { useState } from 'react';
import { ChileanFund, Agency, getFundVisibleStatus } from '../types/funds';
import { Convocatoria } from '../types/convocatoria';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { 
  Search, 
  Filter, 
  Sparkles, 
  ArrowRight, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  FileText,
  PieChart,
  ShieldCheck,
  CalendarPlus
} from 'lucide-react';
import { getGoogleCalendarUrl } from '../utils/calendarExport';

interface FundCatalogProps {
  funds?: ChileanFund[];
  convocatorias?: Convocatoria[];
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onSelectFundToViewDocs: (fund: ChileanFund) => void;
}

export const FundCatalog: React.FC<FundCatalogProps> = ({
  funds = CHILEAN_FUNDS,
  convocatorias = [],
  onSelectFundToFormulate,
  onSelectFundToViewDocs
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgency, setSelectedAgency] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [expandedFundId, setExpandedFundId] = useState<string | null>('corfo_semilla_inicia');

  const agencies: { id: string; label: string }[] = [
    { id: 'ALL', label: 'Todos los Organismos' },
    { id: 'CORFO', label: 'CORFO' },
    { id: 'SERCOTEC', label: 'SERCOTEC' },
    { id: 'START-UP CHILE', label: 'Start-Up Chile' },
    { id: 'ANID', label: 'ANID' },
    { id: 'FIA', label: 'FIA' },
  ];

  const categories = [
    'ALL',
    'Capital Semilla',
    'I+D+i y Tecnológico',
    'Crecimiento y Escalamiento',
    'Innovación Agro / Sostenible'
  ];

  const filteredFunds = funds.filter(fund => {
    const matchesSearch = fund.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fund.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fund.summary.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAgency = selectedAgency === 'ALL' || fund.agency === selectedAgency;
    const matchesCategory = selectedCategory === 'ALL' || fund.category === selectedCategory;

    return matchesSearch && matchesAgency && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/70 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold tracking-wider">
              PROGRAMAS DEL ESTADO
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Catálogo de Fondos Concursables Chile 2026
            </h1>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Bases administrativas, topes de subsidio, cuentas presupuestarias aprobadas y criterios oficiales de evaluación para postular a fondos públicos.
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, palabra clave o sector (ej: software, I+D, ventas, agro)..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>

          {/* Agency Filter on Mobile: Native Select; on Desktop: Pills */}
          <div className="sm:hidden w-full">
            <select
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-hidden"
            >
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.label}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {agencies.map((agency) => (
              <button
                key={agency.id}
                onClick={() => setSelectedAgency(agency.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedAgency === agency.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {agency.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category: Native select on mobile, Pills on desktop */}
        <div className="sm:hidden w-full">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-semibold focus:outline-hidden"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'Todas las Categorías' : cat}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium text-[11px]">Categoría:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {cat === 'ALL' ? 'Todas' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Funds Accordion / Cards List */}
      <div className="space-y-3.5">
        {filteredFunds.map((fund) => {
          const isExpanded = expandedFundId === fund.id;
          const matchingCall = convocatorias.find(c => 
            c.vigente && (c.fundId === fund.id || (c.programa && fund.name.toLowerCase().includes(c.programa.toLowerCase())))
          );
          const hasOpenCall = Boolean(matchingCall) || fund.callStatus === 'abierta';

          return (
            <div
              key={fund.id}
              className={`rounded-3xl border transition-all ${
                isExpanded
                  ? 'bg-white border-blue-300 shadow-md ring-2 ring-blue-500/10'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              {/* Header Bar */}
              <div
                onClick={() => setExpandedFundId(isExpanded ? null : fund.id)}
                className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-500">{fund.agency}</span>
                    <span className="text-xs font-bold text-blue-700">{fund.maxCoFinancePct}%</span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono">
                        {fund.agency}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {fund.category}
                      </span>

                      {/* Open Call Indicator (Requirement 1) */}
                      {hasOpenCall ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Convocatoria abierta{typeof matchingCall?.diasRestantes === 'number' && matchingCall.diasRestantes >= 0
                            ? (matchingCall.diasRestantes === 0 ? ' (cierra hoy)' : ` (${matchingCall.diasRestantes} ${matchingCall.diasRestantes === 1 ? 'día' : 'días'})`)
                            : ''}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                          ⚪ Sin convocatoria abierta (referencial)
                        </span>
                      )}

                      {fund.femaleBonusPct && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200">
                          +{fund.femaleBonusPct}% Bono Mujer
                        </span>
                      )}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-blue-700">
                      {fund.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                      {fund.summary}
                    </p>
                  </div>
                </div>

                {/* Right Quick Metrics */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-2 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-bold text-blue-700 sm:text-base">
                      {fund.subsidyFormatted}
                    </p>
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      Hasta {fund.maxCoFinancePct}% cofinanciamiento
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFundToFormulate(fund);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                      <span>Postular</span>
                    </button>
                    <div className="p-1 rounded-lg text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Detailed Content */}
              {isExpanded && (
                <div className="px-5 pb-6 pt-2 border-t border-slate-100 space-y-6 animate-fade-in text-xs">
                  {/* Basic Specifications */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requisito de Ventas</p>
                      <p className="text-xs text-slate-800 font-semibold mt-1">{fund.salesRequirement}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nivel de Madurez (TRL)</p>
                      <p className="text-xs text-slate-800 font-semibold mt-1">{fund.trlRange}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Calendario Convocatoria</p>
                      <p className="text-xs text-slate-800 font-semibold mt-1">{fund.callSchedule}</p>
                    </div>
                  </div>

                  {/* Criteria Grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2.5">
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                      Criterios y Ponderaciones de Evaluación
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {fund.evaluationCriteria.map((crit, cIdx) => (
                        <div key={cIdx} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-slate-900">{crit.name}</span>
                            <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                              {crit.weight}%
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{crit.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Eligible & Ineligible Expenses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2 mb-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Gastos Financiables (Elegibles)
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {fund.eligibleExpenses.map((exp, eIdx) => (
                          <li key={eIdx} className="flex items-start gap-2">
                            <span className="text-emerald-600 font-bold">•</span>
                            <span>{exp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-2 mb-2.5">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Gastos Excluidos (No Elegibles)
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {fund.ineligibleExpenses.map((exp, eIdx) => (
                          <li key={eIdx} className="flex items-start gap-2">
                            <span className="text-rose-600 font-bold">•</span>
                            <span>{exp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Presupuesto por Cuentas CORFO / SERCOTEC */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5 mb-2.5">
                      <PieChart className="w-4 h-4 text-indigo-600" />
                      Estructura de Cuentas Presupuestarias
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {fund.corfoAccountsBudget.map((acc, aIdx) => (
                        <div key={aIdx} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="text-xs font-bold text-slate-900">{acc.account}</p>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{acc.description}</p>
                          {acc.maxPct && (
                            <p className="text-[10px] font-bold text-blue-700 mt-1">Tope máx: {acc.maxPct}%</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                    <p className="text-xs text-slate-500">
                      Formula tu proyecto con IA y genera el expediente completo para e-CORFO o SERCOTEC.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <a
                        href={getGoogleCalendarUrl(fund)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
                        title="Agregar fecha a Google Calendar"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-amber-600" />
                        <span className="hidden sm:inline">Calendario</span>
                      </a>
                      <button
                        onClick={() => onSelectFundToViewDocs(fund)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Documentos y cartas
                      </button>
                      <button
                        onClick={() => onSelectFundToFormulate(fund)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Comenzar Postulación</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
