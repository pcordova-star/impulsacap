import React, { useState, useMemo } from 'react';
import { Convocatoria, ConvocatoriasSyncMeta } from '../types/convocatoria';
import { ChileanFund } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Building2, 
  ChevronRight,
  Layers,
  RefreshCw,
  Globe
} from 'lucide-react';

interface ConvocatoriasViewProps {
  convocatorias: Convocatoria[];
  syncMeta: ConvocatoriasSyncMeta | null;
  isStale: boolean;
  loading: boolean;
  onRefresh: () => void;
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onOpenNewApplicationModal: () => void;
}

const REGIONES_CHILE = [
  'Todas las regiones',
  'Todo Chile',
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana',
  'O\'Higgins',
  'Maule',
  'Ñuble',
  'Biobío',
  'Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes'
];

export const ConvocatoriasView: React.FC<ConvocatoriasViewProps> = ({
  convocatorias,
  syncMeta,
  isStale,
  loading,
  onRefresh,
  onSelectFundToFormulate,
  onOpenNewApplicationModal
}) => {
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('Todas las regiones');
  const [selectedTipo, setSelectedTipo] = useState('todos');
  const [selectedCierre, setSelectedCierre] = useState('todos');

  // Filter convocatorias
  const filteredConvocatorias = useMemo(() => {
    return convocatorias.filter(c => {
      // Free text search
      const matchesSearch = 
        !search ||
        c.titulo.toLowerCase().includes(search.toLowerCase()) ||
        (c.resumen && c.resumen.toLowerCase().includes(search.toLowerCase())) ||
        (c.alcance && c.alcance.toLowerCase().includes(search.toLowerCase()));

      // Region filter
      let matchesRegion = true;
      if (selectedRegion !== 'Todas las regiones') {
        const alc = (c.alcance || '').toLowerCase();
        const reg = selectedRegion.toLowerCase();
        matchesRegion = alc.includes('todo chile') || alc.includes('nacional') || alc.includes(reg);
      }

      // Tipo / Necesidad filter
      let matchesTipo = true;
      if (selectedTipo === 'subsidios') {
        const nec = String(c.necesidad || '').toLowerCase();
        matchesTipo = nec.includes('subsidio') || nec.includes('co-financiamiento') || nec.includes('financiamiento');
      } else if (selectedTipo === 'creditos') {
        const nec = String(c.necesidad || '').toLowerCase();
        matchesTipo = nec.includes('credito') || nec.includes('garantia') || nec.includes('cobertura');
      } else if (selectedTipo === 'innovacion') {
        const nec = String(c.necesidad || '').toLowerCase();
        const tit = c.titulo.toLowerCase();
        matchesTipo = nec.includes('innova') || tit.includes('innova') || tit.includes('i+d');
      }

      // Cierre filter
      let matchesCierre = true;
      if (selectedCierre === '7dias') {
        matchesCierre = c.diasRestantes !== null && c.diasRestantes !== undefined && c.diasRestantes <= 7;
      } else if (selectedCierre === '15dias') {
        matchesCierre = c.diasRestantes !== null && c.diasRestantes !== undefined && c.diasRestantes <= 15;
      } else if (selectedCierre === 'permanente') {
        matchesCierre = c.permanente || !c.cierre;
      }

      return matchesSearch && matchesRegion && matchesTipo && matchesCierre;
    }).sort((a, b) => {
      // Sort: Open first, then by days remaining ascending
      if (a.vigente && !b.vigente) return -1;
      if (!a.vigente && b.vigente) return 1;

      const diasA = a.diasRestantes !== null && a.diasRestantes !== undefined ? a.diasRestantes : 9999;
      const diasB = b.diasRestantes !== null && b.diasRestantes !== undefined ? b.diasRestantes : 9999;
      return diasA - diasB;
    });
  }, [convocatorias, search, selectedRegion, selectedTipo, selectedCierre]);

  const handlePostular = (conv: Convocatoria) => {
    // If matched to a CHILEAN_FUND, formulate directly
    if (conv.fundId) {
      const fund = CHILEAN_FUNDS.find(f => f.id === conv.fundId);
      if (fund) {
        onSelectFundToFormulate(fund);
        return;
      }
    }
    // Else open New Application modal
    onOpenNewApplicationModal();
  };

  const formatSyncDate = (isoStr?: string | null) => {
    if (!isoStr) return 'Pendiente de sincronización';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      
      {/* 1. Header Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/70 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[10px] font-bold tracking-wider">
                MONITOR CORFO EN VIVO
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {syncMeta?.lastSyncAt ? (
                  <span>Actualizado el <strong>{formatSyncDate(syncMeta.lastSyncAt)}</strong></span>
                ) : (
                  <span>Aún no hay datos sincronizados</span>
                )}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Convocatorias Abiertas en Chile
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Monitoreo diario automatizado desde el portal oficial de CORFO. Las fechas de cierre y días restantes se actualizan en tiempo real para no perder los plazos de entrega.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRefresh}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Warning if stale (> 48 hours) - Requirement 8: Only if syncMeta exists */}
      {Boolean(syncMeta?.lastSyncAt && isStale) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-amber-900 text-xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Aviso de Sincronización</p>
              <p className="text-[11px] text-amber-800">
                La información podría no estar actualizada (última sincronización realizada hace más de 48 horas).
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono bg-amber-100 px-2 py-1 rounded-lg text-amber-800 font-bold shrink-0">
            {formatSyncDate(syncMeta?.lastSyncAt)}
          </span>
        </div>
      )}

      {/* 3. Filter Bar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Search Input */}
        <div className="sm:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por programa, palabras clave, rubro..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500"
          />
        </div>

        {/* Region Filter */}
        <div className="sm:col-span-3">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 cursor-pointer"
          >
            {REGIONES_CHILE.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Tipo Filter */}
        <div className="sm:col-span-2">
          <select
            value={selectedTipo}
            onChange={(e) => setSelectedTipo(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 cursor-pointer"
          >
            <option value="todos">Todos los tipos</option>
            <option value="subsidios">Subsidios</option>
            <option value="creditos">Créditos / Garantías</option>
            <option value="innovacion">I+D / Innovación</option>
          </select>
        </div>

        {/* Cierre Filter */}
        <div className="sm:col-span-2">
          <select
            value={selectedCierre}
            onChange={(e) => setSelectedCierre(e.target.value)}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 cursor-pointer"
          >
            <option value="todos">Cualquier cierre</option>
            <option value="7dias">Cierra en ≤ 7 días</option>
            <option value="15dias">Cierra en ≤ 15 días</option>
            <option value="permanente">Permanente</option>
          </select>
        </div>
      </div>

      {/* 4. Convocatorias List */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Mostrando <strong>{filteredConvocatorias.length}</strong> convocatorias oficiales</span>
          {selectedRegion !== 'Todas las regiones' && (
            <span>Filtrado por: <strong>{selectedRegion}</strong></span>
          )}
        </div>

        {filteredConvocatorias.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No encontramos convocatorias con estos filtros</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Prueba cambiando la región o seleccionando "Todas las regiones" para ver llamados de alcance nacional.
            </p>
            <button
              onClick={() => { setSearch(''); setSelectedRegion('Todas las regiones'); setSelectedTipo('todos'); setSelectedCierre('todos'); }}
              className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
            >
              Restablecer filtros
            </button>
          </div>
        ) : (
          filteredConvocatorias.map(conv => {
            const hasMatchedFund = Boolean(conv.fundId && CHILEAN_FUNDS.some(f => f.id === conv.fundId));
            const matchedFund = hasMatchedFund ? CHILEAN_FUNDS.find(f => f.id === conv.fundId) : null;
            const daysLeft = conv.diasRestantes;
            const isClosingSoon = daysLeft !== null && daysLeft !== undefined && daysLeft <= 7;

            return (
              <div
                key={conv.id}
                className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  
                  {/* Left Info */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono text-[10px] font-bold">
                        {conv.fuente}
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                        📍 {conv.alcance}
                      </span>

                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        conv.callStatus === 'Abierta'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : conv.callStatus === 'Próxima'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {conv.callStatus || 'Abierta'}
                      </span>

                      {/* Días restantes Badge */}
                      {daysLeft !== null && daysLeft !== undefined ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isClosingSoon 
                            ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse' 
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          ⏳ {daysLeft === 0 ? 'Cierra hoy' : `${daysLeft} días restantes`}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                          Ventanilla permanente
                        </span>
                      )}

                      {matchedFund ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 text-[10px] font-bold border border-blue-200">
                          📌 Programa: {matchedFund.name}
                        </span>
                      ) : conv.programa ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                          📌 Programa: {conv.programa}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {conv.titulo}
                    </h3>

                    {/* Subsidio / Tope */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      {conv.tope_aprox && (
                        <span>Tope Aprox: <strong className="text-emerald-700 font-mono font-bold">{conv.tope_aprox}</strong></span>
                      )}
                      <span className="text-slate-300">•</span>
                      <span>Apertura: <strong className="text-slate-800">{conv.apertura || 'No informada'}</strong></span>
                      <span className="text-slate-300">•</span>
                      <span>Cierre: <strong className={isClosingSoon ? 'text-rose-700 font-bold' : 'text-slate-800'}>{conv.cierre || 'Ventanilla permanente'}</strong></span>
                    </div>

                    {/* Resumen */}
                    {conv.resumen && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed pt-1">
                        {conv.resumen}
                      </p>
                    )}

                    {conv.quienes_pueden_postular && (
                      <p className="text-[11px] text-slate-500 italic line-clamp-1">
                        <strong>Quiénes postulan:</strong> {conv.quienes_pueden_postular}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 pt-2 sm:pt-0">
                    <a
                      href={conv.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold text-center cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Bases en Corfo</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handlePostular(conv)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <span>Postular</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
