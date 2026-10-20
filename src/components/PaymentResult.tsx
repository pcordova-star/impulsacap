import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Mail,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CreditCard
} from 'lucide-react';
import { usePlan } from '../hooks/usePlan';
import { apiFetch } from '../utils/apiFetch';
import { auth } from '../firebase';
import { requestLogin } from '../utils/authEvents';

interface PaymentResultProps {
  onNavigateToRoadmap: () => void;
  onNavigateToPlan?: () => void;
}

const SUPPORT_EMAIL = 'contacto@impulsacap.cl';
const CONFIRM_WINDOW_SECONDS = 60;

/**
 * Pantalla de regreso desde Mercado Pago (/pago/resultado).
 *
 * La fuente de verdad es el plan en Firestore (entitlements/{uid}), que solo escribe el webhook.
 * Los parámetros de la URL (status, payment_id) son una pista: pueden faltar si el usuario vuelve
 * por otro camino, o llegar como "pending" aunque el pago ya se haya acreditado.
 *
 * - Si el plan está activo y su último pago coincide con el payment_id de la URL (o no hay payment_id),
 *   el pago está confirmado.
 * - Si la URL dice rechazado/cancelado, se muestra el rechazo (aclarando si el plan anterior sigue vigente).
 * - En cualquier otro caso se espera la confirmación hasta 60 s y luego se explica que seguirá en proceso.
 */
export const PaymentResult: React.FC<PaymentResultProps> = ({ onNavigateToRoadmap, onNavigateToPlan }) => {
  const { hasActivePlan, expiresAt, lastPaymentId, loading, refresh } = usePlan();
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [retryingCheckout, setRetryingCheckout] = useState<boolean>(false);

  const searchParams = new URLSearchParams(window.location.search);
  const rawStatus = (searchParams.get('status') || searchParams.get('collection_status') || '').toLowerCase();
  const urlPaymentId = searchParams.get('payment_id') || searchParams.get('collection_id') || '';
  const hasUrlPaymentId = Boolean(urlPaymentId && urlPaymentId !== 'null');

  const isFailure = rawStatus === 'failure' || rawStatus === 'rejected' || rawStatus === 'cancelled' || rawStatus === 'null';
  const isPendingHint = rawStatus === 'pending' || rawStatus === 'in_process';

  // ¿Este pago ya quedó reflejado en el plan?
  const paymentConfirmed = hasActivePlan && (!hasUrlPaymentId || lastPaymentId === urlPaymentId);
  const waitingWindowOver = secondsElapsed >= CONFIRM_WINDOW_SECONDS;

  type View = 'loading' | 'success' | 'failure' | 'confirming' | 'processing';
  let view: View;
  if (isFailure) view = 'failure';
  else if (paymentConfirmed) view = 'success';
  else if (loading) view = 'loading';
  else if (!waitingWindowOver) view = 'confirming';
  else view = 'processing';

  // Mientras se espera la confirmación, refresca periódicamente (el plan también llega en tiempo real por Firestore).
  useEffect(() => {
    if (view !== 'confirming' && view !== 'loading') return;
    const interval = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    const refresher = setInterval(() => { refresh(); }, 4000);
    return () => {
      clearInterval(interval);
      clearInterval(refresher);
    };
  }, [view, refresh]);

  const handleRetryCheckout = async () => {
    if (auth.authStateReady) {
      try {
        await auth.authStateReady();
      } catch (err) {
        console.warn('authStateReady error:', err);
      }
    }

    if (!auth.currentUser) {
      requestLogin({
        message: 'Inicia sesión para continuar con el pago del Plan Semestral.',
        mode: 'login',
        onSuccess: async () => {
          await handleRetryCheckout();
        }
      });
      return;
    }

    setRetryingCheckout(true);
    try {
      const res = await apiFetch('/api/pagos/crear', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert(data.error || 'No pudimos conectar con Mercado Pago. Intenta nuevamente.');
      }
    } catch (err: any) {
      alert(err?.message || 'Error de conexión');
    } finally {
      setRetryingCheckout(false);
    }
  };

  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const primaryBtn = 'w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 active:scale-95 transition-all cursor-pointer disabled:opacity-50';
  const secondaryBtn = 'w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer';

  const supportLine = (
    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      <Mail className="w-4 h-4 text-slate-500 shrink-0" />
      <span>¿Dudas con tu pago? Escríbenos a</span>
      <a href={`mailto:${SUPPORT_EMAIL}`} className="font-bold underline text-slate-900 break-all">
        {SUPPORT_EMAIL}
      </a>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 px-0 sm:px-6 animate-fade-in">
      <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-6 sm:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center space-y-6">
          {/* PAGO CONFIRMADO */}
          {view === 'success' && (
            <div className="space-y-6 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-500 flex items-center justify-center mx-auto text-emerald-600 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pago confirmado</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  ¡Listo! Tu Plan Semestral está activo{formattedExpiry ? ` hasta el ${formattedExpiry}` : ''}
                </h2>
                <p className="text-sm text-slate-600 max-w-lg mx-auto">
                  Ya puedes usar todas las herramientas en hasta 3 postulaciones a la vez. Te enviamos el comprobante a tu correo.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                {[
                  'Formulador por secciones con IA',
                  'Auditoría simulada con la rúbrica del fondo',
                  'Asesor experto en cada postulación',
                  'Expediente PDF listo para postular'
                ].map(item => (
                  <div key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button onClick={onNavigateToRoadmap} className={primaryBtn}>
                  <span>Ir a mis postulaciones</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                {onNavigateToPlan && (
                  <button onClick={onNavigateToPlan} className={secondaryBtn}>
                    <CreditCard className="w-4 h-4" />
                    <span>Ver mi plan</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* CARGANDO / CONFIRMANDO (hasta 60 s) */}
          {(view === 'loading' || view === 'confirming') && (
            <div className="space-y-6 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-blue-50 border-4 border-blue-500 flex items-center justify-center mx-auto text-blue-600 shadow-lg shadow-blue-500/20">
                <Clock className="w-10 h-10 animate-spin text-blue-600" style={{ animationDuration: '3s' }} />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
                  <span>{isPendingHint ? 'Pago en proceso' : 'Confirmando'}</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  Estamos confirmando tu pago…
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Mercado Pago nos avisa apenas el pago se acredita. Con tarjeta suele tardar solo unos segundos; no cierres esta página.
                </p>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden max-w-xs mx-auto">
                <div
                  className="bg-emerald-500 h-2 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${Math.min(100, (secondsElapsed / CONFIRM_WINDOW_SECONDS) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* SIGUE EN PROCESO DESPUÉS DE 60 s */}
          {view === 'processing' && (
            <div className="space-y-6 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-500 flex items-center justify-center mx-auto text-amber-600">
                <Clock className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider">
                  <span>Pago en proceso</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  Tu pago todavía se está acreditando
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  {hasActivePlan
                    ? `Tu plan actual sigue vigente${formattedExpiry ? ` hasta el ${formattedExpiry}` : ''}. Cuando Mercado Pago acredite este pago, se sumarán 6 meses automáticamente y te llegará un correo.`
                    : 'Algunos medios de pago tardan unos minutos. Cuando Mercado Pago lo acredite, tu plan se activará solo y te llegará un correo de confirmación.'}
                </p>
              </div>

              {supportLine}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button onClick={onNavigateToRoadmap} className={primaryBtn}>
                  <span>Ir a mis postulaciones</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setSecondsElapsed(0); refresh(); }}
                  className={secondaryBtn}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Verificar nuevamente</span>
                </button>
              </div>
            </div>
          )}

          {/* RECHAZADO / CANCELADO */}
          {view === 'failure' && (
            <div className="space-y-6 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-rose-50 border-4 border-rose-500 flex items-center justify-center mx-auto text-rose-600">
                <AlertCircle className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase tracking-wider">
                  <span>No completado</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  El pago no se completó
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  El pago fue rechazado o cancelado en Mercado Pago, así que no se hizo ningún cobro.
                  {hasActivePlan && formattedExpiry ? ` Tu plan actual sigue vigente hasta el ${formattedExpiry}.` : ''}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button onClick={handleRetryCheckout} disabled={retryingCheckout} className={primaryBtn}>
                  <RotateCcw className={`w-4 h-4 ${retryingCheckout ? 'animate-spin' : ''}`} />
                  <span>Intentar de nuevo</span>
                </button>
                <button onClick={onNavigateToRoadmap} className={secondaryBtn}>
                  Volver a mis postulaciones
                </button>
              </div>

              {supportLine}
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Pago procesado de forma segura por Mercado Pago</span>
          </div>
        </div>
      </div>
    </div>
  );
};
