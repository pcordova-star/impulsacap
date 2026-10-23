import { createHash } from 'node:crypto';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { flowConfig, flowCreatePayment, flowGetStatus } from './server/flow';
import { collectNews, listRecipients, recipientsFitting, digestEmail, alertEmail, unsubUrl, unsubToken, NEWS_TYPES, type DigestItem, type ClosingCall } from './server/news';
import { getFundIntro } from './src/data/fundIntros';
import { regionFit } from './src/utils/region';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CHILEAN_FUNDS } from './src/data/chileanFunds';
import { parseCarpetaTributaria } from './src/utils/carpetaTributaria';
import { buildTaxDiagnosis, type TaxDiagnosis } from './src/utils/taxDiagnosis';
import { evaluateChileanGrantMatch, isNonActivityQuery, normalizeText } from './src/utils/grantMatcher';
import { rankCatalogFunds, rankLiveCalls, type MatchAnswers, type RankedFund } from './src/utils/fundRanking';
import { getFundRules, FAMILY_BLOCKS } from './src/data/fundStandards';
import { readCompanySite, cvToText, AutofillError, type CvFile } from './server/profileAutofill';
import { calculateDaysRemaining } from './src/utils/convocatorias';
import { validateRut, formatRut } from './src/utils/rutValidator';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { 
  extractTaxFolderData, 
  isValidTaxRut, 
  isValidTaxCompanyName, 
  isValidTaxSales, 
  parseNumberCLP 
} from './server/taxFolderExtractor';
import { buildAdminSummary, chileDayKey, TRACKED_PAGES } from './server/adminStats';
import { SUPPORT_KNOWLEDGE } from './server/supportKnowledge';
import {
  sendEmail,
  sendEmailDetailed,
  setEmailEventSink,
  getAdminEmail,
  isEmailConfigured,
  formatDateCL,
  welcomeEmail,
  purchaseEmail,
  adminSaleEmail,
  reminderEmail,
  testEmail,
  supportTicketAdminEmail,
  supportTicketUserEmail,
  earlyAccessUserEmail,
  earlyAccessAdminEmail,
  paymentAvailableEmail,
  sellerSaleEmail,
  getAppUrl,
} from './server/email';
import { aiGuard, aiContext, recordAiUsage, inputTextChars, AI_MAX_INPUT_CHARS, AI_MAX_OUTPUT, AiLimitError, AI_LIMITS, chileDay } from './server/aiUsage';
import {
  PRICE_FULL,
  PRICE_FIRST,
  MAX_DISCOUNT_PCT,
  MAX_COMMISSION_PCT,
  normalizeCode,
  isValidCodeFormat,
  priceWithDiscount,
  commissionFor,
  firstName,
  getActiveSeller,
  hasApprovedPayment,
  resolvePricing,
  maskEmail,
  type Seller,
} from './server/sellers';

dotenv.config();

// Registrar errores no controlados sin detener el servidor (Requirement 5)
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('[Unhandled Rejection] Promesa no manejada:', promise, 'Motivo:', reason?.message || reason);
});

process.on('uncaughtException', (err: Error) => {
  console.error('[Uncaught Exception] Excepción no capturada:', err?.message || err, err?.stack);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Límite de express.json: 15mb para subida de Carpeta Tributaria / F29 y 2mb en general (Requirement 7)
app.use('/api/gemini/parse-tax-folder', express.json({ limit: '15mb' }));
// Currículums para el perfil del equipo (hasta 5 archivos de 5 MB)
app.use('/api/perfil/desde-cv', express.json({ limit: '36mb' }));
// Reintenta la conexión de Firestore Admin antes de atender la API si aún no está autorizada
app.use('/api', async (_req, _res, next) => {
  if (!isFirestoreAdminAuthorized) {
    try { await ensureFirestoreAdmin(); } catch { /* el endpoint responde según el estado */ }
  }
  next();
});

// Cloud Run pasa la IP real del visitante en X-Forwarded-For: sin esto, todos los visitantes
// comparten un mismo límite de solicitudes (req.ip sería la del balanceador).
app.set('trust proxy', 1);

// La Carpeta Tributaria puede pesar varios MB en base64 (hasta 36 F29 y 5 F22)
app.use('/api/gemini/parse-tax-folder', express.json({ limit: '15mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Límite de solicitudes con respuesta en español (Requirement 6)
const instantMatchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Demasiadas solicitudes de análisis rápido desde tu IP. Por favor, espera un minuto antes de reintentar.' }
});

const generalGeminiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  keyGenerator: (req: any) => {
    return req.user?.uid || (req.ip ? ipKeyGenerator(req.ip) : 'anonymous');
  },
  message: { error: 'Has alcanzado el límite de 30 consultas de IA por minuto. Por favor, espera un momento antes de continuar.' }
});

app.use('/api/gemini/instant-match', instantMatchLimiter);
// Tope por hora y por IP en lo público (además del límite por minuto)
const publicHourlyLimiter = (max: number, message: string) => rateLimit({
  windowMs: 60 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: message }
});
app.use('/api/gemini/instant-match', publicHourlyLimiter(20, 'Hiciste muchos diagnósticos en la última hora. Intenta más tarde o crea tu cuenta.'));
app.use('/api/ayuda/chat', publicHourlyLimiter(40, 'Hiciste muchas consultas en la última hora. Escríbenos con "Hablar con una persona".'));
app.use('/api/gemini', generalGeminiLimiter);

// Límite para el robot de ayuda general de la plataforma: 10 por minuto por IP
const helpChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Demasiadas consultas de ayuda desde tu IP. Por favor, espera un minuto antes de reintentar.' }
});

app.use('/api/ayuda/chat', helpChatLimiter);

// Shared Gemini client utility (User-Agent header required for telemetry)
const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const MODEL_NAME = 'gemini-3.8-flash';
// Modelos de respaldo en caso de sobrecarga temporal de servidores (503 / UNAVAILABLE / High demand)
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

function isRetryableGeminiError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const status = err.status;
  const code = err.code || err.error?.code;

  return (
    status === 503 ||
    status === 'UNAVAILABLE' ||
    code === 503 ||
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('spikes in demand') ||
    msg.includes('overloaded') ||
    msg.includes('temporarily')
  );
}

// Resilient wrapper: Exponential Backoff (2s, 4s) y cambio automático a modelo de respaldo si un modelo está saturado
const originalGenerateContent = ai.models.generateContent.bind(ai.models);
ai.models.generateContent = async function resilientGenerateContent(params: any) {
  const primaryModel = params.model || MODEL_NAME;
  const modelsToTry = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];

  let lastError: any = null;
  // Tiempo máximo: 70 s por intento y 140 s en total (antes una llamada colgada dejaba "Redactando…" para siempre)
  const PER_CALL_MS = 70_000;
  const deadline = Date.now() + 140_000;

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const currentModel = modelsToTry[mIdx];
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining < 5_000) {
        throw lastError || new Error('La IA tardó demasiado en responder. Intenta de nuevo en unos minutos.');
      }
      try {
        const ctrl = new AbortController();
        const ms = Math.min(PER_CALL_MS, remaining);
        let timer: NodeJS.Timeout | undefined;
        const result: any = await Promise.race([
          originalGenerateContent({
            ...params,
            model: currentModel,
            config: { ...(params.config || {}), abortSignal: ctrl.signal },
          }),
          new Promise((_, reject) => { timer = setTimeout(() => { ctrl.abort(); reject(Object.assign(new Error(`timeout ${ms}ms`), { isTimeout: true })); }, ms); })
        ]).finally(() => { if (timer) clearTimeout(timer); });
        (result as any).usedModel = currentModel;
        if (mIdx > 0 || attempt > 1) {
          console.log(`[Gemini Resilient] Éxito con modelo ${currentModel} (intento ${attempt})`);
        }
        return result;
      } catch (err: any) {
        lastError = err;
        if (err?.isTimeout) {
          console.warn(`[Gemini] ${currentModel} no respondió a tiempo; se prueba el modelo alternativo`);
          break;
        }
        if (isRetryableGeminiError(err)) {
          const waitMs = attempt * 2000;
          console.warn(`[Gemini 503] Modelo ${currentModel} en alta demanda (intento ${attempt}/${maxRetries}). Esperando ${waitMs}ms...`);
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          } else {
            console.warn(`[Gemini Fallback] Agotados reintentos para ${currentModel}. Probando modelo alternativo...`);
            break;
          }
        } else {
          throw err;
        }
      }
    }
  }

  throw lastError;
};

// Medición y topes de la IA: tamaño de entrada, máximo de salida por función y registro de tokens/costo
const resilientGenerateContent = ai.models.generateContent.bind(ai.models);
ai.models.generateContent = async function meteredGenerateContent(params: any) {
  const ctx = aiContext.getStore();
  const endpoint = ctx?.endpoint || 'otro';
  if (inputTextChars(params) > AI_MAX_INPUT_CHARS) {
    console.warn(`[ia] Entrada demasiado grande en ${endpoint}: ${inputTextChars(params)} caracteres`);
    throw new AiLimitError('El texto enviado es demasiado largo. Acórtalo e intenta de nuevo.', 413);
  }
  const maxOut = AI_MAX_OUTPUT[endpoint];
  const finalParams = maxOut
    ? { ...params, config: { ...(params?.config || {}), maxOutputTokens: Math.min(Number(params?.config?.maxOutputTokens) || maxOut, maxOut) } }
    : params;
  const result: any = await resilientGenerateContent(finalParams);
  if (ctx && isFirestoreAdminAuthorized) {
    recordAiUsage(adminDb, ctx, result?.usageMetadata, String(result?.usedModel || finalParams.model || MODEL_NAME))
      .catch((e: any) => console.warn('[ia] No se pudo registrar el uso:', e?.message));
  }
  return result;
};

// -------------------------------------------------------------
// FIREBASE ADMIN & MERCADO PAGO SDK INITIALIZATION
// -------------------------------------------------------------
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8'));

// Inicialización con Application Default Credentials (ADC) de Google Cloud
const adminApp = getAdminApps().length > 0
  ? getAdminApps()[0]
  : initAdminApp({ projectId: firebaseConfig.projectId });

const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

// Estado de autorización de Application Default Credentials para Firestore Admin
let isFirestoreAdminAuthorized = false;

// Test de lectura a Firestore al arrancar el servidor (sin detener la app si falla)
async function testFirestoreAdminConnection(): Promise<boolean> {
  try {
    await adminDb.collection('entitlements').limit(1).get();
    isFirestoreAdminAuthorized = true;
    console.log('firebase-admin OK');
    return true;
  } catch (err: any) {
    isFirestoreAdminAuthorized = false;
    const errorMsg = err?.message || String(err);
    console.log(`firebase-admin SIN PERMISOS: ${errorMsg}`);
    return false;
  }
}

// Si la prueba inicial falla (por ejemplo, credenciales aún no disponibles al encender la instancia),
// se vuelve a intentar: en segundo plano cada 30 s y antes de atender cualquier /api, como máximo cada 10 s.
let lastFirestoreAdminCheck = Date.now();
async function ensureFirestoreAdmin(): Promise<boolean> {
  if (isFirestoreAdminAuthorized) return true;
  if (Date.now() - lastFirestoreAdminCheck < 10_000) return false;
  lastFirestoreAdminCheck = Date.now();
  return testFirestoreAdminConnection();
}

testFirestoreAdminConnection();
const firestoreAdminRetry = setInterval(() => {
  if (isFirestoreAdminAuthorized) return;
  lastFirestoreAdminCheck = Date.now();
  testFirestoreAdminConnection();
}, 30_000);
firestoreAdminRetry.unref?.();

const mpAccessToken = process.env.MP_ACCESS_TOKEN || '';
const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

export interface AuthenticatedRequest extends express.Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
  };
}

// Middleware: verifica Firebase ID Token
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Token de autenticación ausente o inválido.' });
  }
  const token = authHeader.split('Bearer ')[1].trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    (req as AuthenticatedRequest).user = {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true
    };
    return next();
  } catch (err: any) {
    console.warn('Authentication token verification failed:', err?.message);
    return res.status(401).json({ error: 'Sesión expirada o no autorizada. Inicia sesión nuevamente.' });
  }
};

// Helper to read entitlements document using user's Bearer token via Firestore REST API as fallback
async function getEntitlementsWithUserToken(uid: string, token: string) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/entitlements/${uid}`;
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!resp.ok) return null;
    const json: any = await resp.json();
    if (!json.fields) return null;
    return {
      plan: json.fields.plan?.stringValue,
      status: json.fields.status?.stringValue,
      expiresAt: json.fields.expiresAt?.stringValue,
      activeFundIds: json.fields.activeFundIds?.arrayValue?.values?.map((v: any) => v.stringValue) || []
    };
  } catch (e: any) {
    console.warn('Fallback Firestore REST fetch failed:', e?.message);
    return null;
  }
}

// Middleware: verifica plan trimestral activo
// Middleware: tareas administrativas automáticas (GitHub Actions), protegidas con x-import-token
const requireAdminToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const expected = process.env.CONVOCATORIAS_IMPORT_TOKEN;
  const provided = req.headers['x-import-token'];
  if (!expected || typeof provided !== 'string' || provided !== expected) {
    return res.status(401).json({ error: 'Token administrativo inválido o no configurado en x-import-token.' });
  }
  return next();
};

// Correos de compra (usuario + administrador). Nunca lanza errores ni bloquea el webhook.
/**
 * Correo de un usuario. Usa Firebase Auth y, si la cuenta de servicio no tiene permiso
 * de Authentication (rol "Firebase Authentication Admin"), el correo guardado en users/{uid}.
 */
async function getUserEmail(uid: string): Promise<string> {
  try {
    const record = await adminAuth.getUser(uid);
    if (record.email) return record.email;
  } catch (e: any) {
    console.warn(`[auth] getUser sin permiso o fallido (${uid}); se usa users/{uid}:`, e?.code || e?.message);
  }
  try {
    return String((await adminDb.collection('users').doc(uid).get()).data()?.email || '');
  } catch {
    return '';
  }
}

async function sendPurchaseNotifications(args: {
  uid: string;
  paymentId: string;
  amount: number;
  expiresAt: string;
  paymentDocRef: FirebaseFirestore.DocumentReference;
  sellerCode?: string | null;
  commission?: number | null;
}) {
  try {
    const { uid, paymentId, amount, expiresAt, paymentDocRef, sellerCode, commission } = args;

    const userEmail = await getUserEmail(uid);

    let companyName = '';
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      companyName = String(userDoc.data()?.companyName || '');
    } catch {}

    let isFirstPurchase = true;
    try {
      const prev = await adminDb.collection('payments')
        .where('uid', '==', uid)
        .where('status', '==', 'approved')
        .get();
      isFirstPurchase = prev.docs.filter(d => d.id !== paymentId).length === 0;
    } catch {}

    const userMail = purchaseEmail({ amount, paymentId, expiresAt });
    const sentUser = userEmail
      ? await sendEmail({ to: userEmail, ...userMail, idempotencyKey: `purchase-user-${paymentId}` })
      : false;

    const adminTo = getAdminEmail();
    const sentAdmin = adminTo
      ? await sendEmail({
          to: adminTo,
          ...adminSaleEmail({ userEmail, companyName, amount, isFirstPurchase, paymentId, expiresAt, sellerCode, commission }),
          idempotencyKey: `purchase-admin-${paymentId}`,
        })
      : false;

    await paymentDocRef.set({
      emailSentAt: sentUser ? new Date().toISOString() : null,
      adminEmailSentAt: sentAdmin ? new Date().toISOString() : null,
    }, { merge: true });
  } catch (err: any) {
    console.error('[email] Error en notificaciones de compra:', err?.message || err);
  }
}

const requireActivePlan = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = (req as AuthenticatedRequest).user;
  if (!user || !user.uid) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || '';

  try {
    let data: any = null;
    if (isFirestoreAdminAuthorized) {
      try {
        const entDoc = await adminDb.collection('entitlements').doc(user.uid).get();
        if (entDoc.exists) {
          data = entDoc.data();
        }
      } catch {
        // Fallback to REST
      }
    }

    // Fallback to Firestore REST API with user's verified token
    if (!data && token) {
      data = await getEntitlementsWithUserToken(user.uid, token);
    }

    if (!data || data.status !== 'active' || !data.expiresAt) {
      return res.status(402).json({ error: 'Necesitas el Plan Trimestral para usar esta herramienta' });
    }

    const expiresAt = new Date(data.expiresAt);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return res.status(402).json({ error: 'Necesitas el Plan Trimestral para usar esta herramienta' });
    }

    // El acceso temporal de la prueba de lanzamiento (eliminada) no cuenta como plan pagado
    const isAdminUser = Boolean(user.email && user.emailVerified && getAdminDashboardEmails().includes(user.email.toLowerCase()));
    if (data.provisional && !isAdminUser) {
      return res.status(402).json({ error: 'Activa tu Plan Trimestral para usar esta herramienta. Tus datos y postulaciones quedan guardados.' });
    }

    // Derecho a retracto (Ley 19.496, art. 3 bis): antes del primer uso de cada compra, el usuario
    // debe confirmar que inicia el servicio. El cliente muestra el aviso y llama a /api/plan/iniciar-servicio.
    const lastPaymentId = data.lastPaymentId ? String(data.lastPaymentId) : '';
    if (lastPaymentId && data.serviceStartedForPaymentId !== lastPaymentId) {
      return res.status(409).json({
        code: 'SERVICE_START_CONFIRMATION_REQUIRED',
        error: 'Antes de usar esta herramienta, confirma que comienzas a usar tu Plan Trimestral.'
      });
    }

    return next();
  } catch (err: any) {
    console.error('Error in requireActivePlan:', err?.message);
    return res.status(402).json({ error: 'Necesitas el Plan Trimestral para usar esta herramienta' });
  }
};

// Helper: gestión de límite de 3 postulaciones simultáneas usando la colección applications (Requirement 11)
const checkAndRegisterPostulationSlot = async (uid: string, fundId: string): Promise<{ ok: boolean; error?: string }> => {
  if (!fundId) return { ok: true };
  if (!isFirestoreAdminAuthorized) return { ok: true };
  try {
    // Consultar aplicaciones activas (no archivadas) del usuario
    const appsSnap = await adminDb.collection('applications')
      .where('ownerId', '==', uid)
      .get();
    
    const activeFundIds = new Set<string>();
    appsSnap.forEach(d => {
      const data = d.data();
      if (data.status !== 'archivada' && data.fundId) {
        activeFundIds.add(data.fundId);
      }
    });

    // Si este fondo ya es una de las aplicaciones activas, permitir acceso
    if (activeFundIds.has(fundId)) {
      return { ok: true };
    }

    // Validar el límite de 3 postulaciones simultáneas del Plan Trimestral
    if (activeFundIds.size >= 3) {
      return { 
        ok: false, 
        error: 'Puedes tener hasta 3 postulaciones activas a la vez. Archiva una para comenzar otra.' 
      };
    }

    // Mantener sincronizado entitlements para compatibilidad
    const entRef = adminDb.collection('entitlements').doc(uid);
    const entDoc = await entRef.get();
    if (entDoc.exists) {
      const entData = entDoc.data() || {};
      let entFunds: string[] = Array.isArray(entData.activeFundIds) ? entData.activeFundIds : [];
      if (!entFunds.includes(fundId)) {
        entFunds = [...entFunds, fundId];
        await entRef.set({ activeFundIds: entFunds, updatedAt: new Date().toISOString() }, { merge: true });
      }
    }

    return { ok: true };
  } catch {
    return { ok: true };
  }
};


// 0. Match Inmediato Rápido
// Topes de IA por función (ver server/aiUsage.ts)
const budgetAlertSent = new Set<string>();
const guardAi = (endpoint: string) => aiGuard({
  endpoint,
  getDb: async () => ((await ensureFirestoreAdmin()) ? adminDb : null),
  isAdmin: (req) => {
    const u = (req as AuthenticatedRequest).user;
    return Boolean(u?.email && u.emailVerified && getAdminDashboardEmails().includes(u.email.toLowerCase()));
  },
  onBudgetExceeded: (day, costUsd) => {
    if (budgetAlertSent.has(day)) return;
    budgetAlertSent.add(day);
    const to = getAdminEmail();
    console.error(`[ia] Presupuesto diario de IA alcanzado (${day}): US$${costUsd.toFixed(2)}`);
    if (to) {
      sendEmail({
        to,
        subject: `ImpulsaCap: la IA se pausó hoy por presupuesto (US$${costUsd.toFixed(2)})`,
        html: `<p>El gasto estimado de IA de hoy (${day}) llegó a US$${costUsd.toFixed(2)}, el tope diario configurado (IA_PRESUPUESTO_DIARIO_USD = ${AI_LIMITS().dailyBudgetUsd}). La IA queda pausada hasta mañana.</p><p>Revisa el consumo en /admin. Si es uso legítimo, sube el tope en AI Studio y vuelve a publicar.</p>`,
        text: `El gasto de IA de hoy (${day}) llegó a US$${costUsd.toFixed(2)} y la IA quedó pausada hasta mañana. Revisa /admin.`,
        idempotencyKey: `ai-budget-${day}`
      }).catch(() => {});
    }
  }
});

app.post('/api/gemini/instant-match', guardAi('instant-match'), async (req, res) => {
  try {
    const userPrompt = String(req.body?.userPrompt || req.body?.query || '').trim().slice(0, 2000);
    const targetFundHint = req.body?.targetFundHint;
    const availableFunds = Array.isArray(req.body?.availableFunds) && req.body.availableFunds.length > 0
      ? req.body.availableFunds
      : CHILEAN_FUNDS.map(f => ({
          id: f.id,
          name: f.name,
          agency: f.agency,
          maxSubsidyCLP: f.maxSubsidyCLP,
          maxCoFinancePct: f.maxCoFinancePct,
          femaleBonusPct: f.femaleBonusPct,
          salesRequirement: f.salesRequirement,
          status: f.status,
          callSchedule: f.callSchedule,
          callStatus: f.callStatus,
          closeDate: f.closeDate
        }));

    if (!userPrompt) {
      return res.status(400).json({ error: 'Debes ingresar una descripción de tu proyecto o empresa.' });
    }

    // Consultar convocatorias oficiales vigentes en Firestore
    let liveCalls: any[] = [];
    if (isFirestoreAdminAuthorized) {
      try {
        const snap = await adminDb.collection('convocatorias').where('vigente', '==', true).get();
        snap.forEach(d => {
          const c = d.data();
          if (!c.fundId) {
            c.fundId = matchConvocatoriaToFundId(c.titulo, c.url);
          }
          liveCalls.push(c);
        });
      } catch (e: any) {
        console.warn('Could not load convocatorias for instant-match:', e?.message);
      }
    }

    // Requirement 5: Actualizar disponibles con las convocatorias vigentes
    // Cuando exista una convocatoria vigente para un fondo, su callStatus y closeDate se toman de ahí; si no, queda "por_confirmar".
    availableFunds.forEach((f: any) => {
      const matchingCall = liveCalls.find(c => c.fundId === f.id && c.vigente);
      if (matchingCall) {
        f.callStatus = matchingCall.callStatus === 'Abierta' ? 'abierta' : (matchingCall.callStatus === 'Próxima' ? 'proxima' : 'abierta');
        f.closeDate = matchingCall.cierre;
        f.callSchedule = matchingCall.cierre ? `Cierra el ${matchingCall.cierre}` : 'Ventanilla permanente abierta';
        f.status = matchingCall.cierre ? `Abierto (Cierra: ${matchingCall.cierre})` : 'Abierto';
      } else {
        f.callStatus = 'por_confirmar';
        f.closeDate = null;
        f.callSchedule = 'Próxima convocatoria por confirmar';
        f.status = 'Próxima Convocatoria';
      }
    });

    const userProfile = req.body?.profile || {};
    const normPrompt = normalizeText(userPrompt);
    const userRegion = normalizeText(userProfile.region || '');
    const userSalesBracket = userProfile.salesBracket || '';
    const userCompanyType = userProfile.companyType || '';

    // Requirement 6: Filtrar convocatorias vigentes por región, perfil y tramo de ventas
    const filteredCalls = liveCalls.filter(call => {
      if (!call.vigente) return false;

      // Filtro región
      if (userRegion) {
        const alc = normalizeText(call.alcance || '');
        const isNational = alc.includes('todo chile') || alc.includes('nacional') || alc === '';
        if (!isNational && !alc.includes(userRegion) && !userRegion.includes(alc)) {
          return false;
        }
      }

      // Filtro perfil
      if (userCompanyType && call.perfil) {
        const rawP = Array.isArray(call.perfil) ? call.perfil : [call.perfil];
        if (rawP.length > 0) {
          const isPersona = userCompanyType === 'persona_natural' || userCompanyType === 'sin_iniciar';
          const tag = isPersona ? 'persona' : 'empresa';
          if (!rawP.some((p: any) => String(p).toLowerCase().includes(tag))) {
            return false;
          }
        }
      }

      // Filtro ventas
      if (userSalesBracket && call.venta) {
        const rawV = Array.isArray(call.venta) ? call.venta : [call.venta];
        if (rawV.length > 0) {
          const vTags = rawV.map((v: any) => String(v).toLowerCase());
          if (userSalesBracket === 'sin_ventas') {
            if (!vTags.some((t: string) => t.includes('sin-ventas') || t.includes('sin ventas') || t.includes('micro'))) {
              return false;
            }
          }
        }
      }

      return true;
    });

    const hasStructuredProfile = Boolean(userProfile.salesBracket || userProfile.trlStage || userProfile.companyType);
    if (!hasStructuredProfile && isNonActivityQuery(userPrompt)) {
      const nonAct = evaluateChileanGrantMatch(userPrompt, targetFundHint, filteredCalls, userProfile);
      return res.json({ ...nonAct, analizadoCon: 'reglas' });
    }

    // 1. Calce con reglas: solo fondos cuyos requisitos excluyentes cumple (ventas, etapa, tipo, mujeres)
    const answers: MatchAnswers = {
      salesBracket: userProfile.salesBracket || '',
      trlStage: userProfile.trlStage || '',
      companyType: userProfile.companyType || '',
      isFemaleLed: typeof userProfile.isFemaleLed === 'boolean' ? userProfile.isFemaleLed : undefined,
      region: userProfile.region || '',
      projectSummary: String(userProfile.projectSummary || userPrompt || '')
    };
    const openFundIds = new Set<string>(liveCalls.filter(c => c.vigente && c.fundId).map(c => String(c.fundId)));
    const { eligible, near } = rankCatalogFunds(CHILEAN_FUNDS, answers, openFundIds);
    // Alternativas con poca afinidad no se muestran (salvo que no haya otra cosa)
    const strong = eligible.filter(r => r.score >= 45);
    const pool: RankedFund[] = (strong.length ? strong : eligible.length ? eligible.slice(0, 1) : near).slice(0, 5);
    if (targetFundHint) {
      const hinted = [...eligible, ...near].find(r => r.fund.id === targetFundHint);
      if (hinted && !pool.includes(hinted)) pool.unshift(hinted);
    }
    const liveFor = (id: string) => availableFunds.find((f: any) => f.id === id) || {};
    const fundView = (r: RankedFund, reasons?: string[], why?: string) => {
      const lf: any = liveFor(r.fund.id);
      return {
        fundId: r.fund.id,
        fundName: r.fund.name,
        agency: r.fund.agency,
        subsidyFormatted: r.fund.subsidyFormatted,
        maxSubsidyCLP: r.fund.maxSubsidyCLP,
        coFinancePct: r.fund.maxCoFinancePct,
        whenToApply: lf.callSchedule || r.fund.callSchedule || 'Próxima convocatoria por confirmar',
        status: lf.status || r.fund.status,
        callStatus: lf.callStatus || r.fund.callStatus,
        matchScore: r.score,
        whyYouQualify: why || r.reasons[0] || '',
        reasons: (reasons && reasons.length >= 2 ? reasons : r.reasons).slice(0, 3),
        femaleBonusEligible: Boolean(answers.isFemaleLed && (r.fund.femaleBonusPct || r.fund.id === 'sercotec_abeja_emprende')),
        femaleBonusText: answers.isFemaleLed && r.fund.femaleBonusPct ? `+${r.fund.femaleBonusPct}% adicional por liderazgo femenino` : undefined
      };
    };

    // 2. Convocatorias abiertas hoy (monitor) que calzan con la región y el perfil
    const rankedCalls = rankLiveCalls(liveCalls, answers, eligible.map(e => e.fund.id)).slice(0, 3);
    const openCalls = rankedCalls.map(({ call: c }) => ({
      id: c.id,
      titulo: c.titulo,
      alcance: c.alcance,
      cierre: c.cierre || null,
      topeAprox: c.tope_aprox || c.topeAprox || null,
      url: c.url,
      diasRestantes: calculateDaysRemaining(c.cierre),
      resumen: c.resumen || c.beneficio || null
    }));

    const buildResult = (order: RankedFund[], aiText?: { headline?: string; why?: Record<string, string>; reasons?: Record<string, string[]>; action?: string }) => {
      const [first, ...rest] = order;
      const primaryFund = fundView(first, aiText?.reasons?.[first.fund.id], aiText?.why?.[first.fund.id]);
      return {
        isValidProject: true,
        wowHeadline: aiText?.headline || (eligible.length ? `Tu mejor calce: ${first.fund.name}` : `El fondo más cercano a tu perfil: ${first.fund.name}`),
        allRequirementsMet: eligible.length > 0,
        primaryFund,
        secondaryFunds: rest.slice(0, 2).map(r => fundView(r, aiText?.reasons?.[r.fund.id], aiText?.why?.[r.fund.id])),
        openCalls,
        liveRegionalCallMatch: openCalls[0] ? { ...openCalls[0], vigente: true, beneficioResumen: openCalls[0].resumen } : undefined,
        actionCallout: aiText?.action || (first.open
          ? 'Hay una convocatoria abierta: crea tu hoja de ruta y empieza hoy.'
          : 'La convocatoria aún no abre: prepara la postulación ahora para llegar con todo listo.')
      };
    };

    if (pool.length === 0) {
      return res.json({
        isValidProject: true,
        noFundMatch: true,
        wowHeadline: 'Con tus respuestas no encontramos un fondo del catálogo que calce hoy',
        openCalls,
        liveRegionalCallMatch: openCalls[0] ? { ...openCalls[0], vigente: true } : undefined,
        actionCallout: 'Revisa el monitor de convocatorias: cada semana se abren concursos nuevos.',
        analizadoCon: 'reglas'
      });
    }

    // 3. La IA solo ordena y explica entre los fondos que ya cumplen (no puede elegir otros)
    try {
      const prompt = `PERFIL DECLARADO: ${JSON.stringify({ ventas: answers.salesBracket, etapa: answers.trlStage, tipo: answers.companyType, liderazgoFemenino: answers.isFemaleLed ?? null, region: answers.region || null })}
DESCRIPCIÓN DEL PROYECTO: «${String(answers.projectSummary).slice(0, 1500)}»

FONDOS QUE CUMPLEN LOS REQUISITOS EXCLUYENTES (elige y ordena SOLO entre estos ids):
${JSON.stringify(pool.map(r => ({ id: r.fund.id, nombre: r.fund.name, agencia: r.fund.agency, categoria: r.fund.category, resumen: String(r.fund.summary || '').slice(0, 300), requiereInnovacion: r.fund.requiresInnovation, convocatoriaAbierta: r.open, puntajeReglas: r.score })), null, 1)}

Responde SOLO este JSON:
{"orden":["id1","id2","id3"],"titular":"frase corta","porQue":{"id1":"1 frase concreta según el proyecto"},"razones":{"id1":["razón 1","razón 2","razón 3"],"id2":["razón 1","razón 2"]},"accion":"siguiente paso concreto"}`;
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: 'Eres especialista en fondos concursables de Chile. Ordena los fondos según qué tan bien calzan con el PROYECTO descrito (rubro, grado de innovación, objetivo), no por monto. No inventes requisitos, montos ni fechas. Escribe en español de Chile, claro y breve.',
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
      const parsed = JSON.parse(response.text || '{}');
      const order: RankedFund[] = [];
      for (const id of Array.isArray(parsed.orden) ? parsed.orden : []) {
        const r = pool.find(x => x.fund.id === id);
        if (r && !order.includes(r)) order.push(r);
      }
      for (const r of pool) if (!order.includes(r)) order.push(r);
      // Si pidió un fondo concreto y lo cumple, va primero
      if (targetFundHint) {
        const i = order.findIndex(r => r.fund.id === targetFundHint);
        if (i > 0) order.unshift(...order.splice(i, 1));
      }
      const clean = (v: any) => (typeof v === 'string' ? v.trim().slice(0, 400) : '');
      const why: Record<string, string> = {};
      const reasons: Record<string, string[]> = {};
      for (const r of pool) {
        const id = r.fund.id;
        if (clean(parsed.porQue?.[id])) why[id] = clean(parsed.porQue[id]);
        if (Array.isArray(parsed.razones?.[id])) reasons[id] = parsed.razones[id].map(clean).filter(Boolean).slice(0, 3);
      }
      return res.json({ ...buildResult(order, { headline: clean(parsed.titular) || undefined, why, reasons, action: clean(parsed.accion) || undefined }), analizadoCon: 'ia' });
    } catch (aiErr: any) {
      console.warn('[instant-match] IA no disponible, se usa el calce por reglas:', aiErr?.message);
      return res.json({ ...buildResult(pool), analizadoCon: 'reglas' });
    }
  } catch (err: any) {
    console.error('Error in /api/gemini/instant-match:', err?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});


// 0.1 Lector Inteligente de Carpeta Tributaria Electrónica SII (PDF o Texto)
// Valor de la UF del día (mindicador.cl, sin clave). Se guarda 12 horas; si falla, se usa UF_CLP o un valor aproximado.
let ufCache: { value: number; at: number } | null = null;
async function getUfValue(): Promise<{ value: number; isEstimate: boolean }> {
  if (ufCache && Date.now() - ufCache.at < 12 * 36e5) return { value: ufCache.value, isEstimate: false };
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch('https://mindicador.cl/api/uf', { signal: ctrl.signal });
    clearTimeout(t);
    if (r.ok) {
      const j: any = await r.json();
      const v = Number(j?.serie?.[0]?.valor);
      if (v > 20000 && v < 100000) {
        ufCache = { value: v, at: Date.now() };
        return { value: v, isEstimate: false };
      }
    }
  } catch (e: any) {
    console.warn('[uf] No se pudo obtener la UF del día:', e?.message);
  }
  const fallback = Number(process.env.UF_CLP) || 40000;
  return { value: fallback, isEstimate: true };
}

function legacyTaxFieldsFromDiagnosis(d: TaxDiagnosis) {
  const eligible = d.funds.filter(f => f.verdict === 'cumple').map(f => f.name);
  const parts: string[] = [];
  if (d.company.rut) parts.push(`RUT: ${formatRut(d.company.rut)}`);
  if (d.company.name) parts.push(`Razón Social: ${d.company.name}`);
  if (d.company.startDate) parts.push(`Inicio de actividades: ${d.company.startDate} (${d.company.ageText})`);
  parts.push(`${d.compliance.f29Declared} F29 declarados`);
  parts.push(`Ventas 12 meses: $${Math.round(d.sales.last12Total).toLocaleString('es-CL')} CLP`);
  return {
    rut: d.company.rut ? formatRut(d.company.rut) : '',
    companyName: d.company.name,
    companyType: d.company.companyType,
    startDate: d.company.startDate || undefined,
    monthsActive: d.company.ageMonths,
    annualSalesCLP: d.sales.last12Total,
    salesBracket: d.sales.salesBracket,
    periodsFound: d.compliance.f29Declared,
    hasMissingF29: d.compliance.f29Missing.length > 0,
    siiStatusObservations: `Datos leídos de la Carpeta Tributaria: ${parts.join(' | ')}.`,
    admissibilityVerdict: d.compliance.f29Missing.length > 0 || d.compliance.observations.length > 0 ? 'Observaciones en F29 detectadas' : 'Datos tributarios extraídos',
    bestFitFundRecommendation: eligible.slice(0, 3).join(' / '),
    firstCategory: d.company.firstCategory,
    analizadoCon: 'lector-sii',
    diagnosis: d
  };
}

app.post('/api/gemini/parse-tax-folder', requireAuth, guardAi('parse-tax-folder'), async (req, res) => {
  try {
    const { rawText, fileBase64, mimeType, fileName } = req.body || {};
    let extractedText = '';

    // If PDF base64 provided, extract text with PDFParse first
    if (fileBase64) {
      try {
        const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64;
        const pdfBuf = Buffer.from(cleanBase64, 'base64');
        const parser = new PDFParse({ data: pdfBuf });
        const textResult = await parser.getText();
        extractedText = textResult?.text || '';
      } catch (pdfErr) {
        console.warn('PDFParse extraction warning:', pdfErr);
      }
    } else if (rawText && typeof rawText === 'string') {
      extractedText = rawText;
    }

    // 1. Carpeta Tributaria Electrónica del SII: lector propio, exacto y sin IA
    const cte = parseCarpetaTributaria(extractedText || rawText || '');
    if (cte && (cte.f29.length > 0 || cte.f22.length > 0)) {
      const uf = await getUfValue();
      const diagnosis = buildTaxDiagnosis(cte, CHILEAN_FUNDS, { ufValue: uf.value, ufIsEstimate: uf.isEstimate });
      return res.json(legacyTaxFieldsFromDiagnosis(diagnosis));
    }

    // 2. Otros documentos (F29 sueltos, PDF escaneados): extracción básica + IA como respaldo
    const deterministicData = extractTaxFolderData(extractedText || rawText || '', fileName);
    let finalResult: any = { ...deterministicData, analizadoCon: 'sii-parser' };

    // IA de respaldo para todos los usuarios con cuenta: la lectura de la carpeta es crítica
    // Try Gemini AI enhancement if available
    try {
      let contents: any;
      if (fileBase64 && mimeType) {
        const cleanBase64 = fileBase64.includes('base64,') ? fileBase64.split('base64,')[1] : fileBase64;
        contents = [
          {
            inlineData: {
              mimeType: mimeType === 'application/pdf' ? 'application/pdf' : 'text/plain',
              data: cleanBase64,
            },
          },
          {
            text: `Analiza esta Carpeta Tributaria Electrónica SII (${fileName || 'documento'}). Extrae con exactitud legal y sin inventar datos: RUT, Razón Social oficial completa (sin palabras de encabezado), inicio de actividades, tipo societario ('spa'|'srl'|'eirl'|'sa'|'persona_natural'), periodos F29 y facturación anual en CLP.`,
          },
        ];
      } else {
        contents = `Analiza la siguiente información de Carpeta Tributaria Electrónica / F29 del SII de Chile:${(extractedText || rawText || '').slice(0, 15000)}`;
      }

      const systemInstruction = `Eres un analista tributario experto en el SII de Chile. Analiza la Carpeta Tributaria o Formulario 29.
REGLAS ESTRICTAS DE EXTRACCIÓN (NO INVENTAR DATOS):
1. 'rut': solo si es un RUT válido con dígito verificador módulo 11. Si no lo encuentras o no es válido, responde "".
2. 'companyName': Razón Social oficial limpia. PROHIBIDO incluir encabezados o etiquetas como "RUT", "Fecha", "Forma de actuación", "Nombre", "Incorporación" o "Actividad". Debe tener al menos 3 letras. Si no la encuentras, responde "".
3. 'annualSalesCLP': Ventas netas acumuladas de los últimos 12 meses solo si son superiores a $1.000 CLP. Si no hay ventas o no se detecta, responde 0.
4. 'companyType': 'spa'|'srl'|'eirl'|'sa'|'persona_natural' solo si está explícito o deducible legalmente. Si no, responde "".
5. 'startDate': Fecha de inicio de actividades (DD/MM/AAAA) si aparece. Si no, "".
6. 'periodsFound': Número entero de periodos F29 identificados en el texto.
Responde ÚNICAMENTE un JSON con:
{
  "rut": "",
  "companyName": "",
  "companyType": "",
  "startDate": "",
  "annualSalesCLP": 0,
  "periodsFound": 0
}`;

      const aiResponse = await ai.models.generateContent({
        model: MODEL_NAME,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const text = aiResponse.text || '';
      if (text) {
        const parsed = JSON.parse(text);

        // Requirement 1: Validación estricta antes de usar el dato de la IA (no mezclar a ciegas)
        const finalRut = isValidTaxRut(parsed.rut)
          ? formatRut(parsed.rut)
          : (isValidTaxRut(deterministicData.rut) ? formatRut(deterministicData.rut) : '');

        const finalCompanyName = isValidTaxCompanyName(parsed.companyName)
          ? parsed.companyName.trim()
          : (isValidTaxCompanyName(deterministicData.companyName) ? deterministicData.companyName.trim() : '');

        const finalSales = isValidTaxSales(parsed.annualSalesCLP)
          ? parseNumberCLP(parsed.annualSalesCLP)
          : (isValidTaxSales(deterministicData.annualSalesCLP) ? deterministicData.annualSalesCLP : 0);

        const allowedTypes = ['spa', 'srl', 'eirl', 'sa', 'persona_natural'];
        const finalCompanyType = (parsed.companyType && allowedTypes.includes(parsed.companyType))
          ? parsed.companyType
          : (deterministicData.companyType || '');

        const finalStartDate = parsed.startDate && /^\d{2}[-/]\d{2}[-/]\d{4}$/.test(parsed.startDate)
          ? parsed.startDate
          : deterministicData.startDate;

        let finalMonthsActive = deterministicData.monthsActive;
        if (finalStartDate && finalMonthsActive === null) {
          const parts = finalStartDate.split(/[-/]/);
          if (parts.length === 3) {
            const m = parseInt(parts[1], 10);
            const y = parseInt(parts[2], 10);
            if (!isNaN(y) && !isNaN(m)) {
              const now = new Date();
              finalMonthsActive = Math.max(0, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m));
            }
          }
        }

        const finalPeriodsFound = typeof parsed.periodsFound === 'number' && parsed.periodsFound >= 0
          ? parsed.periodsFound
          : deterministicData.periodsFound;

        let finalSalesBracket = '';
        if (finalSales > 0) {
          if (finalSales < 60000000) finalSalesBracket = 'menor_60m';
          else if (finalSales / 39000 < 2400) finalSalesBracket = 'micro_200_a_2400uf';
          else if (finalSales / 39000 < 25000) finalSalesBracket = 'pequena_2400_a_25000uf';
          else if (finalSales / 39000 < 100000) finalSalesBracket = 'mediana_25000_a_100000uf';
          else finalSalesBracket = 'grande_mayor_100000uf';
        } else if (finalPeriodsFound > 0) {
          finalSalesBracket = 'sin_ventas';
        }

        // Resumen que SOLO describe lo que efectivamente se leyó (sin frases inventadas de TGR ni 100% admisible)
        const descParts: string[] = [];
        if (finalRut) descParts.push(`RUT: ${finalRut}`);
        if (finalCompanyName) descParts.push(`Razón Social: ${finalCompanyName}`);
        if (finalStartDate) descParts.push(`Inicio actividades: ${finalStartDate}${finalMonthsActive !== null ? ` (${finalMonthsActive} meses)` : ''}`);
        if (finalPeriodsFound > 0) descParts.push(`${finalPeriodsFound} periodo(s) F29 detectado(s)`);
        if (finalSales > 1000) {
          descParts.push(`Ventas 12 meses: $${finalSales.toLocaleString('es-CL')} CLP`);
        } else if (finalPeriodsFound > 0) {
          descParts.push('Sin registro de ventas en los periodos informados');
        }

        const siiStatusObservations = descParts.length > 0
          ? `Datos leídos de la Carpeta Tributaria: ${descParts.join(' | ')}.`
          : 'No se detectaron datos tributarios legibles en el documento cargado.';

        finalResult = {
          rut: finalRut,
          companyName: finalCompanyName,
          companyType: finalCompanyType,
          startDate: finalStartDate,
          monthsActive: finalMonthsActive,
          annualSalesCLP: finalSales,
          salesBracket: finalSalesBracket,
          periodsFound: finalPeriodsFound,
          hasMissingF29: deterministicData.hasMissingF29,
          siiStatusObservations,
          admissibilityVerdict: descParts.length > 0 ? 'Datos tributarios extraídos' : 'Lectura pendiente',
          bestFitFundRecommendation: deterministicData.bestFitFundRecommendation,
          verificationCode: deterministicData.verificationCode,
          firstCategory: Boolean(finalStartDate || finalRut),
          analizadoCon: 'ia'
        };
      }
    } catch (aiErr: any) {
      console.warn('Gemini enhancement unavailable for parse-tax-folder, using high-precision parser:', aiErr?.message);
    }

    return res.json(finalResult);
  } catch (error: any) {
    console.error('Error in /api/gemini/parse-tax-folder:', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

// 1. Diagnóstico y Calce Inteligente de Fondos
app.post('/api/gemini/diagnose', requireAuth, requireActivePlan, guardAi('diagnose'), async (req, res) => {
  try {
    const { profile, availableFunds } = req.body;

    const prompt = `Eres el especialista sénior en fondos concursables en Chile (CORFO, SERCOTEC, ANID, Start-Up Chile, FIA, ProChile).
Analiza el perfil de esta empresa chilena y evalúa su compatibilidad contra los fondos disponibles.

PERFIL DE LA EMPRESA:
- Razón Social: ${profile.companyName}
- RUT: ${profile.rut}
- Tipo Societario: ${profile.companyType}
- Antigüedad: ${profile.monthsActive} meses activo ante el SII
- Ventas Anuales: ${profile.salesBracket} ($${profile.annualSalesCLP || 0} CLP)
- Sector: ${profile.sector}
- Región: ${profile.region}
- Liderazgo Femenino: ${profile.isFemaleLed ? `Sí (${profile.femaleEquityPct}% participación de mujeres)` : 'No'}
- Nivel TRL: ${profile.trlStage}
- Nivel de Innovación: ${profile.innovationLevel}
- Resumen del Proyecto: ${profile.projectSummary}
- Tecnología Núcleo: ${profile.coreTech}
- Validación Comercial (Cartas de Interés): ${profile.customerValidationCount} cartas firmadas

FONDOS A EVALUAR:
${JSON.stringify(availableFunds, null, 2)}

Devuelve una evaluación rigurosa en formato JSON con la siguiente estructura:
{
  "matches": [
    {
      "fundId": "id_del_fondo",
      "fundName": "Nombre del Fondo",
      "agency": "CORFO | SERCOTEC | etc.",
      "matchScore": 88,
      "isEligible": true,
      "maxSubsidyCLP": 15000000,
      "maxSubsidyFormatted": "$15.000.000 CLP",
      "femaleBonusApplied": true,
      "coFinancePct": 85,
      "companyContributionPct": 15,
      "companyCashRequiredCLP": 2647058,
      "reasonsEligible": [
        "Cumple con tope de ventas menores a $60M",
        "TRL compatible con fase de validación técnica"
      ],
      "blockers": [],
      "strategicAdvice": "Consejo táctico clave para asegurar alta puntuación en el comité.",
      "recommendedFocus": [
        "Cuantificar el dolor de mercado en Chile",
        "Adjuntar al menos 2 cartas de interés (LOI) de clientes reales"
      ]
    }
  ],
  "overallReadinessSummary": "Diagnóstico general de la empresa para postular en 2026...",
  "requiredNextSteps": [
    "Paso 1...",
    "Paso 2...",
    "Paso 3..."
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '';
    if (!text) throw new Error('Respuesta vacía de Gemini');
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/diagnose:', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

// 2. Formulación Técnica Completa para Postulación

/** Fondo desde el catálogo (datos verificados) o, si viene del monitor, el que envía la app. */
function officialFund(fund: any): any {
  if (!fund || typeof fund !== 'object') return fund;
  return CHILEAN_FUNDS.find(f => f.id === fund.id) || fund;
}
/** Resumen de las bases del fondo para darle contexto a la IA. */
function fundRulesForPrompt(fundIn: any): string {
  const fund = officialFund(fundIn);
  const r = getFundRules(fund);
  const crit = (fund.evaluationCriteria || []).map((c: any) => `- ${c.name} (${c.weight}%): ${c.description}`).join('\n');
  return `BASES OFICIALES DEL FONDO "${fund.name}" (${fund.agency}) — ${r.bases.title}:
- Requisitos para postular: ${r.requirements.map(q => q.label).join('; ')}
- Financiamiento: ${r.coFinance.text}${r.partners ? `\n- Con quién se postula: ${r.partners}` : ''}
- Duración: ${r.duration}
- Formulario oficial (secciones): ${r.formSections.map(f => f.title + (f.evaluates ? ` [${f.evaluates}]` : '')).join(' | ')}${r.pitch ? `\n- ${r.pitch.label}: ${r.pitch.content}` : ''}
- Cómo se evalúa (${r.evaluation.scale}): ${r.evaluation.rule}
- Criterios de evaluación y ponderaciones:
${crit}
- Cuentas del presupuesto: ${r.budget.map(b => b.account + (b.cap ? ` (${b.cap})` : '')).join('; ')}`;
}

app.post('/api/gemini/formulate', requireAuth, requireActivePlan, guardAi('formulate'), async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const fundId = req.body?.fund?.id;
    if (fundId) {
      const slotCheck = await checkAndRegisterPostulationSlot(user.uid, fundId);
      if (!slotCheck.ok) {
        return res.status(429).json({ error: slotCheck.error });
      }
    }

    const { profile, fund, specificInstructions } = req.body;

    const prompt = `Eres el redactor y formulador de proyectos número 1 de Chile, con un récord de más de 85% de adjudicaciones en CORFO (Semilla Inicia, Semilla Expande, Crea y Valida), SERCOTEC y Start-Up Chile.
Redacta la formulación técnica oficial para postular al fondo "${fund.name}" de ${fund.agency}.

DATOS DE LA EMPRESA:
- Nombre: ${profile.companyName}
- RUT: ${profile.rut}
- Tipo Societario: ${profile.companyType}
- Sector: ${profile.sector}
- Región: ${profile.region}
- Ventas: ${profile.salesBracket}
- Nivel TRL: ${profile.trlStage}
- Resumen Base: ${profile.projectSummary}
- Tecnología: ${profile.coreTech}
- Liderazgo Femenino: ${profile.isFemaleLed ? `Sí (${profile.femaleEquityPct}%)` : 'No'}
- Instrucciones específicas del usuario: ${specificInstructions || 'Ninguna'}

REGLA CRÍTICA OBLIGATORIA:
Usa SOLO la información entregada por el usuario. PROHIBIDO inventar hechos, clientes, socios, tecnologías, integrantes del equipo, logros, cifras, porcentajes o montos. Si falta información para un punto, escribe [COMPLETAR: qué dato falta] en ese lugar. Es preferible un texto más breve y verdadero que uno extenso con información inventada. La extensión debe depender de la información disponible.

${fundRulesForPrompt(fund)}

Redacta cada campo pensando en la sección del formulario oficial donde se usará y en los criterios que la evalúan. Usa los nombres de las cuentas del presupuesto de este fondo.

Responde ÚNICAMENTE en formato JSON con la siguiente estructura completa:
{
  "fundId": "${fund.id}",
  "fundName": "${fund.name}",
  "projectTitle": "Título potente y técnico del proyecto (máx 15 palabras)",
  "pitchSummary30s": "Elevator pitch para el jurado basado estrictamente en la información disponible",
  "problemStatement": "Descripción del problema u oportunidad en Chile, cuantificando el dolor económico y la pérdida de productividad.",
  "solutionAndInnovation": "Descripción detallada de la solución, explicando por qué es innovadora y qué componentes tecnológicos la componen.",
  "noveltyVsCompetitors": "Grado de novedad y barreras de entrada frente a alternativas existentes en Chile y el mundo.",
  "marketAnalysisTAM": {
    "tam": "Cálculo del Total Addressable Market en USD",
    "sam": "Serviceable Addressable Market en Chile",
    "som": "Mercado objetivo a capturar en los primeros 18 meses",
    "clientArchetype": "Perfil detallado del comprador o usuario final B2B o B2C"
  },
  "businessModel": "Modelo de ingresos, estructura de precios (SaaS, fee, unit economics, LTV/CAC) y estrategia de comercialización 'Go-to-Market'.",
  "workPlanMilestones": [
    {
      "month": "Mes 1 a 3",
      "title": "Hito 1",
      "description": "Actividades técnicas y de validación",
      "deliverable": "Entregable tangible verificable por CORFO",
      "criticalRisk": "Riesgo crítico y plan de mitigación"
    },
    {
      "month": "Mes 4 a 8",
      "title": "Hito 2",
      "description": "Actividades",
      "deliverable": "Entregable",
      "criticalRisk": "Riesgo y mitigación"
    },
    {
      "month": "Mes 9 a 12",
      "title": "Hito 3",
      "description": "Actividades",
      "deliverable": "Entregable",
      "criticalRisk": "Riesgo y mitigación"
    }
  ],
  "budgetBreakdown": [
    {
      "account": "Recursos Humanos (Sueldos y Honorarios)",
      "item": "Líder Técnico / Desarrollador",
      "corfoContributionCLP": 6000000,
      "companyPecuniaryCLP": 1500000,
      "companyValuedCLP": 0,
      "justification": "Dedicación 100% al desarrollo técnico del prototipo funcional."
    },
    {
      "account": "Gastos de Operación (Prospección y Validación)",
      "item": "Pilotos comerciales y marketing de validación",
      "corfoContributionCLP": 4000000,
      "companyPecuniaryCLP": 1000000,
      "companyValuedCLP": 0,
      "justification": "Cofinanciamiento de pruebas en terreno y captación de cartas de compra."
    },
    {
      "account": "Gastos de Administración y Garantías",
      "item": "Póliza de seguro de fianza y contabilidad técnica",
      "corfoContributionCLP": 1250000,
      "companyPecuniaryCLP": 350000,
      "companyValuedCLP": 0,
      "justification": "Costo de prima de seguro para solicitar el 100% de anticipo de fondos."
    }
  ],
  "teamCapabilities": "Experiencia del equipo fundador, complementariedad técnica y de negocios, dedicación horaria",
  "bonusFemaleJustification": "Justificación de liderazgo femenino y porcentaje de participación social para el 10% adicional de bonificación"
}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const text = response.text || '';
    if (!text) throw new Error('Respuesta vacía de Gemini');
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/formulate:', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

// 3. Auditor Ciego y Simulador de Rúbrica CORFO / SERCOTEC

// 2.1 Formulación de Sección Específica (Problema, Solución, Mercado, Equipo, Modelo/Plan)
app.post('/api/gemini/formulate-section', requireAuth, requireActivePlan, guardAi('formulate-section'), async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const fundId = req.body?.fund?.id;
    if (fundId) {
      const slotCheck = await checkAndRegisterPostulationSlot(user.uid, fundId);
      if (!slotCheck.ok) {
        return res.status(429).json({ error: slotCheck.error });
      }
    }

    const { profile, projectProfile: directProj, taxFolderData, fund, sectionKey, sectionTitle, questionsAndAnswers, projectSummary } = req.body;
    if (!profile || !fund || !sectionKey) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos para formular la sección.' });
    }

    const project = directProj || profile?.projectProfile || {};
    const tax = taxFolderData || {
      sector: profile?.sector,
      region: profile?.region,
      monthsActive: profile?.monthsActive,
      annualSalesCLP: profile?.annualSalesCLP,
      salesBracket: profile?.salesBracket
    };

    const qaText = questionsAndAnswers && typeof questionsAndAnswers === 'object'
      ? Object.entries(questionsAndAnswers)
          .map(([q, a]) => `- Pregunta: ${q}\n  Respuesta entregada por el usuario: ${a ? String(a).trim() : 'No especificado por el usuario'}`)
          .join('\n')
      : 'No se ingresaron respuestas adicionales.';

    const prompt = `Eres el redactor y formulador de proyectos número 1 de Chile, especialista en adjudicaciones en ${fund.agency} (CORFO, SERCOTEC, Start-Up Chile).

Tu misión es redactar la sección "${sectionTitle || sectionKey}" para postular al fondo "${fund.name}".

PERFIL DETALLADO DEL PROYECTO (INFORMACIÓN OFICIAL ENTREGADA POR EL USUARIO):
- ¿Qué hace tu empresa o proyecto?: ${project.whatItDoes || profile.projectSummary || projectSummary || 'No informado'}
- ¿Qué problema resuelve y a quién (cliente objetivo)?: ${project.problemAndTarget || 'No informado'}
- ¿Cómo lo resuelven hoy y qué te diferencia?: ${project.currentSolutionAndDiff || 'No informado'}
- Avance actual (prototipos, clientes, ventas, pilotos, cartas de interés): ${project.currentProgress || 'No informado'}
- Equipo clave (nombre, rol y experiencia): ${project.teamDetails || 'No informado'}
- Modelo de negocio (cómo cobras y cuánto): ${project.businessModel || 'No informado'}
- ¿Para qué necesitas el financiamiento y en qué lo usarías?: ${project.fundingPurpose || 'No informado'}
- Sitio web o redes: ${project.websiteOrSocial || 'No informado'}

DATOS CONFIRMADOS DE CARPETA TRIBUTARIA Y EMPRESA:
- Empresa: ${profile.companyName || 'Empresa postulante'}
- RUT: ${profile.rut || 'No informado'}
- Sector: ${tax.sector || profile.sector || 'No informado'}
- Región: ${tax.region || profile.region || 'No informada'}
- Antigüedad: ${tax.monthsActive !== null && tax.monthsActive !== undefined ? `${tax.monthsActive} meses` : 'No informada'}
- Ventas 12 meses: ${tax.annualSalesCLP ? '$' + Number(tax.annualSalesCLP).toLocaleString('es-CL') + ' CLP' : profile.salesBracket || 'Sin ventas registradas'}
- Tipo Societario: ${profile.companyType || 'SpA'}
- Liderazgo Femenino: ${profile.isFemaleLed ? 'Sí (califica a bonificación)' : 'No'}

RESPUESTAS INGRESADAS POR EL USUARIO PARA ESTA SECCIÓN:
${qaText}

${fundRulesForPrompt(fund)}

ESTA SECCIÓN EN EL FORMULARIO OFICIAL:
- Corresponde a: ${(() => { const r = getFundRules(officialFund(fund)); const fs = r.formSections.find(x => x.blocks.includes(sectionKey)); return fs ? `"${fs.title}"${fs.evaluates ? ` (evalúa ${fs.evaluates})` : ''}` : (sectionTitle || sectionKey); })()}
- Qué debe contener: ${(() => { const r = getFundRules(officialFund(fund)); return (FAMILY_BLOCKS as any)[r.family]?.[sectionKey]?.hint || ''; })()}
Escribe con el lenguaje y la estructura que espera el evaluador de este fondo (por ejemplo, en Sercotec es un modelo de negocio simple y concreto; en Corfo y FIA, un proyecto técnico con indicadores).

REGLA CRÍTICA OBLIGATORIA CONTRA ALUCINACIONES:
Usa SOLO la información entregada por el usuario. PROHIBIDO inventar hechos, clientes, socios, tecnologías, integrantes del equipo, logros, cifras, porcentajes o montos. Si falta información para un punto, escribe [COMPLETAR: qué dato falta] en ese lugar. Es preferible un texto más breve y verdadero que uno extenso con información inventada. La extensión debe depender estrictamente de la información disponible.

Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{
  "sectionKey": "${sectionKey}",
  "sectionTitle": "${sectionTitle || sectionKey}",
  "generatedText": "Texto formal y técnico redactado basado exclusivamente en la información disponible, utilizando [COMPLETAR: dato faltante] en cualquier punto donde falten datos...",
  "keyHighlights": [
    "Punto fuerte 1",
    "Punto fuerte 2"
  ],
  "missingData": [
    "Lista de datos que faltan para completar este punto"
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const respText = response.text || '';
    if (!respText) throw new Error('Respuesta vacía de Gemini');
    const parsed = JSON.parse(respText);

    // Extract all [COMPLETAR: ...] tags directly from generatedText to guarantee complete list
    const regexMatches = (parsed.generatedText || '').match(/\[COMPLETAR:[^\]]+\]/g) || [];
    const extractedMissing = regexMatches.map((m: string) => m.replace(/^\[COMPLETAR:\s*/i, '').replace(/\]$/, '').trim());
    const combinedMissing = Array.from(new Set([
      ...(Array.isArray(parsed.missingData) ? parsed.missingData : []),
      ...extractedMissing
    ]));
    parsed.missingData = combinedMissing;

    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/formulate-section:', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

app.post('/api/gemini/audit', requireAuth, requireActivePlan, guardAi('audit'), async (req, res) => {
  try {
    const { fund, formulationText, projectSummary, profile, projectProfile: directProj, taxFolderData } = req.body;
    const project = directProj || profile?.projectProfile || {};
    const tax = taxFolderData || {
      sector: profile?.sector,
      region: profile?.region,
      monthsActive: profile?.monthsActive,
      annualSalesCLP: profile?.annualSalesCLP
    };

    const prompt = `Actúa como un evaluador experto del comité que asigna el fondo "${fund.name}" de ${fund.agency}, siguiendo estrictamente sus bases.
Tu misión es realizar una auditoría ciega estricta y sin condescendencia sobre la siguiente postulación para el fondo "${fund.name}".

REGLA CRÍTICA OBLIGATORIA:
Usa SOLO la información entregada por el usuario. PROHIBIDO inventar hechos, clientes, socios, tecnologías, integrantes del equipo, logros, cifras, porcentajes o montos. Si falta información para un punto, escribe [COMPLETAR: qué dato falta] en ese lugar. Es preferible un texto más breve y verdadero que uno extenso con información inventada. La extensión debe depender de la información disponible. Si la postulación contiene marcas [COMPLETAR: ...], identifícalas como debilidades críticas o Red Flags que el postulante debe corregir antes del cierre.

DATOS OFICIALES DE LA EMPRESA Y PROYECTO:
- Empresa: ${profile?.companyName || 'Empresa postulante'}
- RUT: ${profile?.rut || 'No informado'}
- Sector: ${tax?.sector || profile?.sector || 'No informado'}
- Región: ${tax?.region || profile?.region || 'No informada'}
- Antigüedad: ${tax?.monthsActive !== null && tax?.monthsActive !== undefined ? `${tax.monthsActive} meses` : 'No informada'}
- Ventas 12 meses: ${tax?.annualSalesCLP ? '$' + Number(tax.annualSalesCLP).toLocaleString('es-CL') + ' CLP' : profile?.salesBracket || 'Sin ventas registradas'}
- ¿Qué hace la empresa?: ${project?.whatItDoes || profile?.projectSummary || 'No informado'}
- Problema y cliente objetivo: ${project?.problemAndTarget || 'No informado'}
- Solución y qué la diferencia: ${project?.currentSolutionAndDiff || 'No informado'}
- Avance actual informado: ${project?.currentProgress || 'No informado'}
- Equipo informado: ${project?.teamDetails || 'No informado'}
- Modelo de negocio informado: ${project?.businessModel || 'No informado'}
- Uso del financiamiento: ${project?.fundingPurpose || 'No informado'}
- Sitio web o redes: ${project?.websiteOrSocial || 'No informado'}

TEXTO Y CONTENIDO DE LA POSTULACIÓN:
"""
${formulationText || projectSummary}
"""

${fundRulesForPrompt(fund)}

INSTRUCCIONES DE AUDITORÍA:
1. Evalúa CADA criterio de la lista anterior (usa exactamente esos nombres y ponderaciones en "criteriaScores") con nota de 1.0 a 5.0, y calcula "overallScore" como el promedio ponderado.
2. Aplica la regla de evaluación de las bases indicada arriba (nota mínima por criterio o nota final, si existe). En "verdict" indica si cumple o no esa regla.
3. Identifica "Red Flags": requisitos de admisibilidad que podrían no cumplirse según los datos, secciones del formulario oficial que faltan, montos o porcentajes fuera de las bases, y cualquier dato pendiente marcado como [COMPLETAR: ...].
4. Entrega consejos concretos y prioritarios para subir la nota antes de postular, basándote únicamente en hechos reales.

Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{
  "overallScore": 4.2,
  "verdict": "Adjudicable Altamente Probable | En Zona de Corte | Riesgo de Rechazo | No Elegible",
  "criteriaScores": [
    {
      "criterion": "Nombre del criterio",
      "weight": 40,
      "score": 4.1,
      "observations": "Comentario técnico de fortalezas y debilidades...",
      "improvementTips": "Cómo mejorar este punto específico..."
    }
  ],
  "redFlags": [
    "Alerta 1...",
    "Alerta 2..."
  ],
  "strengths": [
    "Fortaleza 1...",
    "Fortaleza 2..."
  ],
  "top3PriorityChanges": [
    "Cambio 1...",
    "Cambio 2...",
    "Cambio 3..."
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const text = response.text || '';
    if (!text) throw new Error('Respuesta vacía de Gemini');
    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/audit:', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

// 4. Generación de Documentos Formales (Cartas LOI, Compromisos, etc.)
app.post('/api/gemini/generate-doc', requireAuth, requireActivePlan, guardAi('generate-doc'), async (req, res) => {
  try {
    const {
      documentType,
      companyName,
      clientOrPartnerName,
      projectName,
      fundName,
      legalRepName,
      legalRepRut,
      city,
      details,
      formulation,
      taxFolderSummary,
      profile,
      projectProfile: directProj,
      taxFolderData
    } = req.body;

    const project = directProj || profile?.projectProfile || {};
    const tax = taxFolderData || {
      sector: profile?.sector || details?.sector,
      region: profile?.region || details?.region,
      monthsActive: profile?.monthsActive,
      annualSalesCLP: profile?.annualSalesCLP
    };

    const prompt = `Eres un abogado y consultor corporativo experto en tramitación de subsidios públicos en Chile (CORFO, SERCOTEC, ANID, Start-Up Chile).
Genera un documento formal, listo para firmar o presentar, de tipo: "${documentType || 'Carta de Manifestación de Interés Comercial (LOI)'}".

INSTRUCCIONES Y REGLAS ESTRICTAS:
Usa SOLO la información entregada por el usuario. PROHIBIDO inventar hechos, clientes, socios, tecnologías, integrantes del equipo, logros, cifras, porcentajes o montos. Si falta información para un punto, escribe [COMPLETAR: qué dato falta] en ese lugar. Es preferible un texto más breve y verdadero que uno extenso con información inventada. La extensión debe depender de la información disponible.
Donde falte un dato específico que deba completar el usuario o la contraparte, escribe explícitamente [COMPLETAR: descripción del dato faltante] (por ejemplo: [COMPLETAR: RUT de la contraparte], [COMPLETAR: Cargo del firmante], [COMPLETAR: Fecha de firma]).
Diseña el documento conforme a las Bases Administrativas y Técnicas del concurso: ${fundName || 'CORFO / SERCOTEC'}.

DATOS CONFIRMADOS DE LA EMPRESA Y PROYECTO:
- Empresa Postulante: ${companyName || profile?.companyName || '[COMPLETAR: Razón Social de la Empresa]'}
- RUT Empresa: ${details?.rut || profile?.rut || '[COMPLETAR: RUT Empresa]'}
- Representante Legal Empresa: ${legalRepName || profile?.representativeName || '[COMPLETAR: Nombre del Representante Legal]'}
- RUT Representante Legal: ${legalRepRut || profile?.representativeRut || '[COMPLETAR: RUT del Representante Legal]'}
- Ciudad: ${city || details?.city || '[COMPLETAR: Ciudad]'}
- Región: ${details?.region || tax.region || '[COMPLETAR: Región]'}
- Sector: ${details?.sector || tax.sector || 'No especificado'}
- Antigüedad: ${tax.monthsActive !== null && tax.monthsActive !== undefined ? `${tax.monthsActive} meses` : 'No informada'}
- Ventas 12 meses: ${tax.annualSalesCLP ? '$' + Number(tax.annualSalesCLP).toLocaleString('es-CL') + ' CLP' : 'Sin ventas registradas'}
- ¿Qué hace la empresa?: ${project.whatItDoes || profile?.projectSummary || 'No informado'}
- Problema y cliente objetivo: ${project.problemAndTarget || 'No informado'}
- Solución y diferenciación: ${project.currentSolutionAndDiff || 'No informado'}
- Avance actual (pilotos, cartas, ventas): ${project.currentProgress || 'No informado'}
- Equipo clave: ${project.teamDetails || 'No informado'}
- Modelo de negocio: ${project.businessModel || 'No informado'}
- Contraparte / Cliente Piloto o Aliado: ${clientOrPartnerName || '[COMPLETAR: Razón Social o Nombre del Cliente / Aliado]'}
- Nombre y Cargo del Contacto Contraparte: ${details?.clientContact || '[COMPLETAR: Nombre y Cargo del Representante de la Contraparte]'}
- Nombre del Proyecto: ${projectName || '[COMPLETAR: Nombre del Proyecto]'}
- Fondo Concursable al que se postula: ${fundName || '[COMPLETAR: Nombre del Fondo Concursable]'}

${formulation ? `
ANTECEDENTES DE LA FORMULACIÓN TÉCNICA:
- Título Oficial: ${formulation.projectTitle || projectName || ''}
- Problema que resuelve: ${formulation.problemStatement || ''}
- Solución e Innovación: ${formulation.solutionOverview || formulation.solutionAndInnovation || ''}
` : ''}
${taxFolderSummary ? `
ANTECEDENTES TRIBUTARIOS (SII):
${taxFolderSummary}
` : ''}

FORMATO Y ESTRUCTURA:
- Redacción legal, ejecutiva y precisa en Markdown pulcro.
- Incluye campos claros para: Fecha, Ciudad, Identificación de las partes, Cláusulas o declaraciones expresas de interés comercial, pilotaje o cofinanciamiento, y bloque final de firmas con Nombre, RUT, Cargo y Timbre.
- Donde falte cualquier dato, escribe [COMPLETAR: ...] sin inventar nada.

Genera el texto completo del documento en formato Markdown:`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        temperature: 0.2,
      },
    });

    const markdownText = response.text || '';
    if (!markdownText) throw new Error('Respuesta vacía de Gemini');
    return res.json({ documentText: markdownText });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-doc:', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

// 5. Asistente Conversacional Experto en Fondos Chilenos
/**
 * Gemini exige que la conversación empiece con el usuario y alterne turnos.
 * Quita saludos iniciales del asistente, une mensajes seguidos del mismo rol y limita el largo.
 */
function normalizeChatTurns(turns: { role: 'user' | 'model'; text: string }[], maxTurns = 20) {
  const out: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const t of turns) {
    const text = String(t.text || '').trim();
    if (!text) continue;
    if (out.length === 0 && t.role !== 'user') continue;
    const last = out[out.length - 1];
    if (last && last.role === t.role) last.parts[0].text += `\n\n${text}`;
    else out.push({ role: t.role, parts: [{ text }] });
  }
  let trimmed = out.slice(-maxTurns);
  while (trimmed.length && trimmed[0].role !== 'user') trimmed = trimmed.slice(1);
  return trimmed;
}

app.post('/api/gemini/chat', requireAuth, requireActivePlan, guardAi('chat'), async (req, res) => {
  try {
    const { messages, companyProfile, profile, projectProfile: directProj, taxFolderData, currentFund } = req.body;
    const compProfile = companyProfile || profile || {};
    const project = directProj || compProfile?.projectProfile || {};
    const tax = taxFolderData || {
      sector: compProfile?.sector,
      region: compProfile?.region,
      monthsActive: compProfile?.monthsActive,
      annualSalesCLP: compProfile?.annualSalesCLP
    };

    const systemInstruction = `Eres "ImpulsaCap AI", el consultor de fondos concursables más experimentado de Chile.
Conoces en profundidad:
- Todo el ecosistema de financiamiento público chileno: CORFO (Semilla Inicia, Semilla Expande, Innova Alta Tecnología, Crea y Valida, Súmate a Innovar), SERCOTEC (Capital Semilla, Abeja, Crece), ANID (Fondef), Start-Up Chile (Build, Ignite, Growth), FIA, Sence y ProChile.
- Bases Administrativas Generales (BAG) y resoluciones exentas de CORFO.
- Ley de I+D (Ley 20.241 con beneficio tributario del 35% de crédito sobre impuesto de 1ª categoría).
- Criterios de admisibilidad legal: F29 del SII, Carpeta Tributaria Electrónica, estatuto en Tu Empresa en un Día, certificados de TGR y Dirección del Trabajo F30.
- Rendición de cuentas financieras: Cuentas de Recursos Humanos, Gastos de Operación, Inversión y Administración, garantías o pagarés ante CORFO, anticipos y pólizas de seguro de fianza.

REGLA CRÍTICA OBLIGATORIA:
Usa SOLO la información entregada por el usuario. PROHIBIDO inventar hechos, clientes, socios, tecnologías, integrantes del equipo, logros, cifras, porcentajes o montos. Si falta información para un punto, escribe [COMPLETAR: qué dato falta] en ese lugar. Es preferible un texto más breve y verdadero que uno extenso con información inventada. La extensión debe depender de la información disponible.

PERFIL DETALLADO DEL PROYECTO (INFORMACIÓN OFICIAL ENTREGADA POR EL USUARIO):
- ¿Qué hace tu empresa o proyecto?: ${project.whatItDoes || compProfile.projectSummary || 'No informado'}
- ¿Qué problema resuelve y a quién (cliente objetivo)?: ${project.problemAndTarget || 'No informado'}
- ¿Cómo lo resuelven hoy y qué te diferencia?: ${project.currentSolutionAndDiff || 'No informado'}
- Avance actual (prototipos, clientes, ventas, pilotos, cartas de interés): ${project.currentProgress || 'No informado'}
- Equipo clave (nombre, rol y experiencia): ${project.teamDetails || 'No informado'}
- Modelo de negocio (cómo cobras y cuánto): ${project.businessModel || 'No informado'}
- ¿Para qué necesitas el financiamiento y en qué lo usarías?: ${project.fundingPurpose || 'No informado'}
- Sitio web o redes: ${project.websiteOrSocial || 'No informado'}

DATOS CONFIRMADOS DE CARPETA TRIBUTARIA Y EMPRESA:
- Empresa: ${compProfile.companyName || 'Empresa postulante'}
- RUT: ${compProfile.rut || 'No informado'}
- Sector: ${tax.sector || compProfile.sector || 'No informado'}
- Región: ${tax.region || compProfile.region || 'No informada'}
- Antigüedad: ${tax.monthsActive !== null && tax.monthsActive !== undefined ? `${tax.monthsActive} meses` : 'No informada'}
- Ventas 12 meses: ${tax.annualSalesCLP ? '$' + Number(tax.annualSalesCLP).toLocaleString('es-CL') + ' CLP' : compProfile.salesBracket || 'Sin ventas registradas'}
- Tipo Societario: ${compProfile.companyType || 'SpA'}
- Liderazgo Femenino: ${compProfile.isFemaleLed ? 'Sí (califica a bonificación)' : 'No'}

${currentFund && currentFund.id ? fundRulesForPrompt(currentFund) : 'Fondo en consulta: ninguno seleccionado.'}

Cuando respondas sobre requisitos, montos, documentos o evaluación, usa las bases del fondo indicadas arriba; si algo no está ahí, dilo y recomienda revisar las bases de la convocatoria.

Sé conciso, empático, directo y ultra práctico. Habla con terminología chilena natural pero muy profesional (UF, CLP, RUT, SpA, SII, TGR, rendición, contraparte, cofinanciamiento).`;

    // Historial válido para Gemini: parte con el usuario (se omite el saludo inicial del asesor)
    const formattedContents = normalizeChatTurns(
      (Array.isArray(messages) ? messages : []).map((m: { role: string; content: string }) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: String(m.content || '').slice(0, 4000)
      }))
    );
    if (formattedContents.length === 0 || formattedContents[formattedContents.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Escribe tu consulta para el asesor.' });
    }

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const reply = response.text || '';
    if (!reply) throw new Error('Respuesta vacía de Gemini');
    return res.json({ reply });
  } catch (error: any) {
    console.error('Error in /api/gemini/chat:', error?.status || '', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

// 5b. Robot de Ayuda de la Plataforma (Público, sin sesión ni plan requerido - Requirement 2)
// La prueba gratis solo existe con PAGOS_MODO=anticipado: fuera de ese modo, el robot no la ofrece.
function supportKnowledgeForMode(): string {
  if (isEarlyAccessMode()) return SUPPORT_KNOWLEDGE;
  return SUPPORT_KNOWLEDGE.replace(
    /- Beneficio de lanzamiento para pymes:[^\n]*/,
    '- Prueba gratis de lanzamiento: ya terminó; hoy el Plan Trimestral se activa pagando. Quienes la usaron reciben un correo con el enlace para activar el plan a precio de lanzamiento y tienen 7 días desde ese aviso; sus datos y postulaciones quedan guardados.'
  );
}

app.post('/api/ayuda/chat', guardAi('ayuda'), async (req, res) => {
  try {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }
    if (message.length > 500) {
      return res.status(400).json({ error: 'El mensaje no puede superar los 500 caracteres.' });
    }
    // Conversación previa (para entender preguntas como "¿y si no me llega?")
    const history: { role: 'user' | 'bot'; text: string }[] = Array.isArray(req.body?.history)
      ? req.body.history
          .filter((m: any) => (m?.role === 'user' || m?.role === 'bot') && typeof m?.text === 'string')
          .slice(-8)
          .map((m: any) => ({ role: m.role, text: String(m.text).slice(0, 600) }))
      : [];

    const systemInstruction = `Eres el asistente de soporte de ImpulsaCap. Respondes dudas sobre cómo usar la plataforma, cuentas, planes, pagos, correos, carpeta tributaria, privacidad y problemas técnicos.

BASE DE CONOCIMIENTO (única fuente válida):
${supportKnowledgeForMode()}

REGLAS:
- Responde en español de Chile, tuteando, claro y breve (máximo 110 palabras). Si es un procedimiento, da los pasos numerados.
- Usa SOLO la base de conocimiento. Si la respuesta no está ahí, no la inventes: dilo y ofrece hablar con una persona (needsHuman = true).
- Preguntas sobre fondos específicos, requisitos de un concurso, bases, montos, fechas de cierre, cómo redactar o cómo ganar un fondo: intent = "fondos". En ese caso responde que eso lo resuelve el Asesor Experto, disponible dentro de cada postulación con el Plan Trimestral, y que el monitor de convocatorias muestra los cierres.
- needsHuman = true cuando: el usuario pide hablar con una persona; reporta un pago cobrado sin plan activo, un cobro duplicado o quiere ejercer el retracto o pedir devolución; reporta un error que los pasos de la base no resuelven; está molesto; o no sabes la respuesta.
- Nunca pidas contraseñas ni datos de tarjetas.

Responde SOLO un JSON: {"reply": "texto", "intent": "plataforma" | "fondos" | "humano", "needsHuman": true | false}`;

    const contents = normalizeChatTurns([
      ...history.map(m => ({ role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model', text: m.text })),
      { role: 'user' as const, text: message.trim() }
    ]);

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json'
      }
    });

    let reply = '';
    let intent = 'plataforma';
    let needsHuman = false;
    const raw = response.text?.trim() || '';
    try {
      const parsed = JSON.parse(raw);
      reply = String(parsed.reply || '').trim();
      intent = ['plataforma', 'fondos', 'humano'].includes(parsed.intent) ? parsed.intent : 'plataforma';
      needsHuman = Boolean(parsed.needsHuman) || intent === 'humano';
    } catch {
      reply = raw;
    }
    if (!reply) throw new Error('Respuesta vacía de Gemini');

    return res.json({ reply, intent, needsHuman, isExpertRedirect: intent === 'fondos' });
  } catch (error: any) {
    console.error('Error in /api/ayuda/chat:', error?.message);
    return res.status(503).json({
      error: 'El asistente no está disponible en este momento. Puedes dejarnos tu consulta con "Hablar con una persona".',
      needsHuman: true
    });
  }
});

// ---------------------------------------------------------------------------
// Soporte: solicitudes (tickets) cuando el robot no resuelve
// ---------------------------------------------------------------------------
const ticketLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Enviaste varias solicitudes seguidas. Espera unos minutos o escríbenos a contacto@impulsacap.cl.' }
});

app.post('/api/soporte/ticket', ticketLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 120);
    const name = String(req.body?.name || '').trim().slice(0, 80);
    const message = String(req.body?.message || '').trim().slice(0, 2000);
    const page = String(req.body?.page || '').trim().slice(0, 60);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Ingresa un correo válido para poder responderte.' });
    }
    if (message.length < 5) {
      return res.status(400).json({ error: 'Cuéntanos un poco más sobre tu consulta.' });
    }
    const conversation: { role: 'user' | 'bot'; text: string }[] = Array.isArray(req.body?.conversation)
      ? req.body.conversation
          .filter((m: any) => (m?.role === 'user' || m?.role === 'bot') && typeof m?.text === 'string')
          .slice(-12)
          .map((m: any) => ({ role: m.role, text: String(m.text).slice(0, 800) }))
      : [];

    // Sesión opcional: si viene, se asocia el usuario y su plan
    let uid: string | null = null;
    let hasPlan = false;
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7).trim());
        uid = decoded.uid;
      } catch { /* sin sesión válida: se crea igual */ }
    }

    if (!(await ensureFirestoreAdmin())) {
      return res.status(503).json({ error: 'No pudimos registrar tu solicitud. Escríbenos a contacto@impulsacap.cl.' });
    }
    if (uid) {
      try {
        const ent = (await adminDb.collection('entitlements').doc(uid).get()).data();
        hasPlan = Boolean(ent?.status === 'active' && ent?.expiresAt && new Date(ent.expiresAt).getTime() > Date.now());
      } catch { /* sin efecto */ }
    }

    const ref = adminDb.collection('support_tickets').doc();
    const ticketId = ref.id.slice(0, 6).toUpperCase();
    await ref.set({
      ticketId,
      createdAt: new Date().toISOString(),
      status: 'abierto',
      email,
      name,
      uid,
      hasPlan,
      message,
      page,
      conversation,
      userAgent: String(req.get('user-agent') || '').slice(0, 200)
    });

    const data = { ticketId, email, name, message, page, conversation, hasPlan };
    const adminEmail = getAdminEmail();
    const [adminSent, userSent] = await Promise.all([
      adminEmail ? sendEmail({ to: adminEmail, ...supportTicketAdminEmail(data), replyTo: email, idempotencyKey: `ticket-admin-${ref.id}` }) : Promise.resolve(false),
      sendEmail({ to: email, ...supportTicketUserEmail(data), idempotencyKey: `ticket-user-${ref.id}` })
    ]);
    await ref.set({ adminNotified: adminSent, userNotified: userSent }, { merge: true });
    console.log(`[soporte] Solicitud #${ticketId} de ${email} (admin ${adminSent ? 'avisado' : 'NO avisado'})`);
    return res.json({ ok: true, ticketId });
  } catch (err: any) {
    console.error('Error in /api/soporte/ticket:', err?.message);
    return res.status(500).json({ error: 'No pudimos registrar tu solicitud. Escríbenos a contacto@impulsacap.cl.' });
  }
});


// Health check

// -------------------------------------------------------------
// MERCADO PAGO CHECKOUT PRO & SUBSCRIPTION ENDPOINTS
// -------------------------------------------------------------

// ---------------------------------------------------------------------------
// Acceso anticipado: mientras PAGOS_MODO=anticipado, contratar da acceso provisional sin cobro
// y registra la intención de compra (5 días por defecto). Al habilitar el pago, el admin avisa y hay 7 días para pagar.
// ---------------------------------------------------------------------------
// La prueba gratis de lanzamiento se eliminó: el plan solo se activa pagando (se ignora PAGOS_MODO).
const isEarlyAccessMode = () => false;
const EARLY_ACCESS_DAYS = () => Math.min(90, Math.max(1, Number(process.env.ACCESO_ANTICIPADO_DIAS) || 5));
const PAYMENT_GRACE_DAYS = 7;

// Prueba de pagos sin desarmar el lanzamiento: con PAGOS_MODO=anticipado, los correos de
// PAGOS_PRUEBA_EMAILS (o, si no está, los de ADMIN_DASHBOARD_EMAILS / ADMIN_EMAIL) pagan de verdad
// con Mercado Pago; el resto sigue recibiendo la prueba gratis.
function getPaymentTesterEmails(): string[] {
  const raw = process.env.PAGOS_PRUEBA_EMAILS || process.env.ADMIN_DASHBOARD_EMAILS || process.env.ADMIN_EMAIL || '';
  return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}
function isPaymentTester(user?: { email?: string; emailVerified?: boolean } | null): boolean {
  const email = (user?.email || '').toLowerCase();
  return Boolean(email && user?.emailVerified && getPaymentTesterEmails().includes(email));
}
function canPayOnline(user?: { email?: string; emailVerified?: boolean } | null): boolean {
  return !isEarlyAccessMode() || isPaymentTester(user);
}
async function optionalUser(req: express.Request) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  try {
    const d = await adminAuth.verifyIdToken(h.slice(7).trim());
    return { uid: d.uid, email: d.email, emailVerified: d.email_verified === true };
  } catch {
    return null;
  }
}

app.get('/api/pagos/modo', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const user = await optionalUser(req);
  res.json({ paymentsEnabled: canPayOnline(user), testMode: isEarlyAccessMode() && isPaymentTester(user) });
});

async function grantEarlyAccess(uid: string, email: string | undefined) {
  const entRef = adminDb.collection('entitlements').doc(uid);
  const intentRef = adminDb.collection('purchase_intents').doc(uid);
  const [entSnap, intentSnap] = await Promise.all([entRef.get(), intentRef.get()]);
  const ent = entSnap.exists ? entSnap.data() : null;
  const entActive = Boolean(ent?.status === 'active' && ent?.expiresAt && new Date(ent.expiresAt).getTime() > Date.now());

  // Ya tiene un plan pagado vigente: no se toca
  if (entActive && !ent?.provisional) {
    return { earlyAccess: true, alreadyPaid: true, expiresAt: ent!.expiresAt };
  }
  // Ya recibió acceso anticipado antes: no se renueva
  if (intentSnap.exists) {
    return { earlyAccess: true, alreadyGranted: true, expiresAt: entActive ? ent!.expiresAt : null };
  }

  const pricing = await resolvePricing(adminDb, uid);
  const price = pricing.price;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + EARLY_ACCESS_DAYS() * 864e5).toISOString();
  await entRef.set({
    plan: 'semestral',
    status: 'active',
    expiresAt,
    provisional: true,
    provisionalSince: now.toISOString(),
    updatedAt: now.toISOString()
  }, { merge: true });
  let companyName = '';
  try { companyName = String((await adminDb.collection('users').doc(uid).get()).data()?.companyName || ''); } catch {}
  await intentRef.set({
    uid,
    email: email || '',
    companyName,
    price,
    sellerCode: pricing.code,
    createdAt: now.toISOString(),
    status: 'acceso_anticipado',
    accessUntil: expiresAt,
    notifiedAt: null,
    paidAt: null
  });

  if (email) {
    await sendEmail({ to: email, ...earlyAccessUserEmail({ expiresAt, price }), idempotencyKey: `early-user-${uid}` });
  }
  const adminEmail = getAdminEmail();
  if (adminEmail) {
    await sendEmail({ to: adminEmail, ...earlyAccessAdminEmail({ userEmail: email || uid, companyName, expiresAt, price }), idempotencyKey: `early-admin-${uid}` });
  }
  console.log(`[acceso-anticipado] Otorgado a ${uid} hasta ${expiresAt}`);
  return { earlyAccess: true, expiresAt, price };
}

// Consulta de estado de precios (determina si es primera compra para cobrar $19.990 o $39.990)
app.get('/api/pagos/estado', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    res.set('Cache-Control', 'no-store');
    if (!isFirestoreAdminAuthorized) {
      return res.json({ isFirstPurchase: true, price: PRICE_FIRST, paymentsEnabled: !isEarlyAccessMode() });
    }
    const pricing = await resolvePricing(adminDb, user.uid);
    return res.json({ ...pricing, paymentsEnabled: canPayOnline(user) });
  } catch {
    return res.json({ isFirstPurchase: true, price: PRICE_FIRST });
  }
});

// Historial de pagos del usuario (Requirement C.9)
app.get('/api/pagos/historial', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (!isFirestoreAdminAuthorized) {
      return res.json({ payments: [] });
    }
    const snap = await adminDb.collection('payments')
      .where('uid', '==', user.uid)
      .get();

    const payments = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        paymentId: doc.id,
        amount: data.amount || 0,
        currencyId: data.currencyId || 'CLP',
        status: data.status || 'unknown',
        approvedAt: data.approvedAt || data.createdAt || data.rejectedAt || null,
        paymentMethodId: data.paymentMethodId || 'mercadopago',
        externalReference: data.externalReference || ''
      };
    });

    // Ordenar descendente por fecha
    payments.sort((a, b) => {
      const dateA = a.approvedAt ? new Date(a.approvedAt).getTime() : 0;
      const dateB = b.approvedAt ? new Date(b.approvedAt).getTime() : 0;
      return dateB - dateA;
    });

    return res.json({ payments });
  } catch (error: any) {
    console.error('Error in /api/pagos/historial:', error?.message);
    return res.status(500).json({ error: 'No se pudo obtener el historial de pagos.' });
  }
});

// Crear preferencia de pago Mercado Pago Checkout Pro
app.post('/api/pagos/crear', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (isEarlyAccessMode() && !isPaymentTester(user)) {
      if (!(await ensureFirestoreAdmin())) {
        return res.status(503).json({ error: 'No pudimos activar tu acceso en este momento. Intenta en unos minutos.' });
      }
      return res.json(await grantEarlyAccess(user.uid, user.email));
    }
    if (isEarlyAccessMode()) console.log(`[pagos] Pago de prueba real habilitado para ${user.email}`);
    if (paymentProvider() === 'flow') return await createFlowCheckout(req, res, user);
    if (!mpAccessToken) {
      return res.status(500).json({ error: 'Mercado Pago no está configurado (MP_ACCESS_TOKEN ausente).' });
    }

    // El precio lo define SOLO el servidor (incluye el código de vendedor de la primera compra)
    if (!(await ensureFirestoreAdmin())) {
      return res.status(503).json({ error: 'No pudimos iniciar el pago en este momento. Intenta en unos minutos.' });
    }
    const pricing = await resolvePricing(adminDb, user.uid);
    const price = pricing.price;

    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const appUrl = (process.env.APP_URL || `${protocol}://${host}`).replace(/\/$/, '');

    const externalReference = `${user.uid}:semestral:${Date.now()}`;
    // Precio esperado y vendedor de esta preferencia: el webhook valida el monto contra este registro
    await adminDb.collection('checkout_orders').doc(externalReference).set({
      uid: user.uid,
      price,
      code: pricing.code,
      commissionPct: pricing.commissionPct,
      createdAt: new Date().toISOString()
    });

    const preferenceData = {
      items: [
        {
          id: 'plan_semestral_impulsacap',
          title: 'Plan Trimestral ImpulsaCap',
          description: 'Acceso completo por 3 meses a todas las herramientas de formulación, auditoría y dossier oficial (pago único no renovable).',
          quantity: 1,
          unit_price: price,
          currency_id: 'CLP',
        }
      ],
      // Sin payer.email: el comprador inicia sesión en Mercado Pago con su propia cuenta.
      // Prellenar el correo provoca el error "una de las partes es de prueba" al mezclar cuentas
      // y no es necesario: el pago se asocia al usuario por external_reference.
      external_reference: externalReference,
      back_urls: {
        success: `${appUrl}/pago/resultado`,
        pending: `${appUrl}/pago/resultado`,
        failure: `${appUrl}/pago/resultado`,
      },
      auto_return: 'approved',
      notification_url: `${appUrl}/api/pagos/webhook`,
    };

    const created = await preferenceClient.create({ body: preferenceData });
    return res.json({
      init_point: created.init_point,
      price
    });
  } catch (err: any) {
    console.error('Error creating Mercado Pago preference:', err?.message);
    return res.status(500).json({ error: 'Error al generar la preferencia de pago en Mercado Pago.' });
  }
});

/**
 * Pago devuelto (retracto, devolución manual) o contracargo: si ese pago había activado el plan,
 * el plan se cierra; la comisión del vendedor se anula y se avisa al administrador.
 */
async function handlePaymentReversal(paymentId: string, status: string) {
  if (!(await ensureFirestoreAdmin())) throw new Error('Firestore Admin no autorizado');
  const payRef = adminDb.collection('payments').doc(paymentId);
  const pay = (await payRef.get()).data();
  if (!pay || pay.status !== 'approved') {
    console.log(`[pagos] Reverso ${status} de ${paymentId} sin pago aprobado registrado: se ignora`);
    return;
  }
  const now = new Date().toISOString();
  await payRef.set({ status, reversedAt: now }, { merge: true });

  const uid = String(pay.uid || '');
  let planClosed = false;
  if (uid) {
    const entRef = adminDb.collection('entitlements').doc(uid);
    const ent = (await entRef.get()).data();
    if (ent && String(ent.lastPaymentId || '') === paymentId) {
      await entRef.set({ status: 'revoked', expiresAt: now, revokedReason: status, updatedAt: now }, { merge: true });
      planClosed = true;
    }
  }

  let commissionNote = 'sin código de vendedor';
  const saleRef = adminDb.collection('seller_sales').doc(paymentId);
  const sale = (await saleRef.get()).data();
  if (sale) {
    const wasPaid = sale.status === 'pagada';
    await saleRef.set({ status: wasPaid ? 'pagada_anulada' : 'anulada', annulledAt: now, annulReason: status }, { merge: true });
    commissionNote = wasPaid
      ? `la comisión de ${sale.code} (${sale.commission}) YA estaba pagada: descuéntala del próximo pago`
      : `la comisión de ${sale.code} quedó anulada`;
  }

  console.warn(`[pagos] Pago ${paymentId} ${status}: plan ${planClosed ? 'cerrado' : 'sin cambios'}, ${commissionNote}`);
  const to = getAdminEmail();
  if (to) {
    const email = uid ? await getUserEmail(uid) : '';
    await sendEmail({
      to,
      subject: `ImpulsaCap: pago ${paymentId} ${status === 'charged_back' ? 'con contracargo' : 'devuelto'}`,
      html: `<p>El pago <strong>${paymentId}</strong> (${email || uid}) cambió a <strong>${status}</strong>.</p><ul><li>Plan: ${planClosed ? 'cerrado' : 'sin cambios (no era el último pago del usuario)'}</li><li>Vendedor: ${commissionNote}</li></ul>`,
      text: `Pago ${paymentId} (${email || uid}) cambió a ${status}. Plan: ${planClosed ? 'cerrado' : 'sin cambios'}. Vendedor: ${commissionNote}.`,
      idempotencyKey: `reversal-${paymentId}-${status}`
    });
  }
}

/**
 * Activa el plan tras un pago aprobado (Mercado Pago o Flow): valida monto y moneda contra la orden,
 * registra el pago, suma 3 meses, registra la comisión del vendedor y envía los correos.
 * Idempotente por paymentId. Lanza error solo si falla el guardado (para que la pasarela reintente).
 */
type ApprovedPayment = { paymentId: string; amount: number | string; currency: string; approvedAt?: string | null; methodId?: string | null; externalRef?: string | null };
async function processApprovedPayment(info: ApprovedPayment): Promise<'activado' | 'rechazado_validacion' | 'referencia_invalida' | 'ya_procesado'> {
    const paymentId = info.paymentId;
    // Verificación estricta (Requirement 8): moneda CLP y monto igual al precio fijado al crear la preferencia
    // (o 19.990 / 39.990 para preferencias anteriores a los códigos de vendedor)
    const transactionAmount = Number(info.amount);
    const isCurrencyValid = info.currency === 'CLP';
    let order: { uid?: string; price?: number; code?: string | null; commissionPct?: number | null } | null = null;
    try {
      const extRef = String(info.externalRef || '');
      if (extRef && !extRef.includes('/')) {
        const orderSnap = await adminDb.collection('checkout_orders').doc(extRef).get();
        order = orderSnap.exists ? (orderSnap.data() as any) : null;
      }
    } catch (e: any) {
      console.warn('[pagos] No se pudo leer la orden del pago:', e?.message);
    }
    const isAmountValid = order?.price
      ? transactionAmount === Number(order.price)
      : (transactionAmount === PRICE_FIRST || transactionAmount === PRICE_FULL);

    if (!isCurrencyValid || !isAmountValid) {
      console.warn(`Payment ${paymentId} rechazado_validacion: currency=${info.currency}, amount=${transactionAmount}`);
      try {
        if (isFirestoreAdminAuthorized) {
          const externalRef = info.externalRef || '';
          const uid = String(order?.uid || '') || externalRef.split(':')[0] || 'unknown';
          await adminDb.collection('payments').doc(String(paymentId)).set({
            uid,
            amount: isNaN(transactionAmount) ? 0 : transactionAmount,
            currencyId: info.currency || 'unknown',
            status: 'rechazado_validacion',
            rejectedAt: new Date().toISOString(),
            reason: !isCurrencyValid ? 'Moneda no es CLP' : `Monto no corresponde al precio fijado (${order?.price ?? '19.990 o 39.990'})`,
            externalReference: externalRef
          }, { merge: true });
        }
      } catch (dbErr: any) {
        console.error('Error al registrar pago rechazado en Firestore:', dbErr?.message);
      }
      return 'rechazado_validacion';
    }

    const externalRef = info.externalRef || '';
    const uid = String(order?.uid || '') || externalRef.split(':')[0];
    if (!uid) {
      console.warn('Payment approved but no UID in external_reference:', externalRef);
      return 'referencia_invalida';
    }

    // Idempotencia: si ese paymentId ya fue procesado, responder 200 de inmediato
    const paymentDocRef = adminDb.collection('payments').doc(String(paymentId));
    const existingPayment = await paymentDocRef.get();
    if (existingPayment.exists && existingPayment.data()?.status === 'approved') {
      console.log(`Payment ${paymentId} was already processed`);
      return 'ya_procesado';
    }

    // Guardar payments/{paymentId}: { uid, amount, currencyId, status, approvedAt }
    await paymentDocRef.set({
      uid,
      amount: transactionAmount,
      currencyId: info.currency,
      status: 'approved',
      approvedAt: info.approvedAt || new Date().toISOString(),
      paymentMethodId: info.methodId || 'unknown',
      externalReference: externalRef,
      sellerCode: order?.code || null
    });

    // Escribir entitlements/{uid}: { plan: "semestral", status: "active", expiresAt, lastPaymentId }
    // expiresAt = 3 meses desde aprobación; si ya tenía plan vigente, suma 3 meses al expiresAt actual
    const entRef = adminDb.collection('entitlements').doc(uid);
    const currentEntDoc = await entRef.get();
    let baseDate = new Date(info.approvedAt || Date.now());
    if (currentEntDoc.exists) {
      const curData = currentEntDoc.data();
      // El acceso anticipado no se suma: los 3 meses parten desde el pago
      if (curData?.status === 'active' && curData?.expiresAt && !curData?.provisional) {
        const curExp = new Date(curData.expiresAt);
        if (!isNaN(curExp.getTime()) && curExp.getTime() > baseDate.getTime()) {
          baseDate = curExp;
        }
      }
    }

    const expiresAt = new Date(baseDate);
    expiresAt.setMonth(expiresAt.getMonth() + 3);

    await entRef.set({
      plan: 'semestral',
      status: 'active',
      expiresAt: expiresAt.toISOString(),
      lastPaymentId: String(paymentId),
      provisional: false,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    try {
      const intentRef = adminDb.collection('purchase_intents').doc(uid);
      if ((await intentRef.get()).exists) {
        await intentRef.set({ status: 'pagado', paidAt: new Date().toISOString(), paymentId: String(paymentId) }, { merge: true });
      }
    } catch (e: any) {
      console.warn('[acceso-anticipado] No se pudo marcar la intención como pagada:', e?.message);
    }

    console.log(`Plan trimestral activated for user ${uid} until ${expiresAt.toISOString()}`);

    // Venta con código de vendedor: registra la comisión (una por pago) y avisa al vendedor
    let commission: number | null = null;
    if (order?.code) {
      try {
        const sellerSnap = await adminDb.collection('sellers').doc(order.code).get();
        const seller = sellerSnap.exists ? (sellerSnap.data() as Seller) : null;
        commission = commissionFor(transactionAmount, Number(order.commissionPct ?? seller?.commissionPct ?? 0));
        let buyerEmail = '';
        let companyName = '';
        buyerEmail = await getUserEmail(uid);
        try { companyName = String((await adminDb.collection('users').doc(uid).get()).data()?.companyName || ''); } catch {}
        const saleRef = adminDb.collection('seller_sales').doc(String(paymentId));
        const created = await adminDb.runTransaction(async tx => {
          if ((await tx.get(saleRef)).exists) return false;
          tx.set(saleRef, {
            paymentId: String(paymentId),
            code: order!.code,
            sellerEmail: seller?.email || '',
            uid,
            buyerEmail,
            companyName,
            amount: transactionAmount,
            commissionPct: Number(order!.commissionPct ?? seller?.commissionPct ?? 0),
            commission,
            status: 'pendiente',
            createdAt: new Date().toISOString(),
            paidAt: null
          });
          return true;
        });
        if (created && seller?.email) {
          await sendEmail({
            to: seller.email,
            ...sellerSaleEmail({ sellerName: seller.name, code: order.code, amount: transactionAmount, commission, companyName }),
            idempotencyKey: `seller-sale-${paymentId}`
          });
        }
      } catch (e: any) {
        console.error('[vendedores] No se pudo registrar la comisión:', e?.message);
      }
    }

    // Correos de confirmación (usuario) y nueva venta (administrador). No bloquean ni hacen fallar el webhook.
    await sendPurchaseNotifications({
      uid,
      paymentId: String(paymentId),
      amount: transactionAmount,
      expiresAt: expiresAt.toISOString(),
      paymentDocRef,
      sellerCode: order?.code || null,
      commission,
    });
    return 'activado';
}

// ---------------------------------------------------------------------------
// FLOW (flow.cl): pasarela principal cuando FLOW_API_KEY y FLOW_SECRET_KEY están configuradas.
// PAGOS_PASARELA=mercadopago fuerza Mercado Pago; PAGOS_PASARELA=flow fuerza Flow.
// ---------------------------------------------------------------------------
function paymentProvider(): 'flow' | 'mercadopago' {
  const forced = String(process.env.PAGOS_PASARELA || '').trim().toLowerCase();
  if (forced === 'mercadopago' || forced === 'mp') return 'mercadopago';
  if (forced === 'flow') return 'flow';
  return flowConfig().configured ? 'flow' : 'mercadopago';
}

function publicAppUrl(req: express.Request) {
  const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  return (process.env.APP_URL || `${protocol}://${host}`).replace(/\/$/, '');
}

async function createFlowCheckout(req: express.Request, res: express.Response, user: { uid: string; email?: string }) {
  if (!flowConfig().configured) {
    return res.status(500).json({ error: 'Flow no está configurado (faltan FLOW_API_KEY o FLOW_SECRET_KEY).' });
  }
  if (!user.email) {
    return res.status(400).json({ error: 'Tu cuenta no tiene un correo asociado. Escríbenos a contacto@impulsacap.cl.' });
  }
  if (!(await ensureFirestoreAdmin())) {
    return res.status(503).json({ error: 'No pudimos iniciar el pago en este momento. Intenta en unos minutos.' });
  }
  // El precio lo define SOLO el servidor (incluye el código de vendedor de la primera compra)
  const pricing = await resolvePricing(adminDb, user.uid);
  const price = pricing.price;
  const appUrl = publicAppUrl(req);
  // Orden corta y única (Flow limita el largo); la orden guarda a quién pertenece y el precio esperado
  const commerceOrder = `IC${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await adminDb.collection('checkout_orders').doc(commerceOrder).set({
    uid: user.uid,
    price,
    code: pricing.code,
    commissionPct: pricing.commissionPct,
    provider: 'flow',
    createdAt: new Date().toISOString()
  });
  try {
    const created = await flowCreatePayment({
      commerceOrder,
      subject: 'Plan Trimestral ImpulsaCap (3 meses, pago único)',
      amount: price,
      email: user.email,
      urlConfirmation: `${appUrl}/api/pagos/flow/confirmacion`,
      urlReturn: `${appUrl}/api/pagos/flow/retorno`
    });
    await adminDb.collection('checkout_orders').doc(commerceOrder).set({ flowOrder: created.flowOrder }, { merge: true });
    // Mismo nombre de campo que con Mercado Pago: el front redirige a init_point
    return res.json({ init_point: created.redirectUrl, price, provider: 'flow' });
  } catch (err: any) {
    console.error('[flow] Error al crear el pago:', err?.message);
    return res.status(500).json({ error: 'No pudimos conectar con Flow. Intenta nuevamente en unos minutos.' });
  }
}

/** Consulta el estado oficial en Flow y, si está pagado, activa el plan (idempotente). */
async function settleFlowToken(token: string) {
  const st = await flowGetStatus(token);
  const paymentId = `flow-${st.flowOrder}`;
  if (st.status === 2) {
    if (!(await ensureFirestoreAdmin())) throw new Error('Firestore Admin no autorizado');
    const result = await processApprovedPayment({
      paymentId,
      amount: Number(st.amount),
      currency: String(st.currency || ''),
      approvedAt: st.paymentData?.date ? new Date(String(st.paymentData.date).replace(' ', 'T') + '-03:00').toISOString() : null,
      methodId: st.paymentData?.media ? `Flow · ${st.paymentData.media}` : 'Flow',
      externalRef: st.commerceOrder
    });
    return { paymentId, status: 'approved' as const, result };
  }
  if (st.status === 3 || st.status === 4) {
    console.log(`[flow] Pago ${paymentId} (${st.commerceOrder}) ${st.status === 3 ? 'rechazado' : 'anulado'}`);
    return { paymentId, status: (st.status === 3 ? 'rejected' : 'cancelled') as 'rejected' | 'cancelled' };
  }
  return { paymentId, status: 'pending' as const };
}

// Confirmación servidor a servidor: Flow envía el token por POST
app.post('/api/pagos/flow/confirmacion', async (req, res) => {
  const token = String(req.body?.token || req.query?.token || '');
  if (!token) return res.status(400).send('token requerido');
  try {
    const r = await settleFlowToken(token);
    console.log(`[flow] Confirmación ${r.paymentId}: ${r.status}${'result' in r ? ` (${r.result})` : ''}`);
    return res.status(200).send('OK');
  } catch (err: any) {
    console.error('[flow] Error en la confirmación:', err?.message);
    // 500: Flow reintenta la confirmación
    return res.status(500).send('Error');
  }
});

// Regreso del comprador: Flow lo trae por POST (o GET) con el token; se le muestra el resultado
app.all('/api/pagos/flow/retorno', async (req, res) => {
  const appUrl = publicAppUrl(req);
  const token = String(req.body?.token || req.query?.token || '');
  if (!token) return res.redirect(303, `${appUrl}/pago/resultado`);
  try {
    const r = await settleFlowToken(token);
    return res.redirect(303, `${appUrl}/pago/resultado?status=${r.status}&payment_id=${encodeURIComponent(r.paymentId)}`);
  } catch (err: any) {
    console.error('[flow] Error en el retorno:', err?.message);
    // Sin estado: la pantalla de resultado espera la confirmación del plan
    return res.redirect(303, `${appUrl}/pago/resultado`);
  }
});

// Webhook oficial de Mercado Pago (público)
app.post('/api/pagos/webhook', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.body?.id || req.query?.['data.id'] || req.query?.id;
    const type = req.body?.type || req.body?.action || req.query?.type || req.query?.topic;

    if (!paymentId || (type && !String(type).includes('payment'))) {
      return res.status(200).send('OK');
    }

    if (!mpAccessToken) {
      console.warn('Webhook received but MP_ACCESS_TOKEN is not configured');
      return res.status(500).json({ error: 'MP_ACCESS_TOKEN no configurado' });
    }

    // Consulta oficial a la API de Mercado Pago. NUNCA confiar en el cuerpo de la notificación
    const paymentInfo = await paymentClient.get({ id: String(paymentId) });

    // Devolución o contracargo de un pago que habíamos aprobado: se retira el plan y se anula la comisión
    if (paymentInfo && ['refunded', 'charged_back', 'cancelled'].includes(String(paymentInfo.status))) {
      await handlePaymentReversal(String(paymentId), String(paymentInfo.status));
      return res.status(200).send('OK');
    }

    if (!paymentInfo || paymentInfo.status !== 'approved') {
      console.log(`Payment ${paymentId} status: ${paymentInfo?.status}`);
      return res.status(200).send('OK');
    }

    const result = await processApprovedPayment({
      paymentId: String(paymentId),
      amount: Number(paymentInfo.transaction_amount),
      currency: String(paymentInfo.currency_id || ''),
      approvedAt: paymentInfo.date_approved || null,
      methodId: paymentInfo.payment_method_id || null,
      externalRef: paymentInfo.external_reference || ''
    });
    // "rechazado_validacion" responde 200 para que Mercado Pago no reintente indefinidamente
    if (result === 'referencia_invalida') return res.status(400).json({ error: 'external_reference inválido' });
    // Recién al finalizar todo el procesamiento y guardado exitoso se responde 200
    return res.status(200).send('OK');
  } catch (err: any) {
    console.error('Error in Mercado Pago webhook processing:', err?.message);
    // Responder 500 para que Mercado Pago reintente la notificación
    return res.status(500).json({ error: 'Error al procesar la notificación de pago' });
  }
});

// Archivar postulación para liberar cupo del límite de 3 simultáneas (Requirement 11)
app.post('/api/postulaciones/archivar', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { applicationId, fundId } = req.body || {};
    if (!applicationId && !fundId) {
      return res.status(400).json({ error: 'Debes indicar el applicationId o fundId a archivar.' });
    }

    if (isFirestoreAdminAuthorized) {
      // 1. Actualizar en colección applications
      if (applicationId) {
        await adminDb.collection('applications').doc(applicationId).set({
          status: 'archivada',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } else if (fundId) {
        const snap = await adminDb.collection('applications')
          .where('ownerId', '==', user.uid)
          .where('fundId', '==', fundId)
          .get();
        const batch = adminDb.batch();
        snap.forEach(d => {
          batch.set(d.ref, { status: 'archivada', updatedAt: new Date().toISOString() }, { merge: true });
        });
        await batch.commit();
      }

      // 2. Sincronizar en entitlements
      const entRef = adminDb.collection('entitlements').doc(user.uid);
      const entDoc = await entRef.get();
      if (entDoc.exists) {
        const entData = entDoc.data() || {};
        let activeFundIds: string[] = Array.isArray(entData.activeFundIds) ? entData.activeFundIds : [];
        if (fundId) {
          activeFundIds = activeFundIds.filter(id => id !== fundId);
          await entRef.set({ activeFundIds, updatedAt: new Date().toISOString() }, { merge: true });
        }
      }
    }

    return res.json({ success: true, message: 'Postulación archivada con éxito. Cupo liberado.' });
  } catch (err: any) {
    console.error('Error archiving postulation:', err?.message);
    return res.status(500).json({ error: 'Error al archivar la postulación.' });
  }
});

// Reactivar postulación archivada si hay cupo disponible (Requirement 11)
app.post('/api/postulaciones/reactivar', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { applicationId } = req.body || {};
    if (!applicationId) {
      return res.status(400).json({ error: 'Debes indicar el applicationId a reactivar.' });
    }

    if (isFirestoreAdminAuthorized) {
      const appsSnap = await adminDb.collection('applications')
        .where('ownerId', '==', user.uid)
        .get();
      
      let activeCount = 0;
      appsSnap.forEach(d => {
        const data = d.data();
        if (d.id !== applicationId && data.status !== 'archivada') {
          activeCount++;
        }
      });

      if (activeCount >= 3) {
        return res.status(400).json({ 
          error: 'No puedes reactivar esta postulación porque ya tienes 3 activas. Archiva una primero para liberar cupo.' 
        });
      }

      await adminDb.collection('applications').doc(applicationId).set({
        status: 'en_preparacion',
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    return res.json({ success: true, message: 'Postulación reactivada con éxito.' });
  } catch (err: any) {
    console.error('Error reactivating postulation:', err?.message);
    return res.status(500).json({ error: 'Error al reactivar la postulación.' });
  }
});

// Helpers para sincronización de convocatorias oficiales
function matchConvocatoriaToFundId(titulo: string, url?: string): string | null {
  const text = `${titulo || ''} ${url || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (text.includes('semilla inicia')) return 'corfo_semilla_inicia';
  if (text.includes('semilla expande')) return 'corfo_semilla_expande';
  if (text.includes('crea y valida')) return 'corfo_crea_valida';
  if (text.includes('sumate a innovar')) return 'corfo_sumate_innovar';
  if (text.includes('startup chile') || text.includes('start-up chile') || text.includes('ignite') || text.includes('build')) return 'startup_chile_ignite';
  if (text.includes('semilla emprende') || text.includes('capital semilla')) return 'sercotec_semilla_emprende';
  if (text.includes('abeja emprende') || text.includes('capital abeja')) return 'sercotec_abeja_emprende';
  if (text.includes('crece') && (text.includes('sercotec') || text.includes('desarrollo de negocios'))) return 'sercotec_crece';
  if (text.includes('fondef') || text.includes('idea i+d') || text.includes('idea id')) return 'anid_fondef_idea';
  if (text.includes('fia') || text.includes('innovacion agro')) return 'fia_innovacion_agro';

  return null;
}

// POST /api/admin/convocatorias/import
// Protegido con header x-import-token = CONVOCATORIAS_IMPORT_TOKEN (Requirement 3)
app.post('/api/admin/convocatorias/import', async (req, res) => {
  try {
    const importToken = req.headers['x-import-token'];
    const expectedToken = process.env.CONVOCATORIAS_IMPORT_TOKEN;

    if (!expectedToken || importToken !== expectedToken) {
      return res.status(401).json({ error: 'Token de importación inválido o no configurado en x-import-token.' });
    }

    const payload = Array.isArray(req.body)
      ? req.body
      : (Array.isArray(req.body?.convocatorias) ? req.body.convocatorias : null);

    if (!payload || !Array.isArray(payload)) {
      return res.status(400).json({ error: 'Payload inválido: debe ser un array de convocatorias JSON.' });
    }

    if (!isFirestoreAdminAuthorized) {
      return res.status(503).json({ error: 'Firestore Admin no está autorizado para registrar convocatorias.' });
    }

    const now = new Date().toISOString();
    const incomingIds = new Set<string>();
    let upsertCount = 0;
    const newlyOpened: OpenedCall[] = [];

    // Procesar en lotes de Firestore (batch max 400 operaciones)
    const batches = [];
    let currentBatch = adminDb.batch();
    let batchOps = 0;

    for (const item of payload) {
      const rawId = String(item.id || (item.url ? item.url.replace(/\/+$/, '').split('/').pop() : '') || '').trim();
      if (!rawId) continue;
      const id = rawId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
      if (!id) continue;

      incomingIds.add(id);

      const docRef = adminDb.collection('convocatorias').doc(id);
      const existingDoc = await docRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : null;

      const firstSeenAt = existingData?.firstSeenAt || now;
      const fundId = item.fundId || matchConvocatoriaToFundId(item.titulo, item.url);
      // Convocatoria que recién aparece (o que vuelve a abrir): genera novedad y alertas
      if (!existingData || existingData.vigente === false) {
        newlyOpened.push({ id, titulo: String(item.titulo || '').trim(), url: String(item.url || 'https://www.corfo.gob.cl').trim(), cierre: item.cierre || null, fundId: fundId || null, resumen: item.resumen || item.beneficioResumen || null, alcance: String(item.alcance || 'Todo Chile').trim() });
      }

      const record = {
        id,
        titulo: String(item.titulo || '').trim(),
        alcance: String(item.alcance || 'Todo Chile').trim(),
        apertura: item.apertura || null,
        cierre: item.cierre || null,
        tope_aprox: item.tope_aprox || item.topeAprox || null,
        perfil: item.perfil || [],
        etapa: item.etapa || [],
        necesidad: item.necesidad || [],
        venta: item.venta || [],
        url: String(item.url || 'https://www.corfo.gob.cl').trim(),
        fuente: 'CORFO',
        vigente: true,
        permanente: Boolean(item.permanente || (!item.cierre && item.estado_corfo?.toLowerCase() === 'abiertas')),
        firstSeenAt,
        lastSeenAt: now,
        fundId: fundId || null,
        resumen: item.resumen || item.beneficioResumen || null,
        quienes_pueden_postular: item.quienes_pueden_postular || item.quienesPuedenPostular || null,
        beneficio: item.beneficio || item.beneficioResumen || null,
        estado_corfo: item.estado_corfo || 'abiertas'
      };

      currentBatch.set(docRef, record, { merge: true });
      batchOps++;
      upsertCount++;

      if (batchOps >= 300) {
        batches.push(currentBatch.commit());
        currentBatch = adminDb.batch();
        batchOps = 0;
      }
    }

    if (batchOps > 0) {
      batches.push(currentBatch.commit());
    }

    await Promise.all(batches);

    // Requirement 3: Las convocatorias que dejan de aparecer en el listado de abiertas no se borran: se marcan como no vigentes
    const allVigentesSnap = await adminDb.collection('convocatorias').where('vigente', '==', true).get();
    let markedNotVigente = 0;
    const deactivationBatch = adminDb.batch();
    let deactOps = 0;

    allVigentesSnap.forEach(d => {
      if (!incomingIds.has(d.id)) {
        deactivationBatch.set(d.ref, { vigente: false, lastSeenAt: now }, { merge: true });
        deactOps++;
        markedNotVigente++;
      }
    });

    if (deactOps > 0) {
      await deactivationBatch.commit();
    }

    // Guardar meta/convocatoriasSync (Requirement 1)
    await adminDb.collection('meta').doc('convocatoriasSync').set({
      lastSyncAt: now,
      total: incomingIds.size,
      totalVigentes: incomingIds.size,
      markedNotVigente,
      updatedAt: now
    }, { merge: true });

    // Novedad automática y alertas a empresas que calzan (no hace fallar la sincronización)
    let alertas: any = null;
    try {
      alertas = await announceOpenedCalls(newlyOpened, req);
    } catch (e: any) {
      console.error('[novedades] Error al anunciar convocatorias nuevas:', e?.message);
    }

    return res.json({
      success: true,
      alertas,
      message: `Sincronización exitosa: ${upsertCount} convocatorias procesadas, ${markedNotVigente} marcadas como no vigentes.`,
      totalImported: upsertCount,
      markedNotVigente,
      lastSyncAt: now
    });
  } catch (err: any) {
    console.error('Error in /api/admin/convocatorias/import:', err?.message);
    return res.status(500).json({ error: 'Error al importar convocatorias: ' + err?.message });
  }
});

// ---------------------------------------------------------------------------
// NOVEDADES: noticias de fondos, boletín semanal y alertas de convocatorias nuevas
// ---------------------------------------------------------------------------
type OpenedCall = { id: string; titulo: string; url: string; cierre: string | null; fundId: string | null; resumen: string | null; alcance: string };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function generateNewsJson(prompt: string): Promise<string> {
  const r: any = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: { responseMimeType: 'application/json', temperature: 0.2 }
  });
  return String(r?.text || '');
}

/** Convocatorias recién abiertas: se publican como novedad y se avisa a las empresas que calzan */
async function announceOpenedCalls(opened: OpenedCall[], req: express.Request) {
  if (!opened.length) return { nuevas: 0, alertas: 0 };
  const appUrl = publicAppUrl(req);
  const now = new Date().toISOString();
  const batch = adminDb.batch();
  for (const c of opened) {
    batch.set(adminDb.collection('news_items').doc(`conv_${c.id}`.slice(0, 120)), {
      url: c.url, originalTitle: c.titulo, snippet: '', sourceId: 'monitor', sourceName: 'Corfo', outlet: null, kind: 'oficial',
      publishedAt: now, fetchedAt: now,
      status: 'aprobada', approvedAt: now, digestSentAt: null, aiReviewed: false,
      title: `Abrió: ${c.titulo}`.slice(0, 140),
      summary: [c.resumen, c.cierre ? `Cierra el ${c.cierre}.` : null, c.alcance && c.alcance !== 'Todo Chile' ? `Alcance: ${c.alcance}.` : null].filter(Boolean).join(' ').slice(0, 600) || 'Nueva convocatoria abierta en Corfo.',
      type: 'apertura', audience: '', fundIds: c.fundId ? [c.fundId] : [], importance: 3
    }, { merge: true });
  }
  await batch.commit();

  // Más de 15 aperturas en una sola corrida suele ser una carga inicial o un cambio del sitio: no se alerta en masa
  if (opened.length > 15) {
    console.warn(`[novedades] ${opened.length} convocatorias nuevas en una corrida: se publican sin alertas por correo`);
    return { nuevas: opened.length, alertas: 0, omitidas: 'carga masiva' };
  }
  if (!isEmailConfigured()) return { nuevas: opened.length, alertas: 0 };
  const recipients = await listRecipients(adminDb);
  let sent = 0;
  for (const c of opened) {
    if (!c.fundId) continue;
    const { fund, list } = recipientsFitting(recipients, c.fundId);
    if (!fund) continue;
    // Convocatorias regionales: solo a empresas de esa región
    const inRegion = list.filter(r => ['nacional', 'tu_region'].includes(regionFit(c.alcance, r.profile?.region)));
    for (const r of inRegion) {
      const mail = alertEmail({
        firstName: r.firstName, companyName: r.companyName, fundName: fund.name, titulo: c.titulo, cierre: c.cierre,
        url: c.url, appUrl, unsubscribeUrl: unsubUrl(appUrl, r.uid), fundSummary: getFundIntro(fund).hook
      });
      if (await sendEmail({ to: r.email, ...mail, idempotencyKey: `alerta-${c.id}-${r.uid}` })) sent++;
      await sleep(550);
    }
  }
  console.log(`[novedades] ${opened.length} convocatorias nuevas, ${sent} alertas enviadas`);
  return { nuevas: opened.length, alertas: sent };
}

async function runNewsCollect() {
  if (!(await ensureFirestoreAdmin())) return { status: 503, body: { error: 'Firestore Admin no está autorizado.' } };
  try {
    const summary = await collectNews({ db: adminDb, generate: generateNewsJson });
    console.log('[novedades] Recolección:', JSON.stringify(summary));
    return { status: 200, body: { ok: true, ...summary } };
  } catch (e: any) {
    console.error('[novedades] Error en la recolección:', e?.message);
    return { status: 500, body: { error: 'Error al recolectar novedades' } };
  }
}

function chileWeekKey(d = new Date()) {
  const cl = new Date(d.getTime() - 3 * 3600e3);
  const day = (cl.getUTCDay() + 6) % 7; // lunes = 0
  const monday = new Date(Date.UTC(cl.getUTCFullYear(), cl.getUTCMonth(), cl.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

async function buildDigestContent() {
  const since = new Date(Date.now() - 14 * 864e5).toISOString();
  const snap = await adminDb.collection('news_items').where('status', '==', 'aprobada').get();
  const docs = snap.docs.filter(d => !d.data().digestSentAt && String(d.data().approvedAt || '') >= since);
  const items: DigestItem[] = docs.map(d => {
    const x = d.data();
    return { title: x.title, summary: x.summary, type: x.type, audience: x.audience, url: x.url, sourceName: x.sourceName, outlet: x.outlet, importance: Number(x.importance) || 1 };
  }).slice(0, 12);
  const closing: ClosingCall[] = [];
  try {
    const conv = await adminDb.collection('convocatorias').where('vigente', '==', true).get();
    const today = chileDateKey(new Date());
    conv.docs.forEach(d => {
      const c = d.data();
      const t = c.cierre ? new Date(c.cierre) : null;
      if (!t || isNaN(t.getTime())) return;
      const dias = calendarDaysBetween(today, chileDateKey(t));
      if (dias >= 0 && dias <= 14) closing.push({ titulo: String(c.titulo || ''), cierre: String(c.cierre), url: String(c.url || ''), diasRestantes: dias });
    });
    closing.sort((a, b) => a.diasRestantes - b.diasRestantes);
  } catch (e: any) {
    console.warn('[novedades] No se pudieron leer los cierres:', e?.message);
  }
  return { items, closing: closing.slice(0, 8), docIds: docs.slice(0, 12).map(d => d.id) };
}

async function runDigest(opts: { testTo?: string; force?: boolean; appUrl: string }) {
  if (!(await ensureFirestoreAdmin())) return { status: 503, body: { error: 'Firestore Admin no está autorizado.' } };
  if (!isEmailConfigured()) return { status: 503, body: { error: 'RESEND_API_KEY no está configurada.' } };
  const week = chileWeekKey();
  const { items, closing, docIds } = await buildDigestContent();
  const weekLabel = `Semana del ${formatDateCL(week + 'T12:00:00Z')}`;
  if (opts.testTo) {
    const mail = digestEmail({ firstName: '', items, closing, appUrl: opts.appUrl, unsubscribeUrl: `${opts.appUrl}/`, weekLabel });
    const ok = await sendEmail({ to: opts.testTo, ...mail, subject: `[Prueba] ${mail.subject}` });
    return { status: ok ? 200 : 500, body: { ok, prueba: true, noticias: items.length, cierres: closing.length } };
  }
  const metaRef = adminDb.collection('meta').doc('novedades');
  const meta = (await metaRef.get()).data() || {};
  if (meta.lastDigestWeek === week && !opts.force) return { status: 200, body: { ok: true, omitido: 'ya enviado esta semana' } };
  if (!items.length && !closing.length) return { status: 200, body: { ok: true, omitido: 'sin novedades aprobadas ni cierres próximos' } };

  const recipients = await listRecipients(adminDb);
  let sent = 0, errores = 0;
  for (const r of recipients) {
    const mail = digestEmail({ firstName: r.firstName, items, closing, appUrl: opts.appUrl, unsubscribeUrl: unsubUrl(opts.appUrl, r.uid), weekLabel });
    if (await sendEmail({ to: r.email, ...mail, idempotencyKey: `boletin-${week}-${r.uid}` })) sent++; else errores++;
    await sleep(550);
  }
  const now = new Date().toISOString();
  const b = adminDb.batch();
  docIds.forEach(id => b.set(adminDb.collection('news_items').doc(id), { digestSentAt: now }, { merge: true }));
  await b.commit();
  await metaRef.set({ lastDigestWeek: week, lastDigestAt: now, lastDigest: { enviados: sent, errores, noticias: items.length, cierres: closing.length } }, { merge: true });
  return { status: 200, body: { ok: true, enviados: sent, errores, noticias: items.length, cierres: closing.length } };
}

// Automático (GitHub Actions): recolectar a diario y enviar el boletín los lunes
app.post('/api/admin/novedades/recolectar', requireAdminToken, async (_req, res) => {
  const r = await runNewsCollect();
  res.status(r.status).json(r.body);
});
app.post('/api/admin/novedades/boletin', requireAdminToken, async (req, res) => {
  const r = await runDigest({ appUrl: publicAppUrl(req) });
  res.status(r.status).json(r.body);
});

// Desde /admin
app.post('/api/admin/novedades/recolectar/ahora', requireAuth, requireAdminUser, async (_req, res) => {
  const r = await runNewsCollect();
  res.status(r.status).json(r.body);
});
app.post('/api/admin/novedades/boletin/ahora', requireAuth, requireAdminUser, async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  const prueba = req.body?.prueba !== false;
  const r = await runDigest({ appUrl: publicAppUrl(req), testTo: prueba ? user.email : undefined, force: req.body?.forzar === true });
  res.status(r.status).json(r.body);
});

app.get('/api/admin/novedades', requireAuth, requireAdminUser, async (req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    const status = String(req.query.estado || 'pendiente');
    const allowed = ['pendiente', 'aprobada', 'descartada', 'descartada_ia'];
    const snap = await adminDb.collection('news_items').where('status', '==', allowed.includes(status) ? status : 'pendiente').get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (b.importance - a.importance) || String(b.publishedAt || b.fetchedAt).localeCompare(String(a.publishedAt || a.fetchedAt)))
      .slice(0, 120);
    const [sources, meta, counts] = await Promise.all([
      adminDb.collection('news_sources').get(),
      adminDb.collection('meta').doc('novedades').get(),
      Promise.all(allowed.map(async st => [st, (await adminDb.collection('news_items').where('status', '==', st).count().get()).data().count] as const))
    ]);
    res.set('Cache-Control', 'no-store');
    return res.json({
      items,
      counts: Object.fromEntries(counts),
      sources: sources.docs.map(d => ({ id: d.id, ...d.data() })),
      meta: meta.data() || {},
      weekKey: chileWeekKey()
    });
  } catch (e: any) {
    console.error('[novedades] Error al listar:', e?.message);
    return res.status(500).json({ error: 'No se pudieron cargar las novedades.' });
  }
});

app.post('/api/admin/novedades/:id', requireAuth, requireAdminUser, async (req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    const ref = adminDb.collection('news_items').doc(String(req.params.id));
    if (!(await ref.get()).exists) return res.status(404).json({ error: 'Novedad no encontrada.' });
    const b = req.body || {};
    const update: Record<string, any> = { updatedAt: new Date().toISOString() };
    if (b.accion === 'aprobar') { update.status = 'aprobada'; update.approvedAt = new Date().toISOString(); }
    else if (b.accion === 'descartar') { update.status = 'descartada'; update.approvedAt = null; }
    else if (b.accion === 'pendiente') { update.status = 'pendiente'; update.approvedAt = null; }
    if (typeof b.title === 'string') update.title = b.title.trim().slice(0, 140);
    if (typeof b.summary === 'string') update.summary = b.summary.trim().slice(0, 900);
    if (typeof b.audience === 'string') update.audience = b.audience.trim().slice(0, 200);
    if (typeof b.type === 'string' && (NEWS_TYPES as readonly string[]).includes(b.type)) update.type = b.type;
    if ([1, 2, 3].includes(Number(b.importance))) update.importance = Number(b.importance);
    await ref.set(update, { merge: true });
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[novedades] Error al actualizar:', e?.message);
    return res.status(500).json({ error: 'No se pudo actualizar la novedad.' });
  }
});

// Público: novedades aprobadas (sección "Novedades" de la app)
app.get('/api/novedades', async (_req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.json({ items: [] });
    const since = new Date(Date.now() - 75 * 864e5).toISOString();
    const snap = await adminDb.collection('news_items').where('status', '==', 'aprobada').get();
    const items = snap.docs.map(d => d.data())
      .filter(x => String(x.approvedAt || '') >= since)
      .sort((a, b) => String(b.publishedAt || b.approvedAt).localeCompare(String(a.publishedAt || a.approvedAt)))
      .slice(0, 50)
      .map(x => ({ title: x.title, summary: x.summary, type: x.type, audience: x.audience, url: x.url, sourceName: x.outlet || x.sourceName, kind: x.kind, fundIds: x.fundIds || [], importance: x.importance || 1, date: x.publishedAt || x.approvedAt }));
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ items });
  } catch (e: any) {
    console.error('[novedades] Error en /api/novedades:', e?.message);
    return res.json({ items: [] });
  }
});

// Desuscripción con enlace firmado (sin iniciar sesión)
app.all('/api/novedades/desuscribir', async (req, res) => {
  const uid = String(req.query.u || '');
  const t = String(req.query.t || '');
  const page = (title: string, msg: string) => res.status(200).type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:40px 16px"><div style="max-width:480px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:28px"><p style="font-size:20px;font-weight:bold;margin:0 0 12px">Impulsa<span style="color:#059669">Cap</span></p><h1 style="font-size:18px">${title}</h1><p style="color:#334155;line-height:1.6">${msg}</p></div></body></html>`);
  if (!uid || t !== unsubToken(uid)) return page('Enlace no válido', 'El enlace no es válido o está incompleto. Escríbenos a contacto@impulsacap.cl y te sacamos de la lista.');
  try {
    if (!(await ensureFirestoreAdmin())) throw new Error('Firestore no disponible');
    const resub = req.query.volver === '1';
    await adminDb.collection('users').doc(uid).set({ newsOptOut: !resub, newsOptOutAt: resub ? null : new Date().toISOString() }, { merge: true });
    return resub
      ? page('Listo, vuelves a recibir novedades', 'Te llegará el boletín semanal y las alertas cuando se abra un fondo que calce con tu empresa.')
      : page('Listo, ya no recibirás novedades', `No te enviaremos más el boletín ni las alertas de convocatorias. Los correos de tu cuenta y de tu plan siguen llegando. ¿Fue un error? <a href="?u=${encodeURIComponent(uid)}&t=${t}&volver=1" style="color:#059669">Volver a suscribirme</a>.`);
  } catch (e: any) {
    console.error('[novedades] Error al desuscribir:', e?.message);
    return page('No pudimos completar la solicitud', 'Intenta de nuevo en unos minutos o escríbenos a contacto@impulsacap.cl.');
  }
});

// GET /api/convocatorias (Consulta pública con filtros de región y vigencia)
app.get('/api/convocatorias', async (req, res) => {
  try {
    let convocatorias: any[] = [];
    let meta: any = { lastSyncAt: null, total: 0, totalVigentes: 0 };

    if (isFirestoreAdminAuthorized) {
      const snap = await adminDb.collection('convocatorias').get();
      snap.forEach(d => convocatorias.push(d.data()));

      const metaDoc = await adminDb.collection('meta').doc('convocatoriasSync').get();
      if (metaDoc.exists) {
        meta = metaDoc.data();
      }
    }

    const { region, vigente } = req.query;
    if (vigente === 'true') {
      convocatorias = convocatorias.filter(c => c.vigente);
    }

    if (region && typeof region === 'string') {
      const rNorm = region.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      convocatorias = convocatorias.filter(c => {
        const alc = String(c.alcance || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return alc.includes('todo chile') || alc.includes('nacional') || alc.includes(rNorm);
      });
    }

    return res.json({ convocatorias, meta });
  } catch (err: any) {
    console.error('Error in GET /api/convocatorias:', err?.message);
    return res.status(500).json({ error: 'Error al obtener convocatorias.' });
  }
});

// -------------------------------------------------------------
// CORREOS AUTOMÁTICOS (Resend)
// -------------------------------------------------------------

// Fecha calendario en Chile (YYYY-MM-DD) para calcular días restantes sin errores de zona horaria
function chileDateKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}
function calendarDaysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split('-').map(Number);
  const [ty, tm, td] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000);
}

// Bienvenida: la app la solicita al detectar una cuenta nueva. Se envía una sola vez por usuario.
// ---------------------------------------------------------------------------
// Pase libre: cuentas con el Plan Trimestral completo sin pagar (socios, aliados, pruebas)
// El repo es público: los correos van como huella SHA-256, nunca en texto. Se suman los que
// el administrador agrega en /admin (colección free_passes, solo servidor) y PASE_LIBRE_EMAILS.
// ---------------------------------------------------------------------------
const FREE_PASS_HASHES = new Set<string>([
  '906f9b8d0e1fc71ba825b83396b8a06d9a0235821e519d93ca4445eb2a30c9ba',
  '6a58ad25da50827a3616c2a11add7c417efcae4c4f01f38f9e051edcf43e9df9',
  'c190cad0556ab565f395d055ae9cb26c6f982e876af23236ad6b0228f9a41cf0',
  '6f9b2544c30faad0243f4f23f8da61f25ff6e7dde9ca7e0e6aafa15a9f52a82e',
]);
const emailHash = (email: string) => createHash('sha256').update(String(email || '').trim().toLowerCase()).digest('hex');
const FREE_PASS_DAYS = 365;

async function hasFreePass(email?: string | null): Promise<boolean> {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  const h = emailHash(e);
  if (FREE_PASS_HASHES.has(h)) return true;
  if ((process.env.PASE_LIBRE_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean).includes(e)) return true;
  try {
    const d = await adminDb.collection('free_passes').doc(h).get();
    return d.exists && d.data()?.active !== false;
  } catch {
    return false;
  }
}

/** Activa (o extiende) el pase libre de la cuenta si su correo está en la lista. */
app.post('/api/cuenta/pase-libre', requireAuth, async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  try {
    if (!(await ensureFirestoreAdmin())) return res.json({ active: false });
    if (!(await hasFreePass(user.email))) return res.json({ active: false });
    const entRef = adminDb.collection('entitlements').doc(user.uid);
    const ent = (await entRef.get()).data() || null;
    const now = Date.now();
    const currentExp = ent?.expiresAt ? new Date(ent.expiresAt).getTime() : 0;
    // Se renueva solo cuando le quedan menos de 300 días (no se reescribe en cada visita)
    if (ent?.status === 'active' && !ent?.provisional && currentExp - now > 300 * 864e5) {
      return res.json({ active: true, expiresAt: ent.expiresAt });
    }
    const expiresAt = new Date(Math.max(now, currentExp) + FREE_PASS_DAYS * 864e5).toISOString();
    await entRef.set({
      plan: 'trimestral',
      status: 'active',
      expiresAt,
      provisional: false,
      freePass: true,
      freePassSince: ent?.freePassSince || new Date().toISOString(),
      emailRemindersOptOut: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`[pase-libre] Activado para ${user.uid} hasta ${expiresAt}`);
    return res.json({ active: true, expiresAt });
  } catch (err: any) {
    console.error('[pase-libre]', err?.message);
    return res.json({ active: false });
  }
});

// Administración del pase libre desde /admin
app.get('/api/admin/pase-libre', requireAuth, requireAdminUser, async (_req, res) => {
  try {
    const snap = await adminDb.collection('free_passes').get();
    return res.json({
      fixedCount: FREE_PASS_HASHES.size,
      items: snap.docs.map(d => ({ id: d.id, email: d.data().email || '', active: d.data().active !== false, addedAt: d.data().addedAt || null }))
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'No se pudo leer.' });
  }
});
app.post('/api/admin/pase-libre', requireAuth, requireAdminUser, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Correo inválido.' });
  const active = req.body?.active !== false;
  try {
    await adminDb.collection('free_passes').doc(emailHash(email)).set({ email, active, addedAt: new Date().toISOString() }, { merge: true });
    if (!active) {
      // Quitar el pase: si la cuenta existe y su plan venía del pase, se termina
      const users = await adminDb.collection('users').where('email', '==', email).limit(5).get().catch(() => null);
      for (const u of users?.docs || []) {
        const ref = adminDb.collection('entitlements').doc(u.id);
        const ent = (await ref.get()).data();
        if (ent?.freePass && !ent?.lastPaymentId) await ref.set({ status: 'expired', freePass: false, expiresAt: new Date().toISOString() }, { merge: true });
      }
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'No se pudo guardar.' });
  }
});


// ---------------------------------------------------------------------------
// Completar el perfil del proyecto desde el sitio web o los currículums (opcional)
// ---------------------------------------------------------------------------
const perUserLimiter = (max: number, message: string) => rateLimit({
  windowMs: 60 * 60 * 1000,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  keyGenerator: (req) => (req as AuthenticatedRequest).user?.uid || ipKeyGenerator(req.ip || ''),
  message: { error: message }
});
const cleanField = (v: any, max = 1500) => (typeof v === 'string' ? v.replace(/\[COMPLETAR[^\]]*\]/gi, '').trim().slice(0, max) : '');

app.post('/api/perfil/desde-web', requireAuth, perUserLimiter(10, 'Leíste muchos sitios en la última hora. Intenta más tarde.'), guardAi('perfil-web'), async (req, res) => {
  try {
    const { pages, content } = await readCompanySite(String(req.body?.url || ''));
    const prompt = `Este es el texto público del sitio web de una empresa chilena:
"""
${content}
"""

Con SOLO lo que dice el sitio, propone respuestas para el perfil de su proyecto. Reglas:
- No inventes nada: ni cifras, ni clientes, ni logros, ni equipo. Si el sitio no lo dice, deja el campo vacío ("").
- Escribe en español de Chile, en primera persona plural ("Desarrollamos…", "Atendemos a…"), claro y concreto, 1 a 3 oraciones por campo.
- "currentProgress" solo si el sitio menciona clientes, ventas, proyectos realizados, años de experiencia o hitos concretos.
- "teamDetails" solo si el sitio nombra personas y sus roles.

Responde SOLO este JSON:
{"whatItDoes":"","problemAndTarget":"","currentSolutionAndDiff":"","currentProgress":"","businessModel":"","teamDetails":""}`;
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.1 }
    });
    const parsed = JSON.parse(response.text || '{}');
    const suggestions: Record<string, string> = {};
    for (const k of ['whatItDoes', 'problemAndTarget', 'currentSolutionAndDiff', 'currentProgress', 'businessModel', 'teamDetails']) {
      const v = cleanField(parsed[k]);
      if (v.length >= 10) suggestions[k] = v;
    }
    return res.json({ pages, suggestions });
  } catch (err: any) {
    if (err instanceof AutofillError) return res.status(err.status).json({ error: err.message });
    console.error('[perfil-web]', err?.message);
    return res.status(503).json({ error: 'No pudimos leer tu sitio ahora. Intenta en unos minutos o completa el perfil a mano.' });
  }
});

app.post('/api/perfil/desde-cv', requireAuth, perUserLimiter(10, 'Subiste muchos currículums en la última hora. Intenta más tarde.'), guardAi('perfil-cv'), async (req, res) => {
  try {
    const files: CvFile[] = Array.isArray(req.body?.files) ? req.body.files.slice(0, 5) : [];
    if (files.length === 0) return res.status(400).json({ error: 'Adjunta al menos un currículum.' });
    const docs = [];
    for (const f of files) docs.push(await cvToText(f));
    const parts: any[] = [];
    docs.forEach((d, i) => {
      if (d.pdfBase64) {
        parts.push({ text: `CURRÍCULUM ${i + 1} (${d.name}), en el PDF adjunto:` });
        parts.push({ inlineData: { mimeType: 'application/pdf', data: d.pdfBase64 } });
      } else {
        parts.push({ text: `CURRÍCULUM ${i + 1} (${d.name}):\n${d.text}` });
      }
    });
    const projectHint = String(req.body?.projectSummary || '').slice(0, 600);
    parts.push({ text: `Extrae de cada currículum SOLO lo que está escrito, para describir al equipo de un proyecto que postula a fondos públicos${projectHint ? ` (el proyecto: ${projectHint})` : ''}.
Reglas: no inventes cargos, años ni logros. Si algo no aparece, omítelo. No incluyas datos personales sensibles (RUT, dirección, teléfono, fecha de nacimiento).
Responde SOLO este JSON:
{"people":[{"name":"Nombre","role":"cargo o rol (actual o el que indique el CV)","summary":"1 o 2 oraciones: experiencia más relevante, años si están, formación principal"}]}` });
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts }],
      config: { responseMimeType: 'application/json', temperature: 0.1 }
    });
    const parsed = JSON.parse(response.text || '{}');
    const people = (Array.isArray(parsed.people) ? parsed.people : [])
      .map((p: any) => ({ name: cleanField(p?.name, 120), role: cleanField(p?.role, 160), summary: cleanField(p?.summary, 600) }))
      .filter((p: any) => p.name);
    if (people.length === 0) return res.status(422).json({ error: 'No pudimos identificar a las personas en esos archivos. Revisa que sean currículums legibles.' });
    const teamDetails = people.map((p: any) => `${p.name}${p.role ? ` (${p.role})` : ''}: ${p.summary}`.trim()).join('\n');
    return res.json({ people, teamDetails });
  } catch (err: any) {
    if (err instanceof AutofillError) return res.status(err.status).json({ error: err.message });
    console.error('[perfil-cv]', err?.message);
    return res.status(503).json({ error: 'No pudimos leer los currículums ahora. Intenta en unos minutos.' });
  }
});

app.post('/api/cuenta/bienvenida', requireAuth, async (req, res) => {
  const user = (req as AuthenticatedRequest).user!;
  try {
    if (!(await ensureFirestoreAdmin())) {
      console.warn(`[email] Bienvenida pendiente para ${user.uid}: Firestore Admin no autorizado`);
      return res.json({ sent: false, reason: 'firestore_no_autorizado', retry: true });
    }

    // Solo cuentas creadas en los últimos 7 días (evita enviar bienvenidas a cuentas antiguas)
    // Fecha de creación y correo: Firebase Auth o, sin permiso de Authentication, el perfil users/{uid}
    let createdAt = 0;
    let toEmail = '';
    let authName = '';
    try {
      const record = await adminAuth.getUser(user.uid);
      createdAt = new Date(record.metadata.creationTime || 0).getTime();
      toEmail = record.email || '';
      authName = record.displayName || '';
    } catch (e: any) {
      console.warn('[email] getUser sin permiso; bienvenida con datos de users/{uid}:', e?.code || e?.message);
      // El correo sale del token verificado; la fecha, del perfil o de la que informa la app al registrarse
      const profileSnap = await adminDb.collection('users').doc(user.uid).get();
      const clientCreated = Date.parse(String(req.body?.createdAt || ''));
      createdAt = profileSnap.exists && profileSnap.createTime
        ? profileSnap.createTime.toMillis()
        : (Number.isFinite(clientCreated) && clientCreated <= Date.now() ? clientCreated : Date.now());
      toEmail = String(user.email || profileSnap.data()?.email || '');
    }
    if (!createdAt || Date.now() - createdAt > 7 * 86400000) {
      return res.json({ sent: false, reason: 'cuenta_antigua' });
    }
    if (!toEmail) {
      return res.json({ sent: false, reason: 'sin_correo' });
    }

    // Un solo envío por usuario: se reserva el envío en una transacción. Si un intento anterior falló
    // (sin sentAt) y pasaron más de 2 minutos, se permite reintentar.
    const logRef = adminDb.collection('email_log').doc(`welcome_${user.uid}`);
    const claim = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(logRef);
      const data = snap.exists ? snap.data() : null;
      if (data?.sentAt) return 'ya_enviado';
      const last = data?.requestedAt ? new Date(data.requestedAt).getTime() : 0;
      if (last && Date.now() - last < 2 * 60 * 1000) return 'en_curso';
      tx.set(logRef, { uid: user.uid, type: 'welcome', requestedAt: new Date().toISOString(), attempts: (data?.attempts || 0) + 1 }, { merge: true });
      return 'ok';
    });
    if (claim !== 'ok') {
      return res.json({ sent: false, reason: claim, retry: claim === 'en_curso' });
    }

    let name = authName;
    try {
      const userDoc = await adminDb.collection('users').doc(user.uid).get();
      name = String(userDoc.data()?.displayName || name || '');
    } catch {}
    const firstName = name.trim().split(/\s+/)[0] || '';

    const sent = await sendEmail({ to: toEmail, ...welcomeEmail(firstName), idempotencyKey: `welcome-${user.uid}` });
    await logRef.set(sent
      ? { sentAt: new Date().toISOString(), lastError: null }
      : { sentAt: null, lastError: 'resend', lastErrorAt: new Date().toISOString() }, { merge: true });
    console.log(`[email] Bienvenida ${sent ? 'enviada' : 'NO enviada (Resend)'} a usuario ${user.uid}`);
    return res.json({ sent, retry: !sent });
  } catch (err: any) {
    console.error('[email] Error en /api/cuenta/bienvenida:', err?.message);
    return res.json({ sent: false, reason: 'error', retry: true });
  }
});

// Recordatorios de vencimiento del Plan Trimestral (llamado a diario por GitHub Actions)
/** Recordatorios de vencimiento (7 días antes y el día que vence). Lo llama la tarea diaria y /admin. */
async function runReminders(): Promise<{ status: number; body: any }> {
  if (!(await ensureFirestoreAdmin())) {
    return { status: 503, body: { error: 'Firestore Admin no está autorizado.' } };
  }
  if (!isEmailConfigured()) {
    return { status: 503, body: { error: 'RESEND_API_KEY no está configurada.' } };
  }
  const todayKey = chileDateKey(new Date());
  const summary = { revisados: 0, aviso7d: 0, avisoVencido: 0, omitidos: 0, errores: 0 };

  try {
    const snap = await adminDb.collection('entitlements').where('status', '==', 'active').get();

    for (const docSnap of snap.docs) {
      summary.revisados++;
      const uid = docSnap.id;
      const data = docSnap.data() || {};
      const expiresAt: string | undefined = data.expiresAt;
      if (!expiresAt || isNaN(new Date(expiresAt).getTime())) { summary.omitidos++; continue; }
      if (data.emailRemindersOptOut === true || data.provisional === true) { summary.omitidos++; continue; }

      const daysLeft = calendarDaysBetween(todayKey, chileDateKey(new Date(expiresAt)));

      let kind: '7d' | 'expired' | null = null;
      if (daysLeft >= 1 && daysLeft <= 7 && data.reminder7dForExpiresAt !== expiresAt) {
        kind = '7d';
      } else if (daysLeft <= 0 && daysLeft >= -3 && data.reminderExpiredForExpiresAt !== expiresAt) {
        // Solo planes vencidos en los últimos 3 días, para no escribir a cuentas vencidas hace tiempo
        kind = 'expired';
      }
      if (!kind) { summary.omitidos++; continue; }

      try {
        const email = await getUserEmail(uid);
        if (!email) { summary.omitidos++; continue; }

        const sent = await sendEmail({
          to: email,
          ...reminderEmail(kind, expiresAt),
          idempotencyKey: `reminder-${kind}-${uid}-${expiresAt}`,
        });
        if (!sent) { summary.errores++; continue; }

        const now = new Date().toISOString();
        await docSnap.ref.set(
          kind === '7d'
            ? { reminder7dSentAt: now, reminder7dForExpiresAt: expiresAt }
            : { reminderExpiredSentAt: now, reminderExpiredForExpiresAt: expiresAt },
          { merge: true }
        );
        if (kind === '7d') summary.aviso7d++; else summary.avisoVencido++;
      } catch (e: any) {
        console.error(`[email] Error en recordatorio para ${uid}:`, e?.message);
        summary.errores++;
      }
    }

    console.log('[email] Recordatorios:', JSON.stringify(summary));
    return { status: 200, body: { ok: true, ...summary } };
  } catch (err: any) {
    console.error('[email] Error en /api/admin/recordatorios:', err?.message);
    return { status: 500, body: { error: 'Error al procesar recordatorios', ...summary } };
  }
}

app.post('/api/admin/recordatorios', requireAdminToken, async (_req, res) => {
  const r = await runReminders();
  return res.status(r.status).json(r.body);
});

// Desde /admin: ejecutar los recordatorios ahora
app.post('/api/admin/recordatorios/ahora', requireAuth, requireAdminUser, async (_req, res) => {
  const r = await runReminders();
  return res.status(r.status).json(r.body);
});

/** Envía todas las plantillas de correo (marcadas [PRUEBA]) a un destinatario. */
async function sendAllTestEmails(to: string) {
  const exp = new Date(Date.now() + 90 * 864e5).toISOString();
  const ticket: any = { ticketId: 'PRUEBA', email: to, name: 'Cliente de prueba', message: 'Este es un mensaje de prueba del soporte.', page: 'my-company', hasPlan: true, conversation: [{ role: 'user', text: 'Hola' }, { role: 'bot', text: 'Hola, ¿en qué te ayudo?' }] };
  const templates: [string, { subject: string; html: string; text: string }][] = [
    ['Bienvenida', welcomeEmail('Cliente')],
    ['Compra confirmada (cliente)', purchaseEmail({ amount: 19990, paymentId: 'PRUEBA-123', expiresAt: exp })],
    ['Nueva venta (administrador)', adminSaleEmail({ userEmail: 'cliente@ejemplo.cl', companyName: 'Empresa de prueba SpA', amount: 19990, isFirstPurchase: true, paymentId: 'PRUEBA-123', expiresAt: exp })],
    ['Venta con código (vendedor)', sellerSaleEmail({ sellerName: 'Vendedor Prueba', code: 'PRUEBA', amount: 15990, commission: 3198, companyName: 'Empresa de prueba SpA' })],
    ['Recordatorio: vence en 7 días', reminderEmail('7d', new Date(Date.now() + 7 * 864e5).toISOString())],
    ['Recordatorio: venció hoy', reminderEmail('expired', new Date().toISOString())],
    ['Soporte: aviso al administrador', supportTicketAdminEmail(ticket)],
    ['Soporte: confirmación al cliente', supportTicketUserEmail(ticket)],
    ['Invitación a contratar', paymentAvailableEmail({ deadline: new Date().toISOString(), price: 19990 })],
  ];
  const results: { name: string; sent: boolean; error?: string | null }[] = [];
  for (const [name, t] of templates) {
    const r = await sendEmailDetailed({ to, subject: `[PRUEBA] ${t.subject}`, html: t.html, text: t.text });
    results.push({ name, sent: r.ok, error: r.error || null });
  }
  return results;
}

// Cada intento de envío queda registrado (colección solo del servidor) para revisarlo en /admin
setEmailEventSink((e) => {
  if (!isFirestoreAdminAuthorized) return;
  adminDb.collection('email_events').add(e).catch(() => {});
});

// Últimos envíos de correo, con el error exacto de Resend si falló
app.get('/api/admin/correos', requireAuth, requireAdminUser, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    const snap = await adminDb.collection('email_events').orderBy('at', 'desc').limit(40).get();
    const events = snap.docs.map(d => d.data());
    const welcomeSnap = await adminDb.collection('email_log').orderBy('requestedAt', 'desc').limit(15).get().catch(() => null);
    const welcome = welcomeSnap ? welcomeSnap.docs.map(d => d.data()) : [];
    return res.json({ configured: isEmailConfigured(), from: 'notificaciones@impulsacap.cl', adminEmail: getAdminEmail(), events, welcome });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'No se pudo leer el registro.' });
  }
});

// Desde /admin: todas las plantillas a tu correo
app.post('/api/admin/probar-correos', requireAuth, requireAdminUser, async (req, res) => {
  if (!isEmailConfigured()) return res.status(503).json({ error: 'RESEND_API_KEY no está configurada en AI Studio.' });
  const to = (req as AuthenticatedRequest).user?.email || getAdminEmail();
  if (!to) return res.status(400).json({ error: 'Tu cuenta no tiene correo.' });
  const results = await sendAllTestEmails(to);
  return res.json({ to, results, ok: results.every(r => r.sent) });
});

// Correo de prueba al administrador, para verificar la configuración de Resend
app.get('/api/admin/test-email', requireAdminToken, async (req, res) => {
  const to = getAdminEmail();
  if (!isEmailConfigured()) return res.status(503).json({ sent: false, error: 'RESEND_API_KEY no está configurada.' });
  if (!to) return res.status(503).json({ sent: false, error: 'ADMIN_EMAIL no está configurado.' });
  if (req.query.todos === '1') {
    const results = await sendAllTestEmails(to);
    const sent = results.every(r => r.sent);
    return res.status(sent ? 200 : 502).json({ sent, results });
  }
  const sent = await sendEmail({ to, ...testEmail() });
  return res.status(sent ? 200 : 502).json({ sent, to });
});

// Registra que el usuario confirmó el inicio del servicio del plan (fin del plazo de retracto para esa compra)
app.post('/api/plan/iniciar-servicio', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (!isFirestoreAdminAuthorized) {
      return res.status(503).json({ error: 'No pudimos registrar la confirmación. Intenta nuevamente en unos minutos.' });
    }
    const entRef = adminDb.collection('entitlements').doc(user.uid);
    const entSnap = await entRef.get();
    const ent = entSnap.exists ? entSnap.data() : null;
    const expTime = ent?.expiresAt ? new Date(ent.expiresAt).getTime() : NaN;
    if (!ent || ent.status !== 'active' || isNaN(expTime) || expTime <= Date.now()) {
      return res.status(402).json({ error: 'Necesitas el Plan Trimestral para usar esta herramienta' });
    }
    const lastPaymentId = ent.lastPaymentId ? String(ent.lastPaymentId) : '';
    if (!lastPaymentId || ent.serviceStartedForPaymentId === lastPaymentId) {
      return res.json({ ok: true });
    }
    const now = new Date().toISOString();
    await entRef.set({ serviceStartedForPaymentId: lastPaymentId, serviceStartedAt: now }, { merge: true });
    try {
      await adminDb.collection('payments').doc(lastPaymentId).set({ serviceStartedAt: now, serviceStartConfirmedByUser: true }, { merge: true });
    } catch (e: any) {
      console.warn('[plan] No se pudo registrar serviceStartedAt en payments:', e?.message);
    }
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('Error in /api/plan/iniciar-servicio:', err?.message);
    return res.status(500).json({ error: 'No pudimos registrar la confirmación. Intenta nuevamente.' });
  }
});

// ---------------------------------------------------------------------------
// Estadísticas de visitas (sin cookies ni identificadores): conteo diario por página
// ---------------------------------------------------------------------------
const pageviewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Demasiadas solicitudes.' }
});
const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp|telegram|pingdom|uptime|monitor|curl|wget|python|go-http/i;

app.post('/api/metrics/pageview', pageviewLimiter, async (req, res) => {
  res.status(204).end();
  try {
    if (!isFirestoreAdminAuthorized) return;
    const ua = req.get('user-agent') || '';
    if (!ua || BOT_UA.test(ua)) return;
    const rawPage = String(req.body?.page || '');
    const page = (TRACKED_PAGES as readonly string[]).includes(rawPage) ? rawPage : 'otra';
    const day = chileDayKey(new Date());
    await adminDb.collection('stats_daily').doc(day).set({
      date: day,
      views: FieldValue.increment(1),
      visitors: FieldValue.increment(req.body?.newVisitorToday === true ? 1 : 0),
      pages: { [page]: FieldValue.increment(1) }
    }, { merge: true });
  } catch (err: any) {
    console.warn('[metrics] No se pudo registrar la visita:', err?.message);
  }
});

// ---------------------------------------------------------------------------
// Panel de administración: solo correos verificados listados en ADMIN_DASHBOARD_EMAILS
// (separados por coma). Si no está definida, se usa ADMIN_EMAIL.
// ---------------------------------------------------------------------------
function getAdminDashboardEmails(): string[] {
  return (process.env.ADMIN_DASHBOARD_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function requireAdminUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as AuthenticatedRequest).user;
  const email = (user?.email || '').toLowerCase();
  if (!email || !user?.emailVerified || !getAdminDashboardEmails().includes(email)) {
    return res.status(403).json({
      error: 'Tu cuenta no tiene acceso al panel de administración.',
      email: user?.email || null,
      emailVerified: Boolean(user?.emailVerified)
    });
  }
  return next();
}

app.get('/api/admin/soporte', requireAuth, requireAdminUser, async (req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    const snap = await adminDb.collection('support_tickets').orderBy('createdAt', 'desc').limit(100).get();
    res.set('Cache-Control', 'no-store');
    return res.json({ tickets: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (err: any) {
    console.error('Error in /api/admin/soporte:', err?.message);
    return res.status(500).json({ error: 'No se pudieron cargar las solicitudes.' });
  }
});

app.post('/api/admin/soporte/:id/estado', requireAuth, requireAdminUser, async (req, res) => {
  try {
    const status = String(req.body?.status || '');
    if (!['abierto', 'resuelto'].includes(status)) return res.status(400).json({ error: 'Estado inválido.' });
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    await adminDb.collection('support_tickets').doc(String(req.params.id)).set({
      status,
      ...(status === 'resuelto' ? { resolvedAt: new Date().toISOString() } : { resolvedAt: null })
    }, { merge: true });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error('Error in /api/admin/soporte/:id/estado:', err?.message);
    return res.status(500).json({ error: 'No se pudo actualizar la solicitud.' });
  }
});

// Acceso anticipado: listado y aviso de "ya puedes pagar" (solo cuando el pago ya está habilitado)
app.get('/api/admin/acceso-anticipado', requireAuth, requireAdminUser, async (_req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    const snap = await adminDb.collection('purchase_intents').orderBy('createdAt', 'desc').limit(200).get();
    res.set('Cache-Control', 'no-store');
    return res.json({ paymentsEnabled: !isEarlyAccessMode(), intents: snap.docs.map(d => d.data()) });
  } catch (err: any) {
    console.error('Error in /api/admin/acceso-anticipado:', err?.message);
    return res.status(500).json({ error: 'No se pudo cargar el acceso anticipado.' });
  }
});

app.post('/api/admin/acceso-anticipado/avisar', requireAuth, requireAdminUser, async (_req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    // Invita a contratar a quienes usaron la prueba de lanzamiento (ya no existe). No extiende ningún acceso.
    const snap = await adminDb.collection('purchase_intents').where('status', '==', 'acceso_anticipado').get();
    let avisados = 0;
    let omitidos = 0;
    for (const d of snap.docs) {
      const it = d.data();
      if (it.notifiedAt || !it.email) { omitidos++; continue; }
      const price = (await resolvePricing(adminDb, it.uid)).price;
      const sent = await sendEmail({ to: it.email, ...paymentAvailableEmail({ deadline: new Date().toISOString(), price }), idempotencyKey: `pay-available-${it.uid}` });
      await d.ref.set({ notifiedAt: new Date().toISOString(), notifyEmailSent: sent }, { merge: true });
      avisados++;
    }
    console.log(`[acceso-anticipado] Invitación a contratar: ${avisados} avisados, ${omitidos} omitidos`);
    return res.json({ avisados, omitidos });
  } catch (err: any) {
    console.error('Error in /api/admin/acceso-anticipado/avisar:', err?.message);
    return res.status(500).json({ error: 'No se pudo enviar el aviso.' });
  }
});

// Admin: consumo y costo estimado de la IA
app.get('/api/admin/ia-uso', requireAuth, requireAdminUser, async (_req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    res.set('Cache-Control', 'no-store');
    const today = chileDay();
    const since = chileDay(new Date(Date.now() - 13 * 864e5));
    const monthStart = `${today.slice(0, 7)}-01`;
    const [dailySnap, usersSnap] = await Promise.all([
      adminDb.collection('ai_usage_daily').where('day', '>=', since < monthStart ? since : monthStart).get(),
      adminDb.collection('ai_usage_users').where('day', '>=', monthStart).get()
    ]);
    const days = dailySnap.docs.map(d => d.data() as any).sort((a, b) => String(a.day).localeCompare(String(b.day)));
    const month = days.filter(d => d.day >= monthStart);
    const sum = (list: any[], k: string) => list.reduce((acc, d) => acc + (Number(d[k]) || 0), 0);
    const byUser = new Map<string, { uid: string; calls: number; costUsd: number }>();
    usersSnap.docs.forEach(d => {
      const x = d.data() as any;
      const cur = byUser.get(x.uid) || { uid: x.uid, calls: 0, costUsd: 0 };
      cur.calls += Number(x.calls) || 0;
      cur.costUsd += Number(x.costUsd) || 0;
      byUser.set(x.uid, cur);
    });
    const top = Array.from(byUser.values()).sort((a, b) => b.costUsd - a.costUsd).slice(0, 10);
    const topWithEmail = await Promise.all(top.map(async t => ({ ...t, email: await getUserEmail(t.uid) })));
    const todayDoc = days.find(d => d.day === today) || null;
    return res.json({
      today: { calls: Number(todayDoc?.calls) || 0, costUsd: Number(todayDoc?.costUsd) || 0, endpoints: todayDoc?.endpoints || {} },
      month: { calls: sum(month, 'calls'), costUsd: sum(month, 'costUsd'), inTok: sum(month, 'inTok'), outTok: sum(month, 'outTok'), activeUsers: byUser.size },
      last14: days.filter(d => d.day >= since).map(d => ({ day: d.day, calls: Number(d.calls) || 0, costUsd: Number(d.costUsd) || 0 })),
      topUsers: topWithEmail,
      limits: AI_LIMITS()
    });
  } catch (err: any) {
    console.error('Error in /api/admin/ia-uso:', err?.message);
    return res.status(500).json({ error: 'No se pudo cargar el consumo de IA.' });
  }
});

// Admin: prueba en vivo de la IA (Gemini). Devuelve el error real para diagnosticar clave, cuota o modelo.
app.get('/api/admin/diagnostico-ia', requireAuth, requireAdminUser, async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const keyInfo = apiKey ? `presente (${apiKey.length} caracteres, termina en …${apiKey.slice(-4)})` : 'NO configurada';
  const started = Date.now();
  try {
    const r = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: 'Responde solo: OK' }] }],
      config: { maxOutputTokens: 20, temperature: 0 }
    });
    return res.json({ ok: true, model: (r as any)?.usedModel || MODEL_NAME, key: keyInfo, ms: Date.now() - started, sample: (r.text || '').trim().slice(0, 40) });
  } catch (err: any) {
    const message = String(err?.message || err).replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[clave oculta]').slice(0, 600);
    console.error('[diagnostico-ia]', err?.status, message);
    return res.json({ ok: false, model: MODEL_NAME, key: keyInfo, ms: Date.now() - started, status: err?.status ?? null, error: message });
  }
});

app.get('/api/admin/resumen', requireAuth, requireAdminUser, async (req, res) => {
  try {
    if (!isFirestoreAdminAuthorized) {
      return res.status(503).json({ error: 'Firestore Admin no está autorizado en el servidor.' });
    }
    const summary = await buildAdminSummary(adminDb, adminAuth, {
      emailConfigured: isEmailConfigured(),
      mercadoPagoConfigured: Boolean(mpAccessToken),
      flowConfigured: flowConfig().configured,
      paymentProvider: paymentProvider()
    });
    res.set('Cache-Control', 'no-store');
    return res.json(summary);
  } catch (err: any) {
    console.error('Error in /api/admin/resumen:', err?.message);
    return res.status(500).json({ error: 'No se pudo generar el resumen: ' + (err?.message || 'error desconocido') });
  }
});

// ---------------------------------------------------------------------------
// Vendedores: códigos con descuento para la primera compra y comisión por venta
// ---------------------------------------------------------------------------
const sellerCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: 429,
  message: { error: 'Demasiados intentos. Espera unos minutos.' }
});

const publicSellerCode = (s: Seller) => ({
  valid: true,
  code: s.code,
  sellerName: firstName(s.name),
  discountPct: s.discountPct,
  price: priceWithDiscount(s.discountPct)
});

// Público: valida un código y muestra el precio (para visitantes sin sesión)
app.get('/api/vendedores/codigo/:code', sellerCodeLimiter, async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Intenta en unos minutos.' });
    const seller = await getActiveSeller(adminDb, req.params.code);
    if (!seller) return res.status(404).json({ valid: false, error: 'Ese código no existe o ya no está vigente.' });
    return res.json(publicSellerCode(seller));
  } catch (err: any) {
    console.error('Error in /api/vendedores/codigo:', err?.message);
    return res.status(500).json({ error: 'No se pudo validar el código.' });
  }
});

// Asocia un código a la cuenta. Vale hasta la primera compra; un código nuevo reemplaza al anterior.
app.post('/api/vendedores/aplicar', sellerCodeLimiter, requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Intenta en unos minutos.' });
    const seller = await getActiveSeller(adminDb, req.body?.code);
    if (!seller) return res.status(404).json({ error: 'Ese código no existe o ya no está vigente.' });
    if (await hasApprovedPayment(adminDb, user.uid)) {
      return res.status(409).json({ error: 'Los códigos aplican solo a la primera compra del plan.' });
    }
    if (seller.email && user.email && seller.email.toLowerCase() === user.email.toLowerCase()) {
      return res.status(409).json({ error: 'No puedes usar tu propio código de vendedor.' });
    }
    const source = req.body?.source === 'link' ? 'link' : 'campo';
    await adminDb.collection('referrals').doc(user.uid).set({ code: seller.code, appliedAt: new Date().toISOString(), source, email: user.email || '' });
    return res.json({ ok: true, ...(await resolvePricing(adminDb, user.uid)) });
  } catch (err: any) {
    console.error('Error in /api/vendedores/aplicar:', err?.message);
    return res.status(500).json({ error: 'No se pudo aplicar el código.' });
  }
});

app.post('/api/vendedores/quitar', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Intenta en unos minutos.' });
    if (await hasApprovedPayment(adminDb, user.uid)) return res.json({ ok: true, ...(await resolvePricing(adminDb, user.uid)) });
    await adminDb.collection('referrals').doc(user.uid).delete();
    return res.json({ ok: true, ...(await resolvePricing(adminDb, user.uid)) });
  } catch (err: any) {
    console.error('Error in /api/vendedores/quitar:', err?.message);
    return res.status(500).json({ error: 'No se pudo quitar el código.' });
  }
});

const RETRACTO_DAYS = 10;
const isPastRetracto = (iso: string) => {
  const t = new Date(iso || 0).getTime();
  return Boolean(t) && Date.now() - t >= RETRACTO_DAYS * 864e5;
};

/** Ventas, pruebas y totales de un conjunto de códigos. */
async function sellerActivity(codes: string[]) {
  const sales: any[] = [];
  const trials: any[] = [];
  for (let i = 0; i < codes.length; i += 10) {
    const chunk = codes.slice(i, i + 10);
    const [salesSnap, trialsSnap] = await Promise.all([
      adminDb.collection('seller_sales').where('code', 'in', chunk).get(),
      adminDb.collection('purchase_intents').where('sellerCode', 'in', chunk).get()
    ]);
    salesSnap.forEach(d => sales.push(d.data()));
    trialsSnap.forEach(d => trials.push(d.data()));
  }
  sales.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  trials.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const totals = (code?: string) => {
    const all = code ? sales.filter(s => s.code === code) : sales;
    // Ventas devueltas o con contracargo no cuentan
    const list = all.filter(s => s.status !== 'anulada' && s.status !== 'pagada_anulada');
    const sum = (f: (s: any) => boolean) => list.filter(f).reduce((acc, s) => acc + (Number(s.commission) || 0), 0);
    return {
      salesCount: list.length,
      revenue: list.reduce((acc, s) => acc + (Number(s.amount) || 0), 0),
      commissionPending: sum(s => s.status === 'pendiente'),
      // Se puede pagar cuando pasó el plazo de retracto (10 días desde la venta)
      commissionPayable: sum(s => s.status === 'pendiente' && isPastRetracto(s.createdAt)),
      commissionInRetracto: sum(s => s.status === 'pendiente' && !isPastRetracto(s.createdAt)),
      commissionPaid: sum(s => s.status === 'pagada'),
      commissionToRecover: all.filter(s => s.status === 'pagada_anulada').reduce((acc, s) => acc + (Number(s.commission) || 0), 0),
      trialsCount: (code ? trials.filter(t => t.sellerCode === code) : trials).filter(t => t.status !== 'pagado').length
    };
  };
  return { sales, trials, totals };
}

// Panel del vendedor: entra con la cuenta cuyo correo está registrado en su código
app.get('/api/vendedor/panel', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    res.set('Cache-Control', 'no-store');
    const email = (user.email || '').toLowerCase();
    if (!email) return res.status(403).json({ error: 'Tu cuenta no tiene correo.' });
    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Verifica tu correo para ver tu panel de vendedor (revisa el mensaje de verificación o entra con Google).', email });
    }
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Intenta en unos minutos.' });
    const snap = await adminDb.collection('sellers').where('email', '==', email).get();
    if (snap.empty) return res.status(404).json({ error: 'Tu cuenta no tiene un código de vendedor.', email });
    const sellers = snap.docs.map(d => ({ ...(d.data() as Seller), code: d.id }));
    const codesList = sellers.map(s => s.code);
    const { sales, trials, totals } = await sellerActivity(codesList);
    // Registrados con el código que aún no compran (el código se borra de referrals al no aplicar más)
    const buyers = new Set(sales.map((x: any) => x.uid));
    let referredPending = 0;
    for (let i = 0; i < codesList.length; i += 10) {
      const rs = await adminDb.collection('referrals').where('code', 'in', codesList.slice(i, i + 10)).get();
      rs.forEach(d => { if (!buyers.has(d.id)) referredPending++; });
    }
    return res.json({
      referredPending,
      name: sellers[0].name,
      email,
      codes: sellers.map(s => ({
        code: s.code,
        active: s.active,
        discountPct: s.discountPct,
        commissionPct: s.commissionPct,
        price: priceWithDiscount(s.discountPct),
        link: `${getAppUrl()}/?ref=${encodeURIComponent(s.code)}`,
        ...totals(s.code)
      })),
      totals: totals(),
      sales: sales.slice(0, 200).map(s => ({
        date: s.createdAt,
        code: s.code,
        client: s.companyName || maskEmail(s.buyerEmail),
        amount: s.amount,
        commission: s.commission,
        status: s.status,
        paidAt: s.paidAt || null
      })),
      trials: trials.filter(t => t.status !== 'pagado').slice(0, 100).map(t => ({
        date: t.createdAt,
        code: t.sellerCode,
        client: t.companyName || maskEmail(t.email),
        until: t.accessUntil || null
      }))
    });
  } catch (err: any) {
    console.error('Error in /api/vendedor/panel:', err?.message);
    return res.status(500).json({ error: 'No se pudo cargar tu panel.' });
  }
});

// Admin: listado de vendedores con ventas y comisiones
app.get('/api/admin/vendedores', requireAuth, requireAdminUser, async (_req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    res.set('Cache-Control', 'no-store');
    const snap = await adminDb.collection('sellers').get();
    const sellers = snap.docs.map(d => ({ ...(d.data() as Seller), code: d.id }));
    sellers.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
    const { sales, totals } = sellers.length ? await sellerActivity(sellers.map(s => s.code)) : { sales: [], totals: () => ({}) as any };
    return res.json({
      appUrl: getAppUrl(),
      sellers: sellers.map(s => ({ ...s, price: priceWithDiscount(s.discountPct), ...totals(s.code) })),
      sales: sales.slice(0, 300),
      limits: { maxDiscountPct: MAX_DISCOUNT_PCT, maxCommissionPct: MAX_COMMISSION_PCT, priceFull: PRICE_FULL, priceFirst: PRICE_FIRST }
    });
  } catch (err: any) {
    console.error('Error in /api/admin/vendedores:', err?.message);
    return res.status(500).json({ error: 'No se pudieron cargar los vendedores.' });
  }
});

// Admin: crear o editar un vendedor
app.post('/api/admin/vendedores', requireAuth, requireAdminUser, async (req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    const b = req.body || {};
    const code = normalizeCode(b.code);
    if (!isValidCodeFormat(code)) {
      return res.status(400).json({ error: 'El código debe tener entre 3 y 20 caracteres: letras, números, guion o guion bajo.' });
    }
    const name = String(b.name || '').trim().slice(0, 80);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 120);
    const discountPct = Number(b.discountPct);
    const commissionPct = Number(b.commissionPct);
    if (!name) return res.status(400).json({ error: 'Falta el nombre del vendedor.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'El correo del vendedor no es válido.' });
    if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > MAX_DISCOUNT_PCT) {
      return res.status(400).json({ error: `El descuento debe estar entre 0% y ${MAX_DISCOUNT_PCT}%.` });
    }
    if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct > MAX_COMMISSION_PCT) {
      return res.status(400).json({ error: `La comisión debe estar entre 0% y ${MAX_COMMISSION_PCT}%.` });
    }
    const ref = adminDb.collection('sellers').doc(code);
    const existing = await ref.get();
    if (b.isNew && existing.exists) return res.status(409).json({ error: `El código ${code} ya existe.` });
    const now = new Date().toISOString();
    await ref.set({
      code,
      name,
      email,
      discountPct: Math.round(discountPct * 100) / 100,
      commissionPct: Math.round(commissionPct * 100) / 100,
      active: b.active !== false,
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now })
    }, { merge: true });
    return res.json({ ok: true, code });
  } catch (err: any) {
    console.error('Error in POST /api/admin/vendedores:', err?.message);
    return res.status(500).json({ error: 'No se pudo guardar el vendedor.' });
  }
});

// Admin: marca como pagadas las comisiones pendientes de un código
app.post('/api/admin/vendedores/:code/pagar', requireAuth, requireAdminUser, async (req, res) => {
  try {
    if (!(await ensureFirestoreAdmin())) return res.status(503).json({ error: 'Firestore Admin no está autorizado.' });
    const code = normalizeCode(req.params.code);
    const snap = await adminDb.collection('seller_sales').where('code', '==', code).get();
    // Solo comisiones pendientes y con el plazo de retracto cumplido
    const pending = snap.docs.filter(d => d.data().status === 'pendiente' && isPastRetracto(d.data().createdAt));
    const now = new Date().toISOString();
    let total = 0;
    for (let i = 0; i < pending.length; i += 400) {
      const batch = adminDb.batch();
      pending.slice(i, i + 400).forEach(d => {
        total += Number(d.data().commission) || 0;
        batch.set(d.ref, { status: 'pagada', paidAt: now }, { merge: true });
      });
      await batch.commit();
    }
    return res.json({ ok: true, count: pending.length, total });
  } catch (err: any) {
    console.error('Error in /api/admin/vendedores/:code/pagar:', err?.message);
    return res.status(500).json({ error: 'No se pudieron marcar las comisiones.' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ImpulsaCap API', timestamp: new Date().toISOString() });
});

// Endpoint de verificación de permisos de firebase-admin en Firestore
app.get('/api/health/admin', async (req, res) => {
  try {
    await adminDb.collection('entitlements').limit(1).get();
    isFirestoreAdminAuthorized = true;
    return res.json({ firestoreAdmin: 'ok' });
  } catch (err: any) {
    isFirestoreAdminAuthorized = false;
    const message = err?.message || String(err);
    return res.json({ firestoreAdmin: 'error', message });
  }
});

// Setup Vite middleware in dev or static files in production

// Garantizar que ninguna ruta /api retorne HTML (evitar que caiga en el fallback SPA de Vite)
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `Ruta API ${req.method} ${req.path} no encontrada` });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ImpulsaCap Server running on port ${PORT} (mode: ${isProduction ? 'production' : 'development'})`);
  });
}

startServer();
