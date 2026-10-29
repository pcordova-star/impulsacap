import React, { useMemo } from 'react';
import { CalendarClock, ArrowRight } from 'lucide-react';
import type { Convocatoria } from '../types/convocatoria';
import { pendingUpcoming, fmtShortDate, daysText, UPCOMING_SOURCE, type UpcomingCall } from '../data/upcomingCalls';

/** "Se vienen": aperturas esperadas de convocatorias, con cuenta regresiva */
export const UpcomingCallsBanner: React.FC<{
  convocatorias: Convocatoria[];
  actionLabel: string;
  onAction: (call: UpcomingCall) => void;
  /** Texto de la bajada según dónde se muestra */
  intro?: string;
}> = ({ convocatorias, actionLabel, onAction, intro }) => {
  const openIds = useMemo(() => new Set(convocatorias.filter(c => c.vigente && c.fundId).map(c => String(c.fundId))), [convocatorias]);
  const calls = useMemo(() => pendingUpcoming(openIds), [openIds]);
  if (calls.length === 0) return null;
  const next = calls[0];
  return (
    <section aria-labelledby="se-vienen" className="rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-5 sm:p-6 space-y-4 min-w-0">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0"><CalendarClock className="w-5 h-5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-amber-700">Se vienen convocatorias</p>
          <h2 id="se-vienen" className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
            {next.label} abriría {daysText(next.days)}
          </h2>
          <p className="text-sm text-slate-700 mt-1">{intro || 'Las convocatorias abren por pocas semanas. Quien llega con su postulación preparada le saca ventaja al resto.'}</p>
        </div>
      </div>
      <ul className="grid gap-2 sm:grid-cols-3">
        {calls.map(c => (
          <li key={c.id} className="rounded-2xl bg-white border border-amber-200 p-3.5 flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-black text-amber-700">{fmtShortDate(c.date)}</span>
              <span className="text-[11px] font-bold text-slate-500">{daysText(c.days)}</span>
            </div>
            <p className="text-sm font-bold text-slate-900 leading-snug">{c.label}</p>
            <p className="text-xs text-slate-600">{c.detail ? `${c.detail} · ` : ''}{c.amount}</p>
            <button type="button" onClick={() => onAction(c)} className="mt-auto self-start inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline cursor-pointer">
              {actionLabel} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-500">{UPCOMING_SOURCE} Cuando abran, aparecen en el monitor y te avisamos por correo si tu empresa calza.</p>
    </section>
  );
};
