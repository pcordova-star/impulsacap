export type Agency = 'CORFO' | 'SERCOTEC' | 'ANID' | 'START-UP CHILE' | 'FIA' | 'PROCHILE';

export type CompanyType = 
  | 'persona_natural' 
  | 'spa' 
  | 'srl' 
  | 'eirl' 
  | 'sa' 
  | 'sin_iniciar';

export type SalesBracket = 
  | 'sin_ventas' 
  | 'menor_60m' 
  | 'micro_200_a_2400uf' 
  | 'pequena_2400_a_25000uf' 
  | 'mediana_25000_a_100000uf' 
  | 'grande_mayor_100000uf';

export type TRLStage = 
  | 'idea_concepto' // TRL 1-2
  | 'prototipo_lab' // TRL 3-4
  | 'mvp_validado'  // TRL 5-6
  | 'primeras_ventas' // TRL 7-8
  | 'escalamiento_global'; // TRL 9

export interface ChileanFund {
  id: string;
  name: string;
  agency: Agency;
  category: 'Capital Semilla' | 'I+D+i y Tecnológico' | 'Crecimiento y Escalamiento' | 'Innovación Agro / Sostenible' | 'Internacionalización';
  badge: string;
  maxSubsidyCLP: number;
  subsidyFormatted: string;
  maxCoFinancePct: number; // e.g. 75 or 85
  femaleBonusPct?: number; // e.g. +10%
  beneficiaryTypes: CompanyType[];
  salesRequirement: string;
  salesBracketsEligible: SalesBracket[];
  trlRange: string;
  trlEligible: TRLStage[];
  requiresInnovation: boolean;
  requiresCommercialValidation: boolean;
  status: 'Abierto' | 'Próxima Convocatoria' | 'Ventanilla Abierta';
  callStatus: 'abierta' | 'cerrada' | 'proxima' | 'por_confirmar';
  closeDate: string | null;
  lastVerified: string;
  callSchedule: string;
  summary: string;
  description: string;
  evaluationCriteria: {
    name: string;
    weight: number;
    description: string;
  }[];
  eligibleExpenses: string[];
  ineligibleExpenses: string[];
  requiredDocuments: string[];
  corfoAccountsBudget: {
    account: string;
    description: string;
    maxPct?: number;
  }[];
  /** Reglas oficiales del concurso (desde sus bases): requisitos, formulario, evaluación, aportes. */
  rules?: FundRules;
}

/** Familias de formulario: cada una tiene su propia estructura oficial de postulación. */
export type FundFamily = 'corfo_emprendimiento' | 'corfo_innovacion' | 'startup_chile' | 'sercotec' | 'anid' | 'fia' | 'monitor';

/** Bloques internos del formulador (cada sección oficial se arma con uno o más). */
export type FormBlock = 'title_pitch' | 'problem' | 'solution' | 'market' | 'model' | 'workplan' | 'team' | 'budget';

/** Requisito de admisibilidad. `check` permite revisarlo automáticamente con los datos de la empresa. */
export interface FundRequirement {
  id: string;
  label: string;
  detail?: string;
  check?:
    | { kind: 'rut' }
    | { kind: 'taxFolder' }
    | { kind: 'firstCategory'; required: boolean }
    | { kind: 'age'; minMonths?: number; maxMonths?: number }
    | { kind: 'sales'; minCLP?: number; maxCLP?: number; minUF?: number; maxUF?: number; noSales?: boolean }
    | { kind: 'companyType'; allowed: CompanyType[] }
    | { kind: 'female' };
}

export interface FundBudgetAccount {
  key: string;
  account: string;
  plainName: string;
  share: number;
  cap?: string;
  whatGoes: string[];
  whatNot: string[];
  example: string;
  itemPlaceholder: string;
  justificationPlaceholder: string;
}

export interface FundRules {
  family: FundFamily;
  bases: { title: string; url: string; verifiedAt: string; note?: string };
  /** Requisitos excluyentes para postular */
  requirements: FundRequirement[];
  /** Lo que se entrega al postular */
  applicationDocs: { id: string; label: string; detail?: string; link?: 'letters' | 'taxFolder' | 'formulator' | 'pitch' }[];
  /** Lo que se pide si el proyecto es seleccionado */
  formalizationDocs: string[];
  /** Secciones del formulario oficial y con qué bloques del formulador se arman */
  formSections: { title: string; blocks: FormBlock[]; evaluates?: string }[];
  pitch?: { label: string; seconds: number; content: string };
  evaluation: {
    scale: string;
    /** Nota mínima global para ser recomendado (null = no hay corte: se adjudica por ranking) */
    passMark: number | null;
    /** Nota mínima en cada criterio o capítulo (si las bases la exigen) */
    minEach?: number | null;
    /** Meta sugerida cuando no hay nota de corte */
    target: number;
    rule: string;
    stages?: { name: string; weight: number; detail?: string }[];
  };
  coFinance: {
    text: string;
    /** % máximo de subsidio por tamaño de empresa (si cambia según ventas) */
    bySizePct?: { micro_pequena: number; mediana: number; grande: number };
    femalePct?: number;
    femaleMaxCLP?: number;
    /** Aporte como % del subsidio (Sercotec): el % máximo del total se calcula con esto */
    contributionOfSubsidyPct?: number;
    minCashText?: string;
  };
  partners?: string;
  guarantee: { required: boolean; text: string };
  portal: { name: string; url: string };
  duration: string;
  budget: FundBudgetAccount[];
  /** Advertencias importantes para el postulante */
  notes?: string[];
}

export interface GeneratedDocument {
  id: string;
  ownerId: string;
  tipo: string;
  contraparte: string;
  proyecto?: string;
  fondo?: string;
  texto: string;
  status: 'borrador' | 'firmada';
  fecha: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectProfile {
  whatItDoes: string;               // ¿Qué hace tu empresa o proyecto? (producto o servicio)
  problemAndTarget: string;         // ¿Qué problema resuelve y a quién? (cliente objetivo)
  currentSolutionAndDiff: string;   // ¿Cómo lo resuelven hoy tus clientes y qué te diferencia?
  currentProgress: string;          // Avance actual (prototipo, clientes, ventas, pilotos, cartas de interés)
  teamDetails: string;              // Equipo: nombre, rol y experiencia de cada integrante clave
  businessModel: string;            // Modelo de negocio: cómo cobras y cuánto
  fundingPurpose: string;           // ¿Para qué necesitas el financiamiento y en qué lo usarías?
  websiteOrSocial?: string;         // Sitio web o redes (opcional)
}

export function calculateProjectProfileCompletion(project?: Partial<ProjectProfile> | null): number {
  if (!project) return 0;
  const fields = [
    project.whatItDoes,
    project.problemAndTarget,
    project.currentSolutionAndDiff,
    project.currentProgress,
    project.teamDetails,
    project.businessModel,
    project.fundingPurpose
  ];
  const filled = fields.filter(val => typeof val === 'string' && val.trim().length >= 10).length;
  return Math.round((filled / fields.length) * 100);
}

export interface CompanyProfile {
  companyName: string;
  rut: string;
  companyType: CompanyType;
  monthsActive: number | null; // null or 0 if not started / uncompleted
  salesBracket: SalesBracket | '';
  annualSalesCLP?: number | null;
  sector: string;
  region: string;
  city?: string;
  isFemaleLed: boolean;
  femaleEquityPct: number;
  trlStage: TRLStage | '';
  innovationLevel: 'incremental' | 'radical' | 'social_traditional' | 'tech_disruptive';
  projectSummary: string;
  coreTech: string;
  customerValidationCount: number;
  taxFolderUploaded?: boolean;
  /** Eligió seguir sin carpeta tributaria por ahora (se le pedirá si el fondo la exige) */
  taxFolderDeferred?: boolean;
  taxFolderFileName?: string;
  taxFolderUploadDate?: string;
  taxFolderSummary?: string;
  taxFolderF29Periods?: number;
  representativeName?: string;
  representativeRut?: string;
  representativeEmail?: string;
  representativePhone?: string;
  projectProfile?: ProjectProfile;
}

export interface FundMatchResult {
  fundId: string;
  fundName: string;
  agency: Agency;
  matchScore: number; // 0 - 100
  isEligible: boolean;
  maxSubsidyCLP: number;
  maxSubsidyFormatted: string;
  femaleBonusApplied: boolean;
  coFinancePct: number;
  companyContributionPct: number;
  companyCashRequiredCLP: number;
  reasonsEligible: string[];
  blockers: string[];
  strategicAdvice: string;
  recommendedFocus: string[];
}

export interface FormulationOutput {
  fundId: string;
  fundName: string;
  projectTitle: string;
  problemStatement: string;
  solutionAndInnovation: string;
  noveltyVsCompetitors: string;
  marketAnalysisTAM: {
    tam: string;
    sam: string;
    som: string;
    clientArchetype: string;
  };
  businessModel: string;
  workPlanMilestones: {
    month: string;
    title: string;
    description: string;
    deliverable: string;
    criticalRisk: string;
  }[];
  budgetBreakdown: {
    account: string;
    item: string;
    corfoContributionCLP: number;
    companyPecuniaryCLP: number;
    companyValuedCLP: number;
    justification: string;
  }[];
  teamCapabilities: string;
  bonusFemaleJustification?: string;
  pitchSummary30s: string;
  /** Texto final de cada sección tal como quedó en el formulador (redactado por la IA o escrito/editado por la persona) */
  sectionTexts?: Partial<Record<FormBlock, string>>;
}

export interface BlindAuditResult {
  overallScore: number; // 1.0 to 5.0 (Standard Corfo scale)
  verdict: 'Adjudicable Altamente Probable' | 'En Zona de Corte' | 'Riesgo de Rechazo' | 'No Elegible';
  criteriaScores: {
    criterion: string;
    weight: number;
    score: number; // 1 to 5
    observations: string;
    improvementTips: string;
  }[];
  redFlags: string[];
  strengths: string[];
  top3PriorityChanges: string[];
}

export interface CompanyUser {
  id: string;
  email: string;
  password?: string;
  companyName: string;
  rut: string;
  phone?: string;
  representativeName?: string;
  representativeRut?: string;
  seenAlerts?: string[];
  createdAt: string;
  lastLogin?: string;
}

export interface AuthSession {
  user: CompanyUser;
  token: string;
  loginAt: string;
}

export function getFundVisibleStatus(fund: { callStatus?: 'abierta' | 'cerrada' | 'proxima' | 'por_confirmar'; closeDate?: string | null }): 'Abierta' | 'Cerrada' | 'Próxima' | 'Por confirmar' {
  if (fund.closeDate) {
    const closeTime = new Date(fund.closeDate).getTime();
    if (!isNaN(closeTime) && closeTime < Date.now()) {
      return 'Cerrada';
    }
  }
  if (fund.callStatus === 'abierta') return 'Abierta';
  if (fund.callStatus === 'cerrada') return 'Cerrada';
  if (fund.callStatus === 'proxima') return 'Próxima';
  return 'Por confirmar';
}
