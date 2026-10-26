import React, { useMemo, useState } from 'react';
import { Wrench, Truck, Users, Hammer, KeyRound, Package, Megaphone, Code2, FlaskConical, GraduationCap, Globe2, CheckCircle2, AlertCircle, XCircle, ArrowRight, Info } from 'lucide-react';
import type { ChileanFund } from '../types/funds';
import { USE_CATEGORIES, fundsForUse, type UseId } from '../data/fundUses';

const ICONS: Record<UseId, React.FC<{ className?: string }>> = {
  maquinaria: Wrench, vehiculos: Truck, personas: Users, local: Hammer, arriendo: KeyRound, mercaderia: Package,
  marketing: Megaphone, tecnologia: Code2, prototipos: FlaskConical, asesoria: GraduationCap, exportar: Globe2
};

/**
 * "¿Para qué necesitas la plata?": eliges qué quieres financiar y ves qué fondos lo financian,
 * cuáles con límites y cuáles no. Sale de las bases de cada fondo.
 */
export const FundUseFinder: React.FC<{
  funds: ChileanFund[];
  onPickFund: (fund: ChileanFund) => void;
  pickLabel?: string;
  /** Versión compacta para el buscador de fondos */
  compact?: boolean;
}> = ({ funds, onPickFund, pickLabel = 'Ver si califico', compact = false }) => {
  const [use, setUse] = useState<UseId>('maquinaria');
  const cat = USE_CATEGORIES.find(c => c.id === use)!;
  const byId = useMemo(() => new Map(funds.map(f => [f.id, f])), [funds]);
  const res = useMemo(() => fundsForUse(use, funds.map(f => f.id)), [use, funds]);
  const listed = res.si.length + res.tope.length + res.no.length;
  const unknown = funds.filter(f => f.evaluationCriteria?.length).length - listed;

  const Row: React.FC<{ id: string; note?: string; kind: 'si' | 'tope' }> = ({ id, note, kind }) => {
    const f = byId.get(id);
    if (!f) return null;
    return (
      <li className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center gap-3 ${kind === 'si' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-amber-50/60 border-amber-200'}`}>
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {kind === 'si' ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              <span className="mr-1.5 px-1.5 py-0.5 rounded bg-slate-900 text-white font-mono text-[9px] align-middle">{f.agency}</span>
              {f.name}
            </p>
            <p className="text-xs text-slate-600 mt-0.5">{note || (kind === 'si' ? 'Lo financia' : 'Lo financia con límites')} · <span className="text-slate-500">{f.subsidyFormatted}</span></p>
          </div>
        </div>
        <button type="button" onClick={() => onPickFund(f)} className="self-start sm:self-center inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white border border-slate-300 hover:border-blue-400 text-xs font-bold text-blue-700 cursor-pointer shrink-0">
          {pickLabel} <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </li>
    );
  };

  return (
    <section aria-labelledby="para-que-plata" className={`min-w-0 ${compact ? 'rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 space-y-4' : 'space-y-5'}`}>
      <div className="max-w-3xl space-y-1.5">
        <p className="text-xs font-black uppercase tracking-wider text-blue-700">Antes de elegir un fondo</p>
        <h2 id="para-que-plata" className={`${compact ? 'text-lg' : 'text-2xl sm:text-3xl'} font-black text-slate-900 tracking-tight`}>¿Para qué necesitas la plata?</h2>
        <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed">Cada fondo financia cosas distintas. Elige lo que quieres comprar o pagar y te mostramos qué fondos lo financian, según sus bases.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1 sm:flex-wrap sm:overflow-visible" role="tablist" aria-label="Qué quieres financiar">
        {USE_CATEGORIES.map(c => {
          const Icon = ICONS[c.id];
          const on = c.id === use;
          return (
            <button key={c.id} type="button" role="tab" aria-selected={on} onClick={() => setUse(c.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs sm:text-sm font-bold border transition-colors cursor-pointer ${on ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'}`}>
              <Icon className="w-4 h-4" /> {c.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-3xl bg-slate-50 border border-slate-200 p-4 sm:p-5 space-y-4" role="tabpanel">
        <div className="flex items-start gap-2.5">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-slate-900">{cat.label} <span className="font-normal text-slate-500">· {cat.examples}</span></p>
            <p className="text-sm text-slate-700 mt-0.5">{cat.tip}</p>
          </div>
        </div>

        {res.si.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Lo financian ({res.si.length})</p>
            <ul className="grid gap-2 lg:grid-cols-2">{res.si.map(x => <Row key={x.id} id={x.id} note={x.note} kind="si" />)}</ul>
          </div>
        )}
        {res.tope.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-wider text-amber-700">Con límites ({res.tope.length})</p>
            <ul className="grid gap-2 lg:grid-cols-2">{res.tope.map(x => <Row key={x.id} id={x.id} note={x.note} kind="tope" />)}</ul>
          </div>
        )}
        {res.si.length === 0 && res.tope.length === 0 && (
          <p className="text-sm text-slate-700">Ningún fondo del catálogo lo financia claramente según sus bases.</p>
        )}
        {res.no.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-slate-600">
            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <p><strong className="text-slate-800">No lo financian:</strong> {res.no.map(x => `${byId.get(x.id)?.name || x.id}${x.note ? ` (${x.note.charAt(0).toLowerCase() + x.note.slice(1)})` : ''}`).join(' · ')}</p>
          </div>
        )}
        {unknown > 0 && (
          <p className="text-[11px] text-slate-500">Los otros {unknown} fondos no lo mencionan en sus bases: revísalo antes de postular. Ningún fondo financia IVA, deudas ni gastos personales.</p>
        )}
      </div>
    </section>
  );
};
