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

  let title = '¡Tu prueba gratis está activa!';
  let body: React.ReactNode = (
    <>
      <p>
        Como <strong>beneficio de lanzamiento para pymes</strong>, tienes el Plan Semestral completo gratis
        {info.expiresAt ? <> hasta el <strong>{fmt(info.expiresAt)}</strong></> : null}: redacción con IA, documentos y cartas, auditoría simulada y expediente.
      </p>
      <p>
        Te enviaremos por correo tu enlace para activar el plan{info.price ? <> a <strong>{clp(info.price)}</strong> (precio de lanzamiento, IVA incluido)</> : null} y seguir sin perder nada. Tus datos y postulaciones quedan guardados.
      </p>
    </>
  );
  if (info.alreadyPaid) {
    title = 'Tu Plan Semestral ya está activo';
    body = <p>Tu plan sigue vigente{info.expiresAt ? <> hasta el <strong>{fmt(info.expiresAt)}</strong></> : null}.</p>;
  } else if (info.alreadyGranted) {
    title = info.expiresAt ? 'Tu prueba gratis sigue activa' : 'Ya usaste tu prueba gratis';
    body = info.expiresAt
      ? <p>Puedes usar el Plan Semestral completo hasta el <strong>{fmt(info.expiresAt)}</strong>. Te enviaremos por correo tu enlace para activarlo.</p>
      : <p>Tu prueba gratis terminó, pero tus datos y postulaciones siguen guardados. Te enviaremos por correo tu enlace para activar el plan; si quieres activarlo antes, escríbenos a contacto@impulsacap.cl.</p>;
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
          {info.expiresAt ? 'Empezar mi prueba' : 'Entendido'}
        </button>
      </div>
    </div>
  );
};
