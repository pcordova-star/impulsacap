/**
 * Control financiero del uso de IA (Gemini).
 *
 * - Créditos diarios por usuario según su plan (plan pagado / prueba gratis / sin plan).
 * - Tope de gasto por período de plan (cada pago o prueba es un período).
 * - Presupuesto global diario: si se supera, la IA se pausa hasta el día siguiente (Chile).
 * - Topes diarios para las funciones públicas (diagnóstico y robot de Ayuda).
 * - Límite de tamaño de lo que se envía a la IA y de lo que puede generar.
 * - Registro de tokens y costo estimado por día, por usuario y por función (panel /admin).
 *
 * Todo es configurable con variables de entorno (valores por defecto entre paréntesis):
 *   IA_CREDITOS_DIA_PLAN (80), IA_CREDITOS_DIA_PRUEBA (30), IA_CREDITOS_DIA_GRATIS (8)
 *   IA_COSTO_MAX_PLAN_USD (6), IA_COSTO_MAX_PRUEBA_USD (1)
 *   IA_PRESUPUESTO_DIARIO_USD (25)
 *   IA_PUBLICO_DIA_DIAGNOSTICO (1500), IA_PUBLICO_DIA_AYUDA (2500)
 *   GEMINI_PRECIO_ENTRADA_USD (0.5 por millón de tokens), GEMINI_PRECIO_SALIDA_USD (3 por millón)
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type express from 'express';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

export type AiTier = 'plan' | 'prueba' | 'gratis' | 'publico' | 'admin';

export interface AiContext {
  endpoint: string;
  uid: string | null;
  tier: AiTier;
  periodKey: string | null;
  day: string;
}

export const aiContext = new AsyncLocalStorage<AiContext>();

const num = (name: string, def: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : def;
};

export const AI_LIMITS = () => ({
  creditsPerDay: { plan: num('IA_CREDITOS_DIA_PLAN', 80), prueba: num('IA_CREDITOS_DIA_PRUEBA', 30), gratis: num('IA_CREDITOS_DIA_GRATIS', 8) },
  maxCostPerPeriodUsd: { plan: num('IA_COSTO_MAX_PLAN_USD', 6), prueba: num('IA_COSTO_MAX_PRUEBA_USD', 1) },
  dailyBudgetUsd: num('IA_PRESUPUESTO_DIARIO_USD', 25),
  publicPerDay: { 'instant-match': num('IA_PUBLICO_DIA_DIAGNOSTICO', 1500), ayuda: num('IA_PUBLICO_DIA_AYUDA', 2500) } as Record<string, number>,
  priceInPerM: num('GEMINI_PRECIO_ENTRADA_USD', 0.5),
  priceOutPerM: num('GEMINI_PRECIO_SALIDA_USD', 3)
});

/** Créditos que cuesta cada función (aprox. proporcional a su consumo). */
export const AI_CREDITS: Record<string, number> = {
  chat: 1,
  diagnose: 1,
  'formulate-section': 2,
  'generate-doc': 2,
  'parse-tax-folder': 1,
  audit: 4,
  formulate: 5,
  'instant-match': 0,
  ayuda: 0
};

/** Máximo de tokens que puede generar cada función (incluye el razonamiento del modelo). */
export const AI_MAX_OUTPUT: Record<string, number> = {
  chat: 8192,
  ayuda: 2048,
  'instant-match': 8192,
  diagnose: 8192,
  'formulate-section': 8192,
  'generate-doc': 8192,
  audit: 12288,
  formulate: 16384,
  'parse-tax-folder': 8192
};

/** Máximo de caracteres de texto que se envían a la IA en una llamada (~4 caracteres por token). */
export const AI_MAX_INPUT_CHARS = 160_000;

export function chileDay(d = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export class AiLimitError extends Error {
  status: number;
  constructor(message: string, status = 429) { super(message); this.status = status; }
}

/** Mide el texto que se enviará a la IA (sin contar archivos adjuntos). */
export function inputTextChars(params: any): number {
  let total = 0;
  const walk = (v: any) => {
    if (v == null) return;
    if (typeof v === 'string') { total += v.length; return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (typeof v === 'object') {
      for (const [k, val] of Object.entries(v)) {
        if (k === 'inlineData' || k === 'fileData') continue;
        walk(val);
      }
    }
  };
  walk(params?.contents);
  walk(params?.config?.systemInstruction);
  return total;
}

export function estimateCostUsd(usage: any): { inTok: number; outTok: number; costUsd: number } {
  const L = AI_LIMITS();
  const inTok = Number(usage?.promptTokenCount) || 0;
  const outTok = (Number(usage?.candidatesTokenCount) || 0) + (Number(usage?.thoughtsTokenCount) || 0);
  const costUsd = (inTok * L.priceInPerM + outTok * L.priceOutPerM) / 1_000_000;
  return { inTok, outTok, costUsd };
}

/** Registra el consumo real de una llamada (no bloquea la respuesta si falla). */
export async function recordAiUsage(db: Firestore, ctx: AiContext, usage: any, model: string) {
  const { inTok, outTok, costUsd } = estimateCostUsd(usage);
  const inc = FieldValue.increment;
  const ep = ctx.endpoint.replace(/[^a-z0-9-]/gi, '_');
  const writes: Promise<any>[] = [
    db.collection('ai_usage_daily').doc(ctx.day).set({
      day: ctx.day,
      calls: inc(1), inTok: inc(inTok), outTok: inc(outTok), costUsd: inc(costUsd),
      endpoints: { [ep]: { calls: inc(1), costUsd: inc(costUsd) } },
      models: { [model.replace(/[^a-z0-9.-]/gi, '_')]: inc(1) },
      updatedAt: new Date().toISOString()
    }, { merge: true })
  ];
  if (ctx.uid) {
    writes.push(db.collection('ai_usage_users').doc(`${ctx.uid}_${ctx.day}`).set({
      uid: ctx.uid, day: ctx.day, calls: inc(1), inTok: inc(inTok), outTok: inc(outTok), costUsd: inc(costUsd), updatedAt: new Date().toISOString()
    }, { merge: true }));
    if (ctx.periodKey) {
      writes.push(db.collection('ai_usage_periods').doc(`${ctx.uid}_${ctx.periodKey}`).set({
        uid: ctx.uid, periodKey: ctx.periodKey, tier: ctx.tier,
        calls: inc(1), inTok: inc(inTok), outTok: inc(outTok), costUsd: inc(costUsd), updatedAt: new Date().toISOString()
      }, { merge: true }));
    }
  }
  await Promise.all(writes);
}

/**
 * Middleware: revisa los topes antes de llamar a la IA y deja el contexto para registrar el consumo.
 * Debe ir después de requireAuth (si la ruta lo usa).
 */
export function aiGuard(opts: {
  endpoint: string;
  getDb: () => Promise<Firestore | null>;
  isAdmin?: (req: express.Request) => boolean;
  onBudgetExceeded?: (day: string, costUsd: number) => void;
}): express.RequestHandler {
  return async (req, res, next) => {
    const day = chileDay();
    const user = (req as any).user as { uid?: string } | undefined;
    const L = AI_LIMITS();
    let ctx: AiContext = { endpoint: opts.endpoint, uid: user?.uid || null, tier: user?.uid ? 'gratis' : 'publico', periodKey: null, day };
    try {
      const db = await opts.getDb();
      if (db) {
        // 1. Presupuesto global del día
        const dailySnap = await db.collection('ai_usage_daily').doc(day).get();
        const daily = dailySnap.exists ? dailySnap.data() || {} : {};
        if ((Number(daily.costUsd) || 0) >= L.dailyBudgetUsd) {
          opts.onBudgetExceeded?.(day, Number(daily.costUsd) || 0);
          return res.status(503).json({ error: 'La IA alcanzó su capacidad máxima por hoy. Vuelve a intentarlo mañana; tu trabajo queda guardado.', code: 'AI_DAILY_BUDGET' });
        }

        if (!ctx.uid) {
          // 2. Funciones públicas: tope diario de llamadas
          const cap = L.publicPerDay[opts.endpoint];
          const used = Number(daily.endpoints?.[opts.endpoint]?.calls) || 0;
          // Lo público usa como máximo el 60% del presupuesto: el resto queda para quienes pagan
          const publicBudgetHit = (Number(daily.costUsd) || 0) >= L.dailyBudgetUsd * 0.6;
          if ((cap !== undefined && used >= cap) || publicBudgetHit) {
            return res.status(503).json({ error: 'Este servicio está muy solicitado hoy. Intenta de nuevo más tarde.', code: 'AI_PUBLIC_CAP' });
          }
        } else if (opts.isAdmin?.(req)) {
          ctx.tier = 'admin';
        } else {
          // 3. Nivel del usuario según su plan
          const ent = (await db.collection('entitlements').doc(ctx.uid).get()).data() || null;
          const active = Boolean(ent?.status === 'active' && ent?.expiresAt && new Date(ent.expiresAt).getTime() > Date.now());
          if (active && ent?.provisional) {
            ctx.tier = 'prueba';
            ctx.periodKey = `prueba_${String(ent.provisionalSince || '').slice(0, 10) || 'x'}`;
          } else if (active) {
            ctx.tier = 'plan';
            ctx.periodKey = ent?.lastPaymentId ? `pago_${ent.lastPaymentId}` : `plan_${String(ent?.expiresAt || '').slice(0, 10)}`;
          }

          // 4. Tope de gasto del período (plan o prueba)
          if (ctx.periodKey && (ctx.tier === 'plan' || ctx.tier === 'prueba')) {
            const per = (await db.collection('ai_usage_periods').doc(`${ctx.uid}_${ctx.periodKey}`).get()).data();
            const max = L.maxCostPerPeriodUsd[ctx.tier];
            if ((Number(per?.costUsd) || 0) >= max) {
              return res.status(429).json({
                error: ctx.tier === 'prueba'
                  ? 'Usaste toda la IA incluida en la prueba gratis. Activa tu Plan Semestral para seguir.'
                  : 'Alcanzaste el uso máximo de IA incluido en tu plan. Escríbenos a contacto@impulsacap.cl y lo revisamos.',
                code: 'AI_PERIOD_CAP'
              });
            }
          }

          // 5. Créditos del día (se reservan antes de llamar, para frenar ráfagas)
          const credits = AI_CREDITS[opts.endpoint] ?? 1;
          if (credits > 0) {
            const limit = L.creditsPerDay[ctx.tier as 'plan' | 'prueba' | 'gratis'];
            const userDayRef = db.collection('ai_usage_users').doc(`${ctx.uid}_${day}`);
            const allowed = await db.runTransaction(async tx => {
              const snap = await tx.get(userDayRef);
              const used = Number(snap.data()?.credits) || 0;
              if (used + credits > limit) return false;
              tx.set(userDayRef, { uid: ctx.uid, day, credits: used + credits, tier: ctx.tier }, { merge: true });
              return true;
            });
            if (!allowed) {
              return res.status(429).json({
                error: ctx.tier === 'gratis'
                  ? 'Alcanzaste el uso diario de IA de la cuenta gratuita. Se renueva mañana, o activa tu Plan Semestral.'
                  : 'Alcanzaste el uso diario de IA de tu cuenta. Se renueva a medianoche; tu trabajo queda guardado.',
                code: 'AI_DAILY_CREDITS'
              });
            }
          }
        }
      }
    } catch (err: any) {
      // Si falla el control, se sigue (los límites por minuto siguen activos) y se avisa en el registro
      console.warn(`[ia] No se pudo revisar el uso (${opts.endpoint}):`, err?.message);
    }
    aiContext.run(ctx, () => next());
  };
}
