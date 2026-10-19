import React, { useState, useEffect } from 'react';
import { ChileanFund, CompanyProfile, FormulationOutput } from '../types/funds';
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
  FileText
} from 'lucide-react';

interface AiFormulatorProps {
  selectedFund: ChileanFund | null;
  setSelectedFund: (f: ChileanFund) => void;
  profile: CompanyProfile;
  initialFormulation?: FormulationOutput | null;
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

const SECTIONS: SectionDefinition[] = [
  {
    id: 'problem',
    stepNumber: 1,
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
    stepNumber: 2,
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
        key: 'difference',
        label: '¿Cuál es la diferencia o ventaja frente a lo existente en Chile?',
        placeholder: 'Ej: Es 60% más económico de implementar y procesa alertas climáticas en tiempo real...',
        helpText: 'Destaca las barreras de entrada y factores diferenciadores.'
      }
    ]
  },
  {
    id: 'market',
    stepNumber: 3,
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
        key: 'pricing',
        label: '¿Cuál es el precio estimado o modelo de cobro?',
        placeholder: 'Ej: Suscripción SaaS mensual de $150.000 CLP por sucursal más costo de instalación único...',
        helpText: 'Modelo de monetización (SaaS, comisión, venta unitaria, etc.).'
      },
      {
        key: 'size',
        label: '¿Cuál es el tamaño aproximado de mercado en Chile o Latam?',
        placeholder: 'Ej: En Chile existen más de 12.000 empresas agrícolas; mercado potencial de $30 millones USD...',
        helpText: 'Si no tienes el dato exacto, la IA redactará [COMPLETAR: tamaño de mercado objetivo].'
      }
    ]
  },
  {
    id: 'team',
    stepNumber: 4,
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
    id: 'model',
    stepNumber: 5,
    title: 'Modelo de Negocio y Plan de Trabajo',
    badge: 'Criterio Viabilidad y Ejecución',
    questions: [
      {
        key: 'revenue',
        label: '¿Cuáles serán las fuentes de ingresos y estrategia de ventas (Go-to-Market)?',
        placeholder: 'Ej: Venta directa a través de pilotos comerciales, inbound marketing y convenios gremiales...',
        helpText: 'Canales y mecanismos para conseguir los primeros clientes con el subsidio.'
      },
      {
        key: 'milestones',
        label: '¿Cuáles son los 3 hitos clave planificados para los primeros 12 meses?',
        placeholder: 'Ej: Mes 3: Prototipo beta en laboratorio; Mes 7: Piloto con 3 clientes pagando; Mes 12: Escalamiento comercial...',
        helpText: 'Entregables verificables que Corfo y Sercotec exigen en cada rendición.'
      },
      {
        key: 'budget',
        label: '¿Cuáles son los principales gastos en que se usará el subsidio estatal?',
        placeholder: 'Ej: 60% en recursos humanos (desarrolladores), 25% en validación comercial y 15% en póliza de garantía...',
        helpText: 'Se ajustará automáticamente a las cuentas presupuestarias permitidas del fondo.'
      }
    ]
  }
];

export const AiFormulator: React.FC<AiFormulatorProps> = ({
  selectedFund,
  setSelectedFund,
  profile,
  initialFormulation,
  onSaveFormulation,
  onSendToAudit,
  onNavigateTab
}) => {
  const [currentFund, setCurrentFund] = useState<ChileanFund>(
    selectedFund || CHILEAN_FUNDS[0]
  );

  // Active step index (0 to 4)
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0);
  const { hasActivePlan, isExpired } = usePlan();
  const [showPaywall, setShowPaywall] = useState<boolean>(false);

  // User input answers for each section
  const [answersBySection, setAnswersBySection] = useState<Record<string, Record<string, string>>>({
    problem: {},
    solution: {},
    market: {},
    team: {},
    model: {}
  });

  // Generated texts per section (editable)
  const [generatedTexts, setGeneratedTexts] = useState<Record<string, string>>({
    problem: initialFormulation?.problemStatement || '',
    solution: initialFormulation?.solutionAndInnovation || '',
    market: initialFormulation?.marketAnalysisTAM 
      ? `TAM: ${initialFormulation.marketAnalysisTAM.tam}
SAM: ${initialFormulation.marketAnalysisTAM.sam}
SOM: ${initialFormulation.marketAnalysisTAM.som}
Arquetipo: ${initialFormulation.marketAnalysisTAM.clientArchetype}`
      : '',
    team: initialFormulation?.teamCapabilities || '',
    model: initialFormulation?.businessModel || ''
  });

  // Keep full formulation object
  const [fullFormulation, setFullFormulation] = useState<FormulationOutput | null>(
    initialFormulation || null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const currentSection = SECTIONS[currentSectionIndex];

  // Helper to handle answer changes
  const handleAnswerChange = (qKey: string, val: string) => {
    setAnswersBySection(prev => ({
      ...prev,
      [currentSection.id]: {
        ...(prev[currentSection.id] || {}),
        [qKey]: val
      }
    }));
  };

  // Helper to handle generated text changes (user edits)
  const handleTextEdit = (val: string) => {
    setGeneratedTexts(prev => ({
      ...prev,
      [currentSection.id]: val
    }));
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
          fund: currentFund,
          sectionKey: currentSection.id,
          sectionTitle: currentSection.title,
          questionsAndAnswers: questionsObj,
          projectSummary: profile.projectSummary
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

      setGeneratedTexts(prev => ({
        ...prev,
        [currentSection.id]: generated
      }));

      // Update full formulation draft
      updateFullFormulationDraft(currentSection.id, generated);

      setSavedNotice(`¡Sección "${currentSection.title}" generada! Puedes editar el texto a continuación.`);
      setTimeout(() => setSavedNotice(null), 4000);
    } catch (err: any) {
      console.error('Section formulation error:', err);
      setError(err?.message || 'El servicio de IA no está disponible. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Update full formulation draft
  const updateFullFormulationDraft = (sectionId: string, text: string) => {
    const updatedTexts = { ...generatedTexts, [sectionId]: text };

    const problem = updatedTexts.problem || 'Problema en desarrollo.';
    const solution = updatedTexts.solution || 'Solución innovadora en desarrollo.';
    const team = updatedTexts.team || 'Equipo interdisciplinario con dedicación técnica.';
    const model = updatedTexts.model || 'Modelo de negocios orientado a validación.';

    const draft: FormulationOutput = {
      fundId: currentFund.id,
      fundName: currentFund.name,
      projectTitle: fullFormulation?.projectTitle || `Proyecto de Innovación ${profile.companyName || 'Empresa Postulante'}`,
      pitchSummary30s: fullFormulation?.pitchSummary30s || `${solution} Diseñado para resolver ${problem.slice(0, 100)}...`,
      problemStatement: problem,
      solutionAndInnovation: solution,
      noveltyVsCompetitors: fullFormulation?.noveltyVsCompetitors || 'Diferenciación basada en tecnología propietaria y menores costos de adopción.',
      marketAnalysisTAM: fullFormulation?.marketAnalysisTAM || {
        tam: '$35.000.000 USD (Mercado Latinoamericano)',
        sam: '$4.500.000 USD (Mercado Nacional)',
        som: '$850.000 USD (Meta 18 meses)',
        clientArchetype: 'Clientes empresariales B2B y personas con necesidad de automatización'
      },
      businessModel: model,
      workPlanMilestones: fullFormulation?.workPlanMilestones || [
        {
          month: 'Mes 1 a 3',
          title: 'Hito 1: Validación y Prototipado',
          description: 'Desarrollo de especificaciones y pruebas de laboratorio.',
          deliverable: 'Informe técnico de validación y prototipo funcional.',
          criticalRisk: 'Demoras en adquisición de insumos; mitigado con proveedores locales.'
        },
        {
          month: 'Mes 4 a 8',
          title: 'Hito 2: Pilotos en Terreno',
          description: 'Implementación con usuarios de prueba y primeras cartas LOI.',
          deliverable: 'Actas de conformidad de pruebas piloto.',
          criticalRisk: 'Ajustes en interfaz; mitigado con iteraciones semanales.'
        },
        {
          month: 'Mes 9 a 12',
          title: 'Hito 3: Comercialización y Escalamiento',
          description: 'Campaña comercial y formalización de contratos de venta.',
          deliverable: 'Facturas de venta o cartas de intención firmadas.',
          criticalRisk: 'Ciclos de venta prolongados; mitigado con descuentos de entrada.'
        }
      ],
      budgetBreakdown: fullFormulation?.budgetBreakdown || [
        {
          account: 'Recursos Humanos',
          item: 'Equipo de desarrollo y líder técnico',
          corfoContributionCLP: Math.round(currentFund.maxSubsidyCLP * 0.55),
          companyPecuniaryCLP: Math.round(currentFund.maxSubsidyCLP * 0.12),
          companyValuedCLP: 0,
          justification: 'Dedicación al desarrollo de la solución.'
        },
        {
          account: 'Gastos de Operación',
          item: 'Validación en terreno y pilotos comerciales',
          corfoContributionCLP: Math.round(currentFund.maxSubsidyCLP * 0.35),
          companyPecuniaryCLP: Math.round(currentFund.maxSubsidyCLP * 0.08),
          companyValuedCLP: 0,
          justification: 'Insumos de prueba y prospección de clientes.'
        },
        {
          account: 'Administración y Garantías',
          item: 'Póliza de garantía de anticipo',
          corfoContributionCLP: Math.round(currentFund.maxSubsidyCLP * 0.10),
          companyPecuniaryCLP: 0,
          companyValuedCLP: 0,
          justification: 'Costo financiero para anticipar el 100% del subsidio.'
        }
      ],
      teamCapabilities: team,
      bonusFemaleJustification: profile.isFemaleLed
        ? 'Empresa liderada por mujeres con participación societaria mayor al 50%, acreditada mediante estatuto social.'
        : undefined
    };

    setFullFormulation(draft);
    onSaveFormulation?.(draft);
  };

  // Next section handler
  const handleNextSection = () => {
    // Save current section text to full formulation
    updateFullFormulationDraft(currentSection.id, generatedTexts[currentSection.id] || '');

    if (currentSectionIndex < SECTIONS.length - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else {
      setSavedNotice('¡Felicitaciones! Has completado todas las secciones de tu formulación técnica.');
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
${fullFormulation.projectTitle}

### 2. ELEVATOR PITCH (30 SEGUNDOS)
${fullFormulation.pitchSummary30s}

---
### 3. PROBLEMA / OPORTUNIDAD Y MAGNITUD DEL DOLOR
${generatedTexts.problem || fullFormulation.problemStatement}

---
### 4. SOLUCIÓN PROPUESTA Y GRADO DE INNOVACIÓN
${generatedTexts.solution || fullFormulation.solutionAndInnovation}

---
### 5. ANÁLISIS DE MERCADO Y CLIENTES
${generatedTexts.market}

---
### 6. CAPACIDADES DEL EQUIPO DE TRABAJO
${generatedTexts.team || fullFormulation.teamCapabilities}

---
### 7. MODELO DE NEGOCIO Y PLAN DE TRABAJO
${generatedTexts.model || fullFormulation.businessModel}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Formulacion_${currentFund.id}_${(profile.companyName || 'Proyecto').replace(/\s+/g, '_')}.md`;
    link.click();
  };

  const currentSectionText = generatedTexts[currentSection.id] || '';
  const currentAnswers = answersBySection[currentSection.id] || {};
  const hasGeneratedCurrent = currentSectionText.trim().length > 0;
  const isAllCompleted = SECTIONS.every(s => (generatedTexts[s.id] || '').trim().length > 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('my-application')}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-emerald-500 text-xs font-bold text-slate-700 hover:text-emerald-700 shadow-xs transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a Mi Hoja de Ruta</span>
            </button>
          )}
          <span className="text-xs text-slate-500 hidden md:inline">
            Fondo Objetivo: <strong className="text-slate-900">{currentFund.name}</strong>
          </span>
        </div>

        {/* Target Fund Selector */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Fondo:
          </label>
          <select
            value={currentFund.id}
            onChange={(e) => {
              const f = CHILEAN_FUNDS.find(item => item.id === e.target.value);
              if (f) {
                setCurrentFund(f);
                setSelectedFund(f);
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:border-blue-600 focus:outline-hidden"
          >
            {CHILEAN_FUNDS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.subsidyFormatted})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-50/80 via-white to-emerald-50/40 border border-blue-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-[11px] font-black uppercase tracking-wider mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Formulador por Secciones IA</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
            Redacción Asistida Sección por Sección
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Ingresa 2 o 3 datos de tu proyecto por cada sección. La IA redactará el texto técnico formal prohibiendo inventar cifras.
          </p>
        </div>

        {/* Quick actions when completed */}
        {fullFormulation && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportMarkdown}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:border-blue-500 text-xs font-bold text-slate-700 hover:text-blue-700 shadow-xs transition-colors cursor-pointer"
              title="Descargar toda la formulación en formato Markdown"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Exportar .md</span>
            </button>
            <button
              onClick={() => onSendToAudit(fullFormulation, currentFund)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Auditar con Rúbrica</span>
            </button>
          </div>
        )}
      </div>

      {/* Section Steps Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {SECTIONS.map((sec, idx) => {
            const isCurrent = idx === currentSectionIndex;
            const isDone = (generatedTexts[sec.id] || '').trim().length > 0;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  setCurrentSectionIndex(idx);
                  window.scrollTo({ top: 120, behavior: 'smooth' });
                }}
                className={`p-2.5 rounded-xl text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-sm'
                    : isDone
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <div className="min-w-0">
                  <span className={`text-[10px] uppercase font-bold block ${
                    isCurrent ? 'text-blue-200' : isDone ? 'text-emerald-700' : 'text-slate-400'
                  }`}>
                    Sección {sec.stepNumber}
                  </span>
                  <span className="text-xs font-bold truncate block">
                    {sec.title}
                  </span>
                </div>
                {isDone && !isCurrent ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-white' : 'bg-slate-300'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE SECTION WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Input Questions (2 or 3 project questions) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black uppercase">
                  {currentSection.badge}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  Paso {currentSection.stepNumber} de 5
                </span>
              </div>
              <h3 className="text-lg font-black text-slate-900">
                {currentSection.title}
              </h3>
              <p className="text-xs text-slate-500">
                Completa estos datos de tu proyecto antes de generar la redacción técnica.
              </p>
            </div>

            {/* Questions inputs */}
            <div className="space-y-3 pt-1">
              {currentSection.questions.map((q) => (
                <div key={q.key} className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800 leading-snug">
                    {q.label}
                  </label>
                  <textarea
                    rows={2}
                    value={currentAnswers[q.key] || ''}
                    onChange={(e) => handleAnswerChange(q.key, e.target.value)}
                    placeholder={q.placeholder}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                  />
                  <p className="text-[10px] text-slate-400">
                    {q.helpText}
                  </p>
                </div>
              ))}
            </div>

            {/* Generate Section Button */}
            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleGenerateSection}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600 hover:from-blue-700 hover:to-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Redactando sección con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>{hasGeneratedCurrent ? 'Regenerar esta Sección' : 'Generar Sección con IA'}</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-slate-400 mt-2">
                Prompt configurado con prohibición estricta de inventar cifras.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Generated & Editable Output */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-black text-slate-900">
                  Redacción Técnica Oficial (Editable)
                </h4>
              </div>
              {hasGeneratedCurrent && (
                <button
                  onClick={() => handleCopy(currentSectionText, currentSection.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
                >
                  {copiedKey === currentSection.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Notice / Status */}
            {savedNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{savedNotice}</span>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={handleGenerateSection}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-700 cursor-pointer"
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* Editable Text Area */}
            <div>
              <textarea
                rows={14}
                value={currentSectionText}
                onChange={(e) => handleTextEdit(e.target.value)}
                placeholder="Presiona 'Generar Sección con IA' a la izquierda para redactar el texto técnico de esta sección con los criterios oficiales de CORFO y SERCOTEC..."
                className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 text-slate-800 text-xs sm:text-sm leading-relaxed focus:outline-hidden transition-all font-sans"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
                <span>
                  {currentSectionText.trim().length > 0 
                    ? `${currentSectionText.split(/\s+/).filter(Boolean).length} palabras • ${currentSectionText.length} caracteres` 
                    : 'Texto pendiente de redacción'}
                </span>
                {currentSectionText.includes('[COMPLETAR:') && (
                  <span className="text-amber-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Contiene etiquetas [COMPLETAR: ...] para rellenar
                  </span>
                )}
              </div>
            </div>

            {/* Section Footer Navigation Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                {currentSectionIndex > 0 ? (
                  <button
                    onClick={handlePrevSection}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Sección Anterior</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 hidden sm:inline">
                    Sección inicial de la formulación
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleNextSection}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                >
                  <span>
                    {currentSectionIndex < SECTIONS.length - 1 
                      ? 'Guardar y Pasar a Siguiente Sección' 
                      : 'Guardar y Finalizar Formulación'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
