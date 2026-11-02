import React from 'react';
import type { ChileanFund } from '../types/funds';
import { getFundRules } from '../data/fundStandards';

/**
 * Pauta de evaluación trazable: de qué documento sale (y su fecha de revisión), qué escala usa,
 * si hay nota mínima, las etapas con su peso y los criterios con su ponderación.
 * Se usa en la revisión con IA, la hoja de ruta y el expediente, para que todos digan lo mismo.
 */
export const EvaluationGuide: React.FC<{ fund: ChileanFund; dark?: boolean; compact?: boolean }> = ({ fund, dark = true, compact = false }) => {
  const r = getFundRules(fund);
  const ev = r.evaluation;
  const own = /referencial/.test(ev.scale);
  const crit = (fund.evaluationCriteria || []) as { name: string; weight: number; description?: string }[];
  const refWeights = crit.some(c => /referencial/i.test(c.description || ''));
  const t = dark
    ? { box: 'bg-slate-900 border-slate-700 text-slate-300', strong: 'text-white', sub: 'text-slate-400', link: 'text-cyan-300', row: 'border-slate-800' }
    : { box: 'bg-slate-50 border-slate-200 text-slate-700', strong: 'text-slate-900', sub: 'text-slate-500', link: 'text-blue-700', row: 'border-slate-200' };
  const date = r.bases.verifiedAt ? r.bases.verifiedAt.split('-').reverse().join('-') : null;
  return (
    <div className={`p-4 rounded-xl border text-xs space-y-2 print:border-black print:bg-white print:text-black ${t.box}`}>
      <p className={`font-bold ${t.strong} print:text-black`}>Pauta de evaluación de {fund.name}</p>
      <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1">
        <dt className={t.sub}>Fuente</dt>
        <dd>{r.bases.url ? <a href={r.bases.url} target="_blank" rel="noopener noreferrer" className={`${t.link} underline print:text-black`}>{r.bases.title}</a> : r.bases.title}{date ? ` · revisada por ImpulsaCap el ${date}` : ''}</dd>
        <dt className={t.sub}>Escala</dt>
        <dd>{ev.scale.split(' (')[0]}{own ? ' · pauta propia de ImpulsaCap (el fondo no publica una escala equivalente para esta etapa)' : ' · según las bases'}</dd>
        <dt className={t.sub}>Para ser recomendado</dt>
        <dd>{ev.passMark !== null ? `Nota final de al menos ${String(ev.passMark).replace('.', ',')}` : 'Sin nota de corte publicada: se adjudica por ranking'}{ev.minEach ? ` · mínimo ${String(ev.minEach).replace('.', ',')} en cada criterio` : ''}{ev.passMark === null ? ` · meta sugerida por ImpulsaCap: ${String(ev.target).replace('.', ',')}` : ''}</dd>
      </dl>
      {ev.stages && ev.stages.length > 0 && (
        <div>
          <p className={`font-semibold ${t.strong} print:text-black`}>Etapas de la evaluación</p>
          <ol className="list-decimal pl-5 space-y-0.5">
            {ev.stages.map(st => <li key={st.name}>{st.name}{st.weight ? ` (${st.weight}%)` : ''}{st.detail ? `: ${st.detail}` : ''}</li>)}
          </ol>
        </div>
      )}
      {!compact && crit.length > 0 && (
        <div>
          <p className={`font-semibold ${t.strong} print:text-black`}>Criterios y ponderaciones{refWeights ? ' (referenciales)' : ''}</p>
          <ul className="space-y-0.5">
            {crit.map(c => (
              <li key={c.name} className={`flex justify-between gap-3 border-b last:border-b-0 py-0.5 ${t.row}`}>
                <span>{c.name}</span><span className="font-mono shrink-0">{c.weight}%</span>
              </li>
            ))}
          </ul>
          {refWeights && <p className={`mt-1 ${t.sub}`}>El organismo no publica estas ponderaciones para la etapa actual: ImpulsaCap las usa como referencia.</p>}
        </div>
      )}
      <p className={t.sub}>{ev.rule}</p>
      <p className={t.sub}>La revisión con IA es orientativa: la nota real la pone el organismo. Los requisitos administrativos están en la hoja de ruta; esta pauta mide la calidad del proyecto.</p>
    </div>
  );
};
