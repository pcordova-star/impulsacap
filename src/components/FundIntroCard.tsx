import React, { useState } from 'react';
import { Compass, Users, Wallet, Trophy, Lightbulb, ChevronDown } from 'lucide-react';
import type { ChileanFund } from '../types/funds';
import { getFundIntro } from '../data/fundIntros';

/**
 * "Conoce tu fondo": la explicación del consultor al entrar a una postulación.
 * Se muestra abierta la primera vez y luego queda recogida (recordado por fondo).
 */
export const FundIntroCard: React.FC<{ fund: ChileanFund; userKey?: string }> = ({ fund, userKey = 'anon' }) => {
  const intro = getFundIntro(fund);
  const key = `impulsacap_${userKey}_intro_${fund.id}`;
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(key) !== 'visto'; } catch { return true; }
  });
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem(key, next ? '' : 'visto'); } catch { /* sin almacenamiento */ }
  };

  const rows = [
    { icon: Compass, title: 'En qué consiste', text: intro.queEs },
    { icon: Users, title: 'Para quién está pensado', text: intro.paraQuien },
    { icon: Wallet, title: 'Qué te financia', text: intro.queFinancia },
    { icon: Trophy, title: 'Cómo se gana', text: intro.comoSeGana }
  ];

  return (
    <section className="rounded-3xl bg-gradient-to-br from-blue-50 via-white to-emerald-50/60 border border-blue-200 shadow-sm overflow-hidden">
      <button type="button" onClick={toggle} aria-expanded={open} className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 cursor-pointer">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-blue-700">Conoce tu fondo</p>
          <h2 className="mt-1 text-lg sm:text-xl font-bold text-slate-900">{fund.name}</h2>
          <p className="mt-1 text-sm text-slate-700">{intro.hook}</p>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-xs font-bold text-blue-700 mt-1">
          {open ? 'Ocultar' : 'Leer explicación'}
          <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="px-5 sm:px-6 pb-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map(r => (
              <div key={r.title} className="rounded-2xl bg-white/80 border border-slate-200 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <r.icon className="w-4 h-4 text-blue-600" /> {r.title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{r.text}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex gap-3">
            <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900">Consejo de tu consultor</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-950">{intro.consejo}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Más abajo está tu hoja de ruta: los 6 pasos para postular a este fondo, en orden. Ve uno a la vez: tu consultor siempre te indica cuál sigue.
          </p>
        </div>
      )}
    </section>
  );
};
