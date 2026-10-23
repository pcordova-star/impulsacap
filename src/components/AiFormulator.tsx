import { TeamCvImport } from './ProfileAutofill';
import React, { useState, useEffect, useMemo } from 'react';
import { consume, onRequest } from '../utils/navFocus';
import { BudgetWizard } from './BudgetWizard';
import { notifySaved } from '../utils/guideEvents';
import { SectionHelper } from './SectionHelpers';
import { ChileanFund, CompanyProfile, FormulationOutput, ProjectProfile, FormBlock } from '../types/funds';
import { getFundRules, blockLabel, budgetAccountsFor, coFinancePctFor, maxSubsidyFor, questionOverride } from '../data/fundStandards';
import { ExpedienteData } from '../types/expediente';
import { apiFetch } from '../utils/apiFetch';
import { usePlan } from '../hooks/usePlan';
import { PlanPaywallCard } from './PlanPaywallCard';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  Download, 
  ShieldAlert, 
  ArrowRight, 
  ArrowLeft,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Target,
  Users,
  DollarSign,
  Layers,
  PieChart,
  Edit3,
  FileText,
  Calculator,
  Calendar,
  AlertTriangle
} from 'lucide-react';

interface AiFormulatorProps {
  selectedFund: ChileanFund | null;
  setSelectedFund: (f: ChileanFund) => void;
  profile: CompanyProfile;
  initialFormulation?: FormulationOutput | null;
  expediente?: ExpedienteData;
  onSaveSectionAnswers?: (sectionId: string, answers: Record<string, string>, generatedText?: string) => void;
  onSaveFormulation?: (formulation: FormulationOutput) => void;
  onSendToAudit: (formulation: FormulationOutput, fund: ChileanFund) => void;
  onNavigateTab?: (tab: string) => void;
}

interface SectionDefinition {
  id: string;
  stepNumber: number;
  title: string;
  badge: string;
  hint?: string;
  questions: {
    key: string;
    label: string;
    placeholder: string;
    helpText: string;
  }[];
}

// 8 Sections covering: Título y pitch, Problema, Solución, Mercado, Modelo de Negocio, Plan de Trabajo, Equipo, Presupuesto
const SECTIONS: SectionDefinition[] = [
  {
    id: 'title_pitch',
    stepNumber: 1,
    title: 'Título y Pitch',
    badge: 'Identificación Oficial',
    questions: [
      {
        key: 'projectTitle',
        label: '¿Cuál es el título descriptivo de tu proyecto?',
        placeholder: 'Ej: Plataforma IoT y Analítica Predictiva para Eficiencia Hídrica en Viñedos',
        helpText: 'Debe sintetizar la tecnología, la aplicación y el sector objetivo según las bases del concurso.'
      },
      {
        key: 'pitchSummary30s',
        label: 'Elevator Pitch (30 segundos): describe en 2 o 3 oraciones qué hace, para quién y por qué es único:',
        placeholder: 'Ej: Desarrollamos un sistema autónomo de sensores y modelos predictivos que permite a viticultores reducir un 30% el consumo de agua...',
        helpText: 'Resumen ejecutivo de alto impacto que los evaluadores leen primero.'
      }
    ]
  },
  {
    id: 'problem',
    stepNumber: 2,
    title: 'Problema y Oportunidad',
    badge: 'Criterio Dolor de Mercado',
    questions: [
      {
        key: 'who',
        label: '¿A quién le afecta principalmente este problema?',
        placeholder: 'Ej: Pymes del sector vitivinícola y agrícola en las regiones del Maule y OHiggins...',
        helpText: 'Indica el segmento específico de clientes o industrias perjudicadas.'
      },
      {
        key: 'cost',
        label: '¿Cuánto les cuesta hoy o qué pierden por no resolverlo?',
        placeholder: 'Ej: Pierden en promedio $4.500.000 mensuales en mermas y 15 horas semanales en papeleo...',
        helpText: 'Si no tienes la cifra exacta, no te preocupes: se redactará [COMPLETAR: costo estimado].'
      },
      {
        key: 'alternatives',
        label: '¿Por qué las soluciones o alternativas actuales no son suficientes?',
        placeholder: 'Ej: Las soluciones actuales son softwares extranjeros costosos no adaptados a la normativa chilena...',
        helpText: 'Menciona las fallas o vacíos de lo que hoy existe en el mercado.'
      }
    ]
  },
  {
    id: 'solution',
    stepNumber: 3,
    title: 'Solución y Grado de Innovación',
    badge: 'Criterio Novedad Técnica',
    questions: [
      {
        key: 'how',
        label: '¿Cómo funciona tu producto o solución?',
        placeholder: 'Ej: Desarrollamos una plataforma web y móvil conectada a sensores IoT que monitorea...',
        helpText: 'Explica de forma clara y directa el funcionamiento para los evaluadores.'
      },
      {
        key: 'tech',
        label: '¿Qué tecnología, componente o metodología clave utiliza?',
        placeholder: 'Ej: Algoritmos de visión computacional, backend en Python y protocolos LoRaWAN...',
        helpText: 'Menciona las tecnologías clave que sustentan la novedad técnica.'
      },
      {
        key: 'noveltyVsCompetitors',
        label: '¿Cuál es la novedad y diferenciación frente a los competidores existentes en Chile o el mundo?',
        placeholder: 'Ej: Es 60% más económico de implementar y procesa alertas climáticas en tiempo real...',
        helpText: 'Destaca las barreras de entrada y factores diferenciadores.'
      }
    ]
  },
  {
    id: 'market',
    stepNumber: 4,
    title: 'Mercado y Clientes Objetivo',
    badge: 'Criterio Potencial Comercial',
    questions: [
      {
        key: 'archetype',
        label: '¿Quiénes son tus clientes objetivo y arquetipo de comprador?',
        placeholder: 'Ej: Gerentes de Operaciones y Dueños de Medianas Empresas B2B con facturación sobre 2.400 UF...',
        helpText: 'Define quién toma la decisión de compra de tu solución.'
      },
      {
        key: 'tam',
        label: '¿Cuál es el tamaño total del mercado (TAM) estimado?',
        placeholder: 'Ej: En Chile existen más de 12.000 empresas agrícolas; mercado potencial de $30 millones USD...',
        helpText: 'Estimación del mercado total disponible.'
      },
      {
        key: 'sam',
        label: '¿Cuál es el mercado accesible y disponible (SAM)?',
        placeholder: 'Ej: 2.500 empresas agrícolas tecnificadas en la zona centro-sur...',
        helpText: 'Segmento del mercado al que realmente puedes acceder.'
      },
      {
        key: 'som',
        label: '¿Cuál es la meta comercial a 12-24 meses (SOM)?',
        placeholder: 'Ej: Capturar 50 clientes pagando suscripción durante los primeros 18 meses...',
        helpText: 'Objetivo de ventas concreto que planeas capturar con este subsidio.'
      }
    ]
  },
  {
    id: 'model',
    stepNumber: 5,
    title: 'Modelo de Negocio y Monetización',
    badge: 'Criterio Viabilidad Comercial',
    questions: [
      {
        key: 'revenue',
        label: '¿Cuáles serán las fuentes de ingresos y esquema de cobro?',
        placeholder: 'Ej: Suscripción SaaS mensual de $150.000 CLP por sucursal más costo de instalación único...',
        helpText: 'Modelo de monetización (SaaS, comisión, venta unitaria, etc.).'
      },
      {
        key: 'salesStrategy',
        label: '¿Cuál es la estrategia comercial y canales de venta (Go-to-Market)?',
        placeholder: 'Ej: Venta directa a través de pilotos comerciales, inbound marketing y convenios gremiales...',
        helpText: 'Canales y mecanismos para conseguir los primeros clientes con el subsidio.'
      }
    ]
  },
  {
    id: 'workplan',
    stepNumber: 6,
    title: 'Plan de Trabajo e Hitos',
    badge: 'Criterio Plan de Ejecución',
    questions: [
      {
        key: 'milestone1',
        label: 'Hito 1 (Meses 1-3): Objetivo, entregable verificable y riesgo crítico:',
        placeholder: 'Ej: Mes 3: Prototipo funcional probado en laboratorio. Entregable: Informe técnico y métricas de calibración. Riesgo: Demora en insumos importados.',
        helpText: 'Objetivo técnico inicial que Corfo o Sercotec exigen para aprobar el primer hito de avance.'
      },
      {
        key: 'milestone2',
        label: 'Hito 2 (Meses 4-8): Objetivo, entregable verificable y riesgo crítico:',
        placeholder: 'Ej: Mes 7: Piloto en terreno con 3 clientes pagando. Entregable: Actas de conformidad y métricas de ahorro. Riesgo: Resistencia de usuarios.',
        helpText: 'Hito intermedio de validación en entorno real de mercado.'
      },
      {
        key: 'milestone3',
        label: 'Hito 3 (Meses 9-12): Objetivo, entregable verificable y riesgo crítico:',
        placeholder: 'Ej: Mes 12: Escalamiento comercial y primeras 5 ventas formales. Entregable: Facturas y contratos de venta firmados. Riesgo: Ciclos de compra lentos.',
        helpText: 'Hito final de salida al mercado y cumplimiento de metas del fondo.'
      }
    ]
  },
  {
    id: 'team',
    stepNumber: 7,
    title: 'Equipo y Capacidades',
    badge: 'Criterio Idoneidad del Postulante',
    questions: [
      {
        key: 'members',
        label: 'Nombre, rol y experiencia relevante de cada integrante clave:',
        placeholder: 'Ej: Juan Pérez (Líder Técnico, Ing. en Computación con 6 años en SaaS), María Soto (CEO, Comercial con MBA)...',
        helpText: 'Corfo exige demostrar complementariedad técnica y comercial en el equipo fundador.'
      },
      {
        key: 'dedication',
        label: '¿Qué dedicación horaria tendrá el equipo en el proyecto?',
        placeholder: 'Ej: El líder técnico y la CEO tendrán dedicación de 40 horas semanales (100%)...',
        helpText: 'La dedicación completa suma puntaje en la pauta de evaluación.'
      },
      {
        key: 'skills',
        label: '¿Cuentan con las capacidades necesarias para ejecutar este fondo?',
        placeholder: 'Ej: Contamos con experiencia previa en desarrollo ágil y red de contactos comerciales...',
        helpText: 'Respalda la capacidad técnica y operativa de la empresa.'
      }
    ]
  },
  {
    id: 'budget',
    stepNumber: 8,
    title: 'Presupuesto Oficial',
    badge: 'Criterio Co-financiamiento',
    questions: [] // Handled via dedicated Budget Accounts UI
  }
];

const STANDARD_BUDGET_ACCOUNTS = [
  {
    key: 'rh',
    account: 'Recursos Humanos Críticos',
    defaultItem: 'Personal técnico, desarrolladores e ingenieros de proyecto',
    defaultJustification: 'Dedicación técnica directa al desarrollo y ejecución del proyecto.'
  },
  {
    key: 'operaciones',
    account: 'Gastos de Operación',
    defaultItem: 'Materiales, insumos de prototipado, servicios cloud y pruebas de campo',
    defaultJustification: 'Adquisición de insumos y servicios requeridos para validación en terreno.'
  },
  {
    key: 'consultoria',
    account: 'Asistencia Técnica y Consultoría',
    defaultItem: 'Certificaciones, ensayos de laboratorio externos y auditoría técnica',
    defaultJustification: 'Servicios de terceros especializados no disponibles internamente.'
  },
  {
    key: 'administracion',
    account: 'Gastos de Administración y Garantías',
    defaultItem: 'Contabilidad de rendiciones y costo de póliza de garantía de anticipo',
    defaultJustification: 'Garantizar el estricto cumplimiento administrativo y contractual de las bases.'
  }
];

export const AiFormulator: React.FC<AiFormulatorProps> = ({
  selectedFund,
  setSelectedFund,
  profile,
  initialFormulation,
  expediente,
  onSaveSectionAnswers,
  onSaveFormulation,
  onSendToAudit,
  onNavigateTab
}) => {
  const [currentFund, setCurrentFund] = useState<ChileanFund>(
    selectedFund || CHILEAN_FUNDS[0]
  );

  // Active step index (0 to 7)
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const { hasActivePlan, loading: planLoading } = usePlan();
  const [showPaywall, setShowPaywall] = useState<boolean>(false);

  // Helper: Preload section answers from Project Profile (Requirement A.3)
  const getPreloadedAnswers = (prof: CompanyProfile, initForm?: FormulationOutput | null): Record<string, Record<string, string>> => {
    const proj = prof.projectProfile || ({} as Partial<ProjectProfile>);
    return {
      title_pitch: {
        projectTitle: initForm?.projectTitle || (prof.companyName ? `${prof.companyName} - Innovación` : ''),
        pitchSummary30s: initForm?.pitchSummary30s || proj.whatItDoes || prof.projectSummary || ''
      },
      problem: {
        who: proj.problemAndTarget || '',
        cost: '',
        alternatives: proj.currentSolutionAndDiff || ''
      },
      solution: {
        how: proj.whatItDoes || '',
        tech: prof.coreTech || '',
        noveltyVsCompetitors: initForm?.noveltyVsCompetitors || proj.currentSolutionAndDiff || ''
      },
      market: {
        archetype: initForm?.marketAnalysisTAM?.clientArchetype || proj.problemAndTarget || '',
        tam: initForm?.marketAnalysisTAM?.tam || '',
        sam: initForm?.marketAnalysisTAM?.sam || '',
        som: initForm?.marketAnalysisTAM?.som || ''
      },
      model: {
        revenue: proj.businessModel || '',
        salesStrategy: proj.currentProgress || ''
      },
      workplan: {
        milestone1: initForm?.workPlanMilestones?.[0]?.description || (proj.currentProgress ? `Validación técnica inicial: ${proj.currentProgress}` : ''),
        milestone2: initForm?.workPlanMilestones?.[1]?.description || '',
        milestone3: initForm?.workPlanMilestones?.[2]?.description || ''
      },
      team: {
        members: proj.teamDetails || '',
        dedication: '40 horas semanales por integrante clave (dedicación completa 100%)',
        skills: proj.teamDetails ? 'Equipo complementario con roles técnicos y comerciales' : ''
      },
      budget: {}
    };
  };

  // User input answers for each section - Precargado con perfil del proyecto (Requirement A.3)
  const [answersBySection, setAnswersBySection] = useState<Record<string, Record<string, string>>>(() => {
    const preloaded = getPreloadedAnswers(profile, initialFormulation);
    if (!expediente?.answersBySection || Object.keys(expediente.answersBySection).length === 0) {
      return preloaded;
    }
    const merged: Record<string, Record<string, string>> = { ...preloaded };
    Object.entries(expediente.answersBySection).forEach(([secKey, secAnswers]) => {
      merged[secKey] = {
        ...(preloaded[secKey] || {}),
        ...secAnswers
      };
    });
    return merged;
  });

  // Missing data tasks by section (Requirement B.7)
  const [missingDataBySection, setMissingDataBySection] = useState<Record<string, string[]>>({});

  // Dedicated Budget Accounts State (Requirement 10: Real amounts entered by user)
  const [budgetAccounts, setBudgetAccounts] = useState<Record<string, {
    corfoContributionCLP: number;
    companyPecuniaryCLP: number;
    item: string;
    justification: string;
  }>>(() => {
    const existing = expediente?.formulation?.budgetBreakdown || initialFormulation?.budgetBreakdown;
    const initialMap: Record<string, any> = {};

    const legacy = Object.fromEntries(STANDARD_BUDGET_ACCOUNTS.map(a => [a.account, a]));
    budgetAccountsFor(selectedFund || CHILEAN_FUNDS[0]).forEach(acc => {
      const found = existing?.find(b => b.account === acc.account);
      const old = found ? legacy[found.account] : undefined;
      initialMap[acc.key] = {
        corfoContributionCLP: found ? found.corfoContributionCLP : 0,
        companyPecuniaryCLP: found ? found.companyPecuniaryCLP : 0,
        // Sin texto genérico: el usuario escribe en qué gastará y por qué (no se inventa nada)
        item: found?.item && found.item !== old?.defaultItem ? found.item : '',
        justification: found?.justification && found.justification !== old?.defaultJustification ? found.justification : ''
      };
    });
    return initialMap;
  });

  // Generated texts per section (editable)
  const [generatedTexts, setGeneratedTexts] = useState<Record<string, string>>(() => {
    if (expediente?.generatedTextsBySection && Object.keys(expediente.generatedTextsBySection).length > 0) {
      return expediente.generatedTextsBySection;
    }
    return {
      title_pitch: initialFormulation?.projectTitle ? `${initialFormulation.projectTitle}\n\n${initialFormulation.pitchSummary30s || ''}` : '',
      problem: initialFormulation?.problemStatement || '',
      solution: initialFormulation?.solutionAndInnovation || '',
      market: initialFormulation?.marketAnalysisTAM?.tam
        ? `TAM: ${initialFormulation.marketAnalysisTAM.tam}\nSAM: ${initialFormulation.marketAnalysisTAM.sam}\nSOM: ${initialFormulation.marketAnalysisTAM.som}\nArquetipo: ${initialFormulation.marketAnalysisTAM.clientArchetype}`
        : '',
      model: initialFormulation?.businessModel || '',
      workplan: '',
      team: initialFormulation?.teamCapabilities || '',
      budget: ''
    };
  });

  // Keep full formulation object
  const [fullFormulation, setFullFormulation] = useState<FormulationOutput | null>(
    expediente?.formulation || initialFormulation || null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Secciones con los nombres y la ponderación del formulario oficial del fondo elegido
  const fundRules = useMemo(() => getFundRules(currentFund), [currentFund]);
  const sectionsView = useMemo<SectionDefinition[]>(() => SECTIONS.map(sec => {
    const lbl = blockLabel(currentFund, sec.id as FormBlock);
    const official = fundRules.formSections.find(fs => fs.blocks.includes(sec.id as FormBlock));
    const questions = sec.id === 'title_pitch' && fundRules.pitch
      ? sec.questions.map(q => q.key === 'pitchSummary30s'
          ? { ...q, label: `Guion del ${fundRules.pitch!.label.toLowerCase()}: ${fundRules.pitch!.content}`, helpText: `Se graba o presenta en máximo ${fundRules.pitch!.seconds >= 120 ? `${Math.round(fundRules.pitch!.seconds / 60)} minutos` : `${fundRules.pitch!.seconds} segundos`}. Escríbelo aquí y úsalo para grabar.` }
          : q)
      : sec.questions;
    const adapted = questions.map(q => { const o = questionOverride(currentFund, sec.id as FormBlock, q.key); return o ? { ...q, ...o } : q; });
    return { ...sec, questions: adapted, title: lbl.title, badge: official?.evaluates ? `Evalúa ${official.evaluates}` : (official?.title || sec.badge), hint: lbl.hint } as SectionDefinition;
  }), [currentFund, fundRules]);
  const currentSection = sectionsView[currentSectionIndex];
  // Concurso del monitor (fuera del catálogo): se agrega a la lista para mostrarlo bien
  const fundOptions = CHILEAN_FUNDS.some(x => x.id === currentFund.id) ? CHILEAN_FUNDS : [currentFund, ...CHILEAN_FUNDS];

  // Cierre de la formulación (guardar) separado del paso siguiente (auditoría)
  const [showFinishSummary, setShowFinishSummary] = useState(false);
  useEffect(() => { if (currentSectionIndex !== SECTIONS.length - 1) setShowFinishSummary(false); }, [currentSectionIndex]);

  // Requisito para redactar con IA: perfil de la empresa y del proyecto con lo esencial.
  // Sin eso la IA solo puede dejar marcas [COMPLETAR] (no inventa datos).
  const PROFILE_FIELDS: { key: keyof NonNullable<CompanyProfile['projectProfile']>; label: string }[] = [
    { key: 'whatItDoes', label: 'Qué hace tu empresa o proyecto' },
    { key: 'problemAndTarget', label: 'Qué problema resuelve y para quién' },
    { key: 'currentSolutionAndDiff', label: 'Cómo lo resuelven hoy y qué te diferencia' },
    { key: 'currentProgress', label: 'Avance actual (prototipo, clientes, ventas)' },
    { key: 'teamDetails', label: 'Equipo: nombres, roles y experiencia' },
    { key: 'businessModel', label: 'Modelo de negocio: cómo cobras y cuánto' },
    { key: 'fundingPurpose', label: 'Para qué usarías el financiamiento' }
  ];
  const missingProfileFields = [
    ...(!profile.companyName?.trim() ? ['Razón social de la empresa'] : []),
    ...PROFILE_FIELDS.filter(f => String(profile.projectProfile?.[f.key] || '').trim().length < 10).map(f => f.label)
  ];
  const profileReadyForAi = missingProfileFields.length <= 2 && Boolean(profile.companyName?.trim());

  // Answered questions count & validation (Requirement B.4: mínimo 2 de 3)
  const currentSectionAns = answersBySection[currentSection.id] || {};
  const answeredCount = currentSection.questions.filter(q => Boolean(currentSectionAns[q.key]?.trim())).length;
  const totalQuestions = currentSection.questions.length;
  const minRequiredAnswers = Math.min(2, totalQuestions);
  const hasMinimumAnswers = totalQuestions === 0 || answeredCount >= minRequiredAnswers;

  // Extracted and API missingData tasks (Requirement B.7)
  const currentGenerated = generatedTexts[currentSection.id] || '';
  const currentMissingTasks = useMemo(() => {
    const extracted = (currentGenerated.match(/\[COMPLETAR:[^\]]+\]/g) || []).map(t =>
      t.replace(/^\[COMPLETAR:\s*/i, '').replace(/\]$/, '').trim()
    );
    const fromApi = missingDataBySection[currentSection.id] || [];
    return Array.from(new Set([...fromApi, ...extracted])).filter(Boolean);
  }, [currentGenerated, missingDataBySection, currentSection.id]);

  // Pedido de sección desde otra pantalla (p. ej. "Configurar presupuesto" en la Hoja de Ruta)
  useEffect(() => {
    const openSection = (id: string) => {
      let idx = SECTIONS.findIndex(sec => sec.id === id);
      if (id === 'next') {
        idx = SECTIONS.findIndex((sec, i) => i === 7
          ? !isBudgetValid
          : !(generatedTexts[sec.id]?.trim() || Object.values(answersBySection[sec.id] || {}).some(v => String(v).trim().length > 0)));
        if (idx === -1) idx = 0;
      }
      if (idx >= 0) setCurrentSectionIndex(idx);
    };
    const initial = consume('formulatorSection');
    if (initial) openSection(initial);
    return onRequest('formulatorSection', openSection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync when selectedFund prop changes
  useEffect(() => {
    if (selectedFund && selectedFund.id !== currentFund.id) {
      setCurrentFund(selectedFund);
    }
  }, [selectedFund]);

  // Sync when expediente prop updates answers
  useEffect(() => {
    if (expediente?.answersBySection && Object.keys(expediente.answersBySection).length > 0) {
      setAnswersBySection(prev => ({
        ...prev,
        ...expediente.answersBySection
      }));
    }
    if (expediente?.generatedTextsBySection && Object.keys(expediente.generatedTextsBySection).length > 0) {
      setGeneratedTexts(prev => ({
        ...prev,
        ...expediente.generatedTextsBySection
      }));
    }
    if (expediente?.formulation) {
      setFullFormulation(expediente.formulation);
    }
  }, [expediente]);

  // Budget calculations and validations
  const totalSubsidio = useMemo(() => {
    return Object.values(budgetAccounts).reduce((acc, curr) => acc + (curr.corfoContributionCLP || 0), 0);
  }, [budgetAccounts]);

  const totalAporteEmpresa = useMemo(() => {
    return Object.values(budgetAccounts).reduce((acc, curr) => acc + (curr.companyPecuniaryCLP || 0), 0);
  }, [budgetAccounts]);

  const totalProyecto = totalSubsidio + totalAporteEmpresa;

  const maxAllowedSubsidy = maxSubsidyFor(currentFund, profile);
  const maxAllowedPct = coFinancePctFor(currentFund, profile);
  const currentSubsidioPct = totalProyecto > 0 ? (totalSubsidio / totalProjectSafe(totalProyecto)) * 100 : 0;

  function totalProjectSafe(tp: number) {
    return tp > 0 ? tp : 1;
  }

  // Tope 0 = el concurso no informa un monto máximo legible (monitor): se valida solo el porcentaje
  const isSubsidyExceeded = maxAllowedSubsidy > 0 && totalSubsidio > maxAllowedSubsidy;
  const isPctExceeded = totalProyecto > 0 && currentSubsidioPct > (maxAllowedPct + 0.05);
  const isBudgetValid = totalSubsidio > 0 && !isSubsidyExceeded && !isPctExceeded;

  // Helper to handle answer changes & persist (Requirement 11)
  const handleAnswerChange = (qKey: string, val: string) => {
    const updatedSectionAnswers = {
      ...(answersBySection[currentSection.id] || {}),
      [qKey]: val
    };

    const nextAnswers = {
      ...answersBySection,
      [currentSection.id]: updatedSectionAnswers
    };

    setAnswersBySection(nextAnswers);

    if (onSaveSectionAnswers) {
      onSaveSectionAnswers(currentSection.id, updatedSectionAnswers, generatedTexts[currentSection.id]);
    }
  };

  // Varias respuestas a la vez (ayudantes guiados): un solo guardado, sin pisar campos
  const handleAnswersBatch = (updates: Record<string, string>) => {
    const updatedSectionAnswers = { ...(answersBySection[currentSection.id] || {}), ...updates };
    setAnswersBySection(prev => ({ ...prev, [currentSection.id]: { ...(prev[currentSection.id] || {}), ...updates } }));
    if (onSaveSectionAnswers) {
      onSaveSectionAnswers(currentSection.id, updatedSectionAnswers, generatedTexts[currentSection.id]);
    }
    setTimeout(() => document.getElementById('formulator-questions')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  };

  // Helper to handle budget inputs
  const handleBudgetAccountChange = (accKey: string, field: 'corfoContributionCLP' | 'companyPecuniaryCLP' | 'item' | 'justification', val: any) => {
    setBudgetAccounts(prev => {
      const next = {
        ...prev,
        [accKey]: {
          ...prev[accKey],
          [field]: val
        }
      };

      // Also persist to answersBySection for the budget step
      const budgetAnswers: Record<string, string> = {};
      Object.entries(next).forEach(([k, item]) => {
        budgetAnswers[`${k}_corfo`] = String(item.corfoContributionCLP);
        budgetAnswers[`${k}_empresa`] = String(item.companyPecuniaryCLP);
        budgetAnswers[`${k}_item`] = item.item;
        budgetAnswers[`${k}_justification`] = item.justification;
      });

      if (onSaveSectionAnswers) {
        onSaveSectionAnswers('budget', budgetAnswers);
      }

      return next;
    });
  };

  // Helper to handle generated text changes (user edits)
  const handleTextEdit = (val: string) => {
    setGeneratedTexts(prev => ({
      ...prev,
      [currentSection.id]: val
    }));

    if (onSaveSectionAnswers) {
      onSaveSectionAnswers(currentSection.id, answersBySection[currentSection.id] || {}, val);
    }
  };

  // Generate specific section with AI
  const handleGenerateSection = async () => {
    setLoading(true);
    setError(null);

    const questionsObj: Record<string, string> = {};
    const sectionAns = answersBySection[currentSection.id] || {};
    currentSection.questions.forEach(q => {
      questionsObj[q.label] = sectionAns[q.key] || '';
    });

    try {
      if (!hasActivePlan) {
        setShowPaywall(true);
        setLoading(false);
        return;
      }

      const response = await apiFetch('/api/gemini/formulate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          projectProfile: profile.projectProfile,
          taxFolderData: {
            sector: profile.sector,
            region: profile.region,
            monthsActive: profile.monthsActive,
            annualSalesCLP: profile.annualSalesCLP,
            salesBracket: profile.salesBracket
          },
          fund: currentFund,
          sectionKey: currentSection.id,
          sectionTitle: currentSection.title,
          questionsAndAnswers: questionsObj,
          projectSummary: profile.projectProfile?.whatItDoes || profile.projectSummary
        })
      });

      if (response.status === 402) {
        setShowPaywall(true);
        setLoading(false);
        return;
      }

      if (response.status === 429) {
        const errJson = await response.json().catch(() => ({}));
        setError(errJson.error || 'Puedes tener hasta 3 postulaciones activas a la vez. Archiva una para comenzar otra.');
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.');
      }

      const data = await response.json();
      const generated = data.generatedText || '';
      const missing = Array.isArray(data.missingData) ? data.missingData : [];

      setMissingDataBySection(prev => ({
        ...prev,
        [currentSection.id]: missing
      }));

      setGeneratedTexts(prev => ({
        ...prev,
        [currentSection.id]: generated
      }));

      // Update full formulation draft
      updateFullFormulationDraft(currentSection.id, generated);

      if (onSaveSectionAnswers) {
        onSaveSectionAnswers(currentSection.id, sectionAns, generated);
      }

      setSavedNotice(`¡Sección "${currentSection.title}" generada con éxito!`);
      setTimeout(() => setSavedNotice(null), 4000);
    } catch (err: any) {
      console.error('Section formulation error:', err);
      setError(err?.message || 'El servicio de IA no está disponible. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Requirement 10: Assemble formulation WITHOUT inventing any fake data
  const updateFullFormulationDraft = (sectionId: string, text: string) => {
    const updatedTexts = { ...generatedTexts, [sectionId]: text };

    // Título y Pitch (Real, without generic placeholders)
    const titleFromAns = answersBySection.title_pitch?.projectTitle?.trim();
    const pitchFromAns = answersBySection.title_pitch?.pitchSummary30s?.trim();
    const finalProjectTitle = titleFromAns || (updatedTexts.title_pitch?.split('\n')[0]?.trim()) || fullFormulation?.projectTitle || '';
    const finalPitch = pitchFromAns || (updatedTexts.title_pitch?.split('\n').slice(1).join(' ').trim()) || fullFormulation?.pitchSummary30s || '';

    // Problema y Solución
    const problem = updatedTexts.problem || answersBySection.problem?.who || fullFormulation?.problemStatement || '';
    const solution = updatedTexts.solution || answersBySection.solution?.how || fullFormulation?.solutionAndInnovation || '';
    const novelty = answersBySection.solution?.noveltyVsCompetitors || fullFormulation?.noveltyVsCompetitors || '';

    // Mercado TAM SAM SOM (Real, without fake numbers)
    const marketAns = answersBySection.market || {};
    const finalMarket = {
      tam: marketAns.tam?.trim() || fullFormulation?.marketAnalysisTAM?.tam || '',
      sam: marketAns.sam?.trim() || fullFormulation?.marketAnalysisTAM?.sam || '',
      som: marketAns.som?.trim() || fullFormulation?.marketAnalysisTAM?.som || '',
      clientArchetype: marketAns.archetype?.trim() || fullFormulation?.marketAnalysisTAM?.clientArchetype || ''
    };

    // Modelo y Equipo
    const model = updatedTexts.model || answersBySection.model?.revenue || fullFormulation?.businessModel || '';
    const team = updatedTexts.team || answersBySection.team?.members || fullFormulation?.teamCapabilities || '';

    // Plan de Trabajo (Real from user answers, or empty array)
    const workplanAns = answersBySection.workplan || {};
    const realMilestones: {
      month: string;
      title: string;
      description: string;
      deliverable: string;
      criticalRisk: string;
    }[] = [];

    if (workplanAns.milestone1?.trim()) {
      realMilestones.push({
        month: 'Mes 1 a 3',
        title: 'Hito 1: Validación Técnica Inicial',
        description: workplanAns.milestone1.trim(),
        deliverable: 'Informe técnico de validación y prototipo funcional',
        criticalRisk: 'Desviaciones en especificaciones; mitigado con iteraciones ágiles'
      });
    }

    if (workplanAns.milestone2?.trim()) {
      realMilestones.push({
        month: 'Mes 4 a 8',
        title: 'Hito 2: Pilotos en Entorno Real',
        description: workplanAns.milestone2.trim(),
        deliverable: 'Actas de conformidad de pruebas de campo y métricas de desempeño',
        criticalRisk: 'Demoras en pruebas con clientes; mitigado con acuerdos previos'
      });
    }

    if (workplanAns.milestone3?.trim()) {
      realMilestones.push({
        month: 'Mes 9 a 12',
        title: 'Hito 3: Validación Comercial y Escalamiento',
        description: workplanAns.milestone3.trim(),
        deliverable: 'Facturas de venta o acuerdos comerciales de adopción',
        criticalRisk: 'Ciclos de cierre de ventas; mitigado con planes piloto'
      });
    }

    // Presupuesto (Real from entered budget accounts, or empty array)
    const realBudgetItems = budgetAccountsFor(currentFund).map(acc => {
      const data = budgetAccounts[acc.key];
      return {
        account: acc.account,
        item: data?.item || acc.account,
        corfoContributionCLP: Number(data?.corfoContributionCLP || 0),
        companyPecuniaryCLP: Number(data?.companyPecuniaryCLP || 0),
        companyValuedCLP: 0,
        justification: data?.justification || '[COMPLETAR: por qué el proyecto necesita este gasto]'
      };
    }).filter(b => b.corfoContributionCLP > 0 || b.companyPecuniaryCLP > 0);

    const draft: FormulationOutput = {
      fundId: currentFund.id,
      fundName: currentFund.name,
      projectTitle: finalProjectTitle,
      pitchSummary30s: finalPitch,
      problemStatement: problem,
      solutionAndInnovation: solution,
      noveltyVsCompetitors: novelty,
      marketAnalysisTAM: finalMarket,
      businessModel: model,
      workPlanMilestones: realMilestones.length > 0 ? realMilestones : (fullFormulation?.workPlanMilestones || []),
      budgetBreakdown: realBudgetItems.length > 0 ? realBudgetItems : (fullFormulation?.budgetBreakdown || []),
      teamCapabilities: team,
      bonusFemaleJustification: profile.isFemaleLed
        ? 'Empresa liderada por mujeres con participación societaria acreditada.'
        : undefined
    };

    setFullFormulation(draft);
    onSaveFormulation?.(draft);
    return draft;
  };

  // Next section handler
  const handleNextSection = () => {
    updateFullFormulationDraft(currentSection.id, generatedTexts[currentSection.id] || '');
    if (currentSectionIndex < SECTIONS.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else {
      setSavedNotice('¡Excelente! Has completado todas las secciones de tu formulación técnica.');
      setTimeout(() => setSavedNotice(null), 5000);
      notifySaved('Formulario del fondo');
    }
  };

  const handlePrevSection = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Export full markdown
  const handleExportMarkdown = () => {
    if (!fullFormulation) return;

    const md = `# FORMULACIÓN TÉCNICA OFICIAL PARA POSTULACIÓN
## FONDO: ${currentFund.name} (${currentFund.agency})
### POSTULANTE: ${profile.companyName || 'Empresa Postulante'} (${profile.rut || 'RUT Pendiente'})

---

### 1. TÍTULO DEL PROYECTO
${fullFormulation.projectTitle || '[Sin completar]'}

### 2. ELEVATOR PITCH (30 SEGUNDOS)
${fullFormulation.pitchSummary30s || '[Sin completar]'}

---

### 3. PROBLEMA / OPORTUNIDAD Y MAGNITUD DEL DOLOR
${generatedTexts.problem || fullFormulation.problemStatement || '[Sin completar]'}

---

### 4. SOLUCIÓN PROPUESTA Y GRADO DE INNOVACIÓN
${generatedTexts.solution || fullFormulation.solutionAndInnovation || '[Sin completar]'}

---

### 5. ANÁLISIS DE MERCADO Y CLIENTES
${generatedTexts.market || (fullFormulation.marketAnalysisTAM?.tam ? `TAM: ${fullFormulation.marketAnalysisTAM.tam}\nSAM: ${fullFormulation.marketAnalysisTAM.sam}\nSOM: ${fullFormulation.marketAnalysisTAM.som}` : '[Sin completar]')}

---

### 6. MODELO DE NEGOCIO Y ESTRATEGIA COMERCIAL
${generatedTexts.model || fullFormulation.businessModel || '[Sin completar]'}

---

### 7. PLAN DE TRABAJO E HITOS A 12 MESES
${fullFormulation.workPlanMilestones?.map((m, i) => `${i + 1}. ${m.title} (${m.month}): ${m.description} | Entregable: ${m.deliverable} | Riesgo: ${m.criticalRisk}`).join('\n') || '[Sin completar]'}

---

### 8. EQUIPO DE TRABAJO Y CAPACIDADES
${generatedTexts.team || fullFormulation.teamCapabilities || '[Sin completar]'}

---

### 9. PRESUPUESTO OFICIAL (CUENTAS ${currentFund.agency})
${fullFormulation.budgetBreakdown?.map(b => `- ${b.account}: Subsidio $${b.corfoContributionCLP.toLocaleString('es-CL')} CLP | Aporte Empresa: $${b.companyPecuniaryCLP.toLocaleString('es-CL')} CLP`).join('\n') || '[Sin completar]'}
`.trim();

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Formulacion_${currentFund.agency}_${(profile.companyName || 'Empresa').replace(/\s+/g, '_')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 animate-fade-in">
      
      {/* Top Banner / Fund Context Bar */}
      <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-wider">
              {currentFund.agency}
            </span>
            <span className="text-xs text-slate-400">
              Tope Subsidio: <strong className="text-emerald-400">{currentFund.subsidyFormatted}</strong> (hasta {maxAllowedPct}% del costo total)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <span>Formulador Técnico:</span>
            <span className="text-cyan-400">{currentFund.name}</span>
          </h1>
          <p className="text-xs text-slate-400">
            Postulación por: <strong className="text-slate-200">{profile.companyName || 'Empresa'}</strong> • RUT: {profile.rut || 'Pendiente'}
          </p>
        </div>

        {/* Dentro de una postulación el fondo es fijo (cambiar de fondo = otra postulación) */}
        {!expediente && (
        <div className="w-full md:w-auto flex items-center gap-2">
          <select
            value={currentFund.id}
            onChange={(e) => {
              const f = fundOptions.find(x => x.id === e.target.value);
              if (f) {
                setCurrentFund(f);
                setSelectedFund(f);
              }
            }}
            className="w-full md:w-64 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {fundOptions.map(f => (
              <option key={f.id} value={f.id}>
                {f.agency} - {f.name}
              </option>
            ))}
          </select>
        </div>
        )}
      </div>

      {/* Paywall Banner if triggered */}
      {showPaywall && (
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-amber-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Desbloquea el Formulador con el Plan Trimestral</span>
            </h3>
            <button
              onClick={() => setShowPaywall(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cerrar
            </button>
          </div>
          <PlanPaywallCard />
        </div>
      )}

      {/* Section Progress Stepper */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-3 sm:p-4 shadow-lg overflow-x-auto">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-[720px]">
          {sectionsView.map((sec, idx) => {
            const isActive = idx === currentSectionIndex;
            const isFilled = idx === 7 
              ? isBudgetValid 
              : Boolean(generatedTexts[sec.id]?.trim() || Object.values(answersBySection[sec.id] || {}).some(v => v.trim().length > 0));

            return (
              <button
                key={sec.id}
                onClick={() => {
                  updateFullFormulationDraft(currentSection.id, generatedTexts[currentSection.id] || '');
                  setCurrentSectionIndex(idx);
                }}
                className={`flex-1 min-w-[80px] p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-950/60 border-cyan-500 shadow-md shadow-cyan-950/40 text-cyan-200'
                    : isFilled
                    ? 'bg-slate-950/40 border-slate-800/80 text-slate-300 hover:border-slate-700'
                    : 'bg-slate-950/20 border-slate-800/40 text-slate-500 hover:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-1">
                  <span className="opacity-75">Paso {sec.stepNumber}</span>
                  {isFilled && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <div className="text-xs font-semibold truncate text-white">
                  {sec.title}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Notice Alert */}
      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        </div>
      )}

      {/* Main Section Content Area */}
      <div id="formulator-main" className="scroll-mt-40 bg-slate-900/90 rounded-3xl border border-slate-800 p-5 sm:p-8 space-y-6 shadow-2xl">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Paso {currentSection.stepNumber} de {SECTIONS.length}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs text-slate-400 font-medium">{currentSection.badge}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {currentSection.title}
            </h2>
            {currentSection.hint && <p className="text-xs text-slate-400 mt-1 max-w-2xl">{currentSection.hint}</p>}
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            {currentSection.id !== 'budget' && (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleGenerateSection}
                  disabled={loading || planLoading || !hasMinimumAnswers || !profileReadyForAi}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                  title={!hasMinimumAnswers ? `Debes responder al menos ${minRequiredAnswers} preguntas para generar esta sección` : undefined}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Redactando con IA...</span>
                    </>
                  ) : !profileReadyForAi ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-300" />
                      <span>Completa tu perfil para redactar con IA</span>
                    </>
                  ) : !hasMinimumAnswers ? (
                    <>
                      <AlertCircle className="w-4 h-4 text-amber-300" />
                      <span>Responde las preguntas para generar esta sección</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-cyan-200" />
                      <span>Generar sección con IA</span>
                    </>
                  )}
                </button>
                {!hasMinimumAnswers && totalQuestions > 0 && (
                  <span className="text-[10px] text-amber-400 font-medium">
                    Faltan respuestas obligatorias ({answeredCount} de {minRequiredAnswers} mínimo)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {currentSection.id !== 'budget' && !profileReadyForAi && (
          <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-amber-200">Antes de redactar con IA, completa el perfil de tu empresa y proyecto</p>
                <p className="text-xs text-amber-100/80 leading-relaxed">
                  La IA escribe solo con tus datos reales y no inventa nada. Sin estos datos, el texto queda lleno de marcas [COMPLETAR]. Toma unos 5 minutos y sirve para todas las secciones y postulaciones.
                </p>
              </div>
            </div>
            <ul className="grid sm:grid-cols-2 gap-1.5 text-xs text-amber-100 pl-8 list-disc">
              {missingProfileFields.map(f => <li key={f}>{f}</li>)}
            </ul>
            <div className="pl-8">
              <button
                type="button"
                onClick={() => onNavigateTab?.('my-company#project-profile')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Completar mi perfil
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* SECTION 8: PRESUPUESTO OFICIAL (Requirement 10) */}
        {currentSection.id === 'budget' ? (
          <BudgetWizard
            agency={currentFund.agency}
            fundName={currentFund.name}
            basesUrl={fundRules.bases.url || (currentFund as any).officialUrl || null}
            maxSubsidyCLP={maxAllowedSubsidy}
            maxPct={maxAllowedPct}
            guides={budgetAccountsFor(currentFund)}
            coFinanceText={fundRules.coFinance.text}
            accounts={budgetAccounts}
            onChange={(key, field, value) => handleBudgetAccountChange(key, field, value)}
          />
        ) : (
          /* SECTIONS 1 TO 7: QUESTIONS & AI GENERATION */
          <div className="space-y-6">
            
            <SectionHelper
              key={`${currentSection.id}-${currentFund.id}`}
              sectionId={currentSection.id}
              answers={answersBySection[currentSection.id] || {}}
              onApply={handleAnswersBatch}
            />

            {/* Input Questions Grid */}
            <div id="formulator-questions" className="scroll-mt-40 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Preguntas Clave para el Comité Evaluador
              </h3>

              <div className="space-y-4">
                {currentSection.questions.map((q) => {
                  const val = answersBySection[currentSection.id]?.[q.key] || '';
                  const isLong = q.key === 'pitchSummary30s' || q.key === 'alternatives' || q.key === 'how' || q.key.startsWith('milestone') || q.key === 'members';

                  return (
                    <div key={q.key} className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-200 block">
                        {q.label}
                      </label>
                      
                      {isLong ? (
                        <textarea
                          rows={3}
                          value={val}
                          onChange={(e) => handleAnswerChange(q.key, e.target.value)}
                          placeholder={q.placeholder}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl p-3 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500 placeholder:italic transition-colors leading-relaxed"
                        />
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => handleAnswerChange(q.key, e.target.value)}
                          placeholder={q.placeholder}
                          className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500 placeholder:italic transition-colors"
                        />
                      )}

                      <p className="text-[11px] text-slate-400">
                        {q.helpText}
                      </p>
                      {currentSection.id === 'team' && q.key === 'members' && (
                        <TeamCvImport dark fieldLabel="Personal del proyecto" value={val} projectSummary={profile?.projectProfile?.whatItDoes || profile?.projectSummary} onApply={(v) => handleAnswerChange('members', v)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Generated / Editable Technical Text */}
            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Redacción Técnica Oficial (Editable)
                  </h3>
                </div>

                {generatedTexts[currentSection.id] && (
                  <button
                    onClick={() => handleCopy(generatedTexts[currentSection.id], currentSection.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedKey === currentSection.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Texto</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <textarea
                rows={6}
                value={generatedTexts[currentSection.id] || ''}
                onChange={(e) => handleTextEdit(e.target.value)}
                placeholder="El texto técnico redactado para esta sección aparecerá aquí al hacer clic en 'Generar sección con IA', o puedes escribir directamente tu borrador..."
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-2xl p-4 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500 placeholder:italic leading-relaxed font-sans"
              />

              {/* Tareas de datos faltantes (Requirement B.7) */}
              {currentMissingTasks.length > 0 ? (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 space-y-3 animate-fade-in mt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <h4 className="text-xs font-bold text-amber-200 uppercase tracking-wider">
                        Tareas pendientes por completar en esta sección ({currentMissingTasks.length})
                      </h4>
                    </div>
                    <span className="text-[10px] text-amber-400 font-mono">
                      La IA no inventó estos datos
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-300/80 leading-relaxed">
                    Reemplaza cada una de las marcas en el texto editable de arriba con los datos reales de tu empresa antes de postular:
                  </p>
                  <ul className="space-y-1.5">
                    {currentMissingTasks.map((task, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-amber-100 bg-amber-900/30 p-2.5 rounded-xl border border-amber-800/50">
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 font-mono">
                          {idx + 1}
                        </span>
                        <span className="flex-1 font-medium">{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : currentGenerated.trim().length > 60 && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300 animate-fade-in mt-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>¡Sección completa y sin marcas [COMPLETAR] pendientes! Lista para la auditoría.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation & Action Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-slate-800">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {currentSectionIndex > 0 && (
              <button
                onClick={handlePrevSection}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Paso Anterior</span>
              </button>
            )}

            <button
              onClick={handleExportMarkdown}
              disabled={!fullFormulation}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/60 transition-colors cursor-pointer disabled:opacity-40"
              title="Descargar toda la formulación en formato Markdown"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar Borrador</span>
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentSectionIndex < SECTIONS.length - 1 ? (
              <button
                onClick={handleNextSection}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all cursor-pointer w-full sm:w-auto"
              >
                <span>Guardar y Siguiente Paso</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  updateFullFormulationDraft(currentSection.id, generatedTexts[currentSection.id] || '');
                  setShowFinishSummary(true);
                  setTimeout(() => document.getElementById('formulation-finish')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
                }}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all cursor-pointer w-full sm:w-auto"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                <span>Guardar formulación</span>
              </button>
            )}
          </div>
        </div>

      </div>

      {showFinishSummary && (() => {
        const textSections = SECTIONS.filter(sec => sec.id !== 'budget');
        const missingSections = textSections.filter(sec => !generatedTexts[sec.id]?.trim());
        const completarCount = Object.values(generatedTexts).reduce((acc, t) => acc + ((t || '').match(/\[COMPLETAR/g) || []).length, 0);
        const allGood = missingSections.length === 0 && completarCount === 0 && isBudgetValid;
        return (
          <div id="formulation-finish" className="scroll-mt-40 rounded-3xl bg-slate-900 border border-emerald-500/40 p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <p className="text-base font-black text-white">Formulación guardada</p>
                <p className="text-xs text-slate-400">Queda en tu expediente. Puedes volver a editarla cuando quieras.</p>
              </div>
            </div>
            <ul className="grid gap-2 sm:grid-cols-3 text-xs">
              <li className={`p-3 rounded-xl border ${missingSections.length === 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'}`}>
                <strong className="block text-sm">{textSections.length - missingSections.length} de {textSections.length}</strong> secciones redactadas
              </li>
              <li className={`p-3 rounded-xl border ${completarCount === 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'}`}>
                <strong className="block text-sm">{completarCount}</strong> datos [COMPLETAR] pendientes
              </li>
              <li className={`p-3 rounded-xl border ${isBudgetValid ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'}`}>
                <strong className="block text-sm">{isBudgetValid ? 'Presupuesto listo' : 'Presupuesto pendiente'}</strong> {isBudgetValid ? 'dentro de los topes' : 'revisa el paso 8'}
              </li>
            </ul>
            {!allGood && (
              <p className="text-xs text-slate-300">
                Te recomendamos completar lo pendiente antes de la auditoría: la evaluación simulada será más baja si faltan secciones o datos.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {missingSections.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setCurrentSectionIndex(SECTIONS.findIndex(sec => sec.id === missingSections[0].id)); setShowFinishSummary(false); window.scrollTo({ top: 120, behavior: 'smooth' }); }}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
                >
                  Completar: {missingSections[0].title}
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigateTab?.('my-application')}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold cursor-pointer"
              >
                Volver a la Hoja de Ruta
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab?.('auditor')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 ${allGood ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950' : 'border border-slate-600 text-slate-200 hover:bg-slate-800'}`}
              >
                Siguiente paso: auditoría simulada <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
