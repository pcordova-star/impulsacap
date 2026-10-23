import React, { useMemo, useState } from 'react';
import { Trophy, MapPin } from 'lucide-react';
import type { CompanyProfile } from '../types/funds';
import { similarWinners, winnersInRegion, SECTOR_LABEL, WINNERS_SOURCE_NOTE } from '../data/semillaWinners';

/**
 * "Proyectos parecidos al tuyo que ganaron Semilla Inicia": ejemplos reales por rubro y región,
 * más lo que tienen en común los ganadores. Inspira sin copiar.
 */
export const SimilarWinners: React.FC<{ profile: CompanyProfile; compact?: boolean }> = ({ profile, compact }) => {
  const pp = profile.projectProfile || ({} as any);
  const text = [pp.whatItDoes, pp.problemAndTarget, pp.currentSolutionAndDiff, profile.sector, profile.projectSummary].filter(Boolean).join(' ');
  const { sectors, items } = useMemo(() => similarWinners(text, profile.region, compact ? 3 : 6), [text, profile.region, compact]);
  const regional = useMemo(() => winnersInRegion(profile.region), [profile.region]);
  const [showAll, setShowAll] = useState(false);
  const regionName = String(profile.region || '').replace(/^Región (de |del )?/, '');

  return (
    <section className="rounded-3xl bg-white border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Trophy className="w-5 h-5" /></span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-amber-700">Proyectos que ganaron Semilla Inicia</p>
          <h3 className="text-base sm:text-lg font-bold text-slate-900">
            {items.length > 0
              ? (sectors.length ? `Ganadores parecidos al tuyo (${sectors.slice(0, 2).map(s => SECTOR_LABEL[s]).join(' · ')})` : `Ganadores de ${regionName}`)
              : 'Cuéntanos tu proyecto para mostrarte ganadores parecidos'}
          </h3>
          {regional.length > 0 && (
            <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> En {regionName} conocemos {regional.length} {regional.length === 1 ? 'ganador' : 'ganadores'} entre 2020 y 2025.</p>
          )}
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {(showAll ? items : items.slice(0, compact ? 3 : 4)).map(({ w, sameRegion }) => (
            <li key={w.name + w.year} className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
              <p className="text-sm font-bold text-slate-900">{w.name}</p>
              <p className="text-[11px] text-slate-500">{w.region}{sameRegion ? ' (tu región)' : ''} · {w.year}{w.mujeres ? ' · Inicia Mujeres' : ''}</p>
              <p className="text-xs text-slate-700 mt-1">{w.idea}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">Completa "¿Qué hace tu empresa o proyecto?" en Mi empresa y te mostramos proyectos del mismo rubro que ganaron.</p>
      )}
      {!compact && items.length > 4 && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="text-xs font-bold text-blue-700 hover:underline cursor-pointer">{showAll ? 'Ver menos' : `Ver ${items.length - 4} más`}</button>
      )}

      {!compact && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-1.5">
          <p className="text-sm font-bold text-amber-900">Lo que tienen en común los ganadores</p>
          <ul className="text-sm text-amber-950 space-y-1 list-disc pl-5">
            <li>Su idea se explica en una línea: un problema concreto y una solución clara. Escribe la tuya así antes de redactar el resto.</li>
            <li>En regiones, muchos aprovechan un recurso o problema local (calafate en Aysén, niebla costera en Tarapacá, algas en Arica). Si tu proyecto tiene ese vínculo, destácalo.</li>
            <li>Se repite la tecnología aplicada a un problema real (minería, salud, educación, trámites), no la tecnología por sí sola.</li>
            <li>Sustentabilidad y economía circular aparecen en muchos ganadores: si tu proyecto reduce residuos, agua o energía, dilo con datos.</li>
          </ul>
        </div>
      )}
      <p className="text-[11px] text-slate-400">{WINNERS_SOURCE_NOTE} Úsalos como inspiración: los evaluadores premian ideas propias.</p>
    </section>
  );
};
