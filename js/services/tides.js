/**
 * Moteur de Marées & Coefficients Français (20 à 120) calibré SHOM
 * pour Capbreton / Hossegor (+38 min), Tarnos/Boucau (+32 min) et Vieux-Boucau/Moliets (+42 min).
 *
 * Utilise la série horaire `sea_level_height_msl` (CMEMS IBI via Open-Meteo Marine)
 * avec correction de phase sous-horaire parabolique et conversion Zéro Hydrographique (+2.38 m).
 */

import { parseParisLocalISO, formatParisTime, getParisDateParts } from './time.js';

const Z0_ZH_CAPBRETON = 2.38; // Niveau moyen au-dessus du Zéro Hydrographique SHOM (m)
const U_EFF_CMEMS = 2.01;     // Unité de hauteur effective calibrée sur grille côtière CMEMS (m)
const SINC_M2 = 0.989;        // Correction d'atténuation horaire sur onde semi-diurne M2 (12.42h)

/**
 * Retourne le décalage de phase optimal (minutes) selon la latitude du spot.
 */
export function getSpotTidePhaseShiftMin(spot) {
  const lat = spot?.coordinates?.peak?.lat ?? 43.66;
  if (lat < 43.59) return 32; // Ondres / Tarnos / Embouchure Adour (Boucau)
  if (lat > 43.75) return 42; // Soustons / Vieux-Boucau / Messanges / Moliets
  return 38;                  // Capbreton / Hossegor / Seignosse
}

/**
 * Extrait toutes les Pleines Mers (PM), Basses Mers (BM), hauteurs ZH et Coefficients (20..120).
 */
export function computeLandesTides(times, mslValues, phaseShiftMin = 38) {
  if (!Array.isArray(times) || !Array.isArray(mslValues) || mslValues.length < 5) {
    return [];
  }

  const parsedTimes = times.map(parseParisLocalISO);
  const extrema = [];

  for (let i = 1; i < mslValues.length - 1; i++) {
    const y0 = mslValues[i - 1];
    const y1 = mslValues[i];
    const y2 = mslValues[i + 1];
    if (y0 == null || y1 == null || y2 == null) continue;

    const isPM = (y1 >= y0 && y1 > y2) || (y1 > y0 && y1 >= y2);
    const isBM = (y1 <= y0 && y1 < y2) || (y1 < y0 && y1 <= y2);
    if (!isPM && !isBM) continue;

    // Évite deux extrema de même nature à moins de 4h d'écart (bruit météo)
    const denom = 2 * (y0 - 2 * y1 + y2);
    const dtHours = denom !== 0 ? Math.max(-0.75, Math.min(0.75, (y0 - y2) / denom)) : 0;
    const yExtMsl = (y1 - 0.25 * (y0 - y2) * dtHours) / SINC_M2;
    const exactMs = parsedTimes[i] + (dtHours * 60 + phaseShiftMin) * 60_000;

    const prev = extrema[extrema.length - 1];
    if (prev && prev.type === (isPM ? 'PM' : 'BM') && Math.abs(exactMs - prev.timestamp) < 4 * 3600_000) {
      if ((isPM && yExtMsl > prev.heightMsl) || (isBM && yExtMsl < prev.heightMsl)) {
        extrema[extrema.length - 1] = {
          type: isPM ? 'PM' : 'BM',
          timestamp: exactMs,
          timeLabel: formatParisTime(exactMs),
          dateKey: getParisDateParts(exactMs).dateKey,
          heightMsl: yExtMsl,
          heightZH: +(yExtMsl + Z0_ZH_CAPBRETON).toFixed(2),
          coef: null,
        };
      }
      continue;
    }

    extrema.push({
      type: isPM ? 'PM' : 'BM',
      timestamp: exactMs,
      timeLabel: formatParisTime(exactMs),
      dateKey: getParisDateParts(exactMs).dateKey,
      heightMsl: yExtMsl,
      heightZH: +(yExtMsl + Z0_ZH_CAPBRETON).toFixed(2),
      coef: null,
    });
  }

  // Calcul des coefficients français (20..120) sur chaque PM encadrée
  for (let k = 0; k < extrema.length; k++) {
    if (extrema[k].type !== 'PM') continue;
    const prevBM = k > 0 && extrema[k - 1].type === 'BM' ? extrema[k - 1] : null;
    const nextBM = k < extrema.length - 1 && extrema[k + 1].type === 'BM' ? extrema[k + 1] : null;

    if (prevBM && nextBM) {
      const semiMarnage = (extrema[k].heightMsl - 0.5 * (prevBM.heightMsl + nextBM.heightMsl)) / 2;
      extrema[k].coef = Math.max(20, Math.min(120, Math.round((100 * semiMarnage) / U_EFF_CMEMS)));
    } else if (prevBM || nextBM) {
      const bm = prevBM || nextBM;
      const semiMarnage = (extrema[k].heightMsl - bm.heightMsl) / 2;
      extrema[k].coef = Math.max(20, Math.min(120, Math.round((100 * semiMarnage) / U_EFF_CMEMS)));
    }
  }

  return extrema;
}

/**
 * Calcule la hauteur d'eau exacte (en mètres ZH), l'état (montante/descendante),
 * l'heure de marée (1e à 6e heure / douzièmes), la prochaine PM & BM et le coefficient actif à l'instant `targetMs`.
 */
export function getTideStateAt(times, mslValues, targetMs = Date.now(), phaseShiftMin = 38) {
  if (!Array.isArray(times) || !Array.isArray(mslValues) || !mslValues.length) {
    return null;
  }

  const parsedTimes = times.map(parseParisLocalISO);
  const shiftedMs = targetMs - phaseShiftMin * 60_000;

  // Interpolation cubique/cosinus ou linéaire lissée entre deux points horaires
  let heightMsl = mslValues[0] ?? 0;
  for (let i = 0; i < parsedTimes.length - 1; i++) {
    const t0 = parsedTimes[i];
    const t1 = parsedTimes[i + 1];
    if (shiftedMs >= t0 && shiftedMs <= t1) {
      const alpha = (shiftedMs - t0) / (t1 - t0);
      const y0 = mslValues[i] ?? 0;
      const y1 = mslValues[i + 1] ?? y0;
      heightMsl = y0 + (y1 - y0) * alpha;
      break;
    }
  }

  const heightZH = +(heightMsl + Z0_ZH_CAPBRETON).toFixed(2);
  const extrema = computeLandesTides(times, mslValues, phaseShiftMin);

  // Encadrement entre dernier extremum passé et prochain extremum futur
  let prevExt = null;
  let nextExt = null;
  for (const ext of extrema) {
    if (ext.timestamp <= targetMs) prevExt = ext;
    if (ext.timestamp > targetMs && !nextExt) nextExt = ext;
  }

  const isRising = nextExt ? nextExt.type === 'PM' : prevExt ? prevExt.type === 'BM' : true;
  let progress = 0.5;
  if (prevExt && nextExt && nextExt.timestamp > prevExt.timestamp) {
    progress = Math.max(0, Math.min(1, (targetMs - prevExt.timestamp) / (nextExt.timestamp - prevExt.timestamp)));
  }

  // Coefficient actif (PM la plus proche)
  let currentCoef = 70;
  let minDist = Infinity;
  for (const ext of extrema) {
    if (ext.type === 'PM' && ext.coef != null) {
      const dist = Math.abs(ext.timestamp - targetMs);
      if (dist < minDist) {
        minDist = dist;
        currentCoef = ext.coef;
      }
    }
  }

  // Phase lisible pour les surfeurs landais
  let stageCode = 'mid';
  let stageLabel = isRising ? 'Mi-marée montante' : 'Mi-marée descendante';
  if (progress < 0.18) {
    stageCode = prevExt?.type === 'BM' ? 'low' : 'high';
    stageLabel = prevExt?.type === 'BM' ? ' étale Basse Mer / Début montante' : 'Étale Pleine Mer / Début baissante';
  } else if (progress > 0.82) {
    stageCode = nextExt?.type === 'PM' ? 'high' : 'low';
    stageLabel = nextExt?.type === 'PM' ? 'Fin de montante (proche PM)' : 'Fin de baissante (proche BM)';
  } else if (progress < 0.42) {
    stageCode = isRising ? 'low-mid-rising' : 'high-mid-falling';
    stageLabel = isRising ? 'Basse à mi-montante' : 'Haute à mi-descendante';
  } else if (progress > 0.62) {
    stageCode = isRising ? 'mid-high-rising' : 'mid-low-falling';
    stageLabel = isRising ? 'Mi-montante à haute' : 'Mi-descendante à basse';
  }

  // Règle des douzièmes (vitesse du courant de marée : max en 3e et 4e heure = 3/12)
  const sixthHour = Math.min(6, Math.max(1, Math.ceil(progress * 6)));
  const twelfthsByHour = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 2, 6: 1 };
  const twelfthSpeed = twelfthsByHour[sixthHour] || 2;

  const targetDateKey = getParisDateParts(targetMs).dateKey;
  const todayExtrema = extrema.filter((e) => e.dateKey === targetDateKey);
  const upcomingExtrema = extrema.filter((e) => e.timestamp >= targetMs - 3600_000).slice(0, 6);

  return {
    heightZH,
    heightMsl: +heightMsl.toFixed(2),
    isRising,
    progress,
    coef: currentCoef,
    coefCategory:
      currentCoef >= 95
        ? 'Grande vive-eau (forts courants)'
        : currentCoef >= 75
          ? 'Vive-eau'
          : currentCoef >= 50
            ? 'Marée moyenne'
            : 'Morte-eau (peu de marnage)',
    stageCode,
    stageLabel: stageLabel.trim(),
    sixthHour,
    twelfthSpeed,
    prevExt,
    nextExt,
    todayExtrema,
    upcomingExtrema,
    allExtrema: extrema,
  };
}

/**
 * Génère une courbe haute résolution (pas de 15 min sur 24h autour du jour ciblé)
 * pour le tracé Canvas de la marée.
 */
export function build24hTideCurve(times, mslValues, centerDayMs = Date.now(), phaseShiftMin = 38) {
  const parts = getParisDateParts(centerDayMs);
  const dayStartMs = parseParisLocalISO(`${parts.dateKey}T00:00`);
  const points = [];
  for (let m = 0; m <= 24 * 60; m += 15) {
    const tMs = dayStartMs + m * 60_000;
    const state = getTideStateAt(times, mslValues, tMs, phaseShiftMin);
    if (state) {
      points.push({
        timestamp: tMs,
        minuteOfDay: m,
        timeLabel: formatParisTime(tMs, ':'),
        heightZH: state.heightZH,
        isRising: state.isRising,
      });
    }
  }
  return { dayStartMs, dateKey: parts.dateKey, points };
}
