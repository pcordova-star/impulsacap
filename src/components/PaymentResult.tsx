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
  Calendar
} from 'lucide-react';
import { usePlan } from '../hooks/usePlan';
import { apiFetch } from '../utils/apiFetch';

interface PaymentResultProps {
  onNavigateToRoadmap: () => void;
}

export const PaymentResult: React.FC<PaymentResultProps> = ({ onNavigateToRoadmap }) => {
  const { hasActivePlan, expiresAt, refresh } = usePlan();
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [retryingCheckout, setRetryingCheckout] = useState<boolean>(false);

  // Read URL query parameters: status, payment_id, external_reference, collection_status
  const searchParams = new URLSearchParams(window.location.search);
  const rawStatus = (
    searchParams.get('status') || 
    searchParams.get('collection_status') || 
    'pending'
  ).toLowerCase();

  // Normalize status
  const isApproved = rawStatus === 'approved';
  const isPending = rawStatus === 'pending' || rawStatus === 'in_process';
  const isFailure = rawStatus === 'failure' || rawStatus === 'rejected' || rawStatus === 'null';

  // Timer for approved state awaiting webhook confirmation (up to 60 seconds)
  useEffect(() => {
    if (!isApproved || hasActivePlan) return;

    const interval = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
      // Periodically refresh plan from backend/firestore
      refresh();
    }, 2000);

    return () => clearInterval(interval);
  }, [isApproved, hasActivePlan, refresh]);

  const handleRetryCheckout = async () => {
    setRetryingCheckout(true);
    try {
      const res = await apiFetch('/api/pagos/crear', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert(data.error || 'Error al reconectar con Mercado Pago');
      }
    } catch (err: any) {
      alert(err?.message || 'Error de conexión');
    } finally {
      setRetryingCheckout(false);
    }
  };

  const formattedExpiry = expiresAt 
    ? new Date(expiresAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : '6 meses desde hoy';

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 animate-fade-in">
      <div className="rounded-3xl bg-white border border-slate-200 shadow-xl p-8 sm:p-10 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center space-y-6">
          {/* 1. APPROVED STATE */}
          {isApproved && (
            <>
              {hasActivePlan ? (
                // Activated confirmed!
                <div className="space-y-6 animate-fade-in">
                  <div className="w-20 h-20 rounded-full bg-emerald-100 border-4 border-emerald-500 flex items-center justify-center mx-auto text-emerald-600 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>

                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Pago Confirmado</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      ¡Listo! Tu plan está activo hasta el {formattedExpiry}
                    </h2>
                    <p className="text-sm text-slate-600 max-w-lg mx-auto">
                      Tienes acceso ilimitado durante 6 meses a todas las herramientas: Formulador Técnico IA, Auditor Ciego con rúbrica oficial y hasta 3 postulaciones activas a la vez.
                    </p>
                  </div>

                  {/* Benefit highlights */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Formulador Técnico por Secciones</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Auditor Ciego con Rúbrica Oficial</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Chat Experto en Fondos Públicos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Dossier PDF Oficial para e-CORFO</span>
                    </div>
                  </div>

                  <button
                    onClick={onNavigateToRoadmap}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-base shadow-lg shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer"
                  >
                    <span>Ir a Mi Hoja de Ruta</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              ) : secondsElapsed < 60 ? (
                // Still confirming (first 60 seconds)
                <div className="space-y-6 animate-fade-in">
                  <div className="w-20 h-20 rounded-full bg-blue-50 border-4 border-blue-500 flex items-center justify-center mx-auto text-blue-600 shadow-lg shadow-blue-500/20">
                    <Clock className="w-10 h-10 animate-spin text-blue-600" style={{ animationDuration: '3s' }} />
                  </div>

                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold uppercase tracking-wider">
                      <span>Procesando</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      Estamos confirmando tu pago…
                    </h2>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      Mercado Pago ha recibido la transacción. Estamos sincronizando las credenciales de tu empresa en tiempo real. Esto tomará sólo unos segundos.
                    </p>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden max-w-xs mx-auto">
                    <div 
                      className="bg-emerald-500 h-2 transition-all duration-1000 ease-linear rounded-full" 
                      style={{ width: `${Math.min(100, (secondsElapsed / 60) * 100)}%` }} 
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    Verificando confirmación ({secondsElapsed}s)
                  </p>
                </div>
              ) : (
                // Exceeded 60s
                <div className="space-y-6 animate-fade-in">
                  <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-500 flex items-center justify-center mx-auto text-amber-600">
                    <Clock className="w-10 h-10" />
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-slate-900">
                      Tu pago se está procesando; te avisaremos cuando se active
                    </h2>
                    <p className="text-sm text-slate-600 max-w-md mx-auto">
                      Mercado Pago está completando la validación bancaria de tu transferencia o tarjeta. Tan pronto como quede acreditada, tu plan se activará automáticamente.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-center justify-center gap-2">
                    <Mail className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>¿Tienes dudas? Escríbenos directamente a: </span>
                    <a href="mailto:soporte@impulsacap.cl" className="font-bold underline text-amber-950">
                      soporte@impulsacap.cl
                    </a>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      onClick={onNavigateToRoadmap}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer"
                    >
                      Continuar a Mi Hoja de Ruta
                    </button>
                    <button
                      onClick={() => refresh()}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Verificar nuevamente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 2. PENDING STATE */}
          {isPending && (
            <div className="space-y-6 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-amber-50 border-4 border-amber-500 flex items-center justify-center mx-auto text-amber-600">
                <Clock className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold uppercase tracking-wider">
                  <span>Pago Pendiente</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  Pago en Proceso de Acreditación
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Tu plan se activará automáticamente en cuanto Mercado Pago acredite el pago (esto puede demorar unos minutos en caso de transferencias o Servipag).
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 max-w-md mx-auto">
                Te notificaremos en cuanto el pago sea aprobado para que continúes con la formulación oficial de tu fondo.
              </div>

              <button
                onClick={onNavigateToRoadmap}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 transition-all cursor-pointer"
              >
                <span>Volver a la Hoja de Ruta</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 3. FAILURE / REJECTED STATE */}
          {isFailure && (
            <div className="space-y-6 animate-fade-in">
              <div className="w-20 h-20 rounded-full bg-rose-50 border-4 border-rose-500 flex items-center justify-center mx-auto text-rose-600">
                <AlertCircle className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase tracking-wider">
                  <span>No Completado</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                  El pago no se completó
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  La transacción fue rechazada o cancelada en Mercado Pago. No se ha realizado ningún cobro a tu medio de pago.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleRetryCheckout}
                  disabled={retryingCheckout}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className={`w-4 h-4 ${retryingCheckout ? 'animate-spin' : ''}`} />
                  <span>Reintentar Pago con Mercado Pago</span>
                </button>
                <button
                  onClick={onNavigateToRoadmap}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Volver a Mi Hoja de Ruta
                </button>
              </div>
            </div>
          )}

          {/* Footer badge */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Transacciones aseguradas mediante Mercado Pago Checkout Pro</span>
          </div>
        </div>
      </div>
    </div>
  );
};
