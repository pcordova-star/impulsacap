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
  /** Ficha del concurso cuando la postulación viene del monitor y no está en el catálogo */
  fundSnapshot?: ChileanFund | null;
  convocatoriaId?: string | null;

  /** Resultado del concurso, lo marca la persona cuando le avisan (no cambia `status` para no romper reglas) */
  result?: ApplicationResult | null;
  /** Etapa 4: ejecución del proyecto ganado */
  execution?: ExecutionData | null;
  /** Si no ganó: evaluación del comité y plan de mejora */
  rejectionReview?: RejectionReview | null;
  /** Postulación nueva que reutiliza una anterior no adjudicada */
  reapplyContext?: ReapplyContext | null;
}

export type ApplicationOutcome = 'adjudicada' | 'no_adjudicada';

export interface ApplicationResult {
  outcome: ApplicationOutcome;
  decidedAt: string;
  /** Monto adjudicado (subsidio), si lo informa */
  awardedAmountCLP?: number | null;
}

export interface ExecutionBudgetLine {
  id: string;
  account: string;
  item: string;
  /** Monto aprobado que hay que gastar y rendir (subsidio + aporte en dinero) */
  approvedCLP: number;
}

export type ExpenseDocType = 'factura' | 'boleta_honorarios' | 'boleta' | 'otro';

export interface ExecutionExpense {
  id: string;
  date: string; // YYYY-MM-DD
  lineId: string;
  provider: string;
  description: string;
  amountCLP: number;
  docType: ExpenseDocType;
  docNumber?: string;
  paid: boolean;
  rendered: boolean;
}

export interface ExecutionMilestone {
  id: string;
  title: string;
  dueDate?: string; // YYYY-MM-DD
  done: boolean;
  kind: 'plan' | 'informe' | 'propio';
  /** Mes del proyecto en que vence (para calcular la fecha cuando se define el inicio) */
  offsetMonths?: number;
}

export interface ExecutionReport {
  id: string;
  kind: 'avance' | 'final';
  createdAt: string;
  text: string;
}

export interface ExecutionData {
  startDate?: string;
  durationMonths?: number;
  checklist: Record<string, boolean>;
  budget: ExecutionBudgetLine[];
  expenses: ExecutionExpense[];
  milestones: ExecutionMilestone[];
  reports?: ExecutionReport[];
}

export interface ImprovementItem {
  section: string;
  problem: string;
  action: string;
  priority: 'alta' | 'media' | 'baja';
}

export interface ImprovementPlan {
  summary: string;
  scores?: { criterion: string; score: string; comment: string }[];
  improvements: ImprovementItem[];
  nextSteps: string[];
}

export interface RejectionReview {
  evaluationText?: string;
  plan?: ImprovementPlan | null;
  createdAt?: string;
  reappliedAs?: string | null;
}

export interface ReapplyContext {
  fromApplicationId: string;
  improvements: ImprovementItem[];
  done: Record<string, boolean>;
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
