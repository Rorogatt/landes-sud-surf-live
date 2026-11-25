/**
 * Utilitaires temporels strictement calés sur le fuseau de la côte landaise (Europe/Paris).
 * Garantit des calculs d'heures de marées, lever/coucher du soleil et affluence identiques
 * quel que soit le fuseau horaire du navigateur client.
 */

const PARIS_TZ = 'Europe/Paris';

const parisPartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PARIS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hour12: false,
});

const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Extrait les composantes calendaires dans le fuseau Europe/Paris pour un Date ou timestamp ms.
 */
export function getParisDateParts(input = Date.now()) {
  const d = input instanceof Date ? input : new Date(input);
  const parts = {};
  for (const p of parisPartsFormatter.formatToParts(d)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: WEEKDAY_MAP[parts.weekday] ?? 0,
    decimalHour: hour + Number(parts.minute) / 60,
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/**
 * Convertit une chaîne ISO locale Open-Meteo ("2026-11-25T18:00") exprimée en Europe/Paris
 * vers un timestamp UTC exact en millisecondes (gère heure d'été CEST +02 et hiver CET +01).
 */
export function parseParisLocalISO(isoStr) {
  if (!isoStr) return NaN;
  if (isoStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(isoStr)) {
    return Date.parse(isoStr);
  }
  const [datePart, timePart = '00:00'] = isoStr.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm = 0] = timePart.split(':').map(Number);

  // Estimation initiale UTC puis correction de l'offset Europe/Paris exact à cette date
  const guessUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  const p = getParisDateParts(guessUtc);
  const asUtcFromParis = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  const offsetMs = asUtcFromParis - guessUtc;
  return guessUtc - offsetMs;
}

/**
 * Formate un timestamp en heure locale Hossegor ("16h58" ou "16:58").
 */
export function formatParisTime(ms, style = 'h') {
  if (!Number.isFinite(ms)) return '--:--';
  const { hour, minute } = getParisDateParts(ms);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return style === ':' ? `${hh}:${mm}` : `${hh}h${mm}`;
}

/**
 * Formate une date courte en français ("Mer. 25 nov.").
 */
export function formatParisShortDate(ms) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(ms));
}

/**
 * Formate date + heure complète ("Mercredi 25 nov. • 18h15").
 */
export function formatParisFullDateTime(ms) {
  const dateLabel = new Intl.DateTimeFormat('fr-FR', {
    timeZone: PARIS_TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(new Date(ms));
  return `${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} • ${formatParisTime(ms)}`;
}

/**
 * Âge relatif lisible ("à l'instant", "il y a 18 min", "il y a 2h").
 */
export function formatRelativeAge(ms, nowMs = Date.now()) {
  if (!Number.isFinite(ms)) return 'inconnu';
  const diffMin = Math.round((nowMs - ms) / 60_000);
  if (diffMin <= 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const rem = diffMin % 60;
  return rem > 0 ? `il y a ${h}h${String(rem).padStart(2, '0')}` : `il y a ${h}h`;
}
