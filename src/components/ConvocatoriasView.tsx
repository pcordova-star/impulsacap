import React, { useState, useMemo } from 'react';
import { Convocatoria, ConvocatoriasSyncMeta } from '../types/convocatoria';
import { ChileanFund, CompanyUser } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { 
  Search, 
  ExternalLink, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  RefreshCw,
  MapPin,
  Coins,
  Bell,
  Check,
  ChevronRight,
  Filter
} from 'lucide-react';

interface ConvocatoriasViewProps {
  convocatorias: Convocatoria[];
  syncMeta: ConvocatoriasSyncMeta | null;
  isStale: boolean;
  loading: boolean;
  currentUser?: CompanyUser | null;
  onRefresh: () => void;
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onOpenNewApplicationModal: () => void;
  onQualifyCall?: (conv: Convocatoria) => void;
  onPostularCall?: (conv: Convocatoria) => void;
  onOpenAuthModal?: (mode?: 'login' | 'register') => void;
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

type QuickChip = 'todas' | 'emprender' | 'pymes' | 'innovacion' | 'mujeres';

export const ConvocatoriasView: React.FC<ConvocatoriasViewProps> = ({
  convocatorias,
  syncMeta,
  isStale,
  loading,
  currentUser,
  onRefresh,
  onSelectFundToFormulate,
  onOpenNewApplicationModal,
  onQualifyCall,
  onPostularCall,
  onOpenAuthModal
}) => {
  const [search, setSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('Todas las regiones');
  const [activeChip, setActiveChip] = useState<QuickChip>('todas');
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && currentUser?.id) {
      return localStorage.getItem(`impulsacap_alerts_${currentUser.id}`) === 'true';
    }
    return false;
  });

  const handleToggleAlerts = () => {
    if (!currentUser) {
      onOpenAuthModal?.('register');
      return;
    }
    setAlertsEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem(`impulsacap_alerts_${currentUser.id}`, String(next));
      } catch {}
      return next;
    });
  };

  // Helper matching for quick chips (Requirement 2)
  const matchesChip = (c: Convocatoria, chip: QuickChip): boolean => {
    if (chip === 'todas') return true;

    const fullText = [
      c.titulo,
      c.resumen || '',
      c.quienes_pueden_postular || '',
      c.necesidad || '',
      c.programa || ''
    ].join(' ').toLowerCase();

    if (chip === 'emprender') {
      return (
        fullText.includes('semilla') ||
        fullText.includes('inicia') ||
        fullText.includes('emprende') ||
        fullText.includes('startup') ||
        fullText.includes('incub') ||
        fullText.includes('aceler') ||
        fullText.includes('capital') ||
        fullText.includes('nuevo negocio') ||
        fullText.includes('prototipo')
      );
    }

    if (chip === 'pymes') {
      return (
        fullText.includes('pyme') ||
        fullText.includes('crece') ||
        fullText.includes('reactiva') ||
        fullText.includes('par') ||
        fullText.includes('focal') ||
        fullText.includes('empresa') ||
        fullText.includes('mipyme') ||
        fullText.includes('escalamiento') ||
        fullText.includes('consolidación') ||
        fullText.includes('productiv') ||
        fullText.includes('crédito') ||
        fullText.includes('garantía')
      );
    }

    if (chip === 'innovacion') {
      return (
        fullText.includes('innova') ||
        fullText.includes('i+d') ||
        fullText.includes('tecnolog') ||
        fullText.includes('investig') ||
        fullText.includes('desarrollo') ||
        fullText.includes('prototipo') ||
        fullText.includes('validación') ||
        fullText.includes('científic')
      );
    }

    if (chip === 'mujeres') {
      return (
        fullText.includes('mujer') ||
        fullText.includes('femenin') ||
        fullText.includes('abeja') ||
        fullText.includes('liderazgo') ||
        fullText.includes('género')
      );
    }

    return true;
  };

  // Filter convocatorias
  const filteredConvocatorias = useMemo(() => {
    return convocatorias.filter(c => {
      // 1. Chip filter
      if (!matchesChip(c, activeChip)) return false;

      // 2. Region filter
      if (selectedRegion !== 'Todas las regiones') {
        const alc = (c.alcance || '').toLowerCase();
        const reg = selectedRegion.toLowerCase();
        const matchesReg = alc.includes('todo chile') || alc.includes('nacional') || alc.includes(reg);
        if (!matchesReg) return false;
      }

      // 3. Free text search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesSearch = 
          c.titulo.toLowerCase().includes(q) ||
          (c.resumen && c.resumen.toLowerCase().includes(q)) ||
          (c.alcance && c.alcance.toLowerCase().includes(q)) ||
          (c.quienes_pueden_postular && c.quienes_pueden_postular.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      return true;
    }).sort((a, b) => {
      // Sort: Open first, then by days remaining ascending
      if (a.vigente && !b.vigente) return -1;
      if (!a.vigente && b.vigente) return 1;

      const diasA = a.diasRestantes !== null && a.diasRestantes !== undefined ? a.diasRestantes : 9999;
      const diasB = b.diasRestantes !== null && b.diasRestantes !== undefined ? b.diasRestantes : 9999;
      return diasA - diasB;
    });
  }, [convocatorias, activeChip, selectedRegion, search]);

  const handlePostular = (conv: Convocatoria) => {
    if (onPostularCall) {
      onPostularCall(conv);
      return;
    }

    if (!currentUser) {
      onOpenAuthModal?.('register');
      return;
    }

    if (conv.fundId) {
      const fund = CHILEAN_FUNDS.find(f => f.id === conv.fundId);
      if (fund) {
        onSelectFundToFormulate(fund);
        return;
      }
    }
    onOpenNewApplicationModal();
  };

  const handleQualify = (conv: Convocatoria) => {
    if (onQualifyCall) {
      onQualifyCall(conv);
    } else if (conv.fundId) {
      const fund = CHILEAN_FUNDS.find(f => f.id === conv.fundId);
      if (fund) onSelectFundToFormulate(fund);
    }
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
      
      {/* 1. Header Banner con honestidad de datos (Requirement 3) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/70 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-slate-900 text-white font-mono text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 shadow-xs">
                <span className="text-emerald-400 font-sans">⚡</span>
                <span>Monitor CORFO</span>
              </span>

              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {syncMeta?.lastSyncAt ? (
                  <span>Actualizado el <strong>{formatSyncDate(syncMeta.lastSyncAt)}</strong></span>
                ) : (
                  <span>Sincronizando con CORFO...</span>
                )}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Convocatorias Abiertas en Chile
            </h1>

            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              Monitoreo diario automatizado desde el portal oficial de CORFO. Las fechas de cierre y días restantes se actualizan en tiempo real para no perder ninguna oportunidad.
            </p>

            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1 pt-0.5">
              <span>Fuente: Portal oficial CORFO.</span>
              <span className="text-slate-500 font-semibold">Próximamente: Sercotec, ANID y gobiernos regionales.</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRefresh}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-2 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Actualizar datos</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Warning if stale (> 48 hours) */}
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

      {/* 3. Filtros Rápidos Tipo Chips + Selector de Región (Requirement 2) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3.5">
        
        {/* Row 1: Chips rápidos */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros rápidos:</span>
          </span>

          {[
            { id: 'todas' as const, label: 'Todas' },
            { id: 'emprender' as const, label: '🚀 Para emprender' },
            { id: 'pymes' as const, label: '🏢 Para pymes' },
            { id: 'innovacion' as const, label: '💡 Innovación e I+D' },
            { id: 'mujeres' as const, label: '👩‍💼 Mujeres' }
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setActiveChip(chip.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeChip === chip.id
                  ? 'bg-blue-600 text-white shadow-xs scale-102'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/80'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Row 2: Search + Region selector */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1 border-t border-slate-100">
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre de fondo, palabras clave o rubro..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500"
            />
          </div>

          <div className="sm:col-span-4">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-hidden focus:bg-white focus:border-blue-500 cursor-pointer font-medium"
            >
              {REGIONES_CHILE.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Convocatorias List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Mostrando <strong>{filteredConvocatorias.length}</strong> convocatorias oficiales CORFO</span>
          {selectedRegion !== 'Todas las regiones' && (
            <span>Región: <strong>{selectedRegion}</strong></span>
          )}
        </div>

        {filteredConvocatorias.length === 0 ? (
          <div className="p-12 rounded-3xl bg-white border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No encontramos convocatorias con estos filtros</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Prueba seleccionando "Todas" o "Todas las regiones" para ver llamados de alcance nacional.
            </p>
            <button
              onClick={() => { setSearch(''); setSelectedRegion('Todas las regiones'); setActiveChip('todas'); }}
              className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
            >
              Restablecer filtros
            </button>
          </div>
        ) : (
          filteredConvocatorias.map(conv => {
            const daysLeft = conv.diasRestantes;
            const isClosingSoon = daysLeft !== null && daysLeft !== undefined && daysLeft <= 7;
            const isClosingToday = daysLeft === 0;

            return (
              <div
                key={conv.id}
                className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all space-y-3.5"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  
                  {/* Left Info: Nombre, Región, Días restantes, Monto tope (Requirement 2) */}
                  <div className="space-y-2.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[10px] font-bold">
                        {conv.fuente || 'CORFO'}
                      </span>

                      {/* Región */}
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{conv.alcance || 'Todo Chile'}</span>
                      </span>

                      {/* Días restantes Badge */}
                      {!conv.vigente ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-300">
                          Cerrada{conv.cierre ? ` el ${conv.cierre.split('-').reverse().join('-')}` : ''}
                        </span>
                      ) : daysLeft !== null && daysLeft !== undefined ? (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isClosingToday
                            ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse font-black'
                            : isClosingSoon 
                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold' 
                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                          ⏳ {isClosingToday ? '¡Cierra hoy!' : `${daysLeft} días restantes`}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
                          Ventanilla permanente
                        </span>
                      )}

                      {/* Monto Tope */}
                      {conv.tope_aprox && (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-mono font-bold border border-emerald-200 flex items-center gap-1">
                          <Coins className="w-3 h-3 text-emerald-600" />
                          <span>Tope: {conv.tope_aprox}</span>
                        </span>
                      )}
                    </div>

                    {/* Nombre */}
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {conv.titulo}
                    </h3>

                    {/* Resumen */}
                    {conv.resumen && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {conv.resumen}
                      </p>
                    )}

                    {conv.quienes_pueden_postular && (
                      <p className="text-[11px] text-slate-500 italic line-clamp-1">
                        <strong>Quiénes postulan:</strong> {conv.quienes_pueden_postular}
                      </p>
                    )}
                  </div>

                  {/* Actions: Bases Oficiales + Dos Botones "¿Califico?" y "Postular con ImpulsaCap" (Requirement 2) */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2 shrink-0 pt-2 lg:pt-0">
                    
                    {/* Enlace al sitio oficial */}
                    <a
                      href={conv.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold text-center cursor-pointer inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span>Bases en CORFO</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </a>

                    <div className="flex items-center gap-2">
                      {/* Botón "¿Califico?" */}
                      <button
                        onClick={() => handleQualify(conv)}
                        className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        <span>¿Califico?</span>
                      </button>

                      {/* Botón "Postular con ImpulsaCap" */}
                      <button
                        onClick={() => handlePostular(conv)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5"
                      >
                        <span>Postular con ImpulsaCap</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. TARJETA INFERIOR: "Avísame cuando abra una convocatoria para mi perfil" (Requirement 2) */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[11px] font-bold">
              <Bell className="w-3.5 h-3.5 text-blue-400" />
              <span>SISTEMA DE RADAR Y ALERTAS</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Avísame cuando abra una convocatoria para mi perfil
            </h3>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentUser ? (
                <span>
                  Configura alertas para <strong>{currentUser.companyName || 'tu empresa'}</strong>. Te notificaremos automáticamente cuando se abran nuevos llamados en CORFO o Sercotec con requisitos acordes a tu rubro.
                </span>
              ) : (
                <span>
                  Monitoreamos el portal de CORFO las 24 horas. Crea una cuenta gratuita con tu empresa para recibir un aviso apenas se publique una convocatoria compatible con tu región y giro.
                </span>
              )}
            </p>
          </div>

          <div className="shrink-0">
            {currentUser ? (
              <button
                onClick={handleToggleAlerts}
                className={`px-5 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95 ${
                  alertsEnabled
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-white text-slate-900 hover:bg-slate-100'
                }`}
              >
                {alertsEnabled ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>✓ Alertas activadas para mi perfil</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 text-blue-600" />
                    <span>Activar alertas para mi perfil</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={() => onOpenAuthModal?.('register')}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-blue-600/30 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Crear cuenta y activar alertas</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
