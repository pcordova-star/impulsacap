import React, { useState, useEffect, useMemo } from 'react';
import { ChileanFund, CompanyProfile, FormulationOutput } from '../types/funds';
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
    const proj = prof.projectProfile || {};
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

    STANDARD_BUDGET_ACCOUNTS.forEach(acc => {
      const found = existing?.find(b => b.account === acc.account);
      initialMap[acc.key] = {
        corfoContributionCLP: found ? found.corfoContributionCLP : 0,
        companyPecuniaryCLP: found ? found.companyPecuniaryCLP : 0,
        item: found?.item || acc.defaultItem,
        justification: found?.justification || acc.defaultJustification
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

  const currentSection = SECTIONS[currentSectionIndex];

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

  const maxAllowedSubsidy = currentFund.maxSubsidyCLP;
  const maxAllowedPct = profile.isFemaleLed ? 85 : currentFund.maxCoFinancePct;
  const currentSubsidioPct = totalProyecto > 0 ? (totalSubsidio / totalProjectSafe(totalProyecto)) * 100 : 0;

  function totalProjectSafe(tp: number) {
    return tp > 0 ? tp : 1;
  }

  const isSubsidyExceeded = totalSubsidio > maxAllowedSubsidy;
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
    const realBudgetItems = STANDARD_BUDGET_ACCOUNTS.map(acc => {
      const data = budgetAccounts[acc.key];
      return {
        account: acc.account,
        item: data?.item || acc.defaultItem,
        corfoContributionCLP: Number(data?.corfoContributionCLP || 0),
        companyPecuniaryCLP: Number(data?.companyPecuniaryCLP || 0),
        companyValuedCLP: 0,
        justification: data?.justification || acc.defaultJustification
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
              Tope Subsidio: <strong className="text-emerald-400">{currentFund.subsidyFormatted}</strong> (Hasta {profile.isFemaleLed ? 85 : currentFund.maxCoFinancePct}% Estatal)
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

        {/* Change Fund Selector */}
        <div className="w-full md:w-auto flex items-center gap-2">
          <select
            value={currentFund.id}
            onChange={(e) => {
              const f = CHILEAN_FUNDS.find(x => x.id === e.target.value);
              if (f) {
                setCurrentFund(f);
                setSelectedFund(f);
              }
            }}
            className="w-full md:w-64 bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            {CHILEAN_FUNDS.map(f => (
              <option key={f.id} value={f.id}>
                {f.agency} - {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Paywall Banner if triggered */}
      {showPaywall && (
        <div className="p-4 sm:p-6 rounded-2xl bg-slate-900/90 border border-amber-500/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <span>Desbloquea el Formulador con el Plan Semestral</span>
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
          {SECTIONS.map((sec, idx) => {
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
      <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-5 sm:p-8 space-y-6 shadow-2xl">
        
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
          </div>

          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            {currentSection.id !== 'budget' && (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleGenerateSection}
                  disabled={loading || planLoading || !hasMinimumAnswers}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
                  title={!hasMinimumAnswers ? `Debes responder al menos ${minRequiredAnswers} preguntas para generar esta sección` : undefined}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Redactando con IA...</span>
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

        {/* SECTION 8: PRESUPUESTO OFICIAL (Requirement 10) */}
        {currentSection.id === 'budget' ? (
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>Desglose por Cuentas Presupuestarias Oficiales ({currentFund.agency})</span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Ingresa los montos netos (sin IVA) solicitados al organismo y el aporte pecuniario de tu empresa. El sistema valida automáticamente los topes de las bases concursales.
              </p>
            </div>

            {/* Validation Feedback Banner */}
            <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              isSubsidyExceeded || isPctExceeded
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : totalSubsidio > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              {isSubsidyExceeded || isPctExceeded ? (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : totalSubsidio > 0 ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <div className="font-bold text-sm">
                  {isSubsidyExceeded
                    ? `Tope de subsidio excedido en $${(totalSubsidio - maxAllowedSubsidy).toLocaleString('es-CL')} CLP`
                    : isPctExceeded
                    ? `Porcentaje de cofinanciamiento excedido (${currentSubsidioPct.toFixed(1)}% vs Máx ${maxAllowedPct}%)`
                    : totalSubsidio > 0
                    ? `Presupuesto válido y dentro de las bases de ${currentFund.name}`
                    : 'Ingresa los montos por cuenta para calcular el presupuesto oficial'}
                </div>
                <div className="text-[11px] leading-relaxed">
                  {isSubsidyExceeded && (
                    <p>El subsidio solicitado (${totalSubsidio.toLocaleString('es-CL')} CLP) no puede superar el máximo de ${maxAllowedSubsidy.toLocaleString('es-CL')} CLP fijado en las bases.</p>
                  )}
                  {isPctExceeded && (
                    <p>Debes aumentar el Aporte Pecuniario de tu empresa para que el subsidio no sobrepase el {maxAllowedPct}% del costo total del proyecto.</p>
                  )}
                  {isBudgetValid && (
                    <p>Subsidio solicitado representa el {currentSubsidioPct.toFixed(1)}% del proyecto (tope: {maxAllowedPct}%). Aporte de tu empresa: ${totalAporteEmpresa.toLocaleString('es-CL')} CLP.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Live Financial Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Subsidio Solicitado</span>
                <strong className={`text-sm font-mono ${isSubsidyExceeded ? 'text-rose-400 font-bold' : 'text-cyan-400'}`}>
                  ${totalSubsidio.toLocaleString('es-CL')} CLP
                </strong>
                <span className="text-[10px] text-slate-500 block">Máx: ${maxAllowedSubsidy.toLocaleString('es-CL')}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Aporte Pecuniario (Caja)</span>
                <strong className="text-sm font-mono text-emerald-400">
                  ${totalAporteEmpresa.toLocaleString('es-CL')} CLP
                </strong>
                <span className="text-[10px] text-slate-500 block">Aporte privado obligatorio</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Costo Total Proyecto</span>
                <strong className="text-sm font-mono text-white">
                  ${totalProyecto.toLocaleString('es-CL')} CLP
                </strong>
                <span className="text-[10px] text-slate-500 block">Subsidio + Aporte</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">% Cofinanciamiento</span>
                <strong className={`text-sm font-mono ${isPctExceeded ? 'text-rose-400 font-bold' : 'text-amber-400'}`}>
                  {currentSubsidioPct.toFixed(1)}% Estatal
                </strong>
                <span className="text-[10px] text-slate-500 block">Máx permitido: {maxAllowedPct}%</span>
              </div>
            </div>

            {/* Budget Accounts Inputs Table */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Montos por Cuenta Presupuestaria
              </h4>

              <div className="space-y-3">
                {STANDARD_BUDGET_ACCOUNTS.map(acc => {
                  const data = budgetAccounts[acc.key] || {
                    corfoContributionCLP: 0,
                    companyPecuniaryCLP: 0,
                    item: acc.defaultItem,
                    justification: acc.defaultJustification
                  };

                  return (
                    <div 
                      key={acc.key}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <strong className="text-sm font-bold text-white">
                          {acc.account}
                        </strong>
                        <span className="text-xs font-mono text-slate-400">
                          Total cuenta: <strong className="text-slate-200">${((data.corfoContributionCLP || 0) + (data.companyPecuniaryCLP || 0)).toLocaleString('es-CL')} CLP</strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-cyan-300 block mb-1">
                            Subsidio Solicitado ({currentFund.agency}) en CLP:
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100000"
                            value={data.corfoContributionCLP || ''}
                            onChange={(e) => handleBudgetAccountChange(acc.key, 'corfoContributionCLP', Math.max(0, parseInt(e.target.value) || 0))}
                            placeholder="0"
                            className="w-full bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500 placeholder:italic"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-emerald-300 block mb-1">
                            Aporte Pecuniario Empresa (Caja) en CLP:
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="100000"
                            value={data.companyPecuniaryCLP || ''}
                            onChange={(e) => handleBudgetAccountChange(acc.key, 'companyPecuniaryCLP', Math.max(0, parseInt(e.target.value) || 0))}
                            placeholder="0"
                            className="w-full bg-slate-900 border border-slate-700 text-emerald-300 font-mono text-sm rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500 placeholder:text-slate-500 placeholder:italic"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">
                            Detalle del gasto o actividad:
                          </label>
                          <input
                            type="text"
                            value={data.item}
                            onChange={(e) => handleBudgetAccountChange(acc.key, 'item', e.target.value)}
                            placeholder={acc.defaultItem}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500 placeholder:italic"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">
                            Justificación técnica del gasto:
                          </label>
                          <input
                            type="text"
                            value={data.justification}
                            onChange={(e) => handleBudgetAccountChange(acc.key, 'justification', e.target.value)}
                            placeholder={acc.defaultJustification}
                            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-500 placeholder:text-slate-500 placeholder:italic"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* SECTIONS 1 TO 7: QUESTIONS & AI GENERATION */
          <div className="space-y-6">
            
            {/* Input Questions Grid */}
            <div className="space-y-4">
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
                  if (fullFormulation) {
                    onSendToAudit(fullFormulation, currentFund);
                  }
                }}
                disabled={!isBudgetValid}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all cursor-pointer w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>Finalizar y Enviar a Auditoría Ciega</span>
              </button>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
