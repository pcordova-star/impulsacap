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
    return res.json({ ...parsed, analizadoCon: 'ia' });
  } catch (err: any) {
    console.error('Error in /api/gemini/instant-match:', err?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

// 0.1 Lector Inteligente de Carpeta Tributaria Electrónica SII (PDF o Texto)
app.post('/api/gemini/parse-tax-folder', async (req, res) => {
  try {
    const { rawText, fileBase64, mimeType, fileName } = req.body || {};

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
    } else if (rawText && typeof rawText === 'string' && rawText.trim().length > 0) {
      contents = `Analiza la siguiente información de Carpeta Tributaria Electrónica / F29 del SII de Chile:

${rawText.slice(0, 15000)}`;
    } else {
      return res.status(400).json({ error: 'Debes proporcionar un archivo PDF o el texto de la Carpeta Tributaria.' });
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

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const text = response.text || '';
    if (!text) {
      throw new Error('Respuesta vacía de Gemini');
    }
    const parsed = JSON.parse(text);
    if (parsed.rut && validateRut(parsed.rut)) {
      parsed.rut = formatRut(parsed.rut);
    }
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/parse-tax-folder:', error?.message);
    return res.status(503).json({ error: 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.' });
  }
});

// 1. Diagnóstico y Calce Inteligente de Fondos
app.post('/api/gemini/diagnose', async (req, res) => {
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
app.post('/api/gemini/formulate', async (req, res) => {
  try {
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
app.post('/api/gemini/audit', async (req, res) => {
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
app.post('/api/gemini/generate-doc', async (req, res) => {
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
app.post('/api/gemini/chat', async (req, res) => {
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
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ImpulsaCap API', timestamp: new Date().toISOString() });
});

// Setup Vite middleware in dev or static files in production
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
