import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Info } from 'lucide-react';
import { setServiceStartConfirmationHandler } from '../utils/serviceStartEvents';

/**
 * Aviso previo al primer uso del Plan Trimestral tras cada compra.
 * Con la confirmación, el servicio se entiende iniciado y termina la posibilidad de retracto
 * (Ley 19.496, art. 3 bis; sección 5 de los Términos y Condiciones).
 */
export const ServiceStartModal: React.FC<{ onOpenTerms: () => void }> = ({ onOpenTerms }) => {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<((accepted: boolean) => void) | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return setServiceStartConfirmationHandler(
      () =>
        new Promise<boolean>(resolve => {
          resolverRef.current = resolve;
          setOpen(true);
        })
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = (accepted: boolean) => {
    setOpen(false);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    resolve?.(accepted);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-start-title"
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-6 sm:p-8 space-y-5"
      >
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="space-y-3">
          <h2 id="service-start-title" className="text-xl font-black text-slate-900">
            Vas a comenzar a usar tu Plan Trimestral
          </h2>
          <p className="text-[15px] text-slate-700 leading-relaxed">
            Esta es la primera vez que usas una herramienta del plan con esta compra. Al continuar, el servicio se considera iniciado y <strong>ya no podrás ejercer el derecho a retracto</strong> de esta compra.
          </p>
          <div className="flex gap-2.5 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-600 leading-relaxed">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <span>
              Si prefieres retractarte, no continúes y escríbenos a{' '}
              <a href="mailto:contacto@impulsacap.cl" className="text-blue-700 underline underline-offset-2">contacto@impulsacap.cl</a>{' '}
              dentro de 10 días desde el pago.{' '}
              <button type="button" onClick={() => { close(false); onOpenTerms(); }} className="text-blue-700 underline underline-offset-2 cursor-pointer">
                Ver la sección 5 de los Términos
              </button>
            </span>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-5 py-3 rounded-2xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 cursor-pointer"
          >
            Ahora no
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => close(true)}
            className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Comenzar a usar el plan
          </button>
        </div>
      </div>
    </div>
  );
};
