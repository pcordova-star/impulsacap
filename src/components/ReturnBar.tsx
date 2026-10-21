import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getReturnContext, onReturnContext, setReturnContext, type ReturnContext } from '../utils/navFocus';

/**
 * Barra fija "Volver a tu postulación" cuando el usuario salió de una postulación
 * para completar datos en Mi empresa. Evita que se pierda entre formularios.
 */
export const ReturnBar: React.FC<{ activeTab: string; onReturn: (ctx: ReturnContext) => void }> = ({ activeTab, onReturn }) => {
  const [ctx, setCtx] = useState<ReturnContext | null>(getReturnContext());
  useEffect(() => onReturnContext(setCtx), []);
  useEffect(() => {
    if (activeTab === 'postulation') setReturnContext(null);
  }, [activeTab]);

  if (!ctx || activeTab !== 'my-company') return null;
  return (
    <div className="fixed inset-x-0 bottom-20 sm:bottom-6 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-xl rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 p-3 sm:p-3.5 flex items-center justify-between gap-3">
        <p className="text-xs leading-snug min-w-0">
          Estás completando tus datos para <strong className="font-bold">{ctx.label}</strong>. Guarda los cambios y vuelve cuando termines.
        </p>
        <button
          type="button"
          onClick={() => { const c = ctx; setReturnContext(null); onReturn(c); }}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a la postulación
        </button>
      </div>
    </div>
  );
};
