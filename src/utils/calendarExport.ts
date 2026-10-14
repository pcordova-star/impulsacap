import { ChileanFund } from '../types/funds';

/**
 * Generates a Google Calendar link for a Chilean grant closing date
 */
export const getGoogleCalendarUrl = (fund: ChileanFund): string => {
  const title = encodeURIComponent(`Cierre Postulación ${fund.agency}: ${fund.name}`);
  const details = encodeURIComponent(
    `Recordatorio de cierre oficial de postulación para el fondo ${fund.name} (${fund.agency}).\n\n` +
    `Subsidio Máximo: ${fund.subsidyFormatted}\n` +
    `Cofinanciamiento: ${fund.maxCoFinancePct}%\n\n` +
    `Recuerda enviar tu formulario en la plataforma oficial antes de las 16:00 hrs (hora de Chile Continental).\n` +
    `Expediente preparado en INKI.`
  );
  const location = encodeURIComponent(`Plataforma Oficial ${fund.agency} Chile (online)`);

  // Target date parsing or default to next major call
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15, 16, 0, 0);
  const endCall = new Date(now.getFullYear(), now.getMonth() + 1, 15, 17, 0, 0);

  const formatGCalDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const dates = `${formatGCalDate(nextMonth)}/${formatGCalDate(endCall)}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dates}`;
};

/**
 * Generates and triggers download of an .ics calendar file
 */
export const downloadIcsFile = (fund: ChileanFund): void => {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 15, 16, 0, 0);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 15, 17, 0, 0);

  const formatIcsDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//INKI Chile//Postulaciones y Fondos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:inki-fund-${fund.id}-${Date.now()}@inki.cl`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(targetDate)}`,
    `DTEND:${formatIcsDate(endDate)}`,
    `SUMMARY:Cierre de Postulacion ${fund.agency}: ${fund.name}`,
    `DESCRIPTION:Cierre oficial de postulación para el fondo ${fund.name} (${fund.agency}). Subsidio: ${fund.subsidyFormatted}. Enviar antes de las 16:00 hrs continental.`,
    `LOCATION:Plataforma Oficial ${fund.agency} (Online)`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-P3D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio: 3 dias para el cierre del fondo',
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Urgente: Manana cierra la postulacion al fondo',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Cierre_${fund.agency}_${fund.id}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
