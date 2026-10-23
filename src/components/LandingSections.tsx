import React, { useEffect, useState } from 'react';
import {
  Search,
  ClipboardCheck,
  PenLine,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  Sparkles,
  Plus,
  RefreshCw
} from 'lucide-react';
import { usePlan } from '../hooks/usePlan';
import { apiFetch } from '../utils/apiFetch';
import { announceEarlyAccess } from '../utils/earlyAccess';
import { auth } from '../firebase';
import { requestLogin } from '../utils/authEvents';
import { getPaymentsMode } from '../utils/earlyAccess';

/* -------------------------------------------------------------------------- */
/* Cómo funciona: las 3 etapas reales del recorrido en la app                  */
/* -------------------------------------------------------------------------- */

const ExampleTag: React.FC = () => (
  <span className="absolute top-3 right-3 text-[10px] font-medium text-slate-400">Ejemplo</span>
);

// Ilustraciones de cada etapa, hechas con el estilo de la app (no son capturas).
const PreviewDiscover: React.FC = () => (
  <div className="relative rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3" aria-hidden="true">
    <ExampleTag />
    <p className="text-[11px] text-slate-500">Pregunta 3 de 5</p>
    <p className="text-sm font-bold text-slate-900 pr-10">¿Cuánto vende tu empresa al año?</p>
    <div className="grid grid-cols-2 gap-1.5 text-[11px]">
      <span className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-600">Aún no vende</span>
      <span className="px-2 py-1.5 rounded-lg border-2 border-blue-500 bg-blue-50 text-blue-800 font-semibold">Menos de $60M</span>
    </div>
    <div className="border-t border-slate-100 pt-3 space-y-1.5">
      <p className="text-[11px] font-semibold text-emerald-700">Fondos que calzan con tu empresa</p>
      {['Semilla Inicia', 'Activa Riego', 'Crea y Valida'].map(f => (
        <div key={f} className="flex items-center gap-2 text-xs text-slate-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{f}</span>
        </div>
      ))}
    </div>
  </div>
);

const PreviewEligibility: React.FC = () => (
  <div className="relative rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3" aria-hidden="true">
    <ExampleTag />
    <div className="flex items-center gap-2 pr-10">
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-slate-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-900 truncate">carpeta-tributaria-sii.pdf</p>
        <p className="text-[11px] text-slate-500">Datos leídos de tu carpeta</p>
      </div>
    </div>
    <div className="space-y-2 text-xs">
      <div className="flex items-start gap-2 text-slate-700">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
        <span>Inicio de actividades en 1ª categoría</span>
      </div>
      <div className="flex items-start gap-2 text-slate-700">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
        <span>Ventas dentro del tramo del fondo</span>
      </div>
      <div className="flex items-start gap-2 text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <span>Falta una carta de respaldo de un cliente</span>
      </div>
    </div>
  </div>
);

const PreviewPrepare: React.FC = () => (
  <div className="relative rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3" aria-hidden="true">
    <ExampleTag />
    <p className="text-sm font-bold text-slate-900 pr-10">Problema y oportunidad</p>
    <p className="text-xs text-slate-600 leading-relaxed">
      Las pymes de mantención industrial programan sus mantenciones en planillas, lo que provoca detenciones no planificadas. Hoy atendemos a{' '}
      <span className="px-1 rounded bg-amber-100 text-amber-900 font-semibold whitespace-nowrap">[COMPLETAR: n.º de clientes]</span>{' '}
      empresas…
    </p>
    <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
      <span className="text-[11px] text-slate-500">Auditoría simulada</span>
      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">2 brechas por corregir</span>
    </div>
  </div>
);

const STAGES = [
  {
    icon: Search,
    title: 'Encuentra tu fondo',
    text: 'Respondes 5 preguntas y ves los fondos que calzan con tu empresa. El monitor revisa CORFO todos los días y te muestra cuándo cierra cada convocatoria.',
    tools: ['Diagnóstico en 1 minuto', 'Monitor de convocatorias', 'Elige cualquier fondo, aunque no salga recomendado'],
    Preview: PreviewDiscover
  },
  {
    icon: ClipboardCheck,
    title: 'Revisa si cumples',
    text: 'Subes tu carpeta tributaria del SII y la app revisa los requisitos de admisibilidad: antigüedad, ventas e inicio de actividades.',
    tools: ['Revisión de requisitos con tu carpeta tributaria', 'Cartas de respaldo', 'Cálculo de garantías y aportes'],
    Preview: PreviewEligibility
  },
  {
    icon: PenLine,
    title: 'Prepara tu postulación',
    text: 'La IA te ayuda a redactar cada sección con los datos de tu empresa y marca lo que falta, sin inventar cifras. Antes de enviar, una auditoría simula la evaluación.',
    tools: ['Redacción por secciones con IA', 'Auditoría simulada con la rúbrica', 'Expediente PDF y asesor experto'],
    Preview: PreviewPrepare
  }
];

export const HowItWorks: React.FC = () => (
  <section aria-labelledby="como-funciona" className="space-y-8 min-w-0">
    <div className="max-w-2xl space-y-2">
      <h2 id="como-funciona" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
        Te acompañamos de principio a fin
      </h2>
      <p className="text-slate-600 text-[15px] sm:text-base leading-relaxed">
        Desde que buscas un fondo hasta que tienes la postulación lista para subir al portal.
      </p>
    </div>

    <ol className="grid gap-6 lg:grid-cols-3 min-w-0">
      {STAGES.map((stage, idx) => {
        const Icon = stage.icon;
        const Preview = stage.Preview;
        return (
          <li key={stage.title} className="rounded-3xl bg-slate-50 border border-slate-200 p-5 sm:p-6 flex flex-col gap-5 min-w-0">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-slate-900 text-white font-black text-sm flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                {stage.title}
                <Icon className="w-5 h-5 text-blue-600" aria-hidden="true" />
              </h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{stage.text}</p>
            <ul className="space-y-1.5">
              {stage.tools.map(t => (
                <li key={t} className="flex items-start gap-2 text-sm text-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto">
              <Preview />
            </div>
          </li>
        );
      })}
    </ol>
  </section>
);

/* -------------------------------------------------------------------------- */
/* Gratis vs. Plan Trimestral                                                   */
/* -------------------------------------------------------------------------- */

const FREE_FEATURES = [
  'Diagnóstico de 5 preguntas',
  'Monitor de convocatorias',
  'Mis postulaciones y hoja de ruta',
  'Revisión de requisitos con tu carpeta tributaria'
];
const PLAN_FEATURES = [
  'Redacción de la postulación con IA',
  'Cartas y documentos',
  'Auditoría simulada antes de enviar',
  'Expediente PDF',
  'Asesor experto en cada postulación'
];

const CONSULTORA_MAILTO =
  'mailto:contacto@impulsacap.cl?subject=' +
  encodeURIComponent('Plan para consultoras') +
  '&body=' +
  encodeURIComponent('Hola, soy de una consultora y me interesa un plan para varias empresas.\n\nNombre de la consultora:\nCuántas empresas asesoramos:\nCuántas postulaciones preparamos al año (aprox.):\nTeléfono de contacto:\n');

const formatCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

export const PlanComparison: React.FC<{ onStartFree: () => void }> = ({ onStartFree }) => {
  const { isFirstPurchase, price, hasActivePlan, expiresAt } = usePlan();
  const [paymentsEnabled, setPaymentsEnabled] = useState(true);
  useEffect(() => { getPaymentsMode().then(m => setPaymentsEnabled(m.paymentsEnabled)); }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    if (auth.authStateReady) {
      try { await auth.authStateReady(); } catch { /* sigue */ }
    }
    if (!auth.currentUser) {
      setLoading(false);
      requestLogin({
        message: 'Crea tu cuenta o inicia sesión para continuar con el Plan Trimestral.',
        mode: 'login',
        onSuccess: async () => { await handleCheckout(); }
      });
      return;
    }
    try {
      const res = await apiFetch('/api/pagos/crear', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data?.earlyAccess) { announceEarlyAccess(data); setLoading(false); return; }
      if (!res.ok || !data.init_point) throw new Error(data.error || 'No se pudo iniciar el pago.');
      window.location.href = data.init_point;
    } catch (err: any) {
      setError(err?.message || 'No pudimos conectar con la pasarela de pago. Intenta nuevamente.');
      setLoading(false);
    }
  };

  const expiryText = expiresAt
    ? new Date(expiresAt).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <section aria-labelledby="planes" className="space-y-8 min-w-0">
      <div className="max-w-2xl space-y-2">
        <h2 id="planes" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Parte con las herramientas abiertas y activa el plan para postular
        </h2>
        <p className="text-slate-600 text-[15px] sm:text-base leading-relaxed">
          Encontrar tu fondo y revisar si cumples no tiene costo. El Plan Trimestral es para preparar la postulación completa.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2 min-w-0">
        {/* Herramientas abiertas (sin plan) */}
        <div className="rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 flex flex-col gap-6">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900">Herramientas abiertas</h3>
            <p className="text-3xl font-black text-slate-900">Sin costo</p>
            <p className="text-sm text-slate-500">Con tu cuenta, sin plan</p>
          </div>
          <ul className="space-y-2.5 flex-1">
            {FREE_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-slate-800">
                <CheckCircle2 className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onStartFree}
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-slate-300 bg-white text-slate-900 font-bold text-sm hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Hacer el diagnóstico
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Plan Trimestral */}
        <div className="rounded-3xl bg-gradient-to-br from-[#0B1220] to-[#0F1E3A] text-white border border-cyan-400/30 p-6 sm:p-8 flex flex-col gap-6 shadow-xl shadow-cyan-950/20">
          <div className="space-y-1">
            <h3 className="text-lg font-black">Plan Trimestral</h3>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-3xl font-black">{formatCLP(price)}</p>
              {isFirstPurchase && price < 39990 && (
                <p className="text-sm text-slate-400"><s>{formatCLP(39990)}</s> 50% en tu primera compra</p>
              )}
            </div>
            <p className="text-sm text-slate-300">Pago único por 3 meses, IVA incluido. No se renueva solo.</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 space-y-1">
            <p className="text-sm font-bold text-white">Para 1 empresa, hasta 3 postulaciones activas a la vez</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cuando terminas una postulación o la archivas, se libera el cupo y puedes empezar otra dentro de los 3 meses.
            </p>
          </div>
          <ul className="space-y-2.5 flex-1">
            <li className="text-sm text-cyan-200">Todo lo anterior, más:</li>
            {PLAN_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-slate-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {hasActivePlan ? (
            <p className="rounded-2xl bg-emerald-400/10 border border-emerald-400/30 px-4 py-3 text-sm text-emerald-200">
              Tu Plan Trimestral está activo{expiryText ? ` hasta el ${expiryText}` : ''}.
            </p>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleCheckout}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-emerald-400 text-[#04131c] font-black text-sm hover:brightness-110 transition cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1E3A]"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Abriendo el pago seguro…' : 'Activar Plan Trimestral'}
              </button>
              <p className="text-xs text-slate-400 text-center">Pagas de forma segura con Flow: Webpay, tarjetas o transferencia.</p>
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                Al pagar aceptas los{' '}
                <a href="/terminos" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Términos y Condiciones</a>. Tienes derecho a retracto dentro de 10 días desde el pago, mientras no comiences a usar el plan.
              </p>
              {error && <p className="text-xs text-rose-300 text-center" role="alert">{error}</p>}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900">¿Eres consultora o asesoras a varias empresas?</h3>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
            Armamos un plan a tu medida, con más postulaciones a la vez y una cuenta para trabajar con tus clientes.
          </p>
        </div>
        <a
          href={CONSULTORA_MAILTO}
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Conversemos
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------------- */
/* Preguntas frecuentes                                                         */
/* -------------------------------------------------------------------------- */

const FAQS = [
  {
    q: '¿ImpulsaCap postula por mí?',
    a: 'No. Tú envías la postulación en el portal del fondo (por ejemplo, el de CORFO). ImpulsaCap te ayuda a dejar todo listo: requisitos revisados, textos redactados, documentos y expediente.'
  },
  {
    q: '¿La IA inventa datos de mi empresa?',
    a: 'No. Usa solo lo que tú ingresas y lo que lee de tu carpeta tributaria. Cuando falta un dato, lo marca como [COMPLETAR] para que lo agregues tú.'
  },
  {
    q: '¿Qué fondos cubre?',
    a: 'Hoy el monitor revisa a diario las convocatorias de CORFO. Pronto sumaremos Sercotec, ANID y gobiernos regionales. Igual puedes elegir manualmente cualquier fondo del catálogo.'
  },
  {
    q: '¿Cuántas postulaciones puedo preparar con el plan?',
    a: 'El Plan Trimestral es para una empresa y permite tener hasta 3 postulaciones activas a la vez. Cuando terminas una o la archivas, liberas el cupo y puedes empezar otra dentro de los 3 meses. Si eres consultora y trabajas con varias empresas, escríbenos a contacto@impulsacap.cl y armamos un plan a tu medida.'
  },
  {
    q: '¿El plan se renueva automáticamente?',
    a: 'No. Es un pago único que te da 3 meses de acceso. Te avisamos por correo 7 días antes de que venza, y si quieres seguir, renuevas tú.'
  },
  {
    q: '¿Me aseguran que voy a ganar el fondo?',
    a: 'No. La decisión es del organismo que evalúa. Lo que sí hacemos es ayudarte a presentar una postulación completa y a corregir brechas antes de enviarla.'
  }
];

export const LandingFaq: React.FC = () => (
  <section aria-labelledby="preguntas" className="space-y-6 min-w-0">
    <h2 id="preguntas" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
      Preguntas frecuentes
    </h2>
    <div className="divide-y divide-slate-200 border-y border-slate-200">
      {FAQS.map(item => (
        <details key={item.q} className="group py-1">
          <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none text-base font-bold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <Plus className="w-5 h-5 text-slate-500 shrink-0 transition-transform group-open:rotate-45" aria-hidden="true" />
          </summary>
          <p className="pb-5 pr-8 text-[15px] text-slate-600 leading-relaxed max-w-3xl">{item.a}</p>
        </details>
      ))}
    </div>
  </section>
);
