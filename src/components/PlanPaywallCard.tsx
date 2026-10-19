import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Lock, 
  Coins, 
  Clock, 
  FileText, 
  MessageSquareCode,
  AlertCircle,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { apiFetch } from '../utils/apiFetch';
import { usePlan } from '../hooks/usePlan';

interface PlanPaywallCardProps {
  onPlanActivated?: () => void;
  compact?: boolean;
  highlightText?: string;
}

export const PlanPaywallCard: React.FC<PlanPaywallCardProps> = ({
  compact = false,
  highlightText
}) => {
  const { isFirstPurchase, price, hasActivePlan, daysLeft, isExpiringSoon } = usePlan();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/pagos/crear', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo iniciar el proceso de pago.');
      }

      if (data.init_point) {
        // Redirect user to Mercado Pago Checkout Pro
        window.location.href = data.init_point;
      } else {
        throw new Error('No se recibió la URL de pago de Mercado Pago.');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      setError(err?.message || 'Error al conectar con Mercado Pago. Intenta nuevamente.');
      setLoading(false);
    }
  };

  const formattedPrice = (price || (isFirstPurchase ? 19990 : 39990)).toLocaleString('es-CL');

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 text-white border-2 border-emerald-500/80 shadow-2xl p-6 sm:p-8 animate-fade-in">
      {/* Background glow effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-6">
        {/* Header Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-black tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>ACCESO TOTAL 6 MESES</span>
          </div>

          {isFirstPurchase && (
            <div className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-wider animate-pulse">
              ⚡ 50% DCTO. PRIMERA COMPRA
            </div>
          )}
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-1.5">
          <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            Plan Semestral ImpulsaCap: 6 meses de acceso completo
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
            {highlightText || 'Desbloquea el Formulador Técnico con IA, la Auditoría Ciega oficial y la generación de documentos para postular a todos los fondos concursables de Chile.'}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {[
            {
              icon: Sparkles,
              title: 'Formulador Técnico IA por Secciones',
              desc: 'Redacción sin inventar cifras, adaptada a rúbricas Corfo/Sercotec'
            },
            {
              icon: ShieldCheck,
              title: 'Auditor Ciego con Rúbrica Oficial',
              desc: 'Simula la evaluación de los comités antes de enviar tu postulación'
            },
            {
              icon: MessageSquareCode,
              title: 'Chat Experto en Fondos Públicos',
              desc: 'Consultas ilimitadas sobre bases, topes de ventas y requisitos tributarios'
            },
            {
              icon: FileText,
              title: 'Generador de Documentos y Dossier',
              desc: 'Cartas LOI, justificaciones de bonos de género y exportación oficial'
            },
            {
              icon: Coins,
              title: 'Hasta 3 Postulaciones Simultáneas',
              desc: 'Prepara hasta 3 fondos a la vez (con opción de archivar para liberar cupos)'
            },
            {
              icon: Clock,
              title: '6 Meses de Cobertura Continua',
              desc: 'Válido para todas las convocatorias y aperturas oficiales del semestre'
            }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/5 border border-white/10">
                <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-white">{item.title}</h5>
                  <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pricing Box */}
        <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Inversión única por 6 meses
            </span>
            <div className="flex items-baseline gap-3">
              {isFirstPurchase ? (
                <>
                  <span className="text-slate-400 text-lg line-through font-bold">
                    $39.990
                  </span>
                  <span className="text-3xl sm:text-4xl font-black text-emerald-400">
                    ${formattedPrice}
                  </span>
                  <span className="text-xs font-bold text-amber-300">
                    — 50% de descuento en tu primer semestre
                  </span>
                </>
              ) : (
                <span className="text-3xl sm:text-4xl font-black text-emerald-400">
                  ${formattedPrice} CLP
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Pago único. No se renueva automáticamente.
            </p>
          </div>

          {/* Action Button */}
          <div className="shrink-0 w-full sm:w-auto">
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm sm:text-base shadow-lg shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Conectando con Mercado Pago...</span>
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  <span>Pagar con Mercado Pago</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error message if any */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment Security Assurance */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/10">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Pago 100% seguro procesado a través de Mercado Pago Checkout Pro
          </span>
          <span className="hidden sm:inline">Tarjetas de Crédito, Débito / Redcompra</span>
        </div>
      </div>
    </div>
  );
};
