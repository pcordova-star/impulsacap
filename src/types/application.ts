import { ChileanFund, CompanyProfile, FormulationOutput, BlindAuditResult, GeneratedDocument } from './funds';
import { RoadmapConfirmations, DocChecklistStatuses } from './expediente';

export type ApplicationStatus = 'en_preparacion' | 'lista_para_enviar' | 'enviada' | 'archivada';

export interface ApplicationItem {
  id: string; // e.g. `app_${uid}_${fundId}` or unique id
  ownerId: string;
  fundId: string;
  fundName: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;

  // Dossier data scoped strictly to this application
  answersBySection?: Record<string, Record<string, string>>;
  generatedTextsBySection?: Record<string, string>;
  formulation?: FormulationOutput | null;
  auditResult?: BlindAuditResult | null;
  docStatuses?: DocChecklistStatuses;
  roadmapConfirmations?: RoadmapConfirmations;
  generatedDocs?: GeneratedDocument[];
}

export interface ApplicationProgress {
  completedSteps: number;
  totalSteps: number;
  percentage: number;
  nextAction: string;
  nextActionTab: string;
  stepsDetail: {
    number: number;
    title: string;
    completed: boolean;
  }[];
}
