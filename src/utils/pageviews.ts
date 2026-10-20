/**
 * Conteo de visitas sin cookies ni identificadores.
 * Envía solo la sección vista y si es la primera visita del día en este navegador
 * (se guarda únicamente la fecha de la última visita, sin datos personales).
 */
const TAB_TO_PAGE: Record<string, string> = {
  diagnostic: 'inicio',
  convocatorias: 'convocatorias',
  'search-funds': 'fondos',
  catalog: 'fondos',
  'my-applications': 'mis-postulaciones',
  postulation: 'postulacion',
  'my-application': 'postulacion',
  'my-company': 'mi-empresa',
  'pago-resultado': 'pago',
  terminos: 'terminos',
  privacidad: 'privacidad'
};

const VISIT_DAY_KEY = 'impulsacap_visit_day';

function isNewVisitorToday(): boolean {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  try {
    if (localStorage.getItem(VISIT_DAY_KEY) === today) return false;
    localStorage.setItem(VISIT_DAY_KEY, today);
    return true;
  } catch {
    return false;
  }
}

export function trackPageview(activeTab: string): void {
  if (typeof window === 'undefined' || activeTab === 'admin') return;
  if ((navigator as any).webdriver) return;
  const page = TAB_TO_PAGE[activeTab] || 'otra';
  try {
    fetch('/api/metrics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, newVisitorToday: isNewVisitorToday() }),
      keepalive: true
    }).catch(() => {});
  } catch {
    /* sin efecto para el usuario */
  }
}
