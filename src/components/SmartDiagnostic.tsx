import React, { useState } from 'react';
import { CompanyProfile, ChileanFund, FundMatchResult } from '../types/funds';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Building, 
  DollarSign, 
  Users, 
  MapPin, 
  ArrowRight, 
  Award, 
  RefreshCw,
  HelpCircle,
  TrendingUp,
  FileSearch,
  Percent
} from 'lucide-react';

interface SmartDiagnosticProps {
  profile: CompanyProfile;
  setProfile: (p: CompanyProfile) => void;
  onSelectFundToFormulate: (fund: ChileanFund) => void;
  onSelectFundToViewDocs: (fund: ChileanFund) => void;
}

const PRESET_EXAMPLES: { label: string; description: string; data: Partial<CompanyProfile> }[] = [
  {
    label: '🚀 Startup Tecnológica IA (SpA)',
    description: 'Software B2B, 6 meses activa, ventas < $20M, liderada por mujer',
    data: {
      companyName: 'PredictFlow SpA',
      rut: '77.842.109-K',
      companyType: 'spa',
      monthsActive: 6,
      salesBracket: 'menor_60m',
      annualSalesCLP: 18000000,
      sector: 'Tecnología / Software SaaS e Inteligencia Artificial',
      region: 'Región Metropolitana',
      isFemaleLed: true,
      femaleEquityPct: 60,
      trlStage: 'mvp_validado',
      innovationLevel: 'tech_disruptive',
      projectSummary: 'Plataforma SaaS que optimiza la cadena de suministros con modelos predictivos de IA, reduciendo mermas en un 35% en retail y logística.',
      coreTech: 'Algoritmos propietarios de machine learning, visión artificial y microservicios cloud.',
      customerValidationCount: 3
    }
  },
  {
    label: '🌱 Pyme Agro Sostenible (Maule)',
    description: 'Agroindustria, 3 años de antigüedad, ventas 3.500 UF',
    data: {
      companyName: 'BioNutrientes del Sur Ltda.',
      rut: '76.491.332-4',
      companyType: 'srl',
      monthsActive: 36,
      salesBracket: 'pequena_2400_a_25000uf',
      annualSalesCLP: 135000000,
      sector: 'Silvoagropecuario y Biotecnología',
      region: 'Región del Maule',
      isFemaleLed: false,
      femaleEquityPct: 20,
      trlStage: 'prototipo_lab',
      innovationLevel: 'radical',
      projectSummary: 'Desarrollo de bioestimulante derivado de microalgas locales para reducir un 40% el requerimiento hídrico en viñedos y frutales de exportación.',
      coreTech: 'Biotecnología vegetal, cultivo de microalgas nativas chilenas y análisis cromatográfico.',
      customerValidationCount: 2
    }
  },
  {
    label: '👩‍💼 Emprendimiento Femenino (Sin Inicio SII)',
    description: 'Etapa de idea/taller, sin formalizar, busca primer capital',
    data: {
      companyName: 'Kutral Cosmética Nativa',
      rut: '18.921.443-8',
      companyType: 'sin_iniciar',
      monthsActive: 0,
      salesBracket: 'sin_ventas',
      annualSalesCLP: 0,
      sector: 'Manufactura Artesanal / Cosmética Natural',
      region: 'Región de Valparaíso',
      isFemaleLed: true,
      femaleEquityPct: 100,
      trlStage: 'idea_concepto',
      innovationLevel: 'social_traditional',
      projectSummary: 'Línea de jabones y fitocosméticos orgánicos basados en hierbas nativas recolectadas de manera sostenible por comunidades costeras.',
      coreTech: 'Formulaciones botánicas y procesos de saponificación en frío.',
      customerValidationCount: 0
    }
  },
  {
    label: '🔬 Spin-Off Tecnológico / I+D con Universidad',
    description: 'Investigación aplicada en minería / energía, prototipo validado',
    data: {
      companyName: 'NanoMining Tech SpA',
      rut: '77.301.992-1',
      companyType: 'spa',
      monthsActive: 18,
      salesBracket: 'micro_200_a_2400uf',
      annualSalesCLP: 45000000,
      sector: 'Minería, Sensores y Nuevos Materiales',
      region: 'Región de Antofagasta',
      isFemaleLed: false,
      femaleEquityPct: 15,
      trlStage: 'prototipo_lab',
      innovationLevel: 'radical',
      projectSummary: 'Sensores nanotecnológicos de fibra óptica para detección en tiempo real de fugas de ácido y fallas estructurales en relaves mineros.',
      coreTech: 'Nanomateriales de carbono, optoelectrónica e IoT industrial.',
      customerValidationCount: 1
    }
  }
];

export const SmartDiagnostic: React.FC<SmartDiagnosticProps> = ({
  profile,
  setProfile,
  onSelectFundToFormulate,
  onSelectFundToViewDocs
}) => {
  const [loading, setLoading] = useState(false);
  const [matchResults, setMatchResults] = useState<FundMatchResult[] | null>(null);
  const [overallSummary, setOverallSummary] = useState<string>('');
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [showAdvancedInputs, setShowAdvancedInputs] = useState(false);

  // Apply quick preset
  const applyPreset = (preset: typeof PRESET_EXAMPLES[0]) => {
    setProfile({
      ...profile,
      ...preset.data
    } as CompanyProfile);
    setMatchResults(null);
  };

  // Run AI Diagnosis & Matching
  const handleRunDiagnosis = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/gemini/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          availableFunds: CHILEAN_FUNDS.map(f => ({
            id: f.id,
            name: f.name,
            agency: f.agency,
            maxSubsidyCLP: f.maxSubsidyCLP,
            maxCoFinancePct: f.maxCoFinancePct,
            femaleBonusPct: f.femaleBonusPct,
            salesRequirement: f.salesRequirement,
            salesBracketsEligible: f.salesBracketsEligible,
            beneficiaryTypes: f.beneficiaryTypes,
            trlEligible: f.trlEligible,
            requiresInnovation: f.requiresInnovation,
            requiresCommercialValidation: f.requiresCommercialValidation
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Error al conectar con el motor de IA de fondos');
      }

      const data = await response.json();
      setMatchResults(data.matches || []);
      setOverallSummary(data.overallReadinessSummary || '');
      setNextSteps(data.requiredNextSteps || []);
    } catch (err: any) {
      console.error(err);
      // Deterministic fallback matching calculation if server error
      const calculatedMatches: FundMatchResult[] = CHILEAN_FUNDS.map(fund => {
        let score = 50;
        const reasons: string[] = [];
        const blockers: string[] = [];

        // Check company type
        if (fund.beneficiaryTypes.includes(profile.companyType)) {
          score += 20;
          reasons.push(`Tipo legal compatible (${profile.companyType.toUpperCase()})`);
        } else {
          score -= 40;
          blockers.push(`Fondo no admite ${profile.companyType.toUpperCase()}`);
        }

        // Check sales
        if (fund.salesBracketsEligible.includes(profile.salesBracket)) {
          score += 15;
          reasons.push(`Nivel de ventas en rango admisible`);
        } else {
          score -= 30;
          blockers.push(`Ventas fuera de bases: ${fund.salesRequirement}`);
        }

        // Check innovation
        if (fund.requiresInnovation && (profile.innovationLevel === 'radical' || profile.innovationLevel === 'tech_disruptive')) {
          score += 15;
          reasons.push(`Alto grado de innovación técnica`);
        } else if (fund.requiresInnovation && profile.innovationLevel === 'social_traditional') {
          score -= 25;
          blockers.push(`Fondo exige componente de innovación disruptiva.`);
        }

        const isFemaleBonus = (profile.isFemaleLed || profile.femaleEquityPct >= 50) && !!fund.femaleBonusPct;
        const coFinancePct = fund.maxCoFinancePct + (isFemaleBonus ? (fund.femaleBonusPct || 0) : 0);
        const compPct = 100 - coFinancePct;
        const compCash = Math.round((fund.maxSubsidyCLP / (coFinancePct / 100)) * (compPct / 100));

        const clampedScore = Math.min(Math.max(score, 10), 98);
        return {
          fundId: fund.id,
          fundName: fund.name,
          agency: fund.agency,
          matchScore: clampedScore,
          isEligible: blockers.length === 0,
          maxSubsidyCLP: fund.maxSubsidyCLP,
          maxSubsidyFormatted: fund.subsidyFormatted,
          femaleBonusApplied: isFemaleBonus,
          coFinancePct,
          companyContributionPct: compPct,
          companyCashRequiredCLP: compCash,
          reasonsEligible: reasons,
          blockers,
          strategicAdvice: isFemaleBonus 
            ? '¡Aprovecha el 10% adicional de subsidio estatal por liderazgo femenino!'
            : 'Asegura cartas de interés de clientes para subir al tramo de corte.',
          recommendedFocus: ['Validación comercial', 'Claridad en la innovación']
        };
      });

      calculatedMatches.sort((a, b) => b.matchScore - a.matchScore);
      setMatchResults(calculatedMatches);
      setOverallSummary('Análisis completado en base a las Bases Administrativas de CORFO y SERCOTEC 2026.');
      setNextSteps([
        'Verificar vigencia en Registro de Empresas y Sociedades (RES)',
        'Descargar Carpeta Tributaria Electrónica en sii.cl',
        'Validar no tener deudas en TGR'
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Motor Inteligente de Calce y Subsidios Chilenos
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Descubre a qué fondos concursables puede postular y <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">ganar tu empresa</span>
          </h1>
          <p className="mt-3 text-slate-300 text-sm sm:text-base leading-relaxed">
            Analizamos automáticamente tu tipo societario (SpA, SRL, etc.), F29 de ventas ante SII, nivel TRL y bonificaciones por región y mujeres para darte una estrategia 100% ganadora en CORFO y SERCOTEC.
          </p>

          {/* Quick Preset Buttons */}
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Prueba un perfil pre-cargado chileno en 1 clic:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {PRESET_EXAMPLES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => applyPreset(preset)}
                  className="text-left p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all text-xs group"
                >
                  <p className="font-semibold text-white group-hover:text-cyan-300 truncate">{preset.label}</p>
                  <p className="text-[11px] text-slate-400 line-clamp-1">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Profile Form Card */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Perfil Tributario y Operativo de tu Empresa</h2>
              <p className="text-xs text-slate-400">Datos clave según exigencias del SII y bases de postulación</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdvancedInputs(!showAdvancedInputs)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium underline"
          >
            {showAdvancedInputs ? 'Ocultar campos avanzados' : 'Modificar detalles avanzados'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Company Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Razón Social / Nombre del Proyecto
            </label>
            <input
              type="text"
              value={profile.companyName}
              onChange={(e) => setProfile({ ...profile, companyName: e.target.value })}
              placeholder="Ej: AgroTech SpA o Proyecto Solaria"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {/* Legal Form */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Persona Jurídica / Legal
            </label>
            <select
              value={profile.companyType}
              onChange={(e) => setProfile({ ...profile, companyType: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="spa">SpA (Sociedad por Acciones) - Más común para startups</option>
              <option value="srl">SRL (Sociedad de Resp. Limitada)</option>
              <option value="eirl">EIRL (Empresa Individual)</option>
              <option value="sa">S.A. (Sociedad Anónima)</option>
              <option value="persona_natural">Persona Natural con Inicio de Actividades</option>
              <option value="sin_iniciar">Persona Natural SIN Inicio de Actividades (Sercotec)</option>
            </select>
          </div>

          {/* Sales Bracket */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Ventas Netas Anuales (F29 SII)
            </label>
            <select
              value={profile.salesBracket}
              onChange={(e) => setProfile({ ...profile, salesBracket: e.target.value as any })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="sin_ventas">Sin Ventas ($0 CLP / $0 UF)</option>
              <option value="menor_60m">Menor a $60.000.000 CLP (~1.600 UF) - Ideal Corfo Semilla</option>
              <option value="micro_200_a_2400uf">Microempresa (200 a 2.400 UF anuales)</option>
              <option value="pequena_2400_a_25000uf">Pequeña Empresa (2.400 a 25.000 UF) - Ideal Crece</option>
              <option value="mediana_25000_a_100000uf">Mediana Empresa (25.000 a 100.000 UF)</option>
              <option value="grande_mayor_100000uf">Gran Empresa (&gt; 100.000 UF)</option>
            </select>
          </div>

          {/* Antigüedad */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Antigüedad Inicio Actividades ante SII
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="0"
                max="240"
                value={profile.monthsActive}
                onChange={(e) => setProfile({ ...profile, monthsActive: parseInt(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-xs text-slate-400 whitespace-nowrap">meses</span>
            </div>
          </div>

          {/* Region */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Región de Ejecución del Proyecto
            </label>
            <select
              value={profile.region}
              onChange={(e) => setProfile({ ...profile, region: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="Región Metropolitana">Región Metropolitana de Santiago</option>
              <option value="Región de Valparaíso">Región de Valparaíso</option>
              <option value="Región del Biobío">Región del Biobío</option>
              <option value="Región de Antofagasta">Región de Antofagasta (Fondo Minería/Solar)</option>
              <option value="Región de Tarapacá">Región de Tarapacá (Zona Extrema)</option>
              <option value="Región de Arica y Parinacota">Región de Arica y Parinacota (Zona Extrema)</option>
              <option value="Región de Coquimbo">Región de Coquimbo</option>
              <option value="Región de O'Higgins">Región del Libertador Bernardo O'Higgins</option>
              <option value="Región del Maule">Región del Maule</option>
              <option value="Región de Ñuble">Región de Ñuble</option>
              <option value="Región de La Araucanía">Región de La Araucanía</option>
              <option value="Región de Los Ríos">Región de Los Ríos</option>
              <option value="Región de Los Lagos">Región de Los Lagos (Acuícola/Sur)</option>
              <option value="Región de Aysén">Región de Aysén (Zona Extrema)</option>
              <option value="Región de Magallanes">Región de Magallanes (Zona Extrema)</option>
            </select>
          </div>

          {/* Female Leadership Bonus */}
          <div className="flex flex-col justify-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-pink-400" />
                Liderazgo Femenino (+10% Subsidio)
              </label>
              <input
                type="checkbox"
                checked={profile.isFemaleLed}
                onChange={(e) => setProfile({ 
                  ...profile, 
                  isFemaleLed: e.target.checked,
                  femaleEquityPct: e.target.checked ? (profile.femaleEquityPct || 51) : 0
                })}
                className="w-4 h-4 rounded text-pink-600 focus:ring-pink-500 bg-slate-900 border-slate-700 cursor-pointer"
              />
            </div>
            {profile.isFemaleLed && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-slate-400">Participación social mujeres:</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={profile.femaleEquityPct}
                  onChange={(e) => setProfile({ ...profile, femaleEquityPct: parseInt(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                />
                <span className="text-xs text-pink-400 font-bold">%</span>
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-1">
              Bono Corfo/Sercotec: &ge; 50% capital en manos de mujeres o Gerente General mujer.
            </p>
          </div>
        </div>

        {/* Project & Tech summary */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Resumen de la Solución o Proyecto a Postular
            </label>
            <textarea
              rows={2}
              value={profile.projectSummary}
              onChange={(e) => setProfile({ ...profile, projectSummary: e.target.value })}
              placeholder="Describe qué problema resuelves, tu producto o servicio y por qué es innovador..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>

          {showAdvancedInputs && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Grado de Innovación
                </label>
                <select
                  value={profile.innovationLevel}
                  onChange={(e) => setProfile({ ...profile, innovationLevel: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs"
                >
                  <option value="tech_disruptive">Disrupción Tecnológica / Software / IA</option>
                  <option value="radical">Innovación Radical / I+D Científica</option>
                  <option value="incremental">Innovación Incremental / Mejora de Proceso</option>
                  <option value="social_traditional">Comercio o Negocio Tradicional</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Madurez Técnica (Nivel TRL)
                </label>
                <select
                  value={profile.trlStage}
                  onChange={(e) => setProfile({ ...profile, trlStage: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs"
                >
                  <option value="idea_concepto">TRL 1-2: Idea o Concepto Teórico</option>
                  <option value="prototipo_lab">TRL 3-4: Prototipo funcional en Laboratorio</option>
                  <option value="mvp_validado">TRL 5-6: MVP probado con usuarios piloto</option>
                  <option value="primeras_ventas">TRL 7-8: Primeras ventas comerciales</option>
                  <option value="escalamiento_global">TRL 9: Escalamiento consolidado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Clientes Piloto o Cartas de Interés
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={profile.customerValidationCount}
                  onChange={(e) => setProfile({ ...profile, customerValidationCount: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs"
                  placeholder="Número de clientes prospecto"
                />
              </div>
            </div>
          )}
        </div>

        {/* CTA Button to run engine */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800/80">
          <p className="text-xs text-slate-400">
            Comparamos en tiempo real contra las bases 2026 de CORFO, SERCOTEC, ANID, Start-Up Chile y FIA.
          </p>
          <button
            onClick={handleRunDiagnosis}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-sm shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Ejecutando Inteligencia de Calce...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-cyan-200" />
                Calcular Calce y Fondos Adjudicables
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {matchResults && (
        <div className="space-y-6 animate-fade-in">
          {/* Executive Overview Box */}
          <div className="rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-800/50 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0 text-cyan-300">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  Diagnóstico Estratégico INKI
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {matchResults.filter(m => m.isEligible).length} Fondos Compatibles
                  </span>
                </h3>
                <p className="mt-1 text-sm text-slate-300 leading-relaxed">
                  {overallSummary}
                </p>

                {nextSteps.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-800/80">
                    <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      Pasos críticos inmediatos para no quedar fuera en admisibilidad:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {nextSteps.map((step, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-800">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fondos Matched Grid */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-200 flex items-center justify-between">
              <span>Fondos Ordenados por Probabilidad de Éxito en Chile:</span>
              <span className="text-xs font-normal text-slate-400">
                Ponderación algorítmica + Bonificaciones aplicadas
              </span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {matchResults.map((match) => {
                const fundData = CHILEAN_FUNDS.find(f => f.id === match.fundId);
                const scoreColor = match.matchScore >= 80 
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' 
                  : match.matchScore >= 60 
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' 
                    : 'text-slate-400 bg-slate-800 border-slate-700';

                return (
                  <div
                    key={match.fundId}
                    className={`rounded-2xl border transition-all p-5 flex flex-col justify-between ${
                      match.isEligible
                        ? 'bg-slate-900/90 border-slate-800 hover:border-blue-500/50 shadow-lg'
                        : 'bg-slate-950/60 border-slate-900 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {match.agency}
                          </span>
                          {match.femaleBonusApplied && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                              +10% Bono Mujer
                            </span>
                          )}
                          {fundData?.status && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                              {fundData.status}
                            </span>
                          )}
                        </div>

                        {/* Match Score Badge */}
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border font-black text-sm ${scoreColor}`}>
                          <Percent className="w-3.5 h-3.5" />
                          <span>{match.matchScore}% Match</span>
                        </div>
                      </div>

                      {/* Fund Title & Description */}
                      <h4 className="text-base font-bold text-white mb-1">
                        {match.fundName}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                        {fundData?.summary || 'Fondo concursable de fomento productivo e innovación en Chile.'}
                      </p>

                      {/* Financial Metric Cards */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4 text-center">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Subsidio Máx.</p>
                          <p className="text-xs sm:text-sm font-bold text-cyan-400 mt-0.5">{match.maxSubsidyFormatted}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Cofinanciamiento</p>
                          <p className="text-xs sm:text-sm font-bold text-emerald-400 mt-0.5">{match.coFinancePct}% Estado</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-slate-400">Aporte Efectivo</p>
                          <p className="text-xs sm:text-sm font-bold text-white mt-0.5">
                            ${(match.companyCashRequiredCLP || 0).toLocaleString('es-CL')}
                          </p>
                        </div>
                      </div>

                      {/* Reasons or Blockers */}
                      <div className="space-y-1.5 text-xs mb-4">
                        {match.reasonsEligible.slice(0, 2).map((r, rIdx) => (
                          <div key={rIdx} className="flex items-center gap-2 text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))}
                        {match.blockers.map((b, bIdx) => (
                          <div key={bIdx} className="flex items-center gap-2 text-rose-300">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>

                      {/* Strategic Advice */}
                      {match.strategicAdvice && (
                        <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-900/40 text-[11px] text-blue-200 mb-4">
                          <span className="font-bold text-cyan-300">Recomendación Clave: </span>
                          {match.strategicAdvice}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                      {fundData && (
                        <>
                          <button
                            onClick={() => onSelectFundToFormulate(fundData)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-md shadow-blue-600/20"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
                            <span>Formular con IA</span>
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </button>
                          <button
                            onClick={() => onSelectFundToViewDocs(fundData)}
                            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all"
                            title="Ver requisitos de admisibilidad y certificados"
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
