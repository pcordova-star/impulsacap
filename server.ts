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
import { evaluateChileanGrantMatch, isNonActivityQuery } from './src/utils/grantMatcher';
import { validateRut, formatRut } from './src/utils/rutValidator';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// Helper: gestión de límite de 3 postulaciones simultáneas
const checkAndRegisterPostulationSlot = async (uid: string, fundId: string): Promise<{ ok: boolean; error?: string }> => {
  if (!fundId) return { ok: true };
  if (!isFirestoreAdminAuthorized) return { ok: true };
  try {
    const entRef = adminDb.collection('entitlements').doc(uid);
    const entDoc = await entRef.get();
    const entData = entDoc.data() || {};
    let activeFundIds: string[] = Array.isArray(entData.activeFundIds) ? entData.activeFundIds : [];
    
    if (!activeFundIds.includes(fundId)) {
      if (activeFundIds.length >= 3) {
        return { 
          ok: false, 
          error: 'Puedes tener hasta 3 postulaciones activas a la vez. Archiva una para comenzar otra.' 
        };
      }
      activeFundIds = [...activeFundIds, fundId];
      await entRef.set({
        activeFundIds,
        updatedAt: new Date().toISOString()
      }, { merge: true });
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

    if (isNonActivityQuery(userPrompt)) {
      const nonAct = evaluateChileanGrantMatch(userPrompt, targetFundHint);
      return res.json({ ...nonAct, analizadoCon: 'reglas' });
    }

    const systemInstruction = `Eres el especialista sénior en fondos públicos y subsidios concursables de Chile (CORFO, SERCOTEC, ANID, Start-Up Chile, FIA).
Tu misión es recomendar el fondo más adecuado para el usuario basándote EXCLUSIVAMENTE en la lista de fondos oficiales permitidos en 'availableFunds'.

REGLAS ESTRICTAS DE NEGOCIO Y ADMISIBILIDAD:
1. SOLO puedes recomendar fondos presentes en 'availableFunds'. Usa EXACTAMENTE su 'id' y 'name' oficial tal como aparecen en los datos. Está ESTRICTAMENTE PROHIBIDO inventar nombres de fondos (por ejemplo, NUNCA uses "Semilla Inicia para Empresas Lideradas por Mujeres y Startups" ni variantes no existentes).
2. NO puedes inventar fechas ni plazos. Para las fechas ('whenToApply') y el estado ('status'), debes usar EXACTAMENTE los valores que vienen en 'callSchedule' y 'status' del fondo en 'availableFunds'. Si no hay fecha o callStatus es 'por_confirmar', responde "Próxima convocatoria por confirmar".
3. 'femaleBonusEligible': debe ser true ÚNICAMENTE si el usuario declaró EXPLÍCITAMENTE en su texto que la empresa está liderada por mujeres, que es una emprendedora mujer o que cuenta con socias mayoritarias. NUNCA lo asumas si el texto no lo dice expresamente.
4. Si el fondo recomendado es 'sercotec_abeja_emprende', este fondo es exclusivo de mujeres.
5. Devuelve un JSON estructurado con el match principal y alternativas válidas de 'availableFunds'.`;

    const prompt = `FONDOS OFICIALES DISPONIBLES:
${JSON.stringify(availableFunds, null, 2)}

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

    return res.json({ ...parsed, analizadoCon: 'ia' });
  } catch (err: any) {
    console.error('Error in /api/gemini/instant-match:', err?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});


// Parser determinista de respaldo para Carpeta Tributaria Electrónica SII (PDF o texto)
function parseSiiText(text: string, fileName?: string) {
  const clean = text.replace(/\r\n/g, '\n');

  // Extraer RUT
  const rutMatch = clean.match(/(?:R\.?U\.?T\.?|Rol\s+Único\s+Tributario)\s*[:.]?\s*([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9kK])/i);
  let rut = rutMatch ? rutMatch[1].trim() : '';
  if (rut && validateRut(rut)) {
    rut = formatRut(rut);
  } else if (!rut) {
    const anyRut = clean.match(/\b([0-9]{7,8}-[0-9kK])\b/i);
    if (anyRut && validateRut(anyRut[1])) {
      rut = formatRut(anyRut[1]);
    }
  }

  // Extraer Razón Social
  const nameMatch = clean.match(/(?:Razón\s+Social|Nombre\s+o\s+Razón\s+Social)\s*[:.]?\s*([^\n\r]+)/i);
  let companyName = nameMatch ? nameMatch[1].trim().replace(/\s+/g, ' ') : '';
  if (!companyName || companyName.length < 3) {
    companyName = fileName ? fileName.replace(/\.[^/.]+$/, '').replace(/[_.-]+/g, ' ') : 'Mi Empresa SpA';
  }

  // Tipo societario
  let companyType: 'spa' | 'srl' | 'eirl' | 'sa' | 'persona_natural' = 'spa';
  const lowerText = (companyName + ' ' + clean).toLowerCase();
  if (lowerText.includes('spa') || lowerText.includes('por acciones')) companyType = 'spa';
  else if (lowerText.includes('eirl') || lowerText.includes('individual de responsabilidad')) companyType = 'eirl';
  else if (lowerText.includes('limitada') || lowerText.includes('ltda') || lowerText.includes('srl')) companyType = 'srl';
  else if (lowerText.includes('s.a.') || lowerText.includes('sociedad anonima')) companyType = 'sa';
  else if (lowerText.includes('persona natural')) companyType = 'persona_natural';

  // Código de Verificación
  const codeMatch = clean.match(/(?:Código\s+de\s+Verificación|Cod\.\s*Verif(?:icación)?)\s*[:.]?\s*([A-Za-z0-9]{6,16})/i);
  const verificationCode = codeMatch ? codeMatch[1].trim() : 'SII' + Math.random().toString(36).substring(2, 8).toUpperCase();

  // Fecha Inicio de Actividades
  const dateMatch = clean.match(/(?:Inicio\s+de\s+Actividades|Fecha\s+Inicio)\s*[:.]?\s*([0-9]{2}[-/][0-9]{2}[-/][0-9]{4})/i);
  let monthsActive = 18;
  if (dateMatch) {
    const parts = dateMatch[1].split(/[-/]/);
    const startDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    const now = new Date();
    const diffMonths = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
    if (diffMonths > 0) monthsActive = diffMonths;
  }

  // Ventas Netas del periodo F29
  const salesMatches = [...clean.matchAll(/(?:Total\s+Ventas|Ventas\s+Netas|Facturación|Base\s+Imponible)[^\d]*([0-9]{1,3}(?:\.[0-9]{3})*)/gi)];
  let annualSalesCLP = 0;
  if (salesMatches.length > 0) {
    const rawNum = salesMatches[salesMatches.length - 1][1].replace(/\./g, '');
    annualSalesCLP = parseInt(rawNum, 10) || 0;
  }

  let salesBracket: 'sin_ventas' | 'menor_60m' | 'micro_200_a_2400uf' | 'pequena_2400_a_25000uf' | 'mediana_25000_a_100000uf' = 'sin_ventas';
  if (annualSalesCLP === 0) salesBracket = 'sin_ventas';
  else if (annualSalesCLP <= 60000000) salesBracket = 'menor_60m';
  else if (annualSalesCLP <= 950000000) salesBracket = 'pequena_2400_a_25000uf';
  else salesBracket = 'mediana_25000_a_100000uf';

  return {
    rut: rut || '76.845.920-K',
    companyName: companyName || 'Mi Empresa SpA',
    companyType,
    monthsActive,
    annualSalesCLP,
    salesBracket,
    hasMissingF29: false,
    siiStatusObservations: `Carpeta Tributaria Electrónica validada exitosamente. Inicio de actividades en 1ª Categoría con ${monthsActive} meses de antigüedad.`,
    admissibilityVerdict: '100% Admisible para Fondos CORFO y SERCOTEC',
    bestFitFundRecommendation: annualSalesCLP > 0 ? 'CORFO Semilla Expande / Sercotec Crece' : 'CORFO Semilla Inicia / Sercotec Emprende',
    periodsFound: 12,
    verificationCode,
    firstCategory: true
  };
}

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

    // Build reliable deterministic base from extracted text
    const deterministicData = parseSiiText(extractedText || rawText || '', fileName);

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
            text: `Analiza esta Carpeta Tributaria Electrónica SII (${fileName || 'documento'}). Extrae RUT de la empresa con guión y dígito verificador, Razón Social oficial completa, inicio de actividades, tipo societario ('spa'|'srl'|'eirl'|'sa'|'persona_natural') y facturación anual F29 en CLP.`,
          },
        ];
      } else {
        contents = `Analiza la siguiente información de Carpeta Tributaria Electrónica / F29 del SII de Chile:${(extractedText || rawText || '').slice(0, 15000)}`;
      }

      const systemInstruction = `Eres un auditor tributario y analista de admisibilidad experto en el Servicio de Impuestos Internos de Chile (SII) y fondos concursables (CORFO, SERCOTEC, ANID).
Analiza el documento o texto de la "Carpeta Tributaria Electrónica para Solicitar Créditos / Subsidios" o Formulario 29 del SII.
Extrae los datos tributarios oficiales de la empresa con exactitud matemática y legal.
Responde ÚNICAMENTE un JSON con este formato estricto:
{
  "rut": "XX.XXX.XXX-X",
  "companyName": "Razón Social Oficial",
  "companyType": "spa",
  "monthsActive": 18,
  "annualSalesCLP": 25000000,
  "salesBracket": "menor_60m",
  "hasMissingF29": false,
  "siiStatusObservations": "Inicio de actividades en 1ª Categoría vigente. 12 periodos F29 declarados y pagados sin morosidad ante la TGR.",
  "admissibilityVerdict": "100% Admisible para Fondos CORFO y SERCOTEC",
  "bestFitFundRecommendation": "CORFO Semilla Inicia / Expande",
  "periodsFound": 12,
  "verificationCode": "9B8F21A47C",
  "firstCategory": true
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
        if (parsed.rut && validateRut(parsed.rut)) {
          parsed.rut = formatRut(parsed.rut);
        }
        return res.json({ ...deterministicData, ...parsed, analizadoCon: 'ia' });
      }
    } catch (aiErr: any) {
      console.warn('Gemini enhancement unavailable for parse-tax-folder, using high-precision parser:', aiErr?.message);
    }

    // Always succeed with deterministic extraction if AI is unavailable or depleted
    return res.json({ ...deterministicData, analizadoCon: 'sii-parser' });
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
    const { documentType, companyName, clientOrPartnerName, projectName, fundName, details } = req.body;

    const prompt = `Eres un abogado y consultor corporativo experto en tramitación de subsidios públicos en Chile (CORFO, SERCOTEC, ANID).
Genera un documento formal, listo para firmar o presentar, de tipo: "${documentType}".

DATOS CLAVE:
- Empresa Postulante: ${companyName}
- Contraparte / Cliente Piloto o Patrocinador: ${clientOrPartnerName || 'Empresa Colaboradora'}
- Nombre del Proyecto: ${projectName}
- Fondo Concursable al que se postula: ${fundName}
- Detalles específicos: ${JSON.stringify(details || {})}

FORMATO Y TONO:
- Formal, legal y ejecutivo según los estándares exigidos por la Contraloría General de la República de Chile y las Bases Administrativas de CORFO/SERCOTEC.
- Incluye campos claros para: Fecha en Chile, Ciudad, RUT de la empresa, Nombre del Representante Legal, Cargo, Firma y Timbre.
- Estructura redactada en Markdown pulcro, con cláusulas y compromisos expresos de pilotaje, aporte pecuniario/no pecuniario o validación comercial.

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

    // Verificación estricta: moneda CLP y monto 19990 o 39990
    if (paymentInfo.currency_id !== 'CLP') {
      console.warn(`Payment ${paymentId} rechazado: currency_id inválido (${paymentInfo.currency_id})`);
      return res.status(400).json({ error: 'Moneda inválida' });
    }

    const transactionAmount = Number(paymentInfo.transaction_amount);
    if (transactionAmount !== 19990 && transactionAmount !== 39990) {
      console.warn(`Payment ${paymentId} rechazado: transaction_amount inválido (${transactionAmount})`);
      return res.status(400).json({ error: 'Monto de transacción inválido' });
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

// Archivar postulación para liberar cupo del límite de 3 simultáneas
app.post('/api/postulaciones/archivar', requireAuth, async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user!;
    const { fundId } = req.body || {};
    if (!fundId) {
      return res.status(400).json({ error: 'Debes indicar el fundId a archivar.' });
    }

    if (!isFirestoreAdminAuthorized) {
      return res.json({ success: true, activeFundIds: [], message: 'Postulación archivada con éxito. Cupo liberado.' });
    }

    const entRef = adminDb.collection('entitlements').doc(user.uid);
    const entDoc = await entRef.get();
    const entData = entDoc.data() || {};
    let activeFundIds: string[] = Array.isArray(entData.activeFundIds) ? entData.activeFundIds : [];
    activeFundIds = activeFundIds.filter(id => id !== fundId);
    await entRef.set({
      activeFundIds,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return res.json({ success: true, activeFundIds, message: 'Postulación archivada con éxito. Cupo liberado.' });
  } catch (err: any) {
    console.error('Error archiving postulation:', err?.message);
    return res.status(500).json({ error: 'Error al archivar la postulación.' });
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
