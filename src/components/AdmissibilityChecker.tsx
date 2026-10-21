import React from 'react';
import { CompanyProfile, ChileanFund } from '../types/funds';
import { validateRut } from '../utils/rutValidator';
import { getFundRules, evaluateRequirement } from '../data/fundStandards';
import { AlertTriangle, CheckCircle2, XCircle, FileCheck2, HelpCircle, ExternalLink } from 'lucide-react';

interface AdmissibilityCheckerProps {
  profile: CompanyProfile;
  fund: ChileanFund;
  onOpenSiiModal?: () => void;
  onNavigateTab?: (tab: string) => void;
}

/**
 * Requisitos de admisibilidad del fondo, tomados de sus bases.
 * Solo se marca "Cumple" lo que se puede comprobar con los datos de la empresa;
 * lo demás queda "Por confirmar" (nunca se da por cumplido sin revisarlo).
 */
export const AdmissibilityChecker: React.FC<AdmissibilityCheckerProps> = ({ profile, fund, onOpenSiiModal, onNavigateTab }) => {
  const rules = getFundRules(fund);
  const rutValid = validateRut(profile.rut);
  const rows = rules.requirements.map(r => ({ r, ev: evaluateRequirement(r, profile, rutValid) }));
  const fails = rows.filter(x => x.ev.status === 'fail').length;
  const oks = rows.filter(x => x.ev.status === 'ok').length;
  const unknown = rows.length - fails - oks;

  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Requisitos de admisibilidad de {fund.name}</h3>
            <p className="text-xs text-slate-400">Según {rules.bases.title}</p>
          </div>
        </div>
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${fails > 0 ? 'bg-rose-500/15 text-rose-300 border-rose-500/40' : unknown > 0 ? 'bg-amber-500/15 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
          {fails > 0 ? <XCircle className="w-4 h-4" /> : unknown > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{fails > 0 ? `${fails} requisito(s) no se cumplen` : unknown > 0 ? `${unknown} por confirmar` : 'Cumples los requisitos revisables'}</span>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-slate-400">
          {oks} de {rows.length} revisados con los datos de tu empresa. Los demás debes confirmarlos tú con las bases de tu convocatoria.{' '}
          <a href={rules.bases.url} target="_blank" rel="noopener noreferrer" className="text-cyan-300 underline inline-flex items-center gap-0.5">Ver bases <ExternalLink className="w-3 h-3" /></a>
        </p>
        <div className="flex gap-2 shrink-0">
          {onOpenSiiModal && (
            <button onClick={onOpenSiiModal} className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer">
              {profile.taxFolderUploaded ? 'Actualizar carpeta tributaria' : 'Subir carpeta tributaria'}
            </button>
          )}
          {onNavigateTab && (
            <button onClick={() => onNavigateTab('my-company#company-identity')} className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer">
              Mi empresa
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map(({ r, ev }) => {
          const tone = ev.status === 'ok' ? 'ok' : ev.status === 'fail' ? 'fail' : 'unknown';
          return (
            <div
              key={r.id}
              className={`p-3.5 rounded-2xl border flex items-start gap-3 ${tone === 'ok' ? 'bg-slate-950/70 border-slate-800/80' : tone === 'fail' ? 'bg-rose-950/25 border-rose-500/40' : 'bg-amber-950/15 border-amber-500/30'}`}
            >
              <div className="mt-0.5 shrink-0">
                {tone === 'ok' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : tone === 'fail' ? <XCircle className="w-4 h-4 text-rose-400" /> : <HelpCircle className="w-4 h-4 text-amber-400" />}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-white flex flex-wrap items-center gap-2">
                  <span>{r.label}</span>
                  <span className={`text-[10px] px-2 rounded-full font-semibold ${tone === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : tone === 'fail' ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-300'}`}>
                    {tone === 'ok' ? 'Cumple' : tone === 'fail' ? 'No cumple' : 'Por confirmar'}
                  </span>
                </h4>
                {r.detail && <p className="text-[11px] text-slate-400">{r.detail}</p>}
                {ev.note && <p className={`text-[11px] font-medium ${tone === 'fail' ? 'text-rose-300' : tone === 'ok' ? 'text-emerald-300/90' : 'text-amber-300'}`}>{ev.note}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
