import React, { useEffect, useRef, useState } from 'react';
import { onConfirmRequest, ConfirmRequest } from '../utils/confirmDialog';

/** Diálogo de confirmación de la app (se monta una vez en App) */
export const ConfirmHost: React.FC = () => {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => onConfirmRequest(r => setReq(r)), []);
  useEffect(() => { if (req) setTimeout(() => okRef.current?.focus(), 30); }, [req]);
  if (!req) return null;
  const close = (ok: boolean) => { req.resolve(ok); setReq(null); };
  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/60 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-host-msg"
      onClick={() => close(false)} onKeyDown={e => { if (e.key === 'Escape') close(false); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
        <p id="confirm-host-msg" className="text-sm text-slate-800 whitespace-pre-line">{req.message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => close(false)} className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 cursor-pointer">{req.cancelLabel || 'Cancelar'}</button>
          <button ref={okRef} type="button" onClick={() => close(true)} className={`px-4 py-2 rounded-xl text-white text-sm font-bold cursor-pointer ${req.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{req.confirmLabel || 'Aceptar'}</button>
        </div>
      </div>
    </div>
  );
};
