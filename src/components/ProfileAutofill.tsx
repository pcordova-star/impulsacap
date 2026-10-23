import React, { useRef, useState } from 'react';
import { Globe, FileUser, RefreshCw, CheckCircle2, ChevronDown, Sparkles } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';

/**
 * Opcional: completar el perfil del proyecto con información que la empresa ya tiene.
 * - ProfileAutofill: lee el sitio web y propone respuestas para describir la empresa y el proyecto.
 * - TeamCvImport: lee los currículums y arma el texto del equipo (va junto al campo de equipo /
 *   personal involucrado, en Mi empresa y en la sección de equipo del formulario).
 * Siempre como propuesta: el usuario revisa y elige.
 */
export type AutofillField = 'whatItDoes' | 'problemAndTarget' | 'currentSolutionAndDiff' | 'currentProgress' | 'businessModel' | 'teamDetails' | 'websiteOrSocial';

const LABELS: Record<string, string> = {
  whatItDoes: '¿Qué hace tu empresa o proyecto?',
  problemAndTarget: '¿Qué problema resuelve y a quién?',
  currentSolutionAndDiff: '¿Cómo lo resuelven hoy y qué te diferencia?',
  currentProgress: 'Avance actual',
  businessModel: 'Modelo de negocio',
  teamDetails: 'Equipo'
};

interface Props {
  values: Record<AutofillField, string>;
  onApply: (field: AutofillField, value: string) => void;
  projectSummary?: string;
}

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result || '').replace(/^data:[^;]+;base64,/, ''));
  r.onerror = () => reject(new Error('No se pudo leer el archivo'));
  r.readAsDataURL(file);
});

export const ProfileAutofill: React.FC<Props> = ({ values, onApply, projectSummary }) => {
  const [open, setOpen] = useState(false);
  const guessUrl = /\./.test(values.websiteOrSocial || '') && !/\s/.test((values.websiteOrSocial || '').trim()) ? values.websiteOrSocial.trim() : '';
  const [url, setUrl] = useState(guessUrl);
  const [webBusy, setWebBusy] = useState(false);
  const [webErr, setWebErr] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, string> | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [applied, setApplied] = useState<Record<string, boolean>>({});


  const readSite = async () => {
    setWebBusy(true); setWebErr(null); setSuggestions(null); setApplied({});
    try {
      const res = await apiFetch('/api/perfil/desde-web', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), timeoutMs: 90_000 });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || 'No pudimos leer tu sitio.');
      setPages(b.pages || []);
      setSuggestions(b.suggestions || {});
      if (!values.websiteOrSocial?.trim()) onApply('websiteOrSocial', url.trim());
      if (Object.keys(b.suggestions || {}).length === 0) setWebErr('Leímos tu sitio, pero no tiene información suficiente para estas preguntas. Complétalas a mano.');
    } catch (e: any) {
      setWebErr(e?.message || 'No pudimos leer tu sitio.');
    } finally {
      setWebBusy(false);
    }
  };

  const apply = (field: string, mode: 'fill' | 'replace' | 'append') => {
    const s = suggestions?.[field];
    if (!s) return;
    const cur = (values as any)[field]?.trim() || '';
    const next = mode === 'append' && cur ? `${cur}\n${s}` : s;
    onApply(field as AutofillField, next);
    setApplied(a => ({ ...a, [field]: true }));
  };
  const applyAllEmpty = () => {
    Object.keys(suggestions || {}).forEach(k => { if (!(values as any)[k]?.trim()) apply(k, 'fill'); });
  };

  const suggestionKeys = Object.keys(suggestions || {});

  return (
    <div className="rounded-2xl border border-cyan-200 bg-cyan-50/50">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 p-3.5 text-left cursor-pointer" aria-expanded={open}>
        <span className="flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
          <span>
            <span className="block text-xs font-bold text-slate-900">¿Tu empresa tiene sitio web? Úsalo para completar más rápido (opcional)</span>
            <span className="block text-[11px] text-slate-600">Leemos solo lo que ya está escrito y te proponemos respuestas. Tú eliges qué usar; nada se inventa.</span>
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3.5 pb-4 space-y-4">
          {/* Sitio web */}
          <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-2.5">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Globe className="w-4 h-4 text-blue-600" /> Desde tu sitio web</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                inputMode="url"
                autoComplete="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (url.trim() && !webBusy) readSite(); } }}
                placeholder="www.miempresa.cl"
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-sm focus:bg-white focus:border-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={readSite}
                disabled={webBusy || !url.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {webBusy ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Leyendo tu sitio…</> : 'Leer mi sitio'}
              </button>
            </div>
            {webErr && <p className="text-[11px] text-rose-700">{webErr}</p>}
            {suggestions && suggestionKeys.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500">Leímos {pages.length} página(s). Revisa cada propuesta antes de usarla:</p>
                  <button type="button" onClick={applyAllEmpty} className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer">Usar en todos los campos vacíos</button>
                </div>
                {suggestionKeys.map(k => {
                  const cur = (values as any)[k]?.trim();
                  return (
                    <div key={k} className={`rounded-xl border p-2.5 text-xs ${applied[k] ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
                      <p className="font-bold text-slate-700">{LABELS[k]}</p>
                      <p className="text-slate-700 mt-0.5 whitespace-pre-line">{suggestions[k]}</p>
                      <div className="flex flex-wrap gap-3 mt-1.5">
                        {applied[k] ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Agregado al perfil</span>
                        ) : cur ? (
                          <>
                            <button type="button" onClick={() => apply(k, 'append')} className="font-bold text-blue-700 hover:underline cursor-pointer">Agregar a lo que ya escribí</button>
                            <button type="button" onClick={() => apply(k, 'replace')} className="font-bold text-slate-600 hover:underline cursor-pointer">Reemplazar</button>
                          </>
                        ) : (
                          <button type="button" onClick={() => apply(k, 'fill')} className="font-bold text-blue-700 hover:underline cursor-pointer">Usar esta respuesta</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

/** Currículums → texto del equipo / personal involucrado en el proyecto */
export const TeamCvImport: React.FC<{ value: string; onApply: (value: string) => void; projectSummary?: string; dark?: boolean; fieldLabel?: string }> = ({ value, onApply, projectSummary, dark, fieldLabel = 'Equipo' }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [cvBusy, setCvBusy] = useState(false);
  const [cvErr, setCvErr] = useState<string | null>(null);
  const [people, setPeople] = useState<{ name: string; role: string; summary: string }[] | null>(null);
  const [teamText, setTeamText] = useState('');
  const [teamApplied, setTeamApplied] = useState(false);
  const values = { teamDetails: value };

  const readCvs = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setCvBusy(true); setCvErr(null); setPeople(null); setTeamApplied(false);
    try {
      const list = Array.from(files).slice(0, 5);
      const big = list.find(f => f.size > 5 * 1024 * 1024);
      if (big) throw new Error(`${big.name} pesa más de 5 MB.`);
      const payload = await Promise.all(list.map(async f => ({ name: f.name, mimeType: f.type, base64: await toBase64(f) })));
      const res = await apiFetch('/api/perfil/desde-cv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: payload, projectSummary }), timeoutMs: 120_000 });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error || 'No pudimos leer los currículums.');
      setPeople(b.people || []);
      setTeamText(b.teamDetails || '');
    } catch (e: any) {
      setCvErr(e?.message || 'No pudimos leer los currículums.');
    } finally {
      setCvBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };


  const box = dark ? 'border-slate-700 bg-slate-900/60' : 'border-emerald-200 bg-emerald-50/40';
  const txt = dark ? 'text-slate-200' : 'text-slate-800';
  const sub = dark ? 'text-slate-400' : 'text-slate-500';
  const item = dark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700';
  const link = dark ? 'text-cyan-300' : 'text-blue-700';
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${box}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`text-[11px] ${sub}`}><FileUser className="inline w-3.5 h-3.5 mr-1 text-emerald-500" /><strong className={txt}>¿Tienes los currículums del equipo?</strong> Súbelos (hasta 5, PDF o Word) y armamos este campo con nombre, rol y experiencia de cada persona. No guardamos los archivos.</p>
        <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="hidden" onChange={e => readCvs(e.target.files)} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={cvBusy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50 shrink-0"
        >
          {cvBusy ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Leyendo…</> : 'Subir currículums'}
        </button>
      </div>
      {cvErr && <p className="text-[11px] text-rose-500">{cvErr}</p>}
      {people && people.length === 0 && <p className={`text-[11px] ${sub}`}>No encontramos datos del equipo en esos archivos.</p>}
      {people && people.length > 0 && (
        <div className="space-y-2">
          <ul className="space-y-1.5 text-xs">
            {people.map((p, i) => (
              <li key={i} className={`rounded-lg border p-2 ${item}`}>
                <p className="font-bold">{p.name}{p.role ? <span className="font-normal opacity-70"> · {p.role}</span> : null}</p>
                <p>{p.summary}</p>
              </li>
            ))}
          </ul>
          {teamApplied ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-500 font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Agregado a "{fieldLabel}"</span>
          ) : (
            <div className="flex flex-wrap gap-3 text-xs">
              <button type="button" onClick={() => { const cur = values.teamDetails?.trim(); onApply(cur ? `${cur}\n${teamText}` : teamText); setTeamApplied(true); }} className={`font-bold hover:underline cursor-pointer ${link}`}>
                {values.teamDetails?.trim() ? `Agregar a lo que ya escribí` : `Usar en "${fieldLabel}"`}
              </button>
              {values.teamDetails?.trim() && (
                <button type="button" onClick={() => { onApply(teamText); setTeamApplied(true); }} className={`font-bold hover:underline cursor-pointer ${sub}`}>Reemplazar</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
