import React, { useEffect, useState } from 'react';
import { PLAN_PRICE } from '../data/pricing';
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
  RefreshCw,
  Trophy,
  CalendarDays,
  RotateCcw,
  Building2
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

const POSTULA_STEPS = ['Requisitos', 'Formulario', 'Presupuesto', 'Documentos', 'Evaluación', 'Envío'];

const PreviewPrepare: React.FC = () => (
  <div className="relative rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3" aria-hidden="true">
    <ExampleTag />
    <p className="text-[11px] text-slate-500">Tu hoja de ruta · 4 de 6 pasos</p>
    <div className="grid grid-cols-6 gap-1 pr-2">
      {POSTULA_STEPS.map((s, i) => (
        <div key={s} className="space-y-1 min-w-0">
          <div className={`h-1.5 rounded-full ${i < 4 ? 'bg-emerald-500' : i === 4 ? 'bg-blue-500' : 'bg-slate-200'}`} />
          <p className={`text-[9px] leading-tight truncate ${i < 4 ? 'text-emerald-700 font-semibold' : i === 4 ? 'text-blue-700 font-bold' : 'text-slate-400'}`}>{s}</p>
        </div>
      ))}
    </div>
    <p className="text-sm font-bold text-slate-900">Problema y oportunidad</p>
    <p className="text-xs text-slate-600 leading-relaxed">
      Las pymes de mantención programan sus mantenciones en planillas, lo que provoca detenciones no planificadas. Hoy atendemos a{' '}
      <span className="px-1 rounded bg-amber-100 text-amber-900 font-semibold whitespace-nowrap">¿cuántos clientes?</span>{' '}
      empresas…
    </p>
    <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
      <span className="text-[11px] text-slate-500">Evaluación simulada</span>
      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">2 puntos por mejorar</span>
    </div>
  </div>
);

const PreviewResult: React.FC = () => (
  <div className="relative rounded-2xl bg-white border border-slate-200 p-4 shadow-sm space-y-3" aria-hidden="true">
    <ExampleTag />
    <p className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold"><Trophy className="w-3.5 h-3.5" /> Ganado · en ejecución</p>
    <div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full w-[62%] rounded-full bg-emerald-500" /></div>
      <p className="text-[11px] text-slate-600 mt-1">Gastado <strong>$8.100.000</strong> de $13.000.000 (62%)</p>
    </div>
    <div className="flex items-start gap-2 text-xs text-slate-700">
      <CalendarDays className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
      <span>Informe de avance · vence el 1 de abril</span>
    </div>
    <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 rounded-lg px-2 py-1.5">
      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
      <span>Te pasas del ítem "Horno": pide una reasignación antes de comprar</span>
    </div>
    <div className="border-t border-slate-100 pt-3 flex items-center gap-2 text-[11px] text-slate-600">
      <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <span>¿No ganaste? Plan de mejora y vuelves a postular con todo copiado</span>
    </div>
  </div>
);

const STAGES = [
  {
    icon: Building2,
    title: 'Prepara tu empresa',
    when: 'Una sola vez',
    text: 'Ingresas los datos de tu empresa, describes tu proyecto con tus palabras y subes tu carpeta tributaria del SII. Sirve para todos los fondos a los que postules.',
    tools: ['Datos de la empresa y del proyecto', 'Lectura de tu carpeta tributaria', 'Revisión de requisitos: antigüedad, ventas e inicio de actividades'],
    Preview: PreviewEligibility
  },
  {
    icon: Search,
    title: 'Elige tu fondo',
    when: 'En minutos',
    text: 'Te mostramos los fondos que calzan con tu empresa y cuándo cierra cada convocatoria. Antes de empezar te decimos si cumples los requisitos, para no perder tiempo.',
    tools: ['Diagnóstico de 5 preguntas', 'Monitor de convocatorias al día', '"¿Califico?" con tus propios datos'],
    Preview: PreviewDiscover
  },
  {
    icon: PenLine,
    title: 'Postula en 6 pasos',
    when: 'Con las bases de cada fondo',
    text: 'Una hoja de ruta con las reglas del fondo: requisitos, formulario, presupuesto, documentos, evaluación simulada y envío. La IA redacta con tus datos y te pregunta lo que falta, sin inventar.',
    tools: ['Formulario y presupuesto con IA', 'Cartas y documentos', 'Evaluación simulada y expediente para enviar'],
    Preview: PreviewPrepare
  },
  {
    icon: Trophy,
    title: 'Gana y ejecuta (o vuelve a intentarlo)',
    when: 'Después del resultado',
    isNew: true,
    text: 'Si ganas, te acompañamos a firmar, comprar según el presupuesto aprobado, rendir cada gasto y entregar los informes. Si no, armamos un plan de mejora con la evaluación del comité y vuelves a postular sin partir de cero.',
    tools: ['Control de gastos y avisos antes de comprar', 'Hitos, fechas e informes de avance y final', 'Plan de mejora y nueva postulación con todo copiado'],
    Preview: PreviewResult
  }
];

/** Resumen de las 4 etapas en una línea (para el inicio de la página) */
export const StagesStrip: React.FC<{ dark?: boolean }> = ({ dark }) => (
  <ol className={`grid grid-cols-2 gap-2 min-w-0 ${dark ? "sm:grid-cols-4 lg:grid-cols-2" : "sm:grid-cols-4"}`} aria-label="Las 4 etapas">
    {STAGES.map((st, i) => (
      <li key={st.title} className="min-w-0">
        <a href="#como-funciona" className={`h-full flex items-start gap-2 rounded-xl px-3 py-2.5 border transition-colors ${dark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
          <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${dark ? 'bg-cyan-400 text-slate-950' : 'bg-slate-900 text-white'}`}>{i + 1}</span>
          <span className="min-w-0">
            <span className={`block text-xs font-bold leading-tight ${dark ? 'text-white' : 'text-slate-900'}`}>{i === 3 ? 'Gana y ejecuta' : st.title}</span>
            <span className={`block text-[11px] leading-tight mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{st.isNew ? <span className="font-bold text-emerald-400">Nuevo</span> : st.when}</span>
          </span>
        </a>
      </li>
    ))}
  </ol>
);

export const HowItWorks: React.FC = () => (
  <section aria-labelledby="como-funciona" className="space-y-8 min-w-0 scroll-mt-24" id="como-funciona-seccion">
    <div className="max-w-3xl space-y-2">
      <p className="text-xs font-black uppercase tracking-wider text-blue-700">Cómo funciona</p>
      <h2 id="como-funciona" className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight scroll-mt-24">
        4 etapas: desde preparar tu empresa hasta rendir el último peso
      </h2>
      <p className="text-slate-600 text-[15px] sm:text-base leading-relaxed">
        Siempre sabes en qué etapa estás y qué toca hacer ahora. La postulación la envías tú en el portal oficial; nosotros te dejamos todo listo y te acompañamos también después del resultado.
      </p>
    </div>

    <ol className="grid gap-6 md:grid-cols-2 min-w-0">
      {STAGES.map((stage, idx) => {
        const Icon = stage.icon;
        const Preview = stage.Preview;
        return (
          <li key={stage.title} className={`relative rounded-3xl border p-5 sm:p-6 flex flex-col gap-5 min-w-0 ${stage.isNew ? 'bg-emerald-50/60 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
            {stage.isNew && <span className="absolute -top-3 right-5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black shadow-sm">Nuevo</span>}
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-slate-900 text-white font-black text-sm flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Etapa {idx + 1} · {stage.when}</p>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 leading-tight">
                  {stage.title}
                  <Icon className="w-5 h-5 text-blue-600 shrink-0" aria-hidden="true" />
                </h3>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{stage.text}</p>
            {idx === 2 && (
              <ol className="flex flex-wrap gap-1.5" aria-label="Los 6 pasos de la postulación">
                {POSTULA_STEPS.map((s, i) => (
                  <li key={s} className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">{i + 1}. {s}</li>
                ))}
              </ol>
            )}
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
  'Revisión de requisitos con tu carpeta tributaria',
  'Si ganas: control de gastos, hitos y pasos para la ejecución'
];
const PLAN_FEATURES = [
  'Redacción de la postulación con IA',
  'Cartas y documentos',
  'Auditoría simulada antes de enviar',
  'Expediente PDF',
  'Asesor experto en cada postulación',
  'Informes de avance y final con IA si ganas',
  'Plan de mejora con la evaluación del comité si no ganas'
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
              {isFirstPurchase && price < PLAN_PRICE ? (
                <p className="text-sm text-slate-400"><s>{formatCLP(PLAN_PRICE)}</s> con tu código de vendedor</p>
              ) : (
                <p className="text-sm text-emerald-300 font-semibold">Unos $5.000 al mes</p>
              )}
            </div>
            <p className="text-sm text-slate-300">Pago único por 3 meses, IVA incluido. No se renueva solo.</p>
          </div>
          <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 space-y-1">
            <p className="text-sm font-bold text-white">Para 1 empresa, hasta 3 postulaciones activas a la vez</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cuando la archivas o marcas su resultado (ganaste o no), se libera el cupo y puedes empezar otra dentro de los 3 meses.
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
    q: '¿Cuáles son las etapas para postular?',
    a: 'Son 4: (1) preparas tu empresa una sola vez: datos, proyecto y carpeta tributaria; (2) eliges un fondo cuyos requisitos cumplas; (3) postulas en 6 pasos: requisitos, formulario, presupuesto, documentos, evaluación simulada y envío en el portal oficial; y (4) después del resultado, si ganas te acompañamos en la ejecución y, si no, a volver a postular mejor.'
  },
  {
    q: '¿Qué pasa si gano el fondo?',
    a: 'Marcas "¡Gané!" y se abre la etapa de ejecución: los primeros pasos (contrato, garantía, fecha de inicio), tus hitos con fechas, el presupuesto aprobado con registro de gastos y avisos antes de comprar algo que podría no aceptarse, y borradores de los informes de avance y final. Las reglas exactas son las de tu contrato; la rendición oficial la haces en el sistema del fondo.'
  },
  {
    q: '¿Y si no gano?',
    a: 'Es muy común no ganar a la primera. Traes la evaluación del comité, armamos un plan de mejora con lo que falló y creamos una nueva postulación al mismo fondo con todo tu trabajo copiado, para que solo corrijas lo necesario en la próxima convocatoria.'
  },
  {
    q: '¿Me aseguran que voy a ganar el fondo?',
    a: 'No, y nadie puede asegurarlo: la decisión es del organismo que evalúa. Lo que sí hacemos es ayudarte a presentar una postulación completa, corregir brechas antes de enviarla y, si no ganas, volver a postular mejor sin partir de cero.'
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
