import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import { PDFParse } from 'pdf-parse';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { CHILEAN_FUNDS } from './src/data/chileanFunds';
import { evaluateChileanGrantMatch, isNonActivityQuery, normalizeText } from './src/utils/grantMatcher';
import { calculateDaysRemaining } from './src/utils/convocatorias';
import { validateRut, formatRut } from './src/utils/rutValidator';
import rateLimit from 'express-rate-limit';
import { 
  extractTaxFolderData, 
  isValidTaxRut, 
  isValidTaxCompanyName, 
  isValidTaxSales, 
  parseNumberCLP 
} from './server/taxFolderExtractor';

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
    return req.user?.uid || req.ip || 'anonymous';
  },
  message: { error: 'Has alcanzado el límite de 30 consultas de IA por minuto. Por favor, espera un momento antes de continuar.' }
});

app.use('/api/gemini/instant-match', instantMatchLimiter);
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

testFirestoreAdminConnection();

const mpAccessToken = process.env.MP_ACCESS_TOKEN || '';
const mpClient = new MercadoPagoConfig({ accessToken: mpAccessToken });
const preferenceClient = new Preference(mpClient);
const paymentClient = new Payment(mpClient);

export interface AuthenticatedRequest extends express.Request {
  user?: {
    uid: string;
    email?: string;
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
      email: decoded.email
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

// Middleware: verifica plan semestral activo
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
      return res.status(402).json({ error: 'Necesitas el Plan Semestral para usar esta herramienta' });
    }

    const expiresAt = new Date(data.expiresAt);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return res.status(402).json({ error: 'Necesitas el Plan Semestral para usar esta herramienta' });
    }

    return next();
  } catch (err: any) {
    console.error('Error in requireActivePlan:', err?.message);
    return res.status(402).json({ error: 'Necesitas el Plan Semestral para usar esta herramienta' });
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

    // Validar el límite de 3 postulaciones simultáneas del Plan Semestral
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
app.post('/api/gemini/instant-match', async (req, res) => {
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

    if (isNonActivityQuery(userPrompt)) {
      const nonAct = evaluateChileanGrantMatch(userPrompt, targetFundHint, filteredCalls, userProfile);
      return res.json({ ...nonAct, analizadoCon: 'reglas' });
    }

    const systemInstruction = `Eres el especialista sénior en fondos públicos y subsidios concursables de Chile (CORFO, SERCOTEC, ANID, Start-Up Chile, FIA).
Tu misión es recomendar el fondo más adecuado para el usuario basándote EXCLUSIVAMENTE en la lista de fondos oficiales permitidos en 'availableFunds'.

REGLAS ESTRICTAS DE NEGOCIO Y ADMISIBILIDAD:
1. SOLO puedes recomendar fondos presentes en 'availableFunds'. Usa EXACTAMENTE su 'id' y 'name' oficial tal como aparecen en los datos. Está ESTRICTAMENTE PROHIBIDO inventar nombres de fondos (por ejemplo, NUNCA uses "Semilla Inicia para Empresas Lideradas por Mujeres y Startups" ni variantes no existentes).
2. NO puedes inventar fechas ni plazos. Para las fechas ('whenToApply') y el estado ('status'), debes usar EXACTAMENTE los valores que vienen en 'callSchedule' y 'status' del fondo en 'availableFunds'. Si no hay fecha o callStatus es 'por_confirmar', responde "Próxima convocatoria por confirmar".
3. Si existe una convocatoria vigente de CORFO en la lista de 'CONVOCATORIAS VIGENTES', dale prioridad y haz referencia a sus días restantes y fecha oficial de cierre.
4. 'femaleBonusEligible': debe ser true ÚNICAMENTE si el usuario declaró EXPLÍCITAMENTE en su texto que la empresa está liderada por mujeres, que es una emprendedora mujer o que cuenta con socias mayoritarias. NUNCA lo asumas si el texto no lo dice expresamente.
5. Si el fondo recomendado es 'sercotec_abeja_emprende', este fondo es exclusivo de mujeres.
6. Devuelve un JSON estructurado con el match principal y alternativas válidas de 'availableFunds'.`;

    const prompt = `FONDOS OFICIALES DISPONIBLES:
${JSON.stringify(availableFunds, null, 2)}

CONVOCATORIAS VIGENTES FILTRADAS PARA ESTA EMPRESA:
${JSON.stringify(filteredCalls.slice(0, 6).map(c => ({
  id: c.id,
  titulo: c.titulo,
  alcance: c.alcance,
  cierre: c.cierre,
  fundId: c.fundId,
  tope_aprox: c.tope_aprox,
  url: c.url
})), null, 2)}

DESCRIPCIÓN DEL USUARIO:
"""${userPrompt}"""
${targetFundHint ? `(Preferencia indicada: ${targetFundHint})` : ''}

Responde ÚNICAMENTE en JSON con este formato estricto:
{
  "isValidProject": true,
  "wowHeadline": "¡Calificas directamente para [Nombre exacto del fondo en availableFunds]!",
  "primaryFund": {
    "fundId": "id_del_fondo_en_availableFunds",
    "fundName": "Nombre exacto del fondo en availableFunds",
    "agency": "CORFO | SERCOTEC | ANID | START-UP CHILE | FIA",
    "subsidyFormatted": "$XX.XXX.XXX CLP",
    "maxSubsidyCLP": 15000000,
    "coFinancePct": 75,
    "whenToApply": "Valor exacto de callSchedule o 'Próxima convocatoria por confirmar'",
    "status": "Valor exacto de status",
    "matchScore": 94,
    "whyYouQualify": "Explicación concreta de calce según rubro y ventas.",
    "femaleBonusEligible": false,
    "femaleBonusText": "+10% Bonificación Género CORFO/SERCOTEC (solo si aplica explícitamente)"
  },
  "secondaryFunds": [
    {
      "fundId": "id_alternativa",
      "fundName": "Nombre exacto alternativa en availableFunds",
      "agency": "CORFO",
      "subsidyFormatted": "$XX.XXX.XXX CLP",
      "whenToApply": "Valor exacto de callSchedule o 'Próxima convocatoria por confirmar'",
      "status": "Valor exacto de status",
      "matchScore": 82
    }
  ],
  "actionCallout": "Acción recomendada"
}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const text = response.text || '';
    if (!text) throw new Error('Respuesta vacía de Gemini');
    const parsed = JSON.parse(text);

    // Ensure 2 or 3 solid qualification reasons for primary fund
    if (parsed.primaryFund) {
      const fundMatch = availableFunds.find((f: any) => f.id === parsed.primaryFund.fundId);
      if (!Array.isArray(parsed.primaryFund.reasons) || parsed.primaryFund.reasons.length < 2) {
        parsed.primaryFund.reasons = [
          parsed.primaryFund.whyYouQualify || 'Cumple con el nivel de ventas y etapa técnica exigidos por las bases.',
          `Cofinancia hasta el ${parsed.primaryFund.coFinancePct || fundMatch?.maxCoFinancePct || 75}% del proyecto con subsidio estatal.`,
          `Estado de la convocatoria: ${parsed.primaryFund.whenToApply || fundMatch?.callSchedule || 'Próxima convocatoria por confirmar'}.`
        ];
      }
    }

    // Ensure secondary funds have subsidy, cofinancing, status and 2-3 reasons
    if (Array.isArray(parsed.secondaryFunds)) {
      parsed.secondaryFunds = parsed.secondaryFunds.slice(0, 2).map((sec: any) => {
        const matchingDb = availableFunds.find((f: any) => f.id === sec.fundId);
        const coFin = sec.coFinancePct || matchingDb?.maxCoFinancePct || 75;
        const sub = sec.subsidyFormatted || matchingDb?.subsidyFormatted || '$15.000.000 CLP';
        const st = matchingDb?.status || sec.status || 'Convocatoria 2026';
        const sch = matchingDb?.callSchedule || sec.whenToApply || 'Próxima convocatoria por confirmar';
        const reasonsList = Array.isArray(sec.reasons) && sec.reasons.length >= 2
          ? sec.reasons
          : [
              `Alternativa complementaria con subsidio de hasta ${sub} (${coFin}% de cofinanciamiento).`,
              `Convocatoria oficial: ${sch} según bases de ${matchingDb?.agency || sec.agency || 'la agencia'}.`
            ];
        return {
          ...sec,
          subsidyFormatted: sub,
          coFinancePct: coFin,
          status: st,
          whenToApply: sch,
          reasons: reasonsList
        };
      });
    }

    // Resolver convocatoria regional oficial desde Firestore si calza con el perfil o consulta
    let liveRegionalCallMatch: any = undefined;
    if (filteredCalls.length > 0) {
      // Priorizar la convocatoria que corresponde al fondo recomendado por Gemini
      const directMatch = filteredCalls.find(c => c.fundId === parsed.primaryFund?.fundId);
      const chosenCall = directMatch || filteredCalls[0];

      if (chosenCall) {
        liveRegionalCallMatch = {
          id: chosenCall.id,
          titulo: chosenCall.titulo,
          alcance: chosenCall.alcance,
          cierre: chosenCall.cierre,
          topeAprox: chosenCall.tope_aprox || chosenCall.topeAprox,
          url: chosenCall.url,
          vigente: chosenCall.vigente,
          diasRestantes: calculateDaysRemaining(chosenCall.cierre),
          beneficioResumen: chosenCall.resumen || chosenCall.beneficio,
        };
      }
    }

    return res.json({ 
      ...parsed, 
      liveRegionalCallMatch: liveRegionalCallMatch || parsed.liveRegionalCallMatch,
      analizadoCon: 'ia' 
    });
  } catch (err: any) {
    console.error('Error in /api/gemini/instant-match:', err?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});


// 0.1 Lector Inteligente de Carpeta Tributaria Electrónica SII (PDF o Texto)
app.post('/api/gemini/parse-tax-folder', requireAuth, async (req, res) => {
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

    // Extracción determinista de base sin valores inventados (Requirement 1, 2, 3)
    const deterministicData = extractTaxFolderData(extractedText || rawText || '', fileName);
    let finalResult: any = { ...deterministicData, analizadoCon: 'sii-parser' };

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
app.post('/api/gemini/diagnose', requireAuth, async (req, res) => {
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
app.post('/api/gemini/formulate', requireAuth, requireActivePlan, async (req, res) => {
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

REQUISITOS DEL FONDO ${fund.name}:
- Subsidio Máximo: ${fund.subsidyFormatted}
- Co-financiamiento: ${fund.maxCoFinancePct}%
- Criterios de Evaluación: ${JSON.stringify(fund.evaluationCriteria)}
- Cuentas Presupuestarias Aprobadas: ${JSON.stringify(fund.corfoAccountsBudget)}

Responde ÚNICAMENTE en formato JSON con la siguiente estructura completa:
{
  "fundId": "${fund.id}",
  "fundName": "${fund.name}",
  "projectTitle": "Título potente y técnico del proyecto (máx 15 palabras)",
  "pitchSummary30s": "Elevator pitch de alto impacto para el jurado (1 párrafo contundente)",
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
app.post('/api/gemini/formulate-section', requireAuth, requireActivePlan, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const fundId = req.body?.fund?.id;
    if (fundId) {
      const slotCheck = await checkAndRegisterPostulationSlot(user.uid, fundId);
      if (!slotCheck.ok) {
        return res.status(429).json({ error: slotCheck.error });
      }
    }

    const { profile, fund, sectionKey, sectionTitle, questionsAndAnswers, projectSummary } = req.body;
    if (!profile || !fund || !sectionKey) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos para formular la sección.' });
    }

    const qaText = questionsAndAnswers && typeof questionsAndAnswers === 'object'
      ? Object.entries(questionsAndAnswers)
          .map(([q, a]) => `- Pregunta: ${q}\n  Respuesta del usuario: ${a || 'No especificado por el usuario'}`)
          .join('\n')
      : 'No se ingresaron respuestas adicionales.';

    const prompt = `Eres el redactor y formulador de proyectos número 1 de Chile, especialista en adjudicaciones en ${fund.agency} (CORFO, SERCOTEC, Start-Up Chile).

Tu misión es redactar con excelencia técnica la sección "${sectionTitle || sectionKey}" para postular al fondo "${fund.name}".

DATOS DE LA EMPRESA Y POSTULANTE:
- Empresa: ${profile.companyName || 'Empresa postulante'}
- Tipo Societario: ${profile.companyType}
- Ventas 12 meses: ${profile.salesBracket}
- Etapa del Proyecto / TRL: ${profile.trlStage}
- Liderazgo Femenino: ${profile.isFemaleLed ? 'Sí (califica a bonificación)' : 'No'}
- Resumen Base del Proyecto: ${profile.projectSummary || projectSummary || ''}

RESPUESTAS CLAVE INGRESADAS POR EL USUARIO PARA ESTA SECCIÓN:
${qaText}

REQUISITOS Y BASES DEL FONDO ${fund.name} (${fund.agency}):
- Subsidio: ${fund.subsidyFormatted}
- Co-financiamiento: ${fund.maxCoFinancePct}%

REGLA CRÍTICA OBLIGATORIA:
PROHIBIDO INVENTAR CIFRAS, MONTOS O MÉTRICAS FICTICIAS: Si falta algún dato específico o métrica numérica que el usuario no haya proporcionado en sus respuestas o perfil, escribe exactamente [COMPLETAR: descripción del dato faltante] en vez de inventar números, porcentajes o cifras que el evaluador pueda impugnar.

Redacta el texto técnico con vocabulario formal de postulación pública chilena (rigor técnico, impacto económico, viabilidad y pertinencia).

Responde ÚNICAMENTE en formato JSON con la siguiente estructura:
{
  "sectionKey": "${sectionKey}",
  "sectionTitle": "${sectionTitle || sectionKey}",
  "generatedText": "Texto formal y técnico completo de la sección redactado en 2 o 3 párrafos sólidos...",
  "keyHighlights": [
    "Punto fuerte 1 para el comité evaluador",
    "Punto fuerte 2"
  ],
  "missingData": [
    "Detalle de campos marcados como [COMPLETAR: ...] si corresponde"
  ]
}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const respText = response.text || '';
    if (!respText) throw new Error('Respuesta vacía de Gemini');
    const parsed = JSON.parse(respText);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/formulate-section:', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

app.post('/api/gemini/audit', requireAuth, requireActivePlan, async (req, res) => {
  try {
    const { fund, formulationText, projectSummary } = req.body;

    const prompt = `Actúa como un Evaluador Experto del Comité de Asignación de Fondos de ${fund.agency} (CORFO / SERCOTEC).
Tu misión es realizar una auditoría ciega estricta y sin condescendencia sobre la siguiente postulación para el fondo "${fund.name}".

TEXTO Y CONTENIDO DE LA POSTULACIÓN:
"""
${formulationText || projectSummary}
"""

CRITERIOS OFICIALES DE EVALUACIÓN:
${JSON.stringify(fund.evaluationCriteria, null, 2)}

INSTRUCCIONES DE AUDITORÍA:
1. Evalúa de 1.0 a 5.0 (escala estándar CORFO). Recuerda que la nota de corte suele estar sobre 3.8.
2. Identifica "Red Flags" (alertas rojas que causarían rechazo o admisibilidad fallida).
3. Entrega consejos quirúrgicos prioritarios para subir la nota antes de postular.

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
app.post('/api/gemini/generate-doc', requireAuth, requireActivePlan, async (req, res) => {
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
      taxFolderSummary
    } = req.body;

    const prompt = `Eres un abogado y consultor corporativo experto en tramitación de subsidios públicos en Chile (CORFO, SERCOTEC, ANID, Start-Up Chile).
Genera un documento formal, listo para firmar o presentar, de tipo: "${documentType || 'Carta de Manifestación de Interés Comercial (LOI)'}".

INSTRUCCIONES Y REGLAS ESTRICTAS:
1. Usa ÚNICAMENTE los datos entregados en este prompt. No inventes antecedentes de clientes ficticios, cifras no sustentadas ni datos no provistos.
2. Donde falte un dato específico que deba completar el usuario o la contraparte, escribe explícitamente [COMPLETAR: descripción del dato faltante] (por ejemplo: [COMPLETAR: RUT de la contraparte], [COMPLETAR: Cargo del firmante], [COMPLETAR: Fecha de firma]).
3. Diseña el documento conforme a las Bases Administrativas y Técnicas del concurso: ${fundName || 'CORFO / SERCOTEC'}.

DATOS ENTREGADOS DE LA POSTULACIÓN:
- Empresa Postulante: ${companyName || '[COMPLETAR: Razón Social de la Empresa]'}
- RUT Empresa: ${details?.rut || '[COMPLETAR: RUT Empresa]'}
- Representante Legal Empresa: ${legalRepName || '[COMPLETAR: Nombre del Representante Legal]'}
- RUT Representante Legal: ${legalRepRut || '[COMPLETAR: RUT del Representante Legal]'}
- Ciudad: ${city || details?.city || '[COMPLETAR: Ciudad]'}
- Región: ${details?.region || '[COMPLETAR: Región]'}
- Contraparte / Cliente Piloto o Aliado: ${clientOrPartnerName || '[COMPLETAR: Razón Social o Nombre del Cliente / Aliado]'}
- Nombre y Cargo del Contacto Contraparte: ${details?.clientContact || '[COMPLETAR: Nombre y Cargo del Representante de la Contraparte]'}
- Nombre del Proyecto: ${projectName || '[COMPLETAR: Nombre del Proyecto]'}
- Fondo Concursable al que se postula: ${fundName || '[COMPLETAR: Nombre del Fondo Concursable]'}
- Sector Económico: ${details?.sector || 'No especificado'}
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
app.post('/api/gemini/chat', requireAuth, requireActivePlan, async (req, res) => {
  try {
    const { messages, companyProfile, currentFund } = req.body;

    const systemInstruction = `Eres "ImpulsaCap AI", el consultor de fondos concursables más experimentado de Chile.
Conoces en profundidad:
- Todo el ecosistema de financiamiento público chileno: CORFO (Semilla Inicia, Semilla Expande, Innova Alta Tecnología, Crea y Valida, Súmate a Innovar), SERCOTEC (Capital Semilla, Abeja, Crece), ANID (Fondef), Start-Up Chile (Build, Ignite, Growth), FIA, Sence y ProChile.
- Bases Administrativas Generales (BAG) y resoluciones exentas de CORFO.
- Ley de I+D (Ley 20.241 con beneficio tributario del 35% de crédito sobre impuesto de 1ª categoría).
- Criterios de admisibilidad legal: F29 del SII, Carpeta Tributaria Electrónica, estatuto en Tu Empresa en un Día, certificados de TGR y Dirección del Trabajo F30.
- Rendición de cuentas financieras: Cuentas de Recursos Humanos, Gastos de Operación, Inversión y Administración, garantías o pagarés ante CORFO, anticipos y pólizas de seguro de fianza.

Contexto actual de la empresa:
${JSON.stringify(companyProfile || {}, null, 2)}

Fondo en consulta:
${JSON.stringify(currentFund || {}, null, 2)}

Sé conciso, empático, directo y ultra práctico. Habla con terminología chilena natural pero muy profesional (UF, CLP, RUT, SpA, SII, TGR, rendición, contraparte, cofinanciamiento).`;

    // Convert chat history
    const formattedContents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

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
    console.error('Error in /api/gemini/chat:', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

// 5b. Robot de Ayuda de la Plataforma (Público, sin sesión ni plan requerido - Requirement 2)
app.post('/api/ayuda/chat', async (req, res) => {
  try {
    const message = req.body?.message;
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }
    if (message.length > 500) {
      return res.status(400).json({ error: 'El mensaje no puede superar los 500 caracteres.' });
    }

    const systemInstruction = `Eres el Robot de Ayuda de ImpulsaCap, el asistente de soporte técnico y guía de navegación de la plataforma web.

BASE DE CONOCIMIENTO OFICIAL DE IMPULSACAP:
1. ¿CÓMO FUNCIONA LA PLATAFORMA?:
ImpulsaCap es la plataforma digital chilena que guía a emprendedores y empresas paso a paso para postular a fondos concursables (CORFO, SERCOTEC, ANID, Start-Up Chile, FIA).
Funciona mediante una Hoja de Ruta en 6 pasos estructurados:
- Paso 1: Validación Tributaria y SII (se valida RUT con Módulo 11 y se vincula la Carpeta Tributaria Electrónica F29 del SII).
- Paso 2: Acreditación Legal y Cartas de Interés (estatutos sociales y cartas LOI de clientes para pertinencia comercial).
- Paso 3: Formulación Técnica con IA (redacción guiada bajo las rúbricas y criterios de comités evaluadores).
- Paso 4: Presupuesto y Cuentas Oficiales (cuentas de Recursos Humanos, Operación, Inversión y Administración, con topes porcentuales y garantías).
- Paso 5: Auditoría Ciega (simulación del comité con nota de 1.0 a 5.0 para detectar debilidades antes de postular).
- Paso 6: Expediente en PDF consolidado y listo para copiar o adjuntar en e-CORFO o SERCOTEC.

2. PLAN SEMESTRAL Y PRECIOS:
- Precio normal: $39.990 CLP semestral.
- Descuento Primera Compra: 50% de descuento automático en la primera compra, quedando en $19.990 CLP.
- Pago único mediante Mercado Pago (Webpay, tarjetas de crédito y débito).
- NO tiene renovación automática ni cobros recurrentes sorpresa.
- Vigencia: 6 meses de acceso completo a todas las funciones.
- Límite: Permite hasta 3 postulaciones activas simultáneas por empresa (se pueden archivar postulaciones terminadas para liberar cupos).
- Incluye: Formulación técnica con IA ilimitada, Auditor ciego, Gestor de cartas de interés (LOI), Expediente en PDF y Asesor Experto por postulación.

3. CÓMO CREAR CUENTA:
Hacer clic en "Registrarse" o "Crear Cuenta de Empresa" e ingresar el nombre de la empresa, RUT, correo y contraseña. Los datos quedan protegidos en una bóveda privada.

4. CÓMO SUBIR LA CARPETA TRIBUTARIA:
Ir a "Mi empresa" o al Paso 1 de una postulación. Descargar gratis la "Carpeta Tributaria para Solicitar Créditos" (PDF o XML) desde www.sii.cl y subirla a ImpulsaCap. El sistema lee el RUT, razón social, inicio de actividades en 1ª categoría, antigüedad y ventas de los últimos 12 meses, mostrando una pantalla de confirmación con datos editables antes de guardar.

5. PRIVACIDAD DE DATOS:
La Carpeta Tributaria y los antecedentes de la empresa se procesan bajo cifrado para el cálculo exclusivo de admisibilidad de las postulaciones. Nunca se comparten con terceros ni se usan para entrenar modelos públicos.

REGLAS ESTRICTAS DE RESPUESTA:
- SOLO responde preguntas sobre el funcionamiento de la plataforma ImpulsaCap, navegación, Hoja de Ruta, planes, precios, pagos, registro, subida de documentos y privacidad.
- Si te preguntan sobre fondos específicos, requisitos particulares de un concurso, bases administrativas, fechas de cierre, montos de subsidio, cómo redactar un proyecto o cómo ganar un fondo, DEBES responder EXACTAMENTE la siguiente frase sin agregar nada más:
"Eso lo resuelve el Asesor Experto, disponible dentro de cada postulación con el Plan Semestral."
- Respuestas cortas, amables y directas (máximo 120 palabras).
- NUNCA inventes información. Si no sabes la respuesta o no está en esta base de conocimiento, responde que no dispones de esa información y sugiere escribir a soporte.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: message.trim() }] }],
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 300
      }
    });

    const reply = response.text?.trim() || '';
    if (!reply) throw new Error('Respuesta vacía de Gemini');

    const isExpertRedirect = reply.includes('Eso lo resuelve el Asesor Experto, disponible dentro de cada postulación con el Plan Semestral');

    return res.json({
      reply,
      isExpertRedirect
    });
  } catch (error: any) {
    console.error('Error in /api/ayuda/chat:', error?.message);
    return res.status(503).json({ error: 'El servicio de ayuda no está disponible en este momento. Intenta nuevamente en unos minutos.' });
  }
});

// Health check

// -------------------------------------------------------------
// MERCADO PAGO CHECKOUT PRO & SUBSCRIPTION ENDPOINTS
// -------------------------------------------------------------

// Consulta de estado de precios (determina si es primera compra para cobrar $19.990 o $39.990)
app.get('/api/pagos/estado', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    let isFirstPurchase = true;

    if (isFirestoreAdminAuthorized) {
      try {
        const snap = await adminDb.collection('payments')
          .where('uid', '==', user.uid)
          .where('status', '==', 'approved')
          .limit(1)
          .get();
        isFirstPurchase = snap.empty;
      } catch {
        isFirstPurchase = true;
      }
    } else {
      isFirstPurchase = true;
    }

    const price = isFirstPurchase ? 19990 : 39990;
    return res.json({ isFirstPurchase, price });
  } catch {
    return res.json({ isFirstPurchase: true, price: 19990 });
  }
});

// Crear preferencia de pago Mercado Pago Checkout Pro
app.post('/api/pagos/crear', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    if (!mpAccessToken) {
      return res.status(500).json({ error: 'Mercado Pago no está configurado (MP_ACCESS_TOKEN ausente).' });
    }

    // El precio lo define SOLO el servidor
    let isFirstPurchase = true;
    if (isFirestoreAdminAuthorized) {
      try {
        const snap = await adminDb.collection('payments')
          .where('uid', '==', user.uid)
          .where('status', '==', 'approved')
          .limit(1)
          .get();
        isFirstPurchase = snap.empty;
      } catch {
        isFirstPurchase = true;
      }
    } else {
      isFirstPurchase = true;
    }
    const price = isFirstPurchase ? 19990 : 39990;

    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const appUrl = (process.env.APP_URL || `${protocol}://${host}`).replace(/\/$/, '');

    const externalReference = `${user.uid}:semestral:${Date.now()}`;

    const preferenceData = {
      items: [
        {
          id: 'plan_semestral_impulsacap',
          title: 'Plan Semestral ImpulsaCap',
          description: 'Acceso completo por 6 meses a todas las herramientas de formulación, auditoría y dossier oficial (pago único no renovable).',
          quantity: 1,
          unit_price: price,
          currency_id: 'CLP',
        }
      ],
      payer: {
        email: user.email || undefined,
      },
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
    if (!paymentInfo || paymentInfo.status !== 'approved') {
      console.log(`Payment ${paymentId} status: ${paymentInfo?.status}`);
      return res.status(200).send('OK');
    }

    // Verificación estricta (Requirement 8): moneda CLP y monto 19990 o 39990
    const transactionAmount = Number(paymentInfo.transaction_amount);
    const isCurrencyValid = paymentInfo.currency_id === 'CLP';
    const isAmountValid = transactionAmount === 19990 || transactionAmount === 39990;

    if (!isCurrencyValid || !isAmountValid) {
      console.warn(`Payment ${paymentId} rechazado_validacion: currency_id=${paymentInfo.currency_id}, amount=${transactionAmount}`);
      try {
        if (isFirestoreAdminAuthorized) {
          const externalRef = paymentInfo.external_reference || '';
          const uid = externalRef.split(':')[0] || 'unknown';
          await adminDb.collection('payments').doc(String(paymentId)).set({
            uid,
            amount: isNaN(transactionAmount) ? 0 : transactionAmount,
            currencyId: paymentInfo.currency_id || 'unknown',
            status: 'rechazado_validacion',
            rejectedAt: new Date().toISOString(),
            reason: !isCurrencyValid ? 'Moneda no es CLP' : 'Monto no corresponde a plan oficial (19.990 o 39.990)',
            externalReference: externalRef
          }, { merge: true });
        }
      } catch (dbErr: any) {
        console.error('Error al registrar pago rechazado en Firestore:', dbErr?.message);
      }
      // Responde 200 (no 400), para que Mercado Pago no reintente indefinidamente
      return res.status(200).json({ status: 'rechazado_validacion', message: 'Notificación procesada y descartada por validación de monto o moneda.' });
    }

    const externalRef = paymentInfo.external_reference || '';
    const uid = externalRef.split(':')[0];
    if (!uid) {
      console.warn('Payment approved but no UID in external_reference:', externalRef);
      return res.status(400).json({ error: 'external_reference inválido' });
    }

    // Idempotencia: si ese paymentId ya fue procesado, responder 200 de inmediato
    const paymentDocRef = adminDb.collection('payments').doc(String(paymentId));
    const existingPayment = await paymentDocRef.get();
    if (existingPayment.exists && existingPayment.data()?.status === 'approved') {
      console.log(`Payment ${paymentId} was already processed`);
      return res.status(200).send('OK');
    }

    // Guardar payments/{paymentId}: { uid, amount, currencyId, status, approvedAt }
    await paymentDocRef.set({
      uid,
      amount: transactionAmount,
      currencyId: paymentInfo.currency_id,
      status: 'approved',
      approvedAt: paymentInfo.date_approved || new Date().toISOString(),
      paymentMethodId: paymentInfo.payment_method_id || 'unknown',
      externalReference: externalRef
    });

    // Escribir entitlements/{uid}: { plan: "semestral", status: "active", expiresAt, lastPaymentId }
    // expiresAt = 6 meses desde aprobación; si ya tenía plan vigente, suma 6 meses al expiresAt actual
    const entRef = adminDb.collection('entitlements').doc(uid);
    const currentEntDoc = await entRef.get();
    let baseDate = new Date(paymentInfo.date_approved || Date.now());
    if (currentEntDoc.exists) {
      const curData = currentEntDoc.data();
      if (curData?.status === 'active' && curData?.expiresAt) {
        const curExp = new Date(curData.expiresAt);
        if (!isNaN(curExp.getTime()) && curExp.getTime() > baseDate.getTime()) {
          baseDate = curExp;
        }
      }
    }

    const expiresAt = new Date(baseDate);
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    await entRef.set({
      plan: 'semestral',
      status: 'active',
      expiresAt: expiresAt.toISOString(),
      lastPaymentId: String(paymentId),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`Plan semestral activated for user ${uid} until ${expiresAt.toISOString()}`);
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

    return res.json({
      success: true,
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
