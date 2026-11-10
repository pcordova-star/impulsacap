import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, ExternalLink, Copy, Check, Sparkles, Loader2, ChevronDown, ClipboardList } from 'lucide-react';
import { ChileanFund, CompanyProfile } from '../types/funds';
import { PortalAnswer, PortalForm, PortalQuestion } from '../data/portalForms';
import { apiFetch } from '../utils/apiFetch';

interface Props {
  open: boolean;
  onClose: () => void;
  form: PortalForm;
  fund: ChileanFund;
  profile: CompanyProfile;
  /** Textos ya redactados en el formulador (fuente para respuestas cortas) */
  sources: Record<string, string>;
  answers: Record<string, PortalAnswer>;
  onSave: (answers: Record<string, PortalAnswer>) => void;
  /** Sin plan: llevar a contratarlo */
  onNeedPlan?: () => void;
}

const AI_KINDS = new Set(['text', 'choice', 'multi']);
const YOU_LABEL: Record<string, string> = {
  fact: 'Lo respondes tú',
  personal: 'Dato personal: lo pones tú',
  doc: 'Archivo o enlace que subes tú',
  legal: 'Lo aceptas tú'
};

export const PortalFormMirror: React.FC<Props> = ({ open, onClose, form, fund, profile, sources, answers, onSave, onNeedPlan }) => {
  const [secIdx, setSecIdx] = useState(0);
  const [local, setLocal] = useState<Record<string, PortalAnswer>>(answers || {});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showPrepare, setShowPrepare] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const pillsRef = useRef<HTMLDivElement | null>(null);
  // Al cambiar de sección: arriba del todo y la pestaña activa a la vista (en celular se desplazan)
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
    (pillsRef.current?.children[secIdx] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [secIdx]);
  const latest = useRef(local);
  latest.current = local;

  useEffect(() => { if (open) setLocal(answers || {}); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); }, []);

  const stats = useMemo(() => {
    const all = form.sections.flatMap(s => s.questions);
    const isDone = (q: PortalQuestion) => {
      const a = local[q.id];
      if (!a) return false;
      if (q.kind === 'text') return Boolean(a.text?.trim()) && !(q.max && (a.text || '').length > q.max);
      if (q.kind === 'choice' || q.kind === 'multi') return Boolean(a.picks?.length);
      return Boolean(a.done);
    };
    return { total: all.length, done: all.filter(isDone).length, isDone };
  }, [form, local]);

  if (!open) return null;
  const section = form.sections[secIdx];

  const persist = (next: Record<string, PortalAnswer>, immediate = false) => {
    setLocal(next);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (immediate) onSave(next);
    else saveTimer.current = window.setTimeout(() => onSave(latest.current), 700);
  };
  const setAnswer = (id: string, patch: Partial<PortalAnswer>, immediate = false) => {
    persist({ ...latest.current, [id]: { ...latest.current[id], ...patch, updatedAt: new Date().toISOString() } }, immediate);
  };

  const generate = async (questions: PortalQuestion[], key: string) => {
    const qs = questions.filter(q => AI_KINDS.has(q.kind));
    if (qs.length === 0) return;
    setBusy(key); setError(null);
    try {
      const r = await apiFetch('/api/gemini/portal-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, fund, sectionTitle: section.titleEs, questions: qs, sources })
      });
      if (r.status === 402 || r.status === 403) { setError('Redactar con IA requiere el plan activo.'); return; }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { setError(data?.error || 'No se pudo redactar. Intenta de nuevo.'); return; }
      const got: Record<string, any> = data.answers || {};
      const next = { ...latest.current };
      const now = new Date().toISOString();
      for (const q of qs) if (got[q.id]) next[q.id] = { ...next[q.id], ...got[q.id], updatedAt: now };
      if (Object.keys(got).length === 0) setError('La IA no devolvió respuestas. Intenta de nuevo.');
      persist(next, true);
    } catch (e: any) {
      setError(e?.message || 'No se pudo redactar. Intenta de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  const copy = (k: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(k); setTimeout(() => setCopied(c => (c === k ? null : c)), 2000); }).catch(() => {});
  };

  const pendingAi = section.questions.filter(q => AI_KINDS.has(q.kind) && !stats.isDone(q));

  return (
    <div className="fixed inset-0 z-[65] bg-slate-950/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Formulario de ${form.name}`}>
      <div className="w-full max-w-4xl sm:max-h-[94vh] bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Encabezado */}
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Formulario del portal, pregunta por pregunta</p>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">{form.name}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{form.note}</p>
            </div>
            <button type="button" onClick={() => { if (saveTimer.current) { window.clearTimeout(saveTimer.current); onSave(latest.current); } onClose(); }} aria-label="Cerrar" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">{stats.done} de {stats.total} listas</span>
            <div className="h-1.5 flex-1 min-w-[120px] rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.round((stats.done / Math.max(1, stats.total)) * 100)}%` }} /></div>
            <a href={form.portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">Abrir el portal <ExternalLink className="w-3 h-3" /></a>
            <button type="button" onClick={() => setShowPrepare(v => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer"><ClipboardList className="w-3.5 h-3.5" /> Lo que te van a pedir <ChevronDown className={`w-3 h-3 transition-transform ${showPrepare ? 'rotate-180' : ''}`} /></button>
          </div>
          {showPrepare && (
            <ul className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
              {form.prepare.map(p => <li key={p}>• {p}</li>)}
            </ul>
          )}
          <div ref={pillsRef} className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {form.sections.map((s, i) => {
              const done = s.questions.filter(stats.isDone).length;
              return (
                <button key={s.id} type="button" onClick={() => setSecIdx(i)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${i === secIdx ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
                  {i + 1}. {s.titleEs} <span className={i === secIdx ? 'text-slate-300' : 'text-slate-400'}>{done}/{s.questions.length}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preguntas */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">En el portal: <strong className="text-slate-900">{section.title}</strong></p>
            {pendingAi.length > 0 && (
              <button type="button" disabled={Boolean(busy)} onClick={() => generate(pendingAi, `sec-${section.id}`)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer">
                {busy === `sec-${section.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Redactar las {pendingAi.length} pendientes con IA
              </button>
            )}
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs p-2.5 flex flex-wrap items-center gap-2">
              <span>{error}</span>
              {/plan/.test(error) && onNeedPlan && <button type="button" onClick={onNeedPlan} className="font-bold underline cursor-pointer">Ver el plan</button>}
            </div>
          )}

          {section.questions.map(q => {
            const a = local[q.id] || {};
            const done = stats.isDone(q);
            const len = (a.text || '').length;
            const over = q.max ? len > q.max : false;
            return (
              <div key={q.id} id={`portal-q-${q.id}`} className={`rounded-2xl bg-white border p-3.5 space-y-2 ${done ? 'border-emerald-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500"><span className="font-bold text-slate-700">Pregunta {q.n}</span> · en el portal: <span className="italic">"{q.portalLabel}"</span></p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{q.es}{q.optional ? <span className="font-normal text-slate-400"> (opcional)</span> : null}</p>
                    {q.hint && <p className="text-xs text-slate-500 mt-0.5">{q.hint}</p>}
                  </div>
                  {done && <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700"><Check className="w-3.5 h-3.5" /> Lista</span>}
                </div>

                {q.kind === 'text' && (
                  <div className="space-y-1.5">
                    <textarea
                      value={a.text || ''}
                      onChange={e => setAnswer(q.id, { text: e.target.value })}
                      rows={Math.min(8, Math.max(2, Math.ceil((q.max || 300) / 110)))}
                      placeholder="Escribe aquí o redacta con IA"
                      className={`w-full rounded-xl border px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 ${over ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-200'}`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`text-[11px] font-bold ${over ? 'text-red-600' : 'text-slate-500'}`}>{len} / {q.max} caracteres{over ? ' · el portal no acepta más: acórtalo' : ''}</span>
                      <div className="flex items-center gap-2">
                        {/\[COMPLETAR/.test(a.text || '') && <span className="text-[11px] font-bold text-amber-700">Tiene un dato por completar</span>}
                        <button type="button" disabled={Boolean(busy)} onClick={() => generate([q], q.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 text-[11px] font-bold cursor-pointer">
                          {busy === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}{a.text ? 'Rehacer' : 'Redactar'}
                        </button>
                        {a.text && <button type="button" onClick={() => copy(q.id, a.text!)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer">{copied === q.id ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}</button>}
                      </div>
                    </div>
                  </div>
                )}

                {(q.kind === 'choice' || q.kind === 'multi') && (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(q.options || []).map(o => {
                        const on = (a.picks || []).includes(o);
                        return (
                          <button key={o} type="button" onClick={() => {
                            const cur = a.picks || [];
                            const next = q.kind === 'choice' ? (on ? [] : [o]) : (on ? cur.filter(x => x !== o) : [...cur, o].slice(-(q.maxPicks || 10)));
                            setAnswer(q.id, { picks: next }, true);
                          }} className={`px-2 py-1 rounded-lg border text-[11px] cursor-pointer ${on ? 'bg-blue-600 border-blue-600 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}`}>{o}</button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600">{a.picks?.length ? <>Marca en el portal: <strong className="text-slate-900">{a.picks.join(' · ')}</strong>{a.reason ? ` — ${a.reason}` : ''}</> : (q.kind === 'multi' ? `Elige hasta ${q.maxPicks}` : 'Elige una')}</span>
                      <button type="button" disabled={Boolean(busy)} onClick={() => generate([q], q.id)} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 text-[11px] font-bold cursor-pointer">
                        {busy === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}Sugerir
                      </button>
                    </div>
                  </div>
                )}

                {!AI_KINDS.has(q.kind) && (
                  <label className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 cursor-pointer select-none">
                    <span className="text-[11px] font-bold text-slate-600">{YOU_LABEL[q.kind]} en el portal{q.kind === 'personal' ? ': la plataforma no guarda estos datos' : ''}</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                      <input type="checkbox" className="accent-emerald-600" checked={Boolean(a.done)} onChange={e => setAnswer(q.id, { done: e.target.checked }, true)} />
                      Ya lo hice
                    </span>
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-3 sm:p-4 border-t border-slate-200 flex items-center justify-between gap-2 bg-white">
          <button type="button" disabled={secIdx === 0} onClick={() => setSecIdx(i => i - 1)} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-800 text-xs font-bold cursor-pointer">Sección anterior</button>
          <span className="text-[11px] text-slate-500 hidden sm:inline">Se guarda solo. Copia cada respuesta y pégala en la misma pregunta del portal.</span>
          {secIdx < form.sections.length - 1
            ? <button type="button" onClick={() => setSecIdx(i => i + 1)} className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">Siguiente sección</button>
            : <button type="button" onClick={() => { if (saveTimer.current) { window.clearTimeout(saveTimer.current); onSave(latest.current); } onClose(); }} className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">Terminar</button>}
        </div>
      </div>
    </div>
  );
};
