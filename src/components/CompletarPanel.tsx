import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Save, Wand2 } from 'lucide-react';

/**
 * "Para cerrar esta sección": convierte cada marca [COMPLETAR: …] que dejó la IA en una pregunta
 * con su propia casilla. La persona responde lo que sabe, se pone en el texto y lo que falte
 * queda guardado como pendiente para seguir después (como un consultor que pregunta lo que necesita).
 */
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60);
export const completarKey = (label: string) => `completar_${slug(label)}`;

export function extractPlaceholders(text: string): { full: string; label: string }[] {
  const out: { full: string; label: string }[] = [];
  const seen = new Set<string>();
  const re = /\[COMPLETAR:?\s*([^\]]+)\]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || ''))) {
    const label = m[1].trim();
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ full: m[0], label });
  }
  return out;
}

interface Props {
  text: string;
  /** Datos que la IA dijo que faltan pero que no dejó marcados en el texto */
  otherMissing?: string[];
  savedAnswers: Record<string, string>;
  onApplyText: (newText: string, answers: Record<string, string>) => void;
  onSaveAnswers: (answers: Record<string, string>) => void;
}

export const CompletarPanel: React.FC<Props> = ({ text, otherMissing = [], savedAnswers, onApplyText, onSaveAnswers }) => {
  const placeholders = useMemo(() => extractPlaceholders(text), [text]);
  const extra = otherMissing.filter(t => !placeholders.some(p => p.label === t));
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    placeholders.forEach(p => { const v = savedAnswers[completarKey(p.label)]; if (v) init[p.label] = v; });
    return init;
  });
  const [notice, setNotice] = useState<string | null>(null);

  if (placeholders.length === 0 && extra.length === 0) {
    return text.trim().length > 60 ? (
      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 mt-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>Sección completa: no le falta ningún dato.</span>
      </div>
    ) : null;
  }

  const answered = placeholders.filter(p => (answers[p.label] || '').trim()).length;
  const toStore = () => {
    const out: Record<string, string> = {};
    placeholders.forEach(p => { const v = (answers[p.label] || '').trim(); if (v) out[completarKey(p.label)] = v; });
    return out;
  };

  const apply = () => {
    let next = text;
    placeholders.forEach(p => {
      const v = (answers[p.label] || '').trim();
      if (v) next = next.split(p.full).join(v);
    });
    const left = extractPlaceholders(next).length;
    onApplyText(next, toStore());
    setNotice(left === 0 ? '¡Listo! Pusimos tus respuestas en el texto y la sección quedó completa.' : `Pusimos tus respuestas en el texto. Quedan ${left} ${left === 1 ? 'dato' : 'datos'} por completar: tu avance quedó guardado.`);
  };

  const saveLater = () => {
    onSaveAnswers(toStore());
    setNotice('Guardamos lo que respondiste. Puedes volver a esta sección cuando tengas el resto: queda marcada como pendiente en tu hoja de ruta.');
  };

  return (
    <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-3 mt-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-amber-100">
            Para cerrar esta sección {placeholders.length === 1 ? 'falta 1 dato' : `faltan ${placeholders.length} datos`}
          </h4>
          <p className="text-[11px] text-amber-200/80 leading-relaxed mt-0.5">
            La IA no inventa datos de tu empresa. Responde aquí lo que sepas y lo ponemos en el texto.
            {placeholders.length > 3 ? ' Son varios: responde los que tengas a mano y guarda; puedes seguir después.' : ' Si no lo tienes ahora, guarda y sigue después.'}
          </p>
        </div>
      </div>

      <ol className="space-y-2.5">
        {placeholders.map((p, i) => (
          <li key={p.label} className="space-y-1">
            <label htmlFor={`completar-${i}`} className="block text-xs font-semibold text-amber-50">
              {i + 1}. {p.label.charAt(0).toUpperCase() + p.label.slice(1)}
            </label>
            <textarea
              id={`completar-${i}`}
              rows={2}
              value={answers[p.label] || ''}
              onChange={e => setAnswers(a => ({ ...a, [p.label]: e.target.value }))}
              placeholder="Escribe el dato real (puede ser breve)"
              className="w-full bg-slate-950 border border-amber-800/60 text-slate-100 text-xs rounded-xl p-2.5 focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
            />
          </li>
        ))}
      </ol>

      {extra.length > 0 && (
        <div className="text-[11px] text-amber-200/90">
          <p className="font-semibold">Además, para un texto más sólido conviene contar con:</p>
          <ul className="list-disc pl-5 mt-0.5">{extra.map(t => <li key={t}>{t}</li>)}</ul>
          <p className="mt-0.5">Agrégalo en las preguntas de arriba y vuelve a generar la sección.</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {placeholders.length > 0 && (
          <button type="button" onClick={apply} disabled={answered === 0} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <Wand2 className="w-4 h-4" /> Poner mis respuestas en el texto ({answered}/{placeholders.length})
          </button>
        )}
        <button type="button" onClick={saveLater} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-amber-600/60 text-amber-100 hover:bg-amber-900/40 text-xs font-bold cursor-pointer">
          <Save className="w-4 h-4" /> Guardar y seguir después
        </button>
      </div>
      {notice && <p className="text-xs text-emerald-300" role="status">{notice}</p>}
    </div>
  );
};
