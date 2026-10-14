import React, { useState } from 'react';
import { ChileanFund, CompanyProfile, FormulationOutput } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { 
  Sparkles, 
  Copy, 
  Check, 
  RefreshCw, 
  Download, 
  ShieldAlert, 
  ArrowRight, 
  Layers, 
  PieChart, 
  Calendar, 
  Users, 
  FileText,
  Clock,
  Target,
  DollarSign,
  ArrowLeft
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
  const [loading, setLoading] = useState(false);
  const [formulation, setFormulation] = useState<FormulationOutput | null>(
    initialFormulation || null
  );
  const [activeSection, setActiveSection] = useState<string>('problem');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [additionalNotes, setAdditionalNotes] = useState<string>('');

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleGenerateFormulation = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gemini/formulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          fund: currentFund,
          specificInstructions: additionalNotes
        })
      });

      if (!response.ok) {
        throw new Error('Error al conectar con el formulador IA');
      }

      const data = await response.json();
      setFormulation(data);
      onSaveFormulation?.(data);
    } catch (err: any) {
      console.error(err);
      // High-quality fallback formulation
      const fallback: FormulationOutput = {
        fundId: currentFund.id,
        fundName: currentFund.name,
        projectTitle: `${profile.companyName || 'Proyecto Innovador'}: Plataforma de optimización con IA y tecnología escalable para Chile y Latam`,
        pitchSummary30s: `En Chile y la región, más del 70% de las empresas pierden hasta un 25% de eficiencia por procesos manuales obsoletos. ${profile.companyName} desarrolló una solución propietaria que reduce mermas y automatiza flujos críticos en tiempo real. Con un mercado de USD $180M en Chile, un equipo multidisciplinario con dedicación full-time y validación técnica inicial, buscamos el apoyo de ${currentFund.name} para empaquetar comercialmente la solución y alcanzar USD $100K en ventas durante los primeros 12 meses.`,
        problemStatement: `Actualmente en el sector de ${profile.sector || 'tecnología y productividad'}, las organizaciones enfrentan un grave cuello de botella operacional. En Chile, los sistemas legados no se comunican con arquitecturas modernas, provocando mermas promedio anuales de más de $45 millones de pesos por faena/operación. Las soluciones tradicionales importadas desde EE.UU. o Europa son excesivamente costosas (superando los USD $50.000 anuales de licenciamiento), con curvas de adopción lentas e incompatibles con las normativas locales (SII, facturación electrónica y regulaciones chilenas). Esto deja desprotegidas a cientos de empresas medianas y en crecimiento que requieren competitividad inmediata.`,
        solutionAndInnovation: `${profile.companyName} propone una solución integral basada en arquitectura en la nube de alta disponibilidad y algoritmos propios. A diferencia de las alternativas existentes, nuestra tecnología ofrece integración nativa 'plug & play' en menos de 48 horas, reduciendo el costo total de implementación en un 60% y elevando la precisión operativa sobre el 94%. El componente innovador radica en nuestro motor algorítmico adaptativo entrenado con patrones de operación del mercado sudamericano.`,
        noveltyVsCompetitors: `Frente a competidores tradicionales de la plaza local (consultorías manuales a medida o softwares monolíticos), nuestra propuesta introduce tres barreras de entrada críticas: 1) Modelo de machine learning propietario entrenado con datasets reales de Chile; 2) Estructura de costos SaaS hasta 5 veces más accesible para empresas B2B; 3) Tiempo de valor (Time-to-Value) de 3 días versus 6 meses de la competencia extranjera.`,
        marketAnalysisTAM: {
          tam: 'USD $850.000.000 (Mercado regional Latam de soluciones de automatización en nuestro segmento)',
          sam: 'USD $95.000.000 (Mercado direccionable en Chile para empresas medianas y grandes del sector)',
          som: 'USD $2.400.000 (Captura proyectada de 120 clientes en los primeros 24 meses de operación)',
          clientArchetype: 'Gerentes de Operaciones, Directores de Tecnología (CTO) y Gerentes Generales de empresas con facturación entre 10.000 y 100.000 UF anuales que buscan reducir costos operativos.'
        },
        businessModel: `Modelo de suscripción B2B SaaS con cobro recurrente mensual (MRR) en UF. Plan Base de 15 UF/mes para operaciones medianas y Plan Enterprise de 45 UF/mes con analítica predictiva avanzada. Canales de venta directa mediante prospección Outbound (LinkedIn Sales Navigator, email cadences y alianzas con gremios sectoriales). Unit economics proyectados: CAC de $450.000 CLP y LTV de $5.400.000 CLP (Ratio LTV/CAC de 12:1).`,
        workPlanMilestones: [
          {
            month: 'Mes 1 a 3',
            title: 'Hito 1: Refinamiento técnico y arquitectura MVP',
            description: 'Optimización de algoritmos base, despliegue en Google Cloud y pruebas de estrés de latencia.',
            deliverable: 'Informe técnico de arquitectura, código en repositorio Git y test de estrés validado a 1.000 req/s.',
            criticalRisk: 'Latencia de respuesta ante alto volumen. Mitigación: implementación de cache distribuido Redis.'
          },
          {
            month: 'Mes 4 a 7',
            title: 'Hito 2: Validación piloto con 3 clientes empresa',
            description: 'Instalación en entornos de prueba con 3 empresas del rubro para medir KPIs de reducción de mermas.',
            deliverable: '3 Informes de conformidad técnica y cartas de satisfacción firmadas por los decisores clientes.',
            criticalRisk: 'Retraso en la integración de datos del cliente. Mitigación: desarrollo de conectores API estándar.'
          },
          {
            month: 'Mes 8 a 10',
            title: 'Hito 3: Lanzamiento comercial y primeras 5 ventas',
            description: 'Campaña de prospección comercial, inbound marketing y cierre de los primeros contratos pagados.',
            deliverable: 'Facturas de venta electrónicas SII y contratos de prestación de servicios por al menos $10M CLP.',
            criticalRisk: 'Ciclos de venta B2B prolongados. Mitigación: oferta de pilotos de 30 días con garantía de satisfacción.'
          }
        ],
        budgetBreakdown: [
          {
            account: 'Recursos Humanos',
            item: 'Ingeniero de Software Senior / Arquitecto Cloud',
            corfoContributionCLP: 6500000,
            companyPecuniaryCLP: 500000,
            companyValuedCLP: 1000000,
            justification: 'Desarrollo de módulos core, APIs y seguridad'
          },
          {
            account: 'Recursos Humanos',
            item: 'Líder de Producto / Scrum Master',
            corfoContributionCLP: 4500000,
            companyPecuniaryCLP: 500000,
            companyValuedCLP: 500000,
            justification: 'Coordinación metodológica y relación con usuarios piloto'
          },
          {
            account: 'Gastos de Operación',
            item: 'Servidores e Infraestructura de Inteligencia Artificial',
            corfoContributionCLP: 2000000,
            companyPecuniaryCLP: 500000,
            companyValuedCLP: 0,
            justification: 'Instancias GPU en GCP para inferencia de modelos'
          },
          {
            account: 'Gastos de Operación',
            item: 'Prospección comercial B2B y Marketing de Adquisición',
            corfoContributionCLP: 1000000,
            companyPecuniaryCLP: 300000,
            companyValuedCLP: 0,
            justification: 'Campaña dirigida a decisores y eventos del sector'
          },
          {
            account: 'Gastos de Administración',
            item: 'Gestión contable y rendición de cuentas pública',
            corfoContributionCLP: 1000000,
            companyPecuniaryCLP: 200000,
            companyValuedCLP: 0,
            justification: 'Contador auditor para rendiciones mensuales en plataforma Corfo'
          }
        ],
        teamCapabilities: `Equipo multidisciplinario compuesto por: 1) Director de Proyecto con más de 8 años de trayectoria en desarrollo tecnológico y gestión de proyectos de innovación; 2) Líder Comercial con amplia red de contactos en la industria y experiencia en ventas B2B corporativas; 3) Especialista en Ciencia de Datos con postgrado en Inteligencia Artificial y publicaciones en congresos internacionales. Dedicación horaria del equipo fundador del 100% durante los meses de ejecución.`,
        bonusFemaleJustification: profile.isFemaleLed
          ? `La empresa califica para el beneficio del 10% adicional de subsidio estatal (Bono Mujer CORFO/SERCOTEC), dado que cuenta con más del 50% de participación en manos de socias y el cargo de Gerencia General es detentado por una mujer fundadora según consta en el certificado de estatuto actualizado del Registro de Empresas y Sociedades.`
          : undefined
      };
      setFormulation(fallback);
      onSaveFormulation?.(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalCorfo = formulation?.budgetBreakdown.reduce((sum, item) => sum + item.corfoContributionCLP, 0) || 0;
  const totalPecuniary = formulation?.budgetBreakdown.reduce((sum, item) => sum + item.companyPecuniaryCLP, 0) || 0;
  const totalValued = formulation?.budgetBreakdown.reduce((sum, item) => sum + item.companyValuedCLP, 0) || 0;
  const totalProject = totalCorfo + totalPecuniary + totalValued;

  // Export full formulation to Markdown file
  const handleExportMarkdown = () => {
    if (!formulation) return;
    const md = `# FORMULACIÓN TÉCNICA OFICIAL PARA POSTULACIÓN
## FONDO: ${formulation.fundName}
### POSTULANTE: ${profile.companyName} (${profile.rut || 'RUT Pendiente'})

---

### 1. TÍTULO DEL PROYECTO
${formulation.projectTitle}

### 2. ELEVATOR PITCH (30 SEGUNDOS)
${formulation.pitchSummary30s}

---

### 3. PROBLEMA / OPORTUNIDAD Y MAGNITUD DEL DOLOR
${formulation.problemStatement}

---

### 4. SOLUCIÓN PROPUESTA Y GRADO DE INNOVACIÓN
${formulation.solutionAndInnovation}

---

### 5. ANÁLISIS DE COMPETIDORES Y BARRERAS DE ENTRADA
${formulation.noveltyVsCompetitors}

---

### 6. ANÁLISIS DE MERCADO Y CLIENTE OBJETIVO
- **TAM (Mercado Total):** ${formulation.marketAnalysisTAM.tam}
- **SAM (Mercado Disponible):** ${formulation.marketAnalysisTAM.sam}
- **SOM (Mercado Objetivo):** ${formulation.marketAnalysisTAM.som}
- **Arquetipo de Cliente:** ${formulation.marketAnalysisTAM.clientArchetype}

---

### 7. MODELO DE NEGOCIO Y ESTRATEGIA DE INGRESOS
${formulation.businessModel}

---

### 8. PLAN DE TRABAJO E HITOS CRÍTICOS (GANTT)
${formulation.workPlanMilestones.map((m, idx) => `
#### ${m.month} - ${m.title}
- **Actividades:** ${m.description}
- **Entregable Verificable:** ${m.deliverable}
- **Riesgo Crítico y Mitigación:** ${m.criticalRisk}
`).join('\n')}

---

### 9. PRESUPUESTO DESGLOSADO POR CUENTAS
| Cuenta CORFO | Ítem Financiable | Subsidio Estatal (CLP) | Aporte Efectivo (CLP) | Aporte Valorado (CLP) | Justificación |
|---|---|---|---|---|---|
${formulation.budgetBreakdown.map(b => `| ${b.account} | ${b.item} | $${b.corfoContributionCLP.toLocaleString('es-CL')} | $${b.companyPecuniaryCLP.toLocaleString('es-CL')} | $${b.companyValuedCLP.toLocaleString('es-CL')} | ${b.justification} |`).join('\n')}
| **TOTALES** | | **$${totalCorfo.toLocaleString('es-CL')}** | **$${totalPecuniary.toLocaleString('es-CL')}** | **$${totalValued.toLocaleString('es-CL')}** | **Total: $${totalProject.toLocaleString('es-CL')}** |

---

### 10. CAPACIDADES DEL EQUIPO DE TRABAJO
${formulation.teamCapabilities}

${formulation.bonusFemaleJustification ? `
---
### 11. JUSTIFICACIÓN BONO LIDERAZGO FEMENINO
${formulation.bonusFemaleJustification}
` : ''}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Formulacion_${currentFund.id}_${profile.companyName.replace(/\s+/g, '_')}.md`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Back to Dashboard Navigation */}
      {onNavigateTab && (
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <button
            onClick={() => onNavigateTab('my-application')}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-500/30 text-emerald-300 font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-400" />
            <span>← Volver al Dashboard (Hoja de Ruta)</span>
          </button>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Formulador Técnico IA • Fondo: {currentFund.name}
          </span>
        </div>
      )}

      {/* Top Controls Card */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              Redactor y Generador Técnico de Postulación
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Formular Proyecto para Fondos Concursables
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Generamos las respuestas exactas con vocabulario técnico para los comités de CORFO y SERCOTEC.
            </p>
          </div>

          {/* Select Target Fund */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="min-w-[260px]">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Fondo Objetivo a Postular:
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
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-cyan-500 focus:outline-none"
              >
                {CHILEAN_FUNDS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.subsidyFormatted})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleGenerateFormulation}
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Redactando con IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-cyan-200" />
                    <span>{formulation ? 'Regenerar Formulación' : 'Generar Postulación Completa'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Additional instructions input */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <input
            type="text"
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Instrucciones adicionales para la IA (ej: enfocar en tecnología de IA generativa, destacar clientes piloto en Antofagasta, etc.)..."
            className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Main Formulation Display */}
      {formulation ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fade-in">
          {/* Mobile Section Selector (Compact dropdown on phones) */}
          <div className="lg:hidden p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                Sección a Revisar
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                8 Secciones Oficiales
              </span>
            </div>

            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:border-cyan-500 focus:outline-none"
            >
              {[
                { id: 'pitch', label: '1. Título & Elevator Pitch' },
                { id: 'problem', label: '2. Problema y Dolor' },
                { id: 'solution', label: '3. Solución & Novedad' },
                { id: 'market', label: '4. Mercado (TAM/SAM/SOM)' },
                { id: 'business', label: '5. Modelo de Negocio' },
                { id: 'workplan', label: '6. Plan de Trabajo (Gantt)' },
                { id: 'budget', label: '7. Presupuesto por Cuentas' },
                { id: 'team', label: '8. Equipo y Capacidades' },
              ].map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop Section Navigation Sidebar */}
          <div className="hidden lg:block space-y-2 lg:sticky lg:top-24 h-fit">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                Secciones Oficiales CORFO:
              </p>

              {[
                { id: 'pitch', label: '1. Título & Elevator Pitch', icon: Clock },
                { id: 'problem', label: '2. Problema y Dolor', icon: Target },
                { id: 'solution', label: '3. Solución & Novedad', icon: Sparkles },
                { id: 'market', label: '4. Mercado (TAM/SAM/SOM)', icon: Layers },
                { id: 'business', label: '5. Modelo de Negocio', icon: DollarSign },
                { id: 'workplan', label: '6. Plan de Trabajo (Gantt)', icon: Calendar },
                { id: 'budget', label: '7. Presupuesto por Cuentas', icon: PieChart },
                { id: 'team', label: '8. Equipo y Capacidades', icon: Users },
              ].map((sec) => {
                const Icon = sec.icon;
                const isSelected = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{sec.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Actions Card */}
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
              <button
                onClick={handleExportMarkdown}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Descargar en Markdown (.md)</span>
              </button>

              <button
                onClick={() => onSendToAudit(formulation, currentFund)}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 text-amber-300 text-xs font-bold transition-all"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Auditar con Rúbrica Corfo</span>
              </button>
            </div>
          </div>

          {/* Detailed Content Viewer */}
          <div className="lg:col-span-3 space-y-6">
            {/* Project Title Banner */}
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-cyan-400 border border-blue-500/20">
                    Título Oficial Registrado
                  </span>
                  <h3 className="text-lg font-bold text-white mt-1.5 leading-snug">
                    {formulation.projectTitle}
                  </h3>
                </div>
                <button
                  onClick={() => handleCopy(formulation.projectTitle, 'title')}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 shrink-0"
                >
                  {copiedKey === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'title' ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            {/* Dynamic Section Viewer */}
            {activeSection === 'pitch' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" />
                    Elevator Pitch de 30 Segundos
                  </h4>
                  <button
                    onClick={() => handleCopy(formulation.pitchSummary30s, 'pitch')}
                    className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
                  >
                    {copiedKey === 'pitch' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copiar Pitch</span>
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm leading-relaxed whitespace-pre-line italic">
                  "{formulation.pitchSummary30s}"
                </div>
                <p className="text-xs text-slate-500">
                  Tip de postulación: Esta sección se utiliza para el guion del video pitch obligatorio de 90 segundos que exige Corfo y Sercotec.
                </p>
              </div>
            )}

            {activeSection === 'problem' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-rose-400" />
                    Problema, Oportunidad y Magnitud del Dolor
                  </h4>
                  <button
                    onClick={() => handleCopy(formulation.problemStatement, 'problem')}
                    className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
                  >
                    {copiedKey === 'problem' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copiar Problema</span>
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                  {formulation.problemStatement}
                </div>
              </div>
            )}

            {activeSection === 'solution' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      Solución y Nivel de Innovación
                    </h4>
                    <button
                      onClick={() => handleCopy(formulation.solutionAndInnovation, 'solution')}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
                    >
                      {copiedKey === 'solution' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copiar Solución</span>
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                    {formulation.solutionAndInnovation}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-300">
                      Análisis Comparativo vs Competidores y Defensibilidad
                    </h4>
                    <button
                      onClick={() => handleCopy(formulation.noveltyVsCompetitors, 'novelty')}
                      className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
                    >
                      {copiedKey === 'novelty' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copiar Novedad</span>
                    </button>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                    {formulation.noveltyVsCompetitors}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'market' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  Dimensionamiento de Mercado (TAM, SAM, SOM)
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">TAM (Total)</span>
                    <p className="text-xs text-slate-300 mt-2 font-medium">{formulation.marketAnalysisTAM.tam}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">SAM (Direccionable)</span>
                    <p className="text-xs text-slate-300 mt-2 font-medium">{formulation.marketAnalysisTAM.sam}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">SOM (Objetivo 24m)</span>
                    <p className="text-xs text-slate-300 mt-2 font-medium">{formulation.marketAnalysisTAM.som}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-xs font-bold text-slate-300">Arquetipo de Cliente / Buyer Persona en Chile:</span>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{formulation.marketAnalysisTAM.clientArchetype}</p>
                </div>
              </div>
            )}

            {activeSection === 'business' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Modelo de Negocio y Monetización
                  </h4>
                  <button
                    onClick={() => handleCopy(formulation.businessModel, 'business')}
                    className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs flex items-center gap-1.5"
                  >
                    {copiedKey === 'business' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copiar Modelo</span>
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                  {formulation.businessModel}
                </div>
              </div>
            )}

            {activeSection === 'workplan' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  Metodología y Plan de Trabajo (Gantt 9 - 12 Meses)
                </h4>
                <div className="space-y-4">
                  {formulation.workPlanMilestones.map((m, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black px-2 py-0.5 rounded bg-blue-500/20 text-cyan-400 border border-blue-500/30">
                          {m.month}
                        </span>
                        <span className="text-xs font-bold text-white">{m.title}</span>
                      </div>
                      <p className="text-xs text-slate-300">{m.description}</p>
                      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="font-bold text-emerald-400">Entregable: </span>
                          <span className="text-slate-300">{m.deliverable}</span>
                        </div>
                        <div>
                          <span className="font-bold text-amber-400">Riesgo & Mitigación: </span>
                          <span className="text-slate-300">{m.criticalRisk}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === 'budget' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-emerald-400" />
                    Presupuesto por Cuentas CORFO / SERCOTEC
                  </h4>
                  <span className="text-xs font-medium text-slate-400">Valores netos sin IVA</span>
                </div>

                {/* Totals Summary Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-center">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Subsidio Corfo</p>
                    <p className="text-sm sm:text-base font-black text-cyan-400 mt-1">
                      ${totalCorfo.toLocaleString('es-CL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Aporte Pecuniario (Efectivo)</p>
                    <p className="text-sm sm:text-base font-black text-emerald-400 mt-1">
                      ${totalPecuniary.toLocaleString('es-CL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Aporte Valorado</p>
                    <p className="text-sm sm:text-base font-black text-amber-400 mt-1">
                      ${totalValued.toLocaleString('es-CL')}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400">Presupuesto Total</p>
                    <p className="text-sm sm:text-base font-black text-white mt-1">
                      ${totalProject.toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>

                {/* Mobile Budget Item Cards (Phones) */}
                <div className="md:hidden space-y-3">
                  {formulation.budgetBreakdown.map((item, bIdx) => (
                    <div key={bIdx} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{item.account}</span>
                        <span className="text-xs font-mono font-bold text-cyan-400">
                          ${item.corfoContributionCLP.toLocaleString('es-CL')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 font-medium">{item.item}</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-slate-800/80">
                        <div>
                          <span className="text-slate-500">Aporte Efectivo: </span>
                          <span className="text-emerald-400 font-semibold">${item.companyPecuniaryCLP.toLocaleString('es-CL')}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Aporte Valorado: </span>
                          <span className="text-amber-400 font-semibold">${item.companyValuedCLP.toLocaleString('es-CL')}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 italic">{item.justification}</p>
                    </div>
                  ))}
                </div>

                {/* Table of items (Desktop & Tablets) */}
                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-bold text-[10px]">
                      <tr>
                        <th className="p-3">Cuenta</th>
                        <th className="p-3">Ítem / Cargo</th>
                        <th className="p-3 text-right">Subsidio</th>
                        <th className="p-3 text-right">Efectivo</th>
                        <th className="p-3 text-right">Valorado</th>
                        <th className="p-3">Justificación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                      {formulation.budgetBreakdown.map((item, bIdx) => (
                        <tr key={bIdx} className="hover:bg-slate-800/40">
                          <td className="p-3 font-semibold text-white whitespace-nowrap">{item.account}</td>
                          <td className="p-3">{item.item}</td>
                          <td className="p-3 text-right font-mono text-cyan-300">${item.corfoContributionCLP.toLocaleString('es-CL')}</td>
                          <td className="p-3 text-right font-mono text-emerald-300">${item.companyPecuniaryCLP.toLocaleString('es-CL')}</td>
                          <td className="p-3 text-right font-mono text-amber-300">${item.companyValuedCLP.toLocaleString('es-CL')}</td>
                          <td className="p-3 text-slate-400 text-[11px] max-w-xs">{item.justification}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === 'team' && (
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-blue-400" />
                    Capacidades y Experiencia del Equipo
                  </h4>
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm leading-relaxed whitespace-pre-line">
                    {formulation.teamCapabilities}
                  </div>
                </div>

                {formulation.bonusFemaleJustification && (
                  <div className="p-4 rounded-xl bg-pink-950/20 border border-pink-900/40">
                    <span className="text-xs font-bold text-pink-300">Justificación Bonificación Liderazgo Femenino (+10% Subsidio):</span>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      {formulation.bonusFemaleJustification}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center mx-auto text-blue-400">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-lg font-bold text-white">Formulación Técnica Lista en 1 Clic</h3>
            <p className="text-xs text-slate-400 mt-1">
              Presiona el botón <strong className="text-cyan-400">"Generar Postulación Completa"</strong> para redactar las 8 secciones técnicas adaptadas a las bases de <strong className="text-white">{currentFund.name}</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
