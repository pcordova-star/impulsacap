import React, { useState, useEffect, useMemo } from 'react';
import { Convocatoria, ConvocatoriasSyncMeta } from '../types/convocatoria';
import { Sparkles, ArrowRight, Clock, MapPin, ChevronDown, ExternalLink, Coins, CalendarClock } from 'lucide-react';

interface MonitorHeroProps {
  convocatorias: Convocatoria[];
  syncMeta: ConvocatoriasSyncMeta | null;
  loading: boolean;
  onViewAllConvocatorias: () => void;
  onScrollToAssistant: () => void;
}

/**
 * Hero de la portada: "mapa de cierres" en vivo.
 * Cada convocatoria abierta es un punto sobre una línea de tiempo (Hoy → 60+ días),
 * ubicado según los días que le quedan. Las que cierran en 7 días o menos se marcan en ámbar.
 * Las que no tienen fecha de cierre (ventanilla abierta o por confirmar) van en una fila aparte.
 */

// Escala por tramos: la primera semana ocupa más espacio porque es lo urgente.
// 0–7 días → 0–28 %, 7–30 → 28–65 %, 30–60 → 65–95 %, >60 → 98 %.
const TICKS = [
  { days: 0, label: 'Hoy' },
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 60, label: '60+ días' }
];
function positionForDays(d: number): number {
  if (d <= 0) return 0;
  if (d <= 7) return (d / 7) * 28;
  if (d <= 30) return 28 + ((d - 7) / 23) * 37;
  if (d <= 60) return 65 + ((d - 30) / 30) * 30;
  return 98;
}

const URGENT_DAYS = 7;
const LANE_HEIGHT = 24; // px entre filas de puntos
const MIN_TRACK_HEIGHT = 76;
const MIN_GAP_PCT = 3.6; // separación mínima horizontal para no encimar puntos
const MAX_LANES = 5;

type TimedPoint = { call: Convocatoria; days: number; pct: number; lane: number };

function closingText(call: Convocatoria): string {
  const d = call.diasRestantes;
  if (d === null || d === undefined) {
    return call.permanente ? 'Ventanilla abierta, sin fecha de cierre' : 'Fecha de cierre por confirmar';
  }
  const fecha = call.cierre ? new Date(call.cierre + (call.cierre.length === 10 ? 'T12:00:00' : '')) : null;
  const fechaTxt = fecha && !isNaN(fecha.getTime())
    ? fecha.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })
    : '';
  if (d === 0) return fechaTxt ? `Cierra hoy, ${fechaTxt}` : 'Cierra hoy';
  if (d === 1) return fechaTxt ? `Cierra mañana, ${fechaTxt}` : 'Cierra mañana';
  return fechaTxt ? `Cierra en ${d} días, el ${fechaTxt}` : `Cierra en ${d} días`;
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

  const activeCalls = useMemo(() => convocatorias.filter(c => c.vigente), [convocatorias]);
  const totalOpen = activeCalls.length;

  // Puntos con fecha, ordenados por cierre y repartidos en filas para que no se encimen
  const { timedPoints, laneCount } = useMemo(() => {
    const timed = activeCalls
      .filter(c => typeof c.diasRestantes === 'number' && (c.diasRestantes as number) >= 0)
      .map(c => ({ call: c, days: c.diasRestantes as number, pct: positionForDays(c.diasRestantes as number), lane: 0 }))
      .sort((a, b) => a.days - b.days);

    const laneLastPct: number[] = [];
    timed.forEach(p => {
      let lane = laneLastPct.findIndex(last => p.pct - last >= MIN_GAP_PCT);
      if (lane === -1) {
        lane = laneLastPct.length < MAX_LANES ? laneLastPct.length : laneLastPct.indexOf(Math.min(...laneLastPct));
      }
      laneLastPct[lane] = p.pct;
      p.lane = lane;
    });
    return { timedPoints: timed as TimedPoint[], laneCount: Math.max(1, laneLastPct.length) };
  }, [activeCalls]);

  const undatedCalls = useMemo(
    () => activeCalls.filter(c => typeof c.diasRestantes !== 'number' || (c.diasRestantes as number) < 0),
    [activeCalls]
  );

  const closingSoonCount = timedPoints.filter(p => p.days <= URGENT_DAYS).length;

  // Selección: por defecto la que cierra antes, así el panel siempre muestra algo útil (también en celular)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedCall = useMemo(() => {
    const byId = selectedId ? activeCalls.find(c => c.id === selectedId) : null;
    return byId || timedPoints[0]?.call || undatedCalls[0] || null;
  }, [selectedId, activeCalls, timedPoints, undatedCalls]);

  // Única animación de entrada: los puntos aparecen en orden de cierre
  const [revealed, setRevealed] = useState<boolean>(prefersReducedMotion);
  useEffect(() => {
    if (prefersReducedMotion || loading || totalOpen === 0) return;
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [loading, totalOpen, prefersReducedMotion]);

  const syncStatus = useMemo(() => {
    if (!syncMeta?.lastSyncAt) return { text: 'Actualizando convocatorias', isLive: false };
    const syncDate = new Date(syncMeta.lastSyncAt);
    if (isNaN(syncDate.getTime())) return { text: 'Actualizando convocatorias', isLive: false };
    const now = new Date();
    const diffHours = (now.getTime() - syncDate.getTime()) / 36e5;
    const timeStr = syncDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    if (diffHours > 48) {
      return { text: `Actualizado el ${syncDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}`, isLive: false };
    }
    if (syncDate.toDateString() === now.toDateString()) {
      return { text: `Actualizado hoy a las ${timeStr}`, isLive: true };
    }
    return { text: `Actualizado el ${syncDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })} a las ${timeStr}`, isLive: true };
  }, [syncMeta]);

  const hasNoData = !loading && totalOpen === 0;
  const lanesHeight = laneCount * LANE_HEIGHT;
  const trackHeight = Math.max(MIN_TRACK_HEIGHT, lanesHeight + 20);
  const lanesTop = (trackHeight - lanesHeight) / 2;

  const dotClasses = (days: number, isSelected: boolean) => {
    const urgent = days <= URGENT_DAYS;
    const base = urgent
      ? 'bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.75)]'
      : 'bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.6)]';
    const ring = isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0D182E] scale-125' : 'hover:scale-125';
    return `${base} ${ring}`;
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-[#0B1220] via-[#0D182E] to-[#0F1E3A] text-white shadow-2xl shadow-cyan-950/40 mb-8 max-w-full">
      <div
        className="absolute inset-0 pointer-events-none opacity-25"
        style={{ backgroundImage: 'radial-gradient(rgba(56,189,248,0.28) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      />
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 p-5 sm:p-9 lg:p-12 space-y-7 min-w-0">
        {/* Estado del monitor */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/80 text-xs text-slate-200">
            <span className="relative flex h-2 w-2 shrink-0">
              {syncStatus.isLive && !prefersReducedMotion && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${syncStatus.isLive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            </span>
            <span className="font-semibold text-white whitespace-nowrap">Monitoreando CORFO</span>
          </span>
          <span className="text-xs text-slate-400">{syncStatus.text}</span>
          <span className="text-xs text-slate-500">Pronto sumaremos Sercotec, ANID y gobiernos regionales</span>
        </div>

        <div className="grid gap-8 lg:gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-center min-w-0">
        {/* Columna izquierda: propuesta de valor y acciones */}
        <div className="space-y-6 min-w-0">
          <div className="space-y-4 min-w-0">
            <h1 className="text-[28px] leading-[1.1] sm:text-[44px] lg:text-[46px] font-black tracking-tight text-white break-words">
              Postula a fondos CORFO con todo listo, sin perderte ninguna convocatoria
            </h1>
            <p className="text-[15px] sm:text-lg text-slate-300 leading-relaxed max-w-xl">
              ImpulsaCap te dice a qué fondos puedes postular, te avisa cuándo cierran y te ayuda a preparar la postulación completa: requisitos, formulario, cartas y expediente.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
            <button
              onClick={onScrollToAssistant}
              className="monitor-cta group relative inline-flex items-center justify-center gap-2.5 px-6 sm:px-7 py-4 rounded-2xl text-[#04131c] font-black text-base whitespace-nowrap shadow-[0_0_32px_rgba(34,211,238,0.35)] hover:shadow-[0_0_44px_rgba(34,211,238,0.55)] active:scale-[0.98] transition-shadow cursor-pointer w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0D182E]"
            >
              <Sparkles className="w-5 h-5" />
              <span>¿A cuáles califico?<span className="hidden sm:inline"> Descúbrelo en 1 minuto</span></span>
              <ChevronDown className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
            </button>
            {!hasNoData && !loading && (
              <button
                onClick={onViewAllConvocatorias}
                className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm whitespace-nowrap bg-slate-800/80 hover:bg-slate-700/80 text-slate-100 border border-slate-700/80 transition-colors cursor-pointer w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <span>Ver las {totalOpen} convocatorias</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Columna derecha: mapa de cierres en vivo */}
        <div className="min-w-0">
        {/* Cargando */}
        {loading && (
          <div className="rounded-2xl bg-slate-900/50 border border-slate-700/60 p-5 sm:p-6 space-y-4 animate-pulse">
            <div className="h-24 rounded-xl bg-slate-800/60" />
            <div className="h-16 rounded-xl bg-slate-800/40" />
          </div>
        )}

        {/* Sin datos */}
        {hasNoData && (
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-cyan-500/20 space-y-3">
            <div className="flex items-center gap-2 text-cyan-300 font-semibold text-sm">
              <Clock className="w-4 h-4" />
              <span>Estamos actualizando las convocatorias</span>
            </div>
            <p className="text-sm text-slate-400 max-w-xl">
              Mientras tanto, responde 5 preguntas y te mostramos a qué fondos podría postular tu empresa.
            </p>
          </div>
        )}

        {/* Mapa de cierres */}
        {!loading && !hasNoData && (
          <div className="rounded-2xl bg-slate-950/40 backdrop-blur-sm border border-cyan-400/15 p-4 sm:p-6 space-y-5 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-sm sm:text-base font-bold text-white">
                Hoy hay <span className="text-cyan-300">{totalOpen} {totalOpen === 1 ? 'convocatoria abierta' : 'convocatorias abiertas'}</span>
                {closingSoonCount > 0 && (
                  <> y <span className="text-amber-300">{closingSoonCount} {closingSoonCount === 1 ? 'cierra' : 'cierran'} esta semana</span></>
                )}
              </h2>
              <p className="text-xs text-slate-400">Toca un punto para ver cuándo cierra</p>
            </div>

            {/* Línea de tiempo */}
            <div className="px-2 min-w-0">
              <div className="relative" style={{ height: trackHeight }}>
                {/* Zona urgente (primera semana) */}
                <div
                  className="absolute top-0 bottom-0 left-0 rounded-l-lg bg-gradient-to-r from-amber-400/15 to-amber-400/5 border-l-2 border-amber-300/60"
                  style={{ width: `${positionForDays(URGENT_DAYS)}%` }}
                />
                {/* Líneas guía de cada tramo */}
                {TICKS.slice(1).map(t => (
                  <div
                    key={t.days}
                    className="absolute top-0 bottom-0 w-px bg-slate-700/70"
                    style={{ left: `${positionForDays(t.days)}%` }}
                  />
                ))}
                {/* Barrido del monitor */}
                {!prefersReducedMotion && (
                  <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none" aria-hidden="true">
                    <div className="monitor-sweep absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-cyan-300/15 border-r border-cyan-300/50" />
                  </div>
                )}
                {/* Puntos */}
                {timedPoints.map((p, i) => {
                  const isSelected = selectedCall?.id === p.call.id;
                  return (
                    <button
                      key={p.call.id}
                      type="button"
                      onClick={() => setSelectedId(p.call.id)}
                      onMouseEnter={() => setSelectedId(p.call.id)}
                      onFocus={() => setSelectedId(p.call.id)}
                      aria-label={`${p.call.titulo}. ${closingText(p.call)}`}
                      aria-pressed={isSelected}
                      className="absolute p-1.5 rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      style={{
                        left: `${p.pct}%`,
                        top: lanesTop + p.lane * LANE_HEIGHT + LANE_HEIGHT / 2 - 13,
                        opacity: revealed ? 1 : 0,
                        transform: `translateX(-50%) scale(${revealed ? 1 : 0.2})`,
                        transition: prefersReducedMotion ? undefined : `opacity 420ms ease-out ${i * 70}ms, transform 520ms cubic-bezier(0.34,1.56,0.64,1) ${i * 70}ms`
                      }}
                    >
                      <span className={`block w-3.5 h-3.5 rounded-full transition-transform duration-150 ${dotClasses(p.days, isSelected)}`} />
                    </button>
                  );
                })}
              </div>
              {/* Etiquetas del eje */}
              <div className="relative h-5 mt-2 text-[11px] text-slate-400">
                {TICKS.map((t, idx) => (
                  <span
                    key={t.days}
                    className={`absolute whitespace-nowrap ${idx === 0 ? '' : idx === TICKS.length - 1 ? '-translate-x-full' : '-translate-x-1/2'} ${t.days === 0 ? 'text-amber-300 font-semibold' : ''}`}
                    style={{ left: `${idx === TICKS.length - 1 ? 100 : positionForDays(t.days)}%` }}
                  >
                    {t.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Sin fecha de cierre */}
            {undatedCalls.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                <span className="text-xs text-slate-400">Sin fecha de cierre ({undatedCalls.length})</span>
                <div className="flex flex-wrap gap-1">
                  {undatedCalls.map(c => {
                    const isSelected = selectedCall?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        onMouseEnter={() => setSelectedId(c.id)}
                        onFocus={() => setSelectedId(c.id)}
                        aria-label={`${c.titulo}. ${closingText(c)}`}
                        aria-pressed={isSelected}
                        className="p-1.5 rounded-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                      >
                        <span className={`block w-3 h-3 rounded-full border-2 transition-transform duration-150 ${
                          c.permanente ? 'border-emerald-300' : 'border-slate-400'
                        } ${isSelected ? 'bg-white/90 scale-125' : 'hover:scale-125'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Convocatoria seleccionada */}
            {selectedCall && (
              <div
                key={selectedCall.id}
                aria-live="polite"
                className={`rounded-xl border p-4 sm:p-5 flex flex-col gap-4 min-w-0 ${
                  typeof selectedCall.diasRestantes === 'number' && selectedCall.diasRestantes <= URGENT_DAYS
                    ? 'bg-amber-400/[0.07] border-amber-300/30'
                    : 'bg-slate-900/70 border-slate-700/70'
                }`}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-base sm:text-lg font-bold text-white leading-snug break-words">
                    {selectedCall.titulo}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-slate-300">
                    <span className={`inline-flex items-center gap-1.5 ${
                      typeof selectedCall.diasRestantes === 'number' && selectedCall.diasRestantes <= URGENT_DAYS ? 'text-amber-300 font-semibold' : ''
                    }`}>
                      <CalendarClock className="w-4 h-4 shrink-0" />
                      {closingText(selectedCall)}
                    </span>
                    {selectedCall.alcance && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 shrink-0 text-slate-400" />
                        {selectedCall.alcance}
                      </span>
                    )}
                    {selectedCall.tope_aprox && (
                      <span className="inline-flex items-center gap-1.5">
                        <Coins className="w-4 h-4 shrink-0 text-slate-400" />
                        {selectedCall.tope_aprox}
                      </span>
                    )}
                  </div>
                </div>
                {selectedCall.url && (
                  <a
                    href={selectedCall.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sm:self-start inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-600 text-sm font-semibold text-slate-100 hover:bg-slate-800 hover:border-slate-500 transition-colors shrink-0"
                  >
                    Ver bases en CORFO
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        </div>
        </div>
      </div>
    </section>
  );
};
