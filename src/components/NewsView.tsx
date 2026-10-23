import React, { useEffect, useMemo, useState } from 'react';
import { Newspaper, ExternalLink, Bell, Landmark, Building2, Megaphone } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { CHILEAN_FUNDS } from '../data/chileanFunds';

export interface NewsItem {
  title: string;
  summary: string;
  type: string;
  audience: string;
  url: string;
  sourceName: string;
  kind: 'oficial' | 'gobierno' | 'prensa';
  fundIds: string[];
  importance: number;
  date: string | null;
}

export const NEWS_TYPE_LABEL: Record<string, string> = {
  apertura: 'Convocatoria abierta',
  cierre: 'Cierre próximo',
  resultados: 'Resultados',
  cambio_bases: 'Cambio en las bases',
  presupuesto: 'Presupuesto',
  politica: 'Anuncio del gobierno',
  evento: 'Evento o taller',
  otro: 'Novedad'
};

const KIND = {
  oficial: { label: 'Fuente oficial', icon: Building2 },
  gobierno: { label: 'Gobierno', icon: Landmark },
  prensa: { label: 'Prensa', icon: Megaphone }
} as const;

export function useNews() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    apiFetch('/api/novedades')
      .then(r => r.json())
      .then(d => { if (alive) setItems(Array.isArray(d?.items) ? d.items : []); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, []);
  return items;
}

export const formatNewsDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
};

export const NewsCard: React.FC<{ item: NewsItem; compact?: boolean }> = ({ item, compact }) => {
  const k = KIND[item.kind] || KIND.prensa;
  const funds = item.fundIds.map(id => CHILEAN_FUNDS.find(f => f.id === id)?.name).filter(Boolean) as string[];
  return (
    <article className={`rounded-2xl bg-white border ${item.importance >= 3 ? 'border-rose-200' : 'border-slate-200'} p-4 sm:p-5 flex flex-col gap-2`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className={`font-black uppercase tracking-wider ${item.importance >= 3 ? 'text-rose-700' : 'text-blue-700'}`}>{NEWS_TYPE_LABEL[item.type] || 'Novedad'}</span>
        <span className="text-slate-300">•</span>
        <span className="inline-flex items-center gap-1 text-slate-500"><k.icon className="w-3.5 h-3.5" />{item.sourceName}</span>
        {item.date && <><span className="text-slate-300">•</span><span className="text-slate-500">{formatNewsDate(item.date)}</span></>}
      </div>
      <h3 className="text-base font-bold text-slate-900 leading-snug">{item.title}</h3>
      {!compact && item.summary && <p className="text-sm text-slate-700 leading-relaxed">{item.summary}</p>}
      {!compact && item.audience && <p className="text-xs text-slate-600"><strong>Le sirve a:</strong> {item.audience}</p>}
      {!compact && funds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">{funds.map(n => <span key={n} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">{n}</span>)}</div>
      )}
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline">
        Leer la fuente <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </article>
  );
};

const FILTERS = [
  { id: 'todas', label: 'Todas' },
  { id: 'convocatorias', label: 'Convocatorias', types: ['apertura', 'cierre', 'resultados', 'cambio_bases'] },
  { id: 'gobierno', label: 'Gobierno y presupuesto', types: ['presupuesto', 'politica'] },
  { id: 'eventos', label: 'Eventos y talleres', types: ['evento'] }
];

export const NewsView: React.FC<{ loggedIn: boolean; onOpenAuth?: () => void }> = ({ loggedIn, onOpenAuth }) => {
  const items = useNews();
  const [filter, setFilter] = useState('todas');
  const shown = useMemo(() => {
    const f = FILTERS.find(x => x.id === filter);
    return (items || []).filter(it => !f?.types || f.types.includes(it.type));
  }, [items, filter]);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2"><Newspaper className="w-4 h-4" /> Novedades de fondos concursables</p>
        <h1 className="mt-1.5 text-xl sm:text-2xl font-bold leading-snug">Lo que se abre, lo que cierra y lo que viene, explicado en simple.</h1>
        <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">
          Revisamos todos los días a Corfo, Sercotec, ANID, FIA, Start-Up Chile, los ministerios y la prensa. Cada novedad la resumimos con nuestras palabras y te decimos a quién le sirve. Para el detalle oficial, siempre enlazamos la fuente.
        </p>
        <p className="mt-3 text-xs text-slate-400 flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" />
          {loggedIn
            ? 'Te enviamos un resumen cada lunes y te avisamos de inmediato si abre un fondo que calza con tu empresa.'
            : <>Crea tu cuenta y te enviamos un resumen cada lunes, más un aviso cuando abra un fondo que calce con tu empresa. {onOpenAuth && <button type="button" onClick={onOpenAuth} className="underline font-bold text-cyan-300 cursor-pointer">Crear cuenta</button>}</>}
        </p>
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`px-3.5 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${filter === f.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>{f.label}</button>
        ))}
      </div>

      {items === null ? (
        <p className="text-sm text-slate-500">Cargando novedades…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200 p-6 text-sm text-slate-600">
          Todavía no hay novedades publicadas en esta categoría. Las revisamos todos los días.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map(it => <NewsCard key={it.url + it.title} item={it} />)}
        </div>
      )}
    </div>
  );
};

/** Bloque corto para el panel: las 3 novedades más importantes */
export const NewsTeaser: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const items = useNews();
  const top = useMemo(() => [...(items || [])].sort((a, b) => (b.importance - a.importance) || String(b.date).localeCompare(String(a.date))).slice(0, 3), [items]);
  if (!top.length) return null;
  return (
    <section className="rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><Newspaper className="w-4 h-4 text-blue-600" /> Novedades de fondos</p>
        <button type="button" onClick={onOpen} className="text-xs font-bold text-blue-700 hover:underline cursor-pointer">Ver todas</button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {top.map(it => <NewsCard key={it.url + it.title} item={it} compact />)}
      </div>
    </section>
  );
};
