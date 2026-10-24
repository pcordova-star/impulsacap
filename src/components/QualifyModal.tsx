import React, { useMemo } from 'react';
import { CheckCircle2, XCircle, HelpCircle, X, ArrowRight, Info } from 'lucide-react';
import type { CompanyProfile } from '../types/funds';
import type { Convocatoria } from '../types/convocatoria';
import { CHILEAN_FUNDS } from '../data/chileanFunds';
import { getFundRules, evaluateRequirement } from '../data/fundStandards';
import { validateRut } from '../utils/rutValidator';
import { regionFit } from '../utils/region';

/** Instrumentos del monitor que no son un fondo para postular un proyecto de la empresa */
export const NOT_A_GRANT = /(garant[ií]a|cr[eé]dito|cobertura|certificaci[oó]n de acuerdos|solicitud previa|ley de incentivo|art[ií]culo \d|\blir\b|fogain|fogape|cobex|reprogramaci|seguro|pr[eé]stamo|administradora|patrocinador|entidad(es)? gestora|agente operador)/i;

type Check = { label: string; status: 'ok' | 'fail' | 'unknown'; note?: string };

const asList = (v?: string | string[] | null) => (Array.isArray(v) ? v : v ? [v] : []).map(x => String(x));

/**
 * "¿Califico?" para una empresa que ya tiene cuenta: se revisa con los datos que ya guardó en Mi empresa,
 * sin sacarla del panel ni volver a preguntarle. Si falta un dato, se le pide ese dato.
 */
export const QualifyModal: React.FC<{
  conv: Convocatoria;
  profile: CompanyProfile;
  onClose: () => void;
  onPostular: (conv: Convocatoria) => void;
  /** Lleva a completar lo que falta (la carpeta abre su cargador; el resto, Mi empresa) */
  onCompleteData: (missing: string[]) => void;
}> = ({ conv, profile, onClose, onPostular, onCompleteData }) => {
  const result = useMemo(() => {
    const checks: Check[] = [];
    const missing: string[] = [];
    const text = `${conv.titulo} ${conv.resumen || ''}`;
    const notGrant = NOT_A_GRANT.test(text);

    // 1. Región
    const rf = regionFit(conv.alcance, profile.region);
    if (rf === 'nacional') checks.push({ label: 'Alcance: todo Chile', status: 'ok' });
    else if (rf === 'tu_region') checks.push({ label: `Es para ${conv.alcance}, tu región`, status: 'ok' });
    else if (rf === 'otra_region') checks.push({ label: `Es solo para ${conv.alcance}`, status: 'fail', note: `Tu empresa está en ${profile.region}.` });
    else { checks.push({ label: `Es solo para ${conv.alcance}`, status: 'unknown', note: 'Indica tu región en Mi empresa.' }); missing.push('Región'); }

    // 2. Quién puede postular (persona o empresa)
    const perfil = asList(conv.perfil).map(p => p.toLowerCase());
    const isPerson = profile.companyType === 'sin_iniciar' || profile.companyType === 'persona_natural';
    if (perfil.length) {
      const wantsPerson = perfil.some(p => p.includes('persona'));
      const wantsCompany = perfil.some(p => p.includes('empresa'));
      if (!profile.companyType) { checks.push({ label: `Postulan: ${asList(conv.perfil).join(', ')}`, status: 'unknown' }); missing.push('Tipo de empresa'); }
      else if ((isPerson && wantsPerson) || (!isPerson && wantsCompany)) checks.push({ label: `Postulan: ${asList(conv.perfil).join(', ')}`, status: 'ok' });
      else checks.push({ label: `Postulan: ${asList(conv.perfil).join(', ')}`, status: 'fail', note: isPerson ? 'Tu perfil está como persona sin empresa.' : 'Tu perfil está como empresa.' });
    }

    // 3. Requisitos de las bases (si la convocatoria corresponde a un fondo del catálogo)
    const fund = conv.fundId ? CHILEAN_FUNDS.find(f => f.id === conv.fundId) : null;
    if (fund) {
      const rules = getFundRules(fund);
      const rutOk = validateRut(profile.rut || '');
      for (const q of rules.requirements) {
        if (!q.check) { checks.push({ label: q.label, status: 'unknown', note: 'Lo confirmas tú en los requisitos de la postulación.' }); continue; }
        const ev = evaluateRequirement(q, profile, rutOk);
        checks.push({ label: q.label, status: ev.status === 'ok' ? 'ok' : ev.status === 'fail' ? 'fail' : 'unknown', note: ev.note });
        if (ev.status !== 'ok' && ev.status !== 'fail' && ev.note) {
          if (/carpeta/i.test(ev.note)) missing.push('Carpeta tributaria (ventas y antigüedad)');
          else if (/RUT/i.test(ev.note)) missing.push('RUT de la empresa');
          else if (/tipo de postulante/i.test(ev.note)) missing.push('Tipo de empresa');
          else if (/Mi empresa/i.test(ev.note)) missing.push(q.label);
        }
      }
    } else if (conv.quienes_pueden_postular) {
      checks.push({ label: `Quiénes pueden postular: ${conv.quienes_pueden_postular}`, status: 'unknown', note: 'Revísalo en las bases: este concurso aún no tiene sus requisitos cargados en ImpulsaCap.' });
    }

    const fails = checks.filter(c => c.status === 'fail');
    const unknown = checks.filter(c => c.status === 'unknown');
    const verdict: 'no_aplica' | 'no' | 'si' | 'casi' = notGrant ? 'no_aplica' : fails.length ? 'no' : unknown.length ? 'casi' : 'si';
    return { checks, fails, unknown, missing: Array.from(new Set(missing)), verdict, fund };
  }, [conv, profile]);

  const head = {
    no_aplica: { title: 'Esto no es un fondo para postular un proyecto', text: 'Es un trámite, crédito, garantía o un concurso para instituciones. ImpulsaCap te ayuda con subsidios para tu proyecto: revisa los fondos que calzan contigo.', tone: 'text-slate-700' },
    no: { title: 'Según tus datos, no calzas con esta convocatoria', text: 'Hay al menos un requisito que no cumples. Si tus datos están mal, corrígelos en Mi empresa; si están bien, te conviene otra convocatoria.', tone: 'text-rose-700' },
    casi: { title: 'Calzas en lo que podemos revisar', text: 'Hay requisitos que no podemos comprobar con tus datos. Revísalos antes de postular.', tone: 'text-amber-700' },
    si: { title: '¡Calzas con esta convocatoria!', text: 'Tus datos cumplen los requisitos que revisamos. Puedes empezar tu postulación.', tone: 'text-emerald-700' }
  }[result.verdict];

  const Icon = ({ s }: { s: Check['status'] }) => s === 'ok'
    ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
    : s === 'fail' ? <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /> : <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/60 flex items-end sm:items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="qualify-title" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-blue-700">¿Califico? · revisado con tus datos</p>
            <p className="text-sm font-semibold text-slate-600 mt-0.5 line-clamp-2">{conv.titulo}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div>
          <h3 id="qualify-title" className={`text-lg font-bold ${head.tone}`}>{head.title}</h3>
          <p className="text-sm text-slate-600 mt-1">{head.text}</p>
        </div>

        {result.verdict !== 'no_aplica' && (
          <ul className="space-y-2">
            {result.checks.map(c => (
              <li key={c.label} className="flex items-start gap-2 text-sm">
                <Icon s={c.status} />
                <span className="min-w-0"><span className="text-slate-800">{c.label}</span>{c.note && <span className="block text-xs text-slate-500">{c.note}</span>}</span>
              </li>
            ))}
          </ul>
        )}

        {result.missing.length > 0 && result.verdict !== 'no_aplica' && (
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-3 text-sm">
            <p className="font-bold text-blue-900 flex items-center gap-1.5"><Info className="w-4 h-4" /> Para revisarlo completo nos falta:</p>
            <p className="text-blue-900 mt-0.5">{result.missing.join(' · ')}</p>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {(result.verdict === 'si' || result.verdict === 'casi') && (
            <button type="button" onClick={() => onPostular(conv)} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 text-sm cursor-pointer">
              Postular a esta convocatoria <ArrowRight className="w-4 h-4" />
            </button>
          )}
          {result.missing.length > 0 && result.verdict !== 'no_aplica' && (
            <button type="button" onClick={() => onCompleteData(result.missing)} className="w-full rounded-xl border border-blue-300 text-blue-800 hover:bg-blue-50 font-bold py-2.5 text-sm cursor-pointer">{result.missing.every(m => m.startsWith('Carpeta')) ? 'Subir mi carpeta tributaria' : 'Completar mis datos'}</button>
          )}
          {conv.url && (
            <a href={conv.url} target="_blank" rel="noopener noreferrer" className="w-full text-center rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold py-2.5 text-sm">Ver las bases oficiales</a>
          )}
          <button type="button" onClick={onClose} className="w-full text-xs font-semibold text-slate-500 hover:text-slate-800 py-1 cursor-pointer">Volver al monitor</button>
        </div>
      </div>
    </div>
  );
};
