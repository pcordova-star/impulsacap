import React, { useCallback, useEffect, useState } from 'react';
import { FlaskConical, CheckCircle2, Mail, RefreshCw, Users, Bell } from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { requestLogin } from '../utils/authEvents';
import { usePlan } from '../hooks/usePlan';

/**
 * Programa de prueba: los primeros inscritos usan ImpulsaCap gratis unos días (1 postulación)
 * a cambio de enviar sus comentarios. Al llenarse los cupos se muestra "pronto habrá una nueva invitación".
 */
interface BetaStatus {
  abierto: boolean; lleno: boolean; activo: boolean;
  cupos: number; disponibles: number; dias: number;
  participando: boolean; participoAntes: boolean; tienePlan: boolean; enEspera: boolean;
  expiresAt: string | null; correoComentarios: string;
}

const FEEDBACK_EMAIL = 'contacto@impulsacap.cl';

function useBetaStatus() {
  const [st, setSt] = useState<BetaStatus | null>(null);
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid || null);
  useEffect(() => onAuthStateChanged(auth, u => setUid(u?.uid || null)), []);
  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/api/beta/estado');
      if (res.ok) setSt(await res.json());
    } catch { /* sin efecto: la invitación simplemente no aparece */ }
  }, []);
  useEffect(() => { load(); }, [load, uid]);
  return { st, reload: load, loggedIn: Boolean(uid) };
}

export const feedbackMailto = () => {
  const body = [
    'Hola, estos son mis comentarios sobre ImpulsaCap:',
    '',
    '1. ¿Qué parte no entendí o me costó?',
    '',
    '2. ¿Dónde me trabé o dejé de avanzar?',
    '',
    '3. ¿Qué me pareció lo que redactó la IA? ¿Encontré algún error?',
    '',
    '4. ¿Pagaría el Plan Trimestral? ¿Por qué sí o por qué no?',
    ''
  ].join('\n');
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Comentarios programa de prueba ImpulsaCap')}&body=${encodeURIComponent(body)}`;
};

/** Invitación (o aviso de cupos llenos). No se muestra a quien ya tiene plan o ya participó. */
export const BetaInviteCard: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { st, reload, loggedIn } = useBetaStatus();
  const { refresh } = usePlan();
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!st || !st.activo || st.participando || st.participoAntes || st.tienePlan) {
    return msg ? <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{msg}</p> : null;
  }

  const enroll = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await apiFetch('/api/beta/inscribir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aceptaCompromiso: true }) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(b.error || 'No pudimos inscribirte.'); await reload(); return; }
      setMsg(`¡Listo! Tienes ${b.dias} días para probar ImpulsaCap con una postulación. Te enviamos las instrucciones por correo.`);
      await Promise.all([reload(), refresh()]);
    } finally { setBusy(false); }
  };
  const waitlist = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await apiFetch('/api/beta/avisarme', { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(b.error || 'No pudimos guardar tu solicitud.'); return; }
      await reload();
    } finally { setBusy(false); }
  };
  const loginThen = (fn: () => void) => requestLogin({
    mode: 'register',
    message: 'Crea tu cuenta (o inicia sesión) para continuar.',
    onSuccess: async () => { await reload(); fn(); }
  });

  const box = `rounded-2xl border ${st.abierto ? 'border-violet-300 bg-gradient-to-br from-violet-50 to-white' : 'border-slate-200 bg-slate-50'} ${compact ? 'p-4' : 'p-5 sm:p-6'} space-y-3`;

  if (st.lleno) {
    return (
      <div className={box}>
        <p className="text-sm font-bold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-slate-500" /> Los cupos del programa de prueba están llenos</p>
        <p className="text-xs text-slate-600">Gracias por tu interés. Pronto abriremos una nueva invitación{st.enEspera ? ' y te avisaremos por correo.' : '. Si quieres, te avisamos por correo.'}</p>
        {st.enEspera ? (
          <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Te avisaremos cuando abramos nuevos cupos.</p>
        ) : (
          <button type="button" disabled={busy} onClick={() => (loggedIn ? waitlist() : loginThen(waitlist))} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer disabled:opacity-60">
            <Bell className="w-3.5 h-3.5" /> Avísame cuando haya cupos
          </button>
        )}
        {err && <p className="text-xs text-rose-700">{err}</p>}
      </div>
    );
  }

  if (!st.abierto) return null;

  return (
    <div className={box}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2"><FlaskConical className="w-5 h-5 text-violet-600" /> Pruébala gratis {st.dias} días y ayúdanos a mejorarla</p>
        <span className="px-2.5 py-1 rounded-full bg-violet-600 text-white text-[11px] font-bold">Quedan {st.disponibles} de {st.cupos} cupos</span>
      </div>
      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
        Buscamos emprendedores y pymes que usen ImpulsaCap con <strong>una postulación real</strong>: formulario con IA, documentos, evaluación simulada y expediente. A cambio, solo te pedimos que nos cuentes qué te costó y qué mejorarías.
      </p>
      {loggedIn ? (
        <>
          <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-violet-600" />
            <span>Me comprometo a enviar mis comentarios a <strong>{FEEDBACK_EMAIL}</strong> antes de que terminen los {st.dias} días.</span>
          </label>
          <button type="button" disabled={!accepted || busy} onClick={enroll} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Inscribiendo…</> : 'Quiero participar'}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => loginThen(() => {})} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black cursor-pointer">
          Crear mi cuenta y participar
        </button>
      )}
      {err && <p className="text-xs text-rose-700">{err}</p>}
    </div>
  );
};

/** Aviso para quien está en el programa: días que quedan y botón para enviar comentarios. */
export const BetaActiveBanner: React.FC = () => {
  const { isBeta, hasActivePlan, daysLeft, isExpired } = usePlan();
  if (!isBeta) return null;
  if (!hasActivePlan) {
    if (!isExpired) return null;
    return (
      <div className="mb-4 p-3 sm:p-3.5 rounded-2xl bg-violet-50 border border-violet-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs sm:text-sm text-violet-900">
          <FlaskConical className="inline w-4 h-4 mr-1 text-violet-600" />
          <strong>Tu prueba terminó.</strong> Tus datos y tu postulación quedan guardados. ¿Nos cuentas cómo te fue? Tus comentarios nos ayudan a mejorar.
        </p>
        <a href={feedbackMailto()} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shrink-0">
          <Mail className="w-3.5 h-3.5" /> Enviar mis comentarios
        </a>
      </div>
    );
  }
  return (
    <div className="mb-4 p-3 sm:p-3.5 rounded-2xl bg-violet-50 border border-violet-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
      <p className="text-xs sm:text-sm text-violet-900">
        <FlaskConical className="inline w-4 h-4 mr-1 text-violet-600" />
        <strong>Programa de prueba:</strong> {daysLeft <= 1 ? 'hoy es tu último día' : `te quedan ${daysLeft} días`} para 1 postulación. Antes de que termine, cuéntanos cómo te fue.
      </p>
      <a href={feedbackMailto()} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shrink-0">
        <Mail className="w-3.5 h-3.5" /> Enviar mis comentarios
      </a>
    </div>
  );
};
