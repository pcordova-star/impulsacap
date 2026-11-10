import React, { useState } from 'react';
import { X, ExternalLink, Check, Copy, Building2 } from 'lucide-react';
import { CompanyProfile } from '../types/funds';

/**
 * Guía para crear la empresa en "Tu Empresa en un Día" (registrodeempresasysociedades.cl),
 * armada con lo aprendido al constituir una SpA real: qué elegir en cada pantalla, textos listos
 * para copiar y los tropiezos típicos (nombre distinto al del carnet, campo de oficina corto,
 * firma electrónica que no se reconoce).
 */
interface Props {
  open: boolean;
  onClose: () => void;
  profile: CompanyProfile;
  /** Marca "empresa en constitución": se puede seguir postulando sin RUT y se agrega cuando llegue */
  onMarkInProgress: () => void;
  /** Ir a Mi empresa a escribir el RUT nuevo */
  onHaveRut: () => void;
}

function objetoSugerido(profile: CompanyProfile): string {
  const what = (profile.projectProfile?.whatItDoes || '').trim().replace(/\s+/g, ' ');
  const base = what ? what.split(/(?<=\.)\s/)[0].replace(/\.$/, '') : '';
  return base
    ? `El desarrollo, la producción y la comercialización, por cuenta propia o ajena, de lo siguiente: ${base.charAt(0).toLowerCase()}${base.slice(1)}; la prestación de los servicios relacionados con ello; y, en general, cualquier otra actividad relacionada directa o indirectamente con dicho giro que acuerden los accionistas.`
    : 'El desarrollo, la producción y la comercialización, por cuenta propia o ajena, de [describe aquí tus productos o servicios]; la prestación de los servicios relacionados con ello; y, en general, cualquier otra actividad relacionada directa o indirectamente con dicho giro que acuerden los accionistas.';
}

const ADMIN_RULES = 'El administrador durará indefinidamente en su cargo mientras no sea revocado por la junta de accionistas y no percibirá remuneración por su desempeño, salvo que la junta de accionistas acuerde otra cosa.';
const FACULTADES = 'El administrador tendrá la representación judicial y extrajudicial de la sociedad y, para el cumplimiento del objeto social, estará investido de todas las facultades de administración y disposición que la ley o estos estatutos no establezcan como privativas de la junta de accionistas, sin necesidad de otorgarle poder especial alguno, incluso para aquellos actos o contratos respecto de los cuales las leyes exijan esta circunstancia. Podrá delegar parte de sus facultades en terceros.';
const JUNTAS = 'Las juntas ordinarias de accionistas se celebrarán una vez al año, dentro del primer cuatrimestre siguiente a la fecha del balance. Mientras la sociedad tenga un solo accionista, los acuerdos que este adopte y deje por escrito equivaldrán a acuerdos de junta.';
const ARBITRO = 'El árbitro será designado de común acuerdo por las partes; a falta de acuerdo, será designado por la justicia ordinaria, debiendo recaer el nombramiento en un abogado que se desempeñe o se haya desempeñado como profesor de derecho civil o comercial en alguna universidad con sede en Santiago.';

export const CompanyCreationGuide: React.FC<Props> = ({ open, onClose, profile, onMarkInProgress, onHaveRut }) => {
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  if (!open) return null;

  const copy = (k: string, text: string) => {
    navigator.clipboard?.writeText(text).then(() => { setCopied(k); setTimeout(() => setCopied(c => (c === k ? null : c)), 2000); }).catch(() => {});
  };
  const CopyText: React.FC<{ k: string; label: string; text: string }> = ({ k, label, text }) => (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <button type="button" onClick={() => copy(k, text)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer">
          {copied === k ? <><Check className="w-3 h-3" /> Copiado</> : <><Copy className="w-3 h-3" /> Copiar</>}
        </button>
      </div>
      <p className="text-xs text-slate-700 leading-relaxed">{text}</p>
    </div>
  );

  const name = (profile.companyName || '').trim();
  const suggestedName = name && name !== 'Mi Empresa' ? (/\bspa\b/i.test(name) ? name : `${name} SpA`) : 'Tu Nombre SpA';

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: 'Antes de empezar',
      body: (
        <div className="space-y-3 text-sm text-slate-700">
          <p>Crear una <strong>SpA</strong> en "Tu Empresa en un Día" es gratis, se hace en línea y la puedes formar tú solo. Ten a mano:</p>
          <ul className="space-y-1.5 text-sm">
            <li>• Tu <strong>ClaveÚnica</strong>.</li>
            <li>• El <strong>nombre</strong> de la sociedad (debe terminar en "SpA").</li>
            <li>• La <strong>dirección</strong> de la empresa. Si no es tuya (oficina de otra empresa, casa arrendada), pide una carta simple de autorización de uso del domicilio: el SII puede pedirla al hacer el inicio de actividades. Se puede cambiar después.</li>
            <li>• Una forma de <strong>firmar</strong>: firma electrónica avanzada o ir a una notaría adherida al Registro con tu carnet.</li>
          </ul>
          <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-2.5">Si el fondo exige empresa, considera las fechas: firmar, recibir el RUT y hacer el inicio de actividades toma unos días. Mientras tanto puedes seguir armando tu postulación aquí marcando que tu empresa está en constitución.</p>
        </div>
      )
    },
    {
      title: 'Nombre, domicilio y objeto',
      body: (
        <div className="space-y-3 text-sm text-slate-700">
          <p>Entra a <a href="https://www.registrodeempresasysociedades.cl" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-700 hover:underline inline-flex items-center gap-1">registrodeempresasysociedades.cl <ExternalLink className="w-3 h-3" /></a> con tu ClaveÚnica → <strong>Constituir</strong> → <strong>Sociedad por Acciones (SpA)</strong>.</p>
          <ul className="space-y-1.5">
            <li>• <strong>Razón social:</strong> por ejemplo "{suggestedName}". El nombre de fantasía es opcional.</li>
            <li>• <strong>Depto/Local:</strong> acepta solo 6 caracteres (escribe "Of 605", no "Oficina 605").</li>
            <li>• Marca <strong>"Usar también como domicilio social"</strong>.</li>
          </ul>
          <p>El <strong>objeto social</strong> debe calzar con tu proyecto (los fondos lo revisan). Ajusta esta sugerencia a tu negocio y evita la palabra "consultoría" si postulas a Start-Up Chile:</p>
          <CopyText k="objeto" label="Objeto social sugerido" text={objetoSugerido(profile)} />
        </div>
      )
    },
    {
      title: 'Capital y administración',
      body: (
        <div className="space-y-3 text-sm text-slate-700">
          <ul className="space-y-1.5">
            <li>• <strong>Capital:</strong> $1.000.000 en <strong>1.000 acciones</strong>, serie única, sin valor nominal. Monto por pagar: $1.000.000 en <strong>12 meses</strong> (no lo pones hoy).</li>
            <li>• <strong>Duración:</strong> indefinida.</li>
            <li>• <strong>Administración:</strong> desmarca "Gerente General" y marca <strong>"Administrador"</strong>, cantidad 1, nombrado en los estatutos.</li>
          </ul>
          <CopyText k="admin" label="Reglas del administrador" text={ADMIN_RULES} />
          <CopyText k="facultades" label="Facultades de la administración" text={FACULTADES} />
          <CopyText k="juntas" label="Juntas ordinarias" text={JUNTAS} />
          <CopyText k="arbitro" label="Árbitro (marca 'Árbitro arbitrador', 1 árbitro)" text={ARBITRO} />
          <p className="text-xs text-slate-500">Son redacciones estándar para una SpA de un socio. Si tienes abogado o contador, que les eche una mirada.</p>
        </div>
      )
    },
    {
      title: 'Accionista y firma',
      body: (
        <div className="space-y-3 text-sm text-slate-700">
          <ul className="space-y-1.5">
            <li>• Escribe tus <strong>nombres y apellidos exactamente como en tu carnet</strong> (con tildes y todos tus nombres): el Registro los compara con el Registro Civil y, si no calzan, no deja guardar.</li>
            <li>• En <strong>Calidad</strong> marca: Accionista, Administrador y Representante ante el SII.</li>
            <li>• <strong>Aporte:</strong> Dinero, 1.000 acciones, $0 pagado, $1.000.000 por pagar en 12 meses.</li>
            <li>• Adjuntar documentos es opcional.</li>
          </ul>
          <p><strong>Firma:</strong> revisa primero el borrador (botón "Descargar"). Luego firma con firma electrónica avanzada o en una notaría adherida, con tu carnet y el N° de atención. Tienes 60 días.</p>
          <p className="text-xs rounded-xl bg-amber-50 border border-amber-200 text-amber-900 p-2.5">Compra y usa la firma electrónica en tu navegador habitual (Chrome, Safari), no dentro de otra app: algunos pasos muestran avisos de confirmación que otras ventanas cierran solas. Si pagaste la firma y no te la reconocen, guarda el comprobante y escribe al soporte del proveedor; mientras tanto puedes firmar en notaría.</p>
        </div>
      )
    },
    {
      title: 'Después de firmar',
      body: (
        <div className="space-y-3 text-sm text-slate-700">
          <ol className="space-y-1.5 list-decimal pl-5">
            <li>El Registro inscribe la sociedad y te entrega el <strong>RUT de la empresa</strong> (normalmente el mismo día).</li>
            <li>Haz el <strong>inicio de actividades</strong> en sii.cl (con la autorización del domicilio si no es tuyo).</li>
            <li>Abre la <strong>cuenta bancaria</strong> de la empresa.</li>
            <li>Vuelve aquí y escribe el RUT en <strong>Mi empresa</strong>: tus postulaciones se actualizan solas.</li>
          </ol>
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => { onClose(); onHaveRut(); }} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Ya tengo el RUT: ir a Mi empresa</button>
          </div>
        </div>
      )
    }
  ];
  const cur = steps[step];

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-label="Guía para crear tu empresa en un día">
      <div className="w-full max-w-xl max-h-[92vh] overflow-hidden rounded-3xl bg-white shadow-2xl flex flex-col">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0"><Building2 className="w-4 h-4" /></span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Crea tu empresa en un día · paso {step + 1} de {steps.length}</p>
              <h2 className="text-lg font-black text-slate-900 leading-tight">{cur.title}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar guía" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-4 sm:px-5 pt-3 flex gap-1.5" aria-hidden="true">
          {steps.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />)}
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{cur.body}</div>
        <div className="p-4 sm:p-5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => { onMarkInProgress(); onClose(); }} className="text-xs font-bold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer">
            Mi empresa está en constitución: seguir postulando sin RUT
          </button>
          <div className="flex gap-2">
            {step > 0 && <button type="button" onClick={() => setStep(s => s - 1)} className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer">Atrás</button>}
            {step < steps.length - 1
              ? <button type="button" onClick={() => setStep(s => s + 1)} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">Siguiente</button>
              : <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">Listo</button>}
          </div>
        </div>
      </div>
    </div>
  );
};
