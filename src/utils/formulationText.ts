import { ChileanFund, FormBlock, FormulationOutput } from '../types/funds';
import { blockLabel, cleanMilestone } from '../data/fundStandards';

/**
 * Texto de una sección del formulario, en el orden de preferencia:
 * 1) el texto final que quedó en el formulador (IA o escrito por la persona),
 * 2) los campos estructurados de la formulación.
 * Lo usan el expediente y la evaluación simulada, para que ambos lean exactamente lo mismo.
 */
export function sectionText(f: FormulationOutput | null | undefined, block: FormBlock): string {
  if (!f) return '';
  const t = (s?: string) => String(s || '').trim();
  const own = t(f.sectionTexts?.[block]);
  switch (block) {
    case 'title_pitch':
      return [t(f.projectTitle), t(f.pitchSummary30s)].filter(Boolean).join('\n\n');
    case 'problem': return own || t(f.problemStatement);
    case 'solution': {
      const base = own || t(f.solutionAndInnovation);
      const nov = t(f.noveltyVsCompetitors);
      return nov && !base.includes(nov) ? [base, nov].filter(Boolean).join('\n\n') : base;
    }
    case 'market': {
      if (own) return own;
      const m = f.marketAnalysisTAM;
      if (!m) return '';
      return [m.clientArchetype && `Clientes: ${t(m.clientArchetype)}`, m.tam && `TAM: ${t(m.tam)}`, m.sam && `SAM: ${t(m.sam)}`, m.som && `SOM: ${t(m.som)}`].filter(Boolean).join('\n');
    }
    case 'model': return own || t(f.businessModel);
    case 'workplan': {
      const ms = (f.workPlanMilestones || []).map(cleanMilestone)
        .map((m, i) => `${i + 1}. ${m.title}${m.month ? ` (${m.month})` : ''}: ${m.description}${m.deliverable ? ` | Entregable: ${m.deliverable}` : ''}${m.criticalRisk ? ` | Riesgo: ${m.criticalRisk}` : ''}`)
        .join('\n');
      return [own, ms].filter(Boolean).join('\n\n');
    }
    case 'team': return own || t(f.teamCapabilities);
    case 'budget':
      return (f.budgetBreakdown || []).filter(b => (b.corfoContributionCLP || 0) > 0 || (b.companyPecuniaryCLP || 0) > 0)
        .map(b => `- ${b.account}: ${b.item} | Subsidio $${Number(b.corfoContributionCLP || 0).toLocaleString('es-CL')} | Aporte empresa $${Number(b.companyPecuniaryCLP || 0).toLocaleString('es-CL')} | Justificación: ${b.justification}`)
        .join('\n');
  }
}

const BLOCKS: FormBlock[] = ['title_pitch', 'problem', 'solution', 'market', 'model', 'workplan', 'team', 'budget'];

/** Toda la formulación como texto, con los títulos del formulario de ESTE fondo. */
export function formulationToText(f: FormulationOutput | null | undefined, fund: ChileanFund): string {
  if (!f) return '';
  return BLOCKS
    .map(b => ({ title: blockLabel(fund, b)?.title || b, text: sectionText(f, b) }))
    .map(x => `${x.title.toUpperCase()}:\n${x.text || '[Sección sin completar]'}`)
    .join('\n\n');
}
