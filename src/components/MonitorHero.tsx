import React, { useState, useEffect, useMemo } from 'react';
import { Convocatoria, ConvocatoriasSyncMeta } from '../types/convocatoria';
import { 
  Sparkles, 
  ArrowRight, 
  Clock, 
  MapPin, 
  ChevronRight, 
  ChevronDown,
  Activity,
  Layers,
  Calendar,
  AlertTriangle,
  Building2,
  ExternalLink
} from 'lucide-react';

interface MonitorHeroProps {
  convocatorias: Convocatoria[];
  syncMeta: ConvocatoriasSyncMeta | null;
  loading: boolean;
  onViewAllConvocatorias: () => void;
  onScrollToAssistant: () => void;
}

// Parses string like "Hasta $25.000.000", "50 millones", "UF 2.000" into approximate CLP
function parseTopeCLP(topeStr?: string | null): number | null {
  if (!topeStr) return null;
  const str = topeStr.toLowerCase().replace(/\s+/g, ' ');
  
  // Word millions (e.g., "50 millones", "15 millones")
  const millonMatch = str.match(/(\d+(?:[.,]\d+)?)\s*(?:millones|millón|m)/);
  if (millonMatch) {
    const num = parseFloat(millonMatch[1].replace(',', '.'));
    if (!isNaN(num) && num > 0) return Math.round(num * 1_000_000);
  }

  // Standard CLP formatting: $15.000.000 or 15.000.000
  const clpMatch = str.match(/\$?\s*([0-9]{1,3}(?:\.[0-9]{3})+)/);
  if (clpMatch) {
    const cleanNum = parseInt(clpMatch[1].replace(/\./g, ''), 10);
    if (!isNaN(cleanNum) && cleanNum > 0) return cleanNum;
  }

  // UF estimate (~ $38.500 CLP)
  const ufMatch = str.match(/([0-9]{1,3}(?:\.[0-9]{3})*)\s*uf|uf\s*([0-9]{1,3}(?:\.[0-9]{3})*)/);
  if (ufMatch) {
    const rawVal = ufMatch[1] || ufMatch[2];
    const ufNum = parseInt(rawVal.replace(/\./g, ''), 10);
    if (!isNaN(ufNum) && ufNum > 0) return ufNum * 38_500;
  }

  return null;
}

// Counter animation hook (~1 sec duration, respects prefers-reduced-motion)
function useAnimatedCounter(target: number, duration: number = 900): number {
  const [value, setValue] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    if (target <= 0) {
      setValue(0);
      return;
    }

    const start = performance.now();
    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      // easeOutExpo
      const current = progress === 1 ? target : Math.round(target * (1 - Math.pow(2, -10 * progress)));
      setValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return value;
}

export const MonitorHero: React.FC<MonitorHeroProps> = ({
  convocatorias,
  syncMeta,
  loading,
  onViewAllConvocatorias,
  onScrollToAssistant
}) => {
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Active (vigente) calls
  const activeCalls = useMemo(() => {
    return convocatorias.filter(c => c.vigente);
  }, [convocatorias]);

  // Metric 1: Convocatorias abiertas
  const totalOpen = activeCalls.length;

  // Metric 2: Cierran en 7 días o menos
  const closingSoonCalls = useMemo(() => {
    return activeCalls.filter(c => c.diasRestantes !== null && c.diasRestantes !== undefined && c.diasRestantes <= 7 && c.diasRestantes >= 0);
  }, [activeCalls]);
  const totalClosingSoon = closingSoonCalls.length;

  // Metric 3: Sum of caps or unique regions count
  const { metric3Type, metric3Value, metric3Formatted } = useMemo(() => {
    let parsedSum = 0;
    let countParsed = 0;

    activeCalls.forEach(c => {
      const val = parseTopeCLP(c.tope_aprox);
      if (val && val > 0) {
        parsedSum += val;
        countParsed++;
      }
    });

    // If at least 2 calls have parseable numbers and total > 0
    if (countParsed >= 2 && parsedSum > 0) {
      const millions = Math.round(parsedSum / 1_000_000);
      return {
        metric3Type: 'monto' as const,
        metric3Value: millions,
        metric3Formatted: millions >= 1000 
          ? `$${(millions / 1000).toFixed(1).replace('.', ',')}B` 
          : `$${millions.toLocaleString('es-CL')}M`
      };
    }

    // Fallback: Regiones con convocatorias
    const uniqueRegions = new Set(
      activeCalls.map(c => c.alcance).filter(r => r && r !== 'Todo Chile' && r !== 'Nacional')
    );
    const regionsCount = Math.max(uniqueRegions.size, 1);
    return {
      metric3Type: 'regiones' as const,
      metric3Value: regionsCount,
      metric3Formatted: `${regionsCount}`
    };
  }, [activeCalls]);

  // Animated counters
  const animatedOpen = useAnimatedCounter(totalOpen, 900);
  const animatedClosingSoon = useAnimatedCounter(totalClosingSoon, 900);
  const animatedMetric3 = useAnimatedCounter(metric3Value, 1000);

  // Sync date formatting and status
  const syncStatus = useMemo(() => {
    if (!syncMeta?.lastSyncAt) {
      return { text: 'Estamos actualizando las convocatorias', isLive: false, timeOnly: '' };
    }
    const syncDate = new Date(syncMeta.lastSyncAt);
    if (isNaN(syncDate.getTime())) {
      return { text: 'Estamos actualizando las convocatorias', isLive: false, timeOnly: '' };
    }
    const now = new Date();
    const diffHours = (now.getTime() - syncDate.getTime()) / (1000 * 60 * 60);

    if (diffHours > 48) {
      const formattedDate = syncDate.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      return { text: `Actualizado el ${formattedDate}`, isLive: false, timeOnly: '' };
    }

    const isToday = syncDate.toDateString() === now.toDateString();
    const timeStr = syncDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return { text: `Actualizado hoy a las ${timeStr}`, isLive: true, timeOnly: timeStr };
    }
    const dateStr = syncDate.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    return { text: `Actualizado el ${dateStr} a las ${timeStr}`, isLive: true, timeOnly: timeStr };
  }, [syncMeta]);

  // Urgent calls for the ticker (closing soonest)
  const tickerCalls = useMemo(() => {
    return [...activeCalls]
      .sort((a, b) => {
        const dA = a.diasRestantes ?? 9999;
        const dB = b.diasRestantes ?? 9999;
        return dA - dB;
      })
      .slice(0, 6);
  }, [activeCalls]);

  // Ticker rotation state (every 3 seconds)
  const [tickerIndex, setTickerIndex] = useState<number>(0);
  const [isTickerHovered, setIsTickerHovered] = useState<boolean>(false);

  useEffect(() => {
    if (isTickerHovered || tickerCalls.length <= 1 || prefersReducedMotion) return;
    const interval = setInterval(() => {
      setTickerIndex(prev => (prev + 1) % tickerCalls.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isTickerHovered, tickerCalls.length, prefersReducedMotion]);

  const currentTickerCall = tickerCalls[tickerIndex] || tickerCalls[0];
  const hasNoData = !loading && totalOpen === 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-[#0B1220] via-[#0D182E] to-[#0F1E3A] text-white shadow-2xl shadow-cyan-950/40 mb-8 max-w-full">
      {/* SUTIL TECH BACKGROUND GRID PATTERN & SLOW DRIFTING GRADIENT */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `radial-gradient(rgba(56, 189, 248, 0.28) 1px, transparent 1px)`,
          backgroundSize: '24px 24px'
        }}
      />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-5 sm:p-9 lg:p-12 space-y-7 max-w-full min-w-0">
        
        {/* TOP STATUS BAR: EN VIVO + MONITOR CORFO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-5">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Monitor Brand Chip */}
            <span className="px-3 py-1 rounded-full bg-slate-800/90 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5 shadow-xs">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Monitor CORFO</span>
            </span>

            {/* Live Indicator with pulsing dot */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-200 text-xs font-semibold">
              {syncStatus.isLive && (
                <span className="relative flex h-2 w-2">
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${prefersReducedMotion ? '' : 'animate-ping'}`} />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </span>
              )}
              <span className="text-[11px] font-bold text-emerald-400 tracking-wide uppercase">
                {syncStatus.isLive ? 'EN VIVO' : 'ESTADO'}:
              </span>
              <span className="text-[11px] text-slate-300 font-medium">
                {syncStatus.text}
              </span>
            </div>
          </div>

          {/* Honest disclaimer about source */}
          <div className="text-[11px] text-slate-400 font-medium flex flex-wrap items-center gap-1 break-words">
            <span>Fuente: Portal oficial CORFO.</span>
            <span className="text-cyan-400 font-semibold">Próximamente: Sercotec, ANID y gobiernos regionales.</span>
          </div>
        </div>

        {/* HERO TITLE & SUBTITLE */}
        <div className="max-w-3xl space-y-3 min-w-0">
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15] break-words">
            Todas las convocatorias abiertas, en un solo lugar
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal break-words">
            Monitoreamos a diario el portal de CORFO para que no se te pase ninguna oportunidad de financiamiento no reembolsable en Chile.
          </p>
        </div>

        {/* LOADING SKELETON STATE */}
        {loading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className={`p-4 sm:p-6 rounded-2xl bg-slate-800/40 border border-slate-700/60 animate-pulse space-y-2 ${i === 3 ? 'col-span-2 sm:col-span-1' : ''}`}>
                  <div className="h-8 sm:h-12 bg-slate-700/60 rounded-lg w-20" />
                  <div className="h-3 bg-slate-700/40 rounded-md w-28" />
                </div>
              ))}
            </div>
            <div className="h-16 rounded-2xl bg-slate-800/40 border border-slate-700/60 animate-pulse" />
          </div>
        )}

        {/* EMPTY OR ERROR STATE: NO ZERO COUNTERS */}
        {hasNoData && (
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-cyan-500/20 text-slate-300 space-y-4">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Estamos actualizando las convocatorias</span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              El monitor está sincronizando los últimos llamados oficiales de CORFO. Puedes usar el asistente ahora mismo para descubrir a cuáles calificas según el perfil de tu empresa.
            </p>
            <div>
              <button
                onClick={onScrollToAssistant}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shadow-lg transition-all cursor-pointer"
              >
                <span>¿A cuáles califico? Descúbrelo en 1 minuto</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* REAL DATA VIEW */}
        {!loading && !hasNoData && (
          <div className="space-y-6 min-w-0">
            
            {/* 3 CONTADORES GRANDES: 48px en escritorio, 36px en móvil, fuente monoespaciada con brillo cian */}
            {/* Disposición móvil compacta 2+1, 3 en escritorio */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              
              {/* Counter 1: Convocatorias abiertas */}
              <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-cyan-500/20 hover:border-cyan-400/40 transition-colors shadow-lg">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-cyan-400 block truncate">
                  Convocatorias abiertas
                </span>
                <div className="flex items-baseline gap-2 mt-1 sm:mt-2">
                  <span className="text-[36px] sm:text-[48px] font-black font-mono tracking-tight text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.45)] leading-none">
                    {animatedOpen}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                    Vigentes
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-2 truncate">
                  Disponibles en CORFO
                </p>
              </div>

              {/* Counter 2: Cierran en 7 días o menos */}
              <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-amber-500/30 hover:border-amber-400/50 transition-colors shadow-lg">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-400 block truncate">
                  Cierran en ≤ 7 días
                </span>
                <div className="flex items-baseline gap-2 mt-1 sm:mt-2">
                  <span className="text-[36px] sm:text-[48px] font-black font-mono tracking-tight text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.4)] leading-none">
                    {animatedClosingSoon}
                  </span>
                  {totalClosingSoon > 0 && (
                    <span className="text-[10px] sm:text-xs font-bold text-rose-300 bg-rose-950/70 border border-rose-500/40 px-1.5 sm:px-2 py-0.5 rounded-full shrink-0">
                      Crítico
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-2 truncate">
                  {totalClosingSoon === 1 
                    ? '1 en recta final' 
                    : totalClosingSoon > 1 
                    ? `${totalClosingSoon} en recta final` 
                    : 'Sin urgencias'}
                </p>
              </div>

              {/* Counter 3: Monto máximo disponible o Regiones (en móvil ocupa 2 columnas para balance) */}
              <div className="col-span-2 sm:col-span-1 p-4 sm:p-6 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-emerald-500/20 hover:border-emerald-400/40 transition-colors shadow-lg">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-400 block truncate">
                  {metric3Type === 'monto' ? 'Monto máx. disponible' : 'Regiones con convocatorias'}
                </span>
                <div className="flex items-baseline gap-2 mt-1 sm:mt-2">
                  <span className="text-[32px] sm:text-[44px] font-black font-mono tracking-tight text-emerald-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.45)] leading-none">
                    {metric3Type === 'monto' 
                      ? (animatedMetric3 >= 1000 
                          ? `$${(animatedMetric3 / 1000).toFixed(1).replace('.', ',')}B` 
                          : `$${animatedMetric3}M`)
                      : `${animatedMetric3}`}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700 shrink-0">
                    {metric3Type === 'monto' ? 'CLP Subsidio' : 'Regiones'}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-2 truncate">
                  {metric3Type === 'monto' ? 'Suma de topes interpretados' : 'Cobertura territorial activa'}
                </p>
              </div>
            </div>

            {/* TICKER DE CONVOCATORIAS QUE CIERRAN ANTES (Efecto de Vidrio: fondo translúcido, desenfoque y borde sutil) */}
            {tickerCalls.length > 0 && currentTickerCall && (
              <div 
                onMouseEnter={() => setIsTickerHovered(true)}
                onMouseLeave={() => setIsTickerHovered(false)}
                className="group relative p-3.5 sm:p-4 rounded-2xl bg-slate-800/50 backdrop-blur-md border border-cyan-500/25 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all cursor-pointer hover:border-cyan-400/50 hover:bg-slate-800/70 min-w-0"
                onClick={onViewAllConvocatorias}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-inner">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                        Próximas a cerrar ({tickerIndex + 1}/{tickerCalls.length})
                      </span>
                      {isTickerHovered && (
                        <span className="text-[10px] text-slate-400 italic">
                          (Pausado)
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                      <p className="text-xs sm:text-sm font-bold text-white truncate max-w-full sm:max-w-md">
                        {currentTickerCall.titulo}
                      </p>
                      <span className="text-slate-600 text-xs hidden sm:inline">•</span>
                      <span className="text-[11px] text-slate-300 flex items-center gap-1 shrink-0">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        <span>{currentTickerCall.alcance}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-700/60">
                  {currentTickerCall.tope_aprox && (
                    <span className="text-xs text-emerald-400 font-mono font-bold">
                      {currentTickerCall.tope_aprox}
                    </span>
                  )}
                  {currentTickerCall.diasRestantes !== null && currentTickerCall.diasRestantes !== undefined ? (
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                      currentTickerCall.diasRestantes <= 7
                        ? 'bg-amber-400 text-slate-950 font-black shadow-xs shadow-amber-400/20'
                        : 'bg-slate-700/80 text-slate-200'
                    }`}>
                      {currentTickerCall.diasRestantes === 0 
                        ? '¡Cierra hoy!' 
                        : `${currentTickerCall.diasRestantes} días restantes`}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-1 rounded-lg">
                      Abierta
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            )}

            {/* BOTONES PRINCIPALES: Ancho completo en móvil */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              
              {/* Botón Principal: Borde de gradiente animado y brillo sutil */}
              <button
                onClick={onViewAllConvocatorias}
                className="relative group overflow-hidden px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-600 to-emerald-500 text-white font-black text-sm sm:text-base shadow-xl shadow-cyan-900/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2.5 border border-cyan-300/40 w-full sm:w-auto"
              >
                {/* Shimmer sweep effect */}
                {!prefersReducedMotion && (
                  <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-shimmer pointer-events-none" />
                )}
                <span>Ver las {totalOpen > 0 ? totalOpen : ''} convocatorias abiertas →</span>
              </button>

              {/* Botón Secundario: ¿A cuáles califico? Descúbrelo en 1 minuto */}
              <button
                onClick={onScrollToAssistant}
                className="px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-slate-700/80 w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>¿A cuáles califico? Descúbrelo en 1 minuto</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>
        )}

      </div>
    </section>
  );
};
