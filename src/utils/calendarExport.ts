import { ChileanFund } from '../types/funds';
import { upcomingForFund } from '../data/upcomingCalls';

/**
 * Eventos de calendario SOLO con fechas conocidas: nunca se completa un plazo con una fecha inventada.
 * - Cierre publicado y futuro → evento de cierre.
 * - Sin cierre, pero con apertura anunciada → evento "Abre la convocatoria" (confirmada o estimada, dicho en el título).
 * - Sin ninguna fecha → no hay evento (los botones se ocultan).
 */
export interface FundCalendarEvent { kind: 'cierre' | 'apertura'; title: string; details: string; start: Date; end: Date; allDay: boolean }

export function fundCalendarEvent(fund: ChileanFund, now = new Date()): FundCalendarEvent | null {
  if (fund.closeDate) {
    const d = new Date(fund.closeDate);
    if (!isNaN(d.getTime()) && d.getTime() > now.getTime()) {
      const hasTime = /T\d{2}:\d{2}/.test(fund.closeDate);
      const start = hasTime ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
      return {
        kind: 'cierre',
        title: `Cierre de postulación: ${fund.name} (${fund.agency})`,
        details: `Cierre publicado de la convocatoria ${fund.name}. Revisa la hora exacta en las bases oficiales y no dejes el envío para el final.\n\nExpediente preparado en ImpulsaCap.`,
        start,
        end: new Date(start.getTime() + 60 * 60 * 1000),
        allDay: !hasTime
      };
    }
  }
  const up = upcomingForFund(fund.id, [], now);
  if (up) {
    const [y, m, dd] = up.date.split('-').map(Number);
    const [hh, mm] = (up.time || '09:00').split(':').map(Number);
    const start = new Date(y, m - 1, dd, hh, mm, 0);
    return {
      kind: 'apertura',
      title: `${up.confirmed ? 'Abre' : 'Abriría (fecha estimada)'} la convocatoria: ${up.label}`,
      details: `${up.confirmed ? 'Fecha publicada por el organismo' : 'Fecha estimada según el calendario anunciado; puede cambiar'}${up.sourceUrl ? ` (${up.sourceUrl})` : ''}. El cierre aún no está publicado: cuando se publique, agrégalo también.\n\nPrepara tu postulación en ImpulsaCap.`,
      start,
      end: new Date(start.getTime() + 60 * 60 * 1000),
      allDay: !up.time
    };
  }
  return null;
}

const fmtUtc = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
const fmtDay = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

/** Enlace de Google Calendar, o null si no hay ninguna fecha conocida */
export const getGoogleCalendarUrl = (fund: ChileanFund): string | null => {
  const ev = fundCalendarEvent(fund);
  if (!ev) return null;
  const dates = ev.allDay
    ? `${fmtDay(ev.start)}/${fmtDay(new Date(ev.start.getTime() + 86400000))}`
    : `${fmtUtc(ev.start)}/${fmtUtc(ev.end)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(ev.title)}&details=${encodeURIComponent(ev.details)}&location=${encodeURIComponent(`Portal de ${fund.agency} (online)`)}&dates=${dates}`;
};

/** Texto del botón según el tipo de evento */
export const calendarLabel = (fund: ChileanFund): string | null => {
  const ev = fundCalendarEvent(fund);
  return ev ? (ev.kind === 'cierre' ? 'Agendar el cierre' : 'Agendar la apertura') : null;
};

/** Descarga un .ics con el mismo evento (no hace nada si no hay fecha conocida) */
export const downloadIcsFile = (fund: ChileanFund): void => {
  const ev = fundCalendarEvent(fund);
  if (!ev) return;
  const ascii = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\n/g, '\\n').replace(/[,;]/g, m => `\\${m}`);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ImpulsaCap Chile//Postulaciones y Fondos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:impulsacap-${fund.id}-${ev.kind}-${fmtDay(ev.start)}@impulsacap.cl`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    ev.allDay ? `DTSTART;VALUE=DATE:${fmtDay(ev.start)}` : `DTSTART:${fmtUtc(ev.start)}`,
    ev.allDay ? `DTEND;VALUE=DATE:${fmtDay(new Date(ev.start.getTime() + 86400000))}` : `DTEND:${fmtUtc(ev.end)}`,
    `SUMMARY:${ascii(ev.title)}`,
    `DESCRIPTION:${ascii(ev.details)}`,
    `LOCATION:Portal de ${ascii(fund.agency)} (online)`,
    'BEGIN:VALARM',
    'TRIGGER:-P3D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${ev.kind === 'cierre' ? 'Faltan 3 dias para el cierre' : 'En 3 dias abre la convocatoria'}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${ev.kind === 'cierre' ? 'Manana cierra la postulacion' : 'Manana abre la convocatoria'}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${ev.kind === 'cierre' ? 'Cierre' : 'Apertura'}_${fund.id}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
