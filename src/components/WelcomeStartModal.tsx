import React, { useEffect, useRef } from 'react';
import { FileSearch, ListChecks, Rocket, ArrowRight, X } from 'lucide-react';
import type { ChileanFund } from '../types/funds';

interface Props {
  open: boolean;
  suggestedFund: ChileanFund | null;
  onStartWithFund: (fund: ChileanFund) => void;
  onUploadTaxFolder: () => void;
  onBrowseFunds: () => void;
  onClose: () => void;
}

/**
 * Primera entrada de una cuenta sin postulaciones: el usuario elige por dónde empezar,
 * en vez de crearle una postulación automáticamente.
 */
export const WelcomeStartModal: React.FC<Props> = ({ open, suggestedFund, onStartWithFund, onUploadTaxFolder, onBrowseFunds, onClose }) => {
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    firstBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const options: { key: string; icon: React.ElementType; title: string; text: string; onClick: () => void; primary?: boolean }[] = [];
  if (suggestedFund) {
    options.push({
      key: 'fund',
      icon: Rocket,
      title: `Postular a ${suggestedFund.name}`,
      text: 'Es el fondo que más calza con tus respuestas del diagnóstico. Creamos tu hoja de ruta para ese fondo.',
      onClick: () => onStartWithFund(suggestedFund),
      primary: true
    });
  }
  options.push({
    key: 'carpeta',
    icon: FileSearch,
    title: 'Subir mi carpeta tributaria',
    text: 'Gratis y en un minuto: ves a qué fondos calificas, tus ventas mes a mes y qué regularizar antes de postular.',
    onClick: onUploadTaxFolder,
    primary: !suggestedFund
  });
  options.push({
    key: 'listado',
    icon: ListChecks,
    title: 'Elegir un fondo del listado',
    text: 'Revisa los fondos disponibles y elige tú a cuál quieres postular.',
    onClick: onBrowseFunds
  });

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-slate-950/50 p-3 sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="welcome-start-title" className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl p-6 sm:p-8 space-y-5">
        <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer">
          <X className="w-5 h-5" />
        </button>
        <div className="space-y-1.5 pr-8">
          <h2 id="welcome-start-title" className="text-xl sm:text-2xl font-black text-slate-900">¿Cómo quieres empezar?</h2>
          <p className="text-sm text-slate-600">Tu cuenta está lista. Elige por dónde partir; puedes cambiar de idea cuando quieras.</p>
        </div>
        <ul className="space-y-3">
          {options.map((o, i) => {
            const Icon = o.icon;
            return (
              <li key={o.key}>
                <button
                  ref={i === 0 ? firstBtnRef : undefined}
                  type="button"
                  onClick={o.onClick}
                  className={`w-full text-left rounded-2xl border p-4 flex items-start gap-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    o.primary ? 'border-blue-300 bg-blue-50 hover:bg-blue-100/70' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${o.primary ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      {o.title}
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                    </span>
                    <span className="block text-[13px] text-slate-600 leading-relaxed mt-0.5">{o.text}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={onClose} className="w-full text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">
          Ahora no, solo quiero mirar
        </button>
      </div>
    </div>
  );
};
