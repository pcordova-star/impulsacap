import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X, Volume2, VolumeX, ArrowRight } from 'lucide-react';
import { onToast, playToastSound, isToastSoundOn, setToastSoundOn, type ToastOptions, type ToastLevel } from '../utils/toast';

const STYLE: Record<ToastLevel, { icon: React.ElementType; ring: string; iconCls: string }> = {
  info: { icon: Info, ring: 'border-blue-200', iconCls: 'bg-blue-50 text-blue-600' },
  success: { icon: CheckCircle2, ring: 'border-emerald-200', iconCls: 'bg-emerald-50 text-emerald-600' },
  warning: { icon: AlertTriangle, ring: 'border-amber-300', iconCls: 'bg-amber-50 text-amber-600' },
  error: { icon: XCircle, ring: 'border-rose-300', iconCls: 'bg-rose-50 text-rose-600' }
};

type Item = ToastOptions & { key: number; leaving?: boolean };

/** Pila de avisos emergentes: arriba a la derecha en computador, abajo en celular. */
export const ToastCenter: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [soundOn, setSoundOn] = useState(isToastSoundOn());
  const counter = useRef(0);

  const dismiss = useCallback((key: number) => {
    setItems(prev => prev.map(i => (i.key === key ? { ...i, leaving: true } : i)));
    setTimeout(() => setItems(prev => prev.filter(i => i.key !== key)), 220);
  }, []);

  useEffect(() => onToast(t => {
    const key = ++counter.current;
    setItems(prev => [...prev.filter(i => i.id !== t.id), { ...t, key }].slice(-3));
    if (!t.silent) playToastSound(t.level || 'info');
    const ms = t.durationMs ?? 10000;
    if (ms > 0) setTimeout(() => dismiss(key), ms);
  }), [dismiss]);

  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed z-[80] inset-x-3 bottom-24 sm:bottom-auto sm:inset-x-auto sm:right-5 sm:top-20 flex flex-col gap-3 sm:w-[380px] pointer-events-none"
    >
      {items.map(t => {
        const st = STYLE[t.level || 'info'];
        const Icon = st.icon;
        return (
          <div
            key={t.key}
            role="status"
            className={`pointer-events-auto rounded-2xl bg-white border ${st.ring} shadow-xl shadow-slate-900/10 p-4 flex gap-3 transition-all duration-200 ${
              t.leaving ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0 animate-toast-in'
            }`}
          >
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${st.iconCls}`}>
              <Icon className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-bold text-slate-900 leading-snug pr-1">{t.title}</p>
              {t.message && <p className="text-[13px] text-slate-600 leading-relaxed">{t.message}</p>}
              <div className="flex items-center justify-between gap-2 pt-1">
                {t.action ? (
                  <button
                    type="button"
                    onClick={() => { t.action!.onClick(); dismiss(t.key); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                  >
                    {t.action.label}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                ) : <span />}
                <button
                  type="button"
                  onClick={() => { const next = !soundOn; setSoundOn(next); setToastSoundOn(next); }}
                  aria-label={soundOn ? 'Silenciar avisos' : 'Activar sonido de avisos'}
                  title={soundOn ? 'Silenciar avisos' : 'Activar sonido de avisos'}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.key)}
              aria-label="Cerrar aviso"
              className="self-start p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
