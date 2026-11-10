import React from 'react';
import { ExternalLink, FileText, ArrowRight } from 'lucide-react';
import type { ChileanFund } from '../types/funds';
import { upcomingForFund, fmtShortDate } from '../data/upcomingCalls';

/**
 * Paso 6 en lenguaje simple: qué se hace, en orden, para enviar la postulación en el portal oficial.
 * ImpulsaCap prepara el contenido; el envío lo hace la persona en el sitio del organismo.
 */
export const SubmitGuide: React.FC<{
  fund: ChileanFund;
  portalName: string;
  portalUrl: string;
  sections: string[];
  docs: string[];
  onOpenDossier: () => void;
  submitted: boolean;
}> = ({ fund, portalName, portalUrl, sections, docs, onOpenDossier, submitted }) => {
  if (submitted) return null;
  const up = upcomingForFund(fund.id);
  return (
    <div className="rounded-2xl bg-slate-950/70 border border-emerald-500/40 p-4 space-y-3 text-xs text-slate-200">
      <div>
        <p className="text-sm font-black text-white">¿Qué hago ahora? Enviar la postulación en {portalName}</p>
        <p className="text-slate-400 mt-0.5">ImpulsaCap ya te dejó el contenido listo. El envío lo haces tú en el sitio oficial: es copiar, pegar, adjuntar y enviar.</p>
        {up && <p className="mt-1 text-amber-300">La convocatoria {up.confirmed ? 'abre' : 'abriría'} el {fmtShortDate(up.date)}: hasta entonces el formulario oficial no estará disponible.</p>}
      </div>
      <ol className="space-y-2.5">
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">1</span>
          <div>
            <p className="font-bold text-white">Entra al portal y crea tu cuenta (o inicia sesión)</p>
            <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-cyan-300 underline mt-0.5">Abrir {portalName} <ExternalLink className="w-3 h-3" /></a>
            <p className="text-slate-400">Busca la convocatoria de <strong className="text-slate-200">{fund.name}</strong> y abre su formulario de postulación.</p>
          </div>
        </li>
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">2</span>
          <div>
            <p className="font-bold text-white">Abre tu expediente aquí, en otra pestaña o ventana</p>
            <button type="button" onClick={onOpenDossier} className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">
              <FileText className="w-3.5 h-3.5" /> Abrir mi expediente
            </button>
            <p className="text-slate-400 mt-1">Cada sección tiene un botón <strong className="text-slate-200">"Copiar para el portal"</strong>.</p>
          </div>
        </li>
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">3</span>
          <div>
            <p className="font-bold text-white">Copia y pega cada sección en el campo que corresponde del portal</p>
            {sections.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-slate-300">
                {sections.map(t => <li key={t} className="flex items-center gap-1"><ArrowRight className="w-3 h-3 text-emerald-400 shrink-0" />{t}</li>)}
              </ul>
            )}
            <p className="text-slate-400 mt-1">Si un campo del portal tiene límite de caracteres, acorta el texto ahí mismo. Si queda algún [COMPLETAR], reemplázalo por el dato real antes de pegar.</p>
          </div>
        </li>
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">4</span>
          <div>
            <p className="font-bold text-white">Sube los archivos que pide el formulario</p>
            {docs.length > 0 && <p className="text-slate-300 mt-0.5">{docs.join(' · ')}</p>}
            <p className="text-slate-400">El presupuesto se ingresa en la sección de presupuesto del portal, con los montos de tu expediente.</p>
          </div>
        </li>
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">5</span>
          <div>
            <p className="font-bold text-white">Revisa, envía y guarda el comprobante</p>
            <p className="text-slate-400">No lo dejes para el último día: los portales se saturan. Guarda el correo o número de postulación que te entregue el portal.</p>
          </div>
        </li>
        <li className="flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center shrink-0">6</span>
          <div>
            <p className="font-bold text-white">Vuelve aquí y marca "Postular en {portalName}" como hecho</p>
            <p className="text-slate-400">Así te avisamos de los resultados y, si ganas, te acompañamos con la ejecución.</p>
          </div>
        </li>
      </ol>
    </div>
  );
};
