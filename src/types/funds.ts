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
}

export interface CompanyProfile {
  companyName: string;
  rut: string;
  companyType: CompanyType;
  monthsActive: number; // 0 if not started
  salesBracket: SalesBracket;
  annualSalesCLP?: number;
  sector: string;
  region: string;
  isFemaleLed: boolean;
  femaleEquityPct: number;
  trlStage: TRLStage;
  innovationLevel: 'incremental' | 'radical' | 'social_traditional' | 'tech_disruptive';
  projectSummary: string;
  coreTech: string;
  customerValidationCount: number;
  taxFolderUploaded?: boolean;
  taxFolderFileName?: string;
  taxFolderUploadDate?: string;
  taxFolderSummary?: string;
  taxFolderF29Periods?: number;
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
  createdAt: string;
  lastLogin?: string;
}

export interface AuthSession {
  user: CompanyUser;
  token: string;
  loginAt: string;
}
