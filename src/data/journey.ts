/**
 * El recorrido completo del usuario, en un solo lugar (fuente única para el consultor,
 * la hoja de ruta, el panel de postulaciones y el encabezado de la postulación).
 *
 *   Etapa A · Prepara tu empresa (3 pasos): datos, perfil del proyecto, carpeta tributaria
 *   Etapa B · Elige tu fondo (1 paso): uno cuyos requisitos cumplas
 *   Etapa C · Postula a {fondo} (6 pasos = hoja de ruta): requisitos, formulario, presupuesto,
 *             documentos y anexos, evaluación simulada, envío
 */
import type { ChileanFund, CompanyProfile } from '../types/funds';
import { calculateProjectProfileCompletion } from '../types/funds';
import { validateRut } from '../utils/rutValidator';
import { computeRoadmap, getFundRules, evaluateRequirement, type RoadmapStep } from './fundStandards';

export type Phase = 'empresa' | 'fondo' | 'postulacion';

export interface JourneyStage {
  id: string;
  phase: Phase;
  /** Ej.: "Prepara tu empresa · paso 2 de 3" o "Postulación a X · paso 4 de 6" */
  phaseLabel: string;
  title: string;
  why: string;
  done: boolean;
  next?: string;
  detail?: string;
  action: { label: string; target: string };
  alt?: { label: string; target: string };
  locked?: boolean;
  blocker?: boolean;
}

export interface JourneyApplication {
  formulation?: any;
  auditResult?: any;
  roadmapConfirmations?: any;
  generatedDocs?: any[];
  status?: string;
  result?: { outcome: 'adjudicada' | 'no_adjudicada' } | null;
  rejectionReview?: { reappliedAs?: string | null } | null;
}

export interface Journey {
  stages: JourneyStage[];
  current: JourneyStage | null;
  currentIdx: number;
  doneCount: number;
  total: number;
  roadmap: ReturnType<typeof computeRoadmap> | null;
}

const WHY: Record<string, string> = {
  step_requirements: 'Revisamos que tu empresa cumpla cada requisito de las bases. Si uno no se cumple, no conviene seguir con este fondo.',
  step_form: 'Redacta cada sección del formulario oficial. Respondes preguntas simples y la IA escribe el texto con tus datos; tú lo revisas.',
  step_budget: 'Arma el presupuesto en las cuentas del fondo. Te guiamos con ejemplos y calculamos el aporte de tu empresa.',
  step_documents: 'Junta lo que se entrega con el formulario: video o pitch, cartas, certificados y anexos. Marca cada uno cuando lo tengas.',
  step_audit: 'Simulamos la evaluación con los criterios del fondo para corregir lo débil antes de enviar.',
  step_submit: 'Descarga el expediente y copia cada sección en el portal oficial. La postulación final la envías tú.'
};

export function isCompanyReady(profile: Partial<CompanyProfile>) {
  const isPerson = profile.companyType === 'sin_iniciar';
  const rutOk = validateRut(profile.rut || '');
  return Boolean(profile.companyName?.trim() && profile.companyName !== 'Mi Empresa' && (rutOk || isPerson) && profile.region);
}

export function computeJourney(input: {
  profile: CompanyProfile;
  fund?: ChileanFund | null;
  application?: JourneyApplication | null;
  hasActivePlan: boolean;
}): Journey {
  const { profile, fund, application, hasActivePlan } = input;
  const isPerson = profile.companyType === 'sin_iniciar';
  const rutOk = validateRut(profile.rut || '');
  const projectPct = calculateProjectProfileCompletion(profile.projectProfile);
  const companyReady = isCompanyReady(profile);

  const stages: JourneyStage[] = [
    {
      id: 'empresa', phase: 'empresa', phaseLabel: 'Prepara tu empresa · paso 1 de 3',
      title: 'Completa los datos de tu empresa',
      why: 'Los fondos piden quién postula: nombre, RUT, tipo de empresa y región. Con eso revisamos si cumples las bases de cada fondo.',
      done: companyReady,
      next: !profile.companyName?.trim() || profile.companyName === 'Mi Empresa' ? 'Nombre o razón social' : !(rutOk || isPerson) ? 'RUT válido' : !profile.region ? 'Región' : undefined,
      action: { label: 'Completar datos de la empresa', target: 'my-company#company-identity' }
    },
    {
      id: 'proyecto', phase: 'empresa', phaseLabel: 'Prepara tu empresa · paso 2 de 3',
      title: 'Cuéntanos tu proyecto',
      why: 'La IA redacta tu postulación solo con lo que tú le cuentas, sin inventar. Responde al menos 5 de las 7 preguntas del perfil del proyecto (puedes usar tu sitio web o los CV del equipo).',
      done: projectPct >= 70,
      next: projectPct >= 70 ? undefined : `Perfil del proyecto al ${projectPct}% (necesitas 70%)`,
      action: { label: 'Completar perfil del proyecto', target: 'my-company#project-profile' }
    },
    {
      id: 'carpeta', phase: 'empresa', phaseLabel: 'Prepara tu empresa · paso 3 de 3',
      title: 'Sube tu carpeta tributaria',
      why: 'Con ella comprobamos tus ventas, antigüedad e inicio de actividades contra los requisitos de cada fondo. Se descarga gratis en sii.cl. Si no la tienes ahora puedes seguir: te la pediremos en los requisitos del fondo que la exija.',
      done: Boolean(profile.taxFolderUploaded) || isPerson || Boolean(profile.taxFolderDeferred),
      action: { label: 'Subir carpeta tributaria', target: 'sii' },
      alt: { label: 'No la tengo ahora: seguir y subirla después', target: 'defer-carpeta' }
    },
    {
      id: 'fondo', phase: 'fondo', phaseLabel: 'Elige tu fondo',
      title: 'Elige un fondo que calce con tu empresa',
      why: 'En "Buscar fondos" te mostramos qué fondos cumples según tus datos. Al elegir uno se arma tu hoja de ruta con sus bases.',
      done: Boolean(application && fund),
      action: { label: 'Ver fondos que calzan', target: 'search-funds' },
      alt: { label: 'Ver convocatorias abiertas', target: 'convocatorias' }
    }
  ];

  let roadmap: Journey['roadmap'] = null;
  if (application && fund) {
    roadmap = computeRoadmap({
      fund,
      profile,
      rutValid: rutOk,
      formulation: application.formulation,
      auditResult: application.auditResult,
      checks: application.roadmapConfirmations?.checks || {},
      confirmedGarantia: Boolean(application.roadmapConfirmations?.confirmedGarantia),
      signedLetters: (application.generatedDocs || []).filter((d: any) => d.status === 'firmada').length,
      submitted: application.status === 'enviada'
    });
    roadmap.steps.forEach((st: RoadmapStep) => {
      const pending = st.items.find(i => !i.done);
      const locked = Boolean(st.needsPlan) && !hasActivePlan;
      const base = {
        id: st.id, phase: 'postulacion' as Phase,
        phaseLabel: `Postulación a ${fund.name} · paso ${st.number} de ${roadmap!.steps.length}`,
        title: st.title, why: WHY[st.id] || st.subtitle, done: st.done, locked
      };
      if (pending?.warn && st.id === 'step_requirements') {
        stages.push({
          ...base,
          blocker: true,
          why: `Según los datos de tu empresa, no cumples un requisito obligatorio de ${fund.name}. Si tus datos están bien, este fondo no es para tu empresa: te conviene elegir otro que sí calce.`,
          next: pending.label,
          detail: pending.detail,
          action: { label: 'Buscar un fondo que calce', target: 'search-funds' },
          alt: { label: 'Ver todos los requisitos de este fondo', target: 'my-application' }
        });
        return;
      }
      if (locked) {
        stages.push({ ...base, next: pending?.label, detail: pending?.detail, action: { label: 'Activar Plan Trimestral', target: 'my-company#mi-plan' } });
        return;
      }
      let next = pending?.label;
      let action = pending?.go || st.action;
      if (pending && !pending.go && pending.confirmable) {
        next = `Confirma que cumples: ${pending.label}`;
        action = { label: 'Revisar y marcar en la hoja de ruta', target: 'my-application' };
      }
      if (pending?.id === 'portal') {
        next = pending.label;
        action = { label: 'Abrir el expediente para postular', target: 'dossier' };
      }
      stages.push({ ...base, next, detail: pending?.detail, action });
    });

    // Después de enviar: esperar el resultado y, según cuál sea, ejecutar el proyecto o mejorar y volver a postular
    const submitted = application.status === 'enviada' || Boolean(application.roadmapConfirmations?.checks?.portal) || Boolean(application.result);
    if (submitted) {
      const outcome = application.result?.outcome;
      const base = { id: 'resultado', phase: 'postulacion' as Phase, phaseLabel: `Después de postular a ${fund.name}` };
      if (!outcome) {
        stages.push({ ...base, title: 'Espera el resultado y márcalo aquí', done: false,
          why: 'Los resultados suelen tardar algunas semanas y llegan por correo o al portal del fondo. Cuando te avisen, márcalo: si ganaste, te acompañamos en la ejecución; si no, armamos un plan para volver a postular mejor.',
          action: { label: 'Marcar el resultado', target: 'resultado' } });
      } else if (outcome === 'adjudicada') {
        stages.push({ ...base, title: 'Ejecuta tu proyecto ganado', done: false,
          why: 'Ganar es la mitad del camino: ahora toca firmar, comprar según el presupuesto aprobado, rendir los gastos y entregar los informes. Te acompañamos para que no se te rechace ningún gasto.',
          action: { label: 'Abrir la ejecución', target: 'resultado' } });
      } else {
        stages.push({ ...base, title: 'Mejora tu postulación y vuelve a intentarlo', done: Boolean(application.rejectionReview?.reappliedAs),
          why: 'La mayoría de los proyectos que ganan no lo logran a la primera. Con la evaluación del comité armamos un plan de mejora y reutilizas todo tu trabajo en la próxima convocatoria.',
          action: { label: 'Armar mi plan de mejora', target: 'resultado' } });
      }
    }
  }

  // Ya enviada (o con resultado): lo que toca es esa etapa (esperar y marcar, ejecutar o mejorar),
  // aunque en la plataforma hayan quedado pasos previos sin marcar
  const resultIdx = stages.findIndex(s => s.id === 'resultado' && !s.done);
  const currentIdx = resultIdx >= 0 ? resultIdx : stages.findIndex(s => !s.done);
  const current = currentIdx >= 0 ? stages[currentIdx] : null;
  return {
    stages,
    current,
    currentIdx,
    doneCount: stages.filter(s => s.done).length,
    total: application && fund ? stages.length : 10,
    roadmap
  };
}

/** ¿La empresa calza con el fondo? Revisa los requisitos de las bases que se pueden comprobar con sus datos. */
export function fundFit(fund: ChileanFund, profile: Partial<CompanyProfile>) {
  const r = getFundRules(fund);
  const rutOk = validateRut(profile.rut || '');
  const fails: { label: string; note?: string }[] = [];
  let unknown = 0;      // requisitos comprobables que faltan datos para revisar
  let declarative = 0;  // requisitos que solo el postulante puede confirmar (no se comprueban con datos)
  let ok = 0;
  for (const q of r.requirements) {
    if (!q.check) { declarative++; continue; }
    const ev = evaluateRequirement(q, profile, rutOk);
    if (ev.status === 'fail') fails.push({ label: q.label, note: ev.note });
    else if (ev.status === 'ok') ok++;
    else unknown++;
  }
  // "Calza" solo cuando todo lo comprobable está revisado y se cumple; si faltan datos, queda por confirmar
  const status: 'cumple' | 'no_cumple' | 'por_confirmar' = fails.length ? 'no_cumple' : unknown || !ok ? 'por_confirmar' : 'cumple';
  return { status, fails, ok, unknown, declarative };
}
