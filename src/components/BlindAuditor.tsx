import React, { useState } from 'react';
import { ChileanFund, BlindAuditResult, FormulationOutput, CompanyProfile } from '../types/funds';
import { apiFetch } from '../utils/apiFetch';
import { usePlan } from '../hooks/usePlan';
import { PlanPaywallCard } from './PlanPaywallCard';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { 
  ShieldAlert, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ArrowUpRight, 
  HelpCircle,
  Award,
  Flame,
  FileCheck2,
  ArrowLeft,
  RotateCcw,
  AlertCircle
} from 'lucide-react';

interface BlindAuditorProps {
  initialFund?: ChileanFund | null;
  initialFormulation?: FormulationOutput | null;
  profile?: CompanyProfile;
  onSaveAudit?: (result: BlindAuditResult) => void;
  onNavigateTab?: (tab: string) => void;
}

/** A qué parte del formulario lleva cada observación de la auditoría (por palabras clave). */
function fixTargetFor(text: string): { target: string; label: string } | null {
  const t = (text || '').toLowerCase();
  const rules: [RegExp, string, string][] = [
    [/equipo|integrante|fundador|dedicaci|emprendedor/, 'formulator#section:team', 'Completar equipo'],
    [/mercado|tam|sam|som|escalab|cliente objetivo|comercializ|adquisici/, 'formulator#section:market', 'Calcular mercado'],
    [/innova|novedad|diferenci|propuesta de valor|tecnolog|soluci[oó]n/, 'formulator#section:solution', 'Explicar innovación'],
    [/problema|dolor/, 'formulator#section:problem', 'Trabajar el problema'],
    [/modelo de negocio|monetiz|ingreso|precio|suscripci/, 'formulator#section:model', 'Modelo de negocio'],
    [/plan de trabajo|hito|cronograma|entregable/, 'formulator#section:workplan', 'Plan de trabajo'],
    [/presupuest|financiamiento|cofinanc|gasto|aporte/, 'formulator#section:budget', 'Revisar presupuesto'],
    [/pitch|t[ií]tulo/, 'formulator#section:title_pitch', 'Título y pitch'],
    [/perfil|no informado|empresa|avance|desarrollo actual/, 'my-company#project-profile', 'Completar perfil']
  ];
  for (const [re, target, label] of rules) if (re.test(t)) return { target, label };
  return null;
}

export const BlindAuditor: React.FC<BlindAuditorProps> = ({
  initialFund,
  initialFormulation,
  profile,
  onSaveAudit,
  onNavigateTab
}) => {
  const [selectedFund, setSelectedFund] = useState<ChileanFund>(
    initialFund || CHILEAN_FUNDS[0]
  );
  const [inputText, setInputText] = useState<string>(
    initialFormulation
      ? `PROYECTO: ${initialFormulation.projectTitle}\n\nPROBLEMA:\n${initialFormulation.problemStatement}\n\nSOLUCIÓN E INNOVACIÓN:\n${initialFormulation.solutionAndInnovation}\n\nMERCADO:\n${initialFormulation.marketAnalysisTAM.tam}\n\nMODELO:\n${initialFormulation.businessModel}`
      : ''
  );
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<BlindAuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { hasActivePlan, isExpired } = usePlan();
  const [showPaywall, setShowPaywall] = useState<boolean>(false);

  const handleRunAudit = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!hasActivePlan) {
        setShowPaywall(true);
        setLoading(false);
        return;
      }

      const response = await apiFetch('/api/gemini/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fund: selectedFund,
          formulationText: inputText,
          projectSummary: inputText.substring(0, 1000),
          profile,
          projectProfile: profile?.projectProfile,
          taxFolderData: profile ? {
            sector: profile.sector,
            region: profile.region,
            monthsActive: profile.monthsActive,
            annualSalesCLP: profile.annualSalesCLP
          } : undefined
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
      setAuditResult(data);
      onSaveAudit?.(data);
    } catch (err: any) {
      console.error('Audit error:', err);
      setError(err?.message || 'El servicio de IA no está disponible. Intenta nuevamente en unos minutos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {(showPaywall || !hasActivePlan) && (
        <div className="mb-6 animate-fade-in">
          <PlanPaywallCard
            highlightText="La Auditoría Ciega oficial con rúbrica de comités CORFO / SERCOTEC requiere el Plan Trimestral ImpulsaCap. Simula evaluaciones reales y detecta alertas rojas antes de enviar tu postulación."
          />
        </div>
      )}
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
            Auditoría Ciega Oficial • {selectedFund.name}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Simulador de Comité de Evaluación Ciega (CORFO / SERCOTEC)
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Auditoría y Scoring de Adjudicación
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Somete tu postulación al filtro implacable de los evaluadores públicos chilenos antes del cierre oficial.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="min-w-[220px]">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Rúbrica del Fondo:
              </label>
              <select
                value={selectedFund.id}
                onChange={(e) => {
                  const f = (CHILEAN_FUNDS.some(x => x.id === selectedFund.id) ? CHILEAN_FUNDS : [selectedFund, ...CHILEAN_FUNDS]).find(item => item.id === e.target.value);
                  if (f) setSelectedFund(f);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-cyan-500 focus:outline-none"
              >
                {(CHILEAN_FUNDS.some(x => x.id === selectedFund.id) ? CHILEAN_FUNDS : [selectedFund, ...CHILEAN_FUNDS]).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleRunAudit}
                disabled={loading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-500 hover:from-amber-500 hover:to-orange-400 text-white font-bold text-xs shadow-lg shadow-amber-600/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Auditando Postulación...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>Ejecutar Auditoría Ciega</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
        <label className="block text-xs font-semibold text-slate-300">
          Texto de la Postulación o Resumen del Proyecto para Auditar:
        </label>
        <textarea
          rows={6}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Pega aquí el texto completo o secciones que vas a postular a CORFO/SERCOTEC..."
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-mono leading-relaxed focus:border-amber-500 focus:outline-none placeholder:text-slate-500 placeholder:italic"
        />
        <p className="text-[11px] text-slate-500">
          Consejo: Cuanto más detallado sea el texto (incluyendo métricas, competidores y plazos), más precisa será la detección de inconsistencias y red flags.
        </p>
      </div>

      {/* Audit Results */}
      {auditResult && (
        <div className="space-y-6 animate-fade-in">
          {/* Main Scorecard */}
          <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border border-blue-800/60 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              {/* Score Circular Badge */}
              <div className="w-24 h-24 rounded-2xl bg-slate-950 border-2 border-emerald-500 flex flex-col items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                <span className="text-3xl font-black text-emerald-400">{auditResult.overallScore}</span>
                <span className="text-[10px] font-bold uppercase text-slate-400">Escala 1 a 5</span>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {auditResult.verdict}
                </span>
                <h3 className="text-xl font-black text-white mt-2">
                  Pronóstico del Comité Evaluador
                </h3>
                <p className="text-xs text-slate-300 mt-1 max-w-xl">
                  {auditResult.overallScore >= 4.3 
                    ? 'Tu postulación se sitúa por sobre el puntaje de corte histórico en Chile (típicamente 4.2 a 4.4). Con los ajustes sugeridos tienes altísimas probabilidades de adjudicar.'
                    : 'Tu postulación se encuentra en la zona de riesgo o corte ajustado. Realiza los cambios prioritarios para evitar quedar en lista de espera.'}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-xs text-slate-400 block">Corte Estimado Adjudicación:</span>
              <span className="text-sm font-bold text-amber-400 font-mono">&ge; 4.25 / 5.0</span>
            </div>
          </div>

          {/* Criteria Breakdown */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-cyan-400" />
              Desglose de Calificaciones por Criterio de Rúbrica
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {auditResult.criteriaScores.map((crit, cIdx) => (
                <div key={cIdx} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white leading-snug">{crit.criterion}</span>
                    <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {crit.score} / 5.0 ({crit.weight}%)
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {crit.observations}
                  </p>

                  <div className="pt-2 border-t border-slate-800/80 text-[11px] text-cyan-300">
                    <span className="font-bold">Para llegar a 5.0: </span>
                    {crit.improvementTips}
                  </div>
                  {(() => {
                    const fix = fixTargetFor(`${crit.criterion} ${crit.improvementTips}`);
                    return fix && onNavigateTab && Number(crit.score) < 4.5 ? (
                      <button type="button" onClick={() => onNavigateTab(fix.target)} className="mt-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-[11px] font-black cursor-pointer">
                        Mejorar: {fix.label} →
                      </button>
                    ) : null;
                  })()}
                </div>
              ))}
            </div>
          </div>

          {/* Red Flags & Top Priorities */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Red Flags */}
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
              <h4 className="text-sm font-bold text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Alertas graves detectadas
              </h4>
              <p className="text-xs text-rose-900/80">
                Puntos débiles que los evaluadores de CORFO/SERCOTEC suelen castigar con bajas notas o descalificación:
              </p>
              <div className="space-y-2">
                {auditResult.redFlags.map((flag, fIdx) => (
                  <div key={fIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white border border-rose-200 text-xs text-rose-950">
                    <span className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /><span>{flag}</span></span>
                    {(() => {
                      const fix = fixTargetFor(flag);
                      return fix && onNavigateTab ? (
                        <button type="button" onClick={() => onNavigateTab(fix.target)} className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer">{fix.label} →</button>
                      ) : null;
                    })()}
                  </div>
                ))}
              </div>
            </div>

            {/* Top 3 Priority Changes */}
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-600" />
                Los 3 cambios más importantes
              </h4>
              <p className="text-xs text-amber-950/80">
                Implementa estas 3 acciones antes de enviar tu formulario en la plataforma oficial:
              </p>
              <div className="space-y-2">
                {auditResult.top3PriorityChanges.map((change, cIdx) => (
                  <div key={cIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white border border-amber-200 text-xs text-amber-950 font-medium">
                    <span className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">{cIdx + 1}</span><span>{change}</span></span>
                    {(() => {
                      const fix = fixTargetFor(change);
                      return fix && onNavigateTab ? (
                        <button type="button" onClick={() => onNavigateTab(fix.target)} className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer">{fix.label} →</button>
                      ) : null;
                    })()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
