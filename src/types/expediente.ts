import { CompanyProfile, FormulationOutput, BlindAuditResult, GeneratedDocument } from './funds';

export interface TaxFolderData {
  fileName?: string;
  uploadDate?: string;
  rut?: string;
  companyName?: string;
  startDate?: string;
  monthsActive?: number | null;
  annualSalesCLP?: number | null;
  salesBracket?: string;
  f29Periods?: number;
  siiStatusObservations?: string;
  admissibilityVerdict?: 'aprobado' | 'observado' | 'rechazado' | null;
  taxFolderUploaded: boolean;
}

export interface RoadmapConfirmations {
  confirmedInicioActividades: boolean;
  confirmedEstatutoSocial: boolean;
  confirmedGarantia: boolean;
}

export interface DocChecklistStatuses {
  f29_sii: boolean;
  estatuto_res: boolean;
  deuda_tgr: boolean;
  previsional_f30: boolean;
  carta_interes_loi: boolean;
}

export interface ExpedienteData {
  id: string; // `exp_${uid}_${fundId}`
  ownerId: string;
  fundId: string;
  fundName: string;
  updatedAt: string;
  createdAt: string;

  profile: CompanyProfile;
  taxFolder: TaxFolderData;
  roadmapConfirmations: RoadmapConfirmations;
  docStatuses: DocChecklistStatuses;
  generatedDocs: GeneratedDocument[];
  answersBySection: Record<string, Record<string, string>>;
  generatedTextsBySection: Record<string, string>;
  formulation: FormulationOutput | null;
  auditResult: BlindAuditResult | null;
}
