import React, { useEffect, useRef, useState } from 'react';
import { X, CheckCircle2 } from 'lucide-react';
import { onFeedbackRequest, FeedbackRequest, FeedbackMoment } from '../utils/feedbackEvents';
import { apiFetch } from '../utils/apiFetch';
import { auth } from '../firebase';
import { usePlan } from '../hooks/usePlan';

/**
 * Encuesta rápida en una esquina: "¿Cómo te está funcionando ImpulsaCap?" con 3 opciones.
 * Si la respuesta es Mal o Regular, pide un comentario opcional en una línea.
 * Aparece como máximo una vez por momento: siempre para el programa de prueba y a veces para el resto.
 */
const RATINGS = [
  { id: 'mal', emoji: '😞', label: 'Mal' },
  { id: 'regular', emoji: '😐', label: 'Regular' },
  { id: 'bien', emoji: '🙂', label: 'Bien' }
] as const;
type Rating = typeof RATINGS[number]['id'];

const SAMPLE_RATE = 0.35; // proporción de usuarios fuera del programa de prueba a los que se les pregunta

const seenKey = (uid: string, m: FeedbackMoment) => `impulsacap_feedback_${uid}_${m}`;
function alreadyAsked(uid: string, m: FeedbackMoment): boolean {
  try { return Boolean(localStorage.getItem(seenKey(uid, m))); } catch { return false; }
}
function markAsked(uid: string, m: FeedbackMoment) {
  try { localStorage.setItem(seenKey(uid, m), new Date().toISOString()); } catch { /* sin almacenamiento */ }
}

export const QuickFeedback: React.FC = () => {
  const { isBeta } = usePlan();
  const [req, setReq] = useState<FeedbackRequest | null>(null);
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isBetaRef = useRef(isBeta);
  isBetaRef.current = isBeta;
  const openRef = useRef(false);
  openRef.current = Boolean(req);

  useEffect(() => onFeedbackRequest(r => {
    const uid = auth.currentUser?.uid;
    if (!uid || openRef.current || alreadyAsked(uid, r.moment)) return;
    markAsked(uid, r.moment);
    if (!isBetaRef.current && Math.random() > SAMPLE_RATE) return;
    if (timer.current) clearTimeout(timer.current);
    // Se muestra un momento después, para no interrumpir mientras la persona mira el resultado
    timer.current = setTimeout(() => { setReq(r); setRating(null); setComment(''); setSent(false); }, 2500);
  }), []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!req) return null;

  const send = async (r: Rating, text?: string) => {
    setBusy(true);
    try {
      await apiFetch('/api/feedback/rapida', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moment: req.moment, rating: r, comment: (text || '').trim().slice(0, 1000), fundId: req.fundId, fundName: req.fundName, detail: req.detail })
      });
    } catch { /* la encuesta nunca bloquea */ }
    setBusy(false);
  };

  const choose = async (r: Rating) => {
    setRating(r);
    await send(r);
    if (r === 'bien') { setSent(true); setTimeout(() => setReq(null), 2500); }
  };
  const sendComment = async () => {
    if (rating && comment.trim()) await send(rating, comment);
    setSent(true);
    setTimeout(() => setReq(null), 2500);
  };

  return (
    <div role="dialog" aria-label="¿Cómo te está funcionando ImpulsaCap?" className="fixed z-50 bottom-20 sm:bottom-6 right-3 sm:right-6 left-3 sm:left-auto sm:w-80 rounded-2xl bg-white border border-slate-200 shadow-2xl p-4 animate-fade-in">
      <button type="button" onClick={() => setReq(null)} className="absolute top-2.5 right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Cerrar">
        <X className="w-4 h-4" />
      </button>
      {sent ? (
        <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2 pr-6"><CheckCircle2 className="w-4 h-4" /> ¡Gracias! Nos ayuda a mejorar.</p>
      ) : !rating || rating === 'bien' ? (
        <>
          <p className="text-sm font-bold text-slate-900 pr-6">¿Cómo te está funcionando ImpulsaCap?</p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {RATINGS.map(r => (
              <button key={r.id} type="button" disabled={busy} onClick={() => choose(r.id)} className="flex flex-col items-center gap-1 py-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer disabled:opacity-60">
                <span className="text-2xl leading-none" aria-hidden="true">{r.emoji}</span>
                <span className="text-xs font-semibold text-slate-700">{r.label}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-900 pr-6">¿Qué te costó o qué mejorarías?</p>
          <textarea
            rows={2}
            autoFocus
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Opcional: cuéntanos en una línea"
            className="w-full text-sm rounded-xl border border-slate-300 p-2.5 focus:border-blue-500 focus:outline-hidden"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setSent(true); setTimeout(() => setReq(null), 1500); }} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">Omitir</button>
            <button type="button" disabled={busy || !comment.trim()} onClick={sendComment} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50">Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
};
