import React, { useEffect, useState } from 'react';
import { PartyPopper, CheckCircle2, Info } from 'lucide-react';
import { onEarlyAccess, type EarlyAccessInfo } from '../utils/earlyAccess';

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const clp = (n?: number) => (n ? `$${n.toLocaleString('es-CL')}` : '');

/** Se muestra cuando alguien contrata mientras el pago en línea está en modo de acceso anticipado. */
export const EarlyAccessModal: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  const [info, setInfo] = useState<EarlyAccessInfo | null>(null);

  useEffect(() => onEarlyAccess(setInfo), []);
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setInfo(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [info]);

  if (!info) return null;

  let title = '¡Listo! Ya tienes acceso al Plan Semestral';
  let body: React.ReactNode = (
    <>
      <p>
        Estamos terminando de habilitar el pago en línea. Mientras tanto, te damos <strong>acceso completo sin costo</strong>
        {info.expiresAt ? <> hasta el <strong>{fmt(info.expiresAt)}</strong></> : null}.
      </p>
      <p>
        Cuando el pago esté disponible te avisaremos por correo para que lo completes{info.price ? <> ({clp(info.price)}, IVA incluido)</> : null}. Desde ese aviso tendrás 7 días para pagar y mantener tu acceso.
      </p>
    </>
  );
  if (info.alreadyPaid) {
    title = 'Tu Plan Semestral ya está activo';
    body = <p>Tu plan pagado sigue vigente{info.expiresAt ? <> hasta el <strong>{fmt(info.expiresAt)}</strong></> : null}. Podrás renovarlo cuando habilitemos el pago en línea.</p>;
  } else if (info.alreadyGranted) {
    title = 'Ya tienes acceso anticipado';
    body = info.expiresAt
      ? <p>Tu acceso sin costo sigue vigente hasta el <strong>{fmt(info.expiresAt)}</strong>. Te avisaremos por correo cuando puedas completar el pago.</p>
      : <p>Tu acceso anticipado ya terminó. Te avisaremos por correo cuando el pago en línea esté disponible; si tienes dudas, escríbenos a contacto@impulsacap.cl.</p>;
  }

  const Icon = info.alreadyPaid || info.alreadyGranted ? (info.expiresAt ? CheckCircle2 : Info) : PartyPopper;

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-slate-950/50 p-3 sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="early-access-title" className="w-full max-w-lg rounded-3xl bg-white shadow-2xl p-6 sm:p-8 space-y-5">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Icon className="w-6 h-6" />
        </div>
        <div className="space-y-3">
          <h2 id="early-access-title" className="text-xl sm:text-2xl font-black text-slate-900">{title}</h2>
          <div className="space-y-2 text-[15px] text-slate-700 leading-relaxed">{body}</div>
          {!info.alreadyPaid && !info.alreadyGranted && (
            <p className="text-xs text-slate-500">Te enviamos este detalle a tu correo.</p>
          )}
        </div>
        <button
          type="button"
          autoFocus
          onClick={() => { const ok = Boolean(info.expiresAt); setInfo(null); if (ok) onStart(); }}
          className="w-full px-5 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
        >
          {info.expiresAt ? 'Empezar a usar el plan' : 'Entendido'}
        </button>
      </div>
    </div>
  );
};
