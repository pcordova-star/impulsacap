import React, { useState } from 'react';
import { ChileanFund, Agency, getFundVisibleStatus } from '../types/funds';
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
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onSelectFundToViewDocs: (fund: ChileanFund) => void;
}

export const FundCatalog: React.FC<FundCatalogProps> = ({
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

  const filteredFunds = CHILEAN_FUNDS.filter(fund => {
    const matchesSearch = fund.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fund.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fund.summary.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAgency = selectedAgency === 'ALL' || fund.agency === selectedAgency;
    const matchesCategory = selectedCategory === 'ALL' || fund.category === selectedCategory;

    return matchesSearch && matchesAgency && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Catálogo Oficial de Fondos Concursables Chile 2026
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Bases administrativas, topes presupuestarios, criterios de evaluación y gastos elegibles actualizados.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, palabra clave o sector (ej: software, I+D, ventas, agro)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none placeholder:text-slate-500 placeholder:italic"
            />
          </div>

          {/* Agency Filter on Mobile: Native Select; on Desktop: Pills */}
          <div className="sm:hidden w-full">
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Organismo:
            </label>
            <select
              value={selectedAgency}
              onChange={(e) => setSelectedAgency(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-cyan-500 focus:outline-none"
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
                className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedAgency === agency.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {agency.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category: Native select on mobile, Pills on desktop */}
        <div className="sm:hidden w-full pt-1">
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Categoría:
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-cyan-500 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'Todas las Categorías' : cat}
              </option>
            ))}
          </select>
        </div>

        <div className="hidden sm:flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 border-t border-slate-800/60 text-xs">
          <span className="text-slate-500 font-medium">Categoría:</span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat === 'ALL' ? 'Todas' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Funds Accordion / Cards List */}
      <div className="space-y-4">
        {filteredFunds.map((fund) => {
          const isExpanded = expandedFundId === fund.id;

          return (
            <div
              key={fund.id}
              className={`rounded-2xl border transition-all ${
                isExpanded
                  ? 'bg-slate-900 border-blue-600/40 shadow-xl'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Header Bar */}
              <div
                onClick={() => setExpandedFundId(isExpanded ? null : fund.id)}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] font-black uppercase text-slate-400">{fund.agency}</span>
                    <span className="text-xs font-bold text-cyan-400">{fund.maxCoFinancePct}%</span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {fund.agency}
                      </span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {fund.category}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        getFundVisibleStatus(fund) === 'Abierta'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : getFundVisibleStatus(fund) === 'Cerrada'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        ● {getFundVisibleStatus(fund)}
                      </span>
                      {fund.femaleBonusPct && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20">
                          +{fund.femaleBonusPct}% Bono Mujer
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-300">
                      {fund.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {fund.summary}
                    </p>
                  </div>
                </div>

                {/* Right Quick Metrics */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-1">
                  <div className="text-right">
                    <p className="text-xs font-bold text-cyan-400 sm:text-base">
                      {fund.subsidyFormatted}
                    </p>
                    <p className="text-[11px] text-emerald-400 font-medium">
                      Hasta {fund.maxCoFinancePct}% cofinanciamiento
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectFundToFormulate(fund);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md transition-all"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                      <span>Formular</span>
                    </button>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Detailed Content */}
              {isExpanded && (
                <div className="px-5 pb-6 pt-2 border-t border-slate-800/80 space-y-6 animate-fade-in text-sm">
                  {/* Basic Specifications */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Requisito de Ventas</p>
                      <p className="text-xs text-slate-200 mt-1">{fund.salesRequirement}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nivel de Madurez (TRL)</p>
                      <p className="text-xs text-slate-200 mt-1">{fund.trlRange}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Calendario Convocatoria</p>
                      <p className="text-xs text-slate-200 mt-1">{fund.callSchedule}</p>
                    </div>
                  </div>

                  {/* Criteria Grid */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
                      <ShieldCheck className="w-4 h-4 text-cyan-400" />
                      Criterios y Ponderaciones Oficiales de Evaluación
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {fund.evaluationCriteria.map((crit, cIdx) => (
                        <div key={cIdx} className="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-white">{crit.name}</span>
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              {crit.weight}%
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 leading-relaxed">{crit.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Eligible & Ineligible Expenses */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-emerald-950/10 border border-emerald-900/30">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2 mb-3">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Gastos Financiables (Elegibles)
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {fund.eligibleExpenses.map((exp, eIdx) => (
                          <li key={eIdx} className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{exp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-rose-950/10 border border-rose-900/30">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2 mb-3">
                        <XCircle className="w-4 h-4 text-rose-400" />
                        Gastos Excluidos (No Elegibles)
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-300">
                        {fund.ineligibleExpenses.map((exp, eIdx) => (
                          <li key={eIdx} className="flex items-start gap-2">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>{exp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Presupuesto por Cuentas CORFO / SERCOTEC */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
                      <PieChart className="w-4 h-4 text-indigo-400" />
                      Estructura de Cuentas Presupuestarias Aprobadas
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {fund.corfoAccountsBudget.map((acc, aIdx) => (
                        <div key={aIdx} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                          <p className="text-xs font-bold text-white">{acc.account}</p>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{acc.description}</p>
                          {acc.maxPct && (
                            <p className="text-[10px] font-semibold text-cyan-400 mt-1">Tope máx: {acc.maxPct}%</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
                    <p className="text-xs text-slate-400">
                      ¿Listo para postular a este fondo? Nuestro redactor IA redactará las 5 secciones oficiales con terminología de evaluación CORFO/SERCOTEC.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <a
                        href={getGoogleCalendarUrl(fund)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-all"
                        title="Agregar fecha de cierre a Google Calendar"
                      >
                        <CalendarPlus className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Calendario</span>
                      </a>
                      <button
                        onClick={() => onSelectFundToViewDocs(fund)}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Ver Documentos & F29
                      </button>
                      <button
                        onClick={() => onSelectFundToFormulate(fund)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-cyan-200" />
                        <span>Formular Proyecto Ahora</span>
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
