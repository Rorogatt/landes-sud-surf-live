/**
 * Moteur Physique v2 de Scoring Surf (/10) Personnalisé par Niveau Surfeur :
 * - Profils : `debutant` | `intermediaire` | `confirme` | `chargeur`
 * - Angle de houle primaire (`idealSwell.directionsDeg`), bonus *Wedge* / malus clapot de la houle secondaire
 * - Vraie pénalité de fermeture (*closeouts*) par houle trop longue sur les beachbreaks rectilignes
 * - Prise en compte des rafales AROME (`windGustsKmh`) et des abris côtiers (Estacade / Digue Tarnos)
 * - Intégration directe du Risque de Baïnes (1–5) et de la Qualité d'Eau Post-Pluie 48h.
 */

import { getParisDateParts, formatParisTime, formatParisShortDate } from './time.js';
import { computeBainesRisk, computeWaterQualityAlert, SURFER_LEVELS } from './safetyAndCoach.js';

const CROWD_VOTES_KEY = 'landes_surf_crowd_votes_v1';

// Spots dont la bathymétrie (Gouf / digue / embouchure) tient les très longues périodes (15-18s) sans fermer d'un bloc
const LONG_PERIOD_HOLD_SPOTS = new Set([
  'hossegor-la-nord',
  'hossegor-la-graviere',
  'hossegor-les-culs-nus',
  'capbreton-la-piste-vvf',
  'tarnos-metro-la-digue',
  'hossegor-la-sud',
  'capbreton-le-prevent',
  'capbreton-notre-dame-miramar',
]);

// Spots lourds / slabs / experts dangereux pour Débutants et exigeants pour Intermédiaires dès que ça pousse
const HEAVY_EXPERT_SPOTS = new Set([
  'hossegor-la-graviere',
  'hossegor-la-nord',
  'capbreton-la-piste-vvf',
  'hossegor-les-culs-nus',
]);

function angleDiffDeg(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

/**
 * Qualifie le vent (moyen + rafales) par rapport à l'azimut de la plage et aux abris locaux.
 */
export function evaluateWindForSpot(spot, snapshot) {
  const speed = snapshot.windSpeedKmh ?? 0;
  const gusts = snapshot.windGustsKmh ?? speed;
  const effectiveWind = speed * 0.72 + gusts * 0.28; // Pondère les rafales violentes au take-off
  const dir = snapshot.windDirDeg ?? 0;
  const offshoreIdeal = spot.orientationAndWind.idealOffshoreWindDeg;
  const deltaOffshore = angleDiffDeg(dir, offshoreIdeal);

  const prot = spot.orientationAndWind.windProtection || {};
  const isNorthWind = dir >= 330 || dir <= 40;
  const isSouthWind = dir >= 155 && dir <= 225;
  const shelteredNorth = prot.isProtectedNorth && isNorthWind;
  const shelteredSouth = prot.isProtectedSouth && isSouthWind;
  const isSheltered = shelteredNorth || shelteredSouth;

  if (speed <= 7 && gusts <= 14) {
    return {
      regime: 'glassy',
      label: 'Glassy (plan d’eau lisse)',
      shortLabel: 'Glassy',
      tone: 'optimal',
      score10: 9.8,
      isSheltered,
      detail: `Vent quasi nul (${speed} km/h) — plan d'eau huileux.`,
    };
  }

  if (deltaOffshore <= 38) {
    let score = effectiveWind <= 22 ? 9.6 : effectiveWind <= 34 ? 8.1 : 6.1;
    if (gusts >= 42) score -= 1.1; // Rafales d'Est arrachant la planche au drop
    return {
      regime: 'offshore',
      label: gusts >= 38 ? 'Offshore fort (rafales au drop)' : 'Pur Offshore (creuse et lisse)',
      shortLabel: 'Offshore',
      tone: score >= 7.5 ? 'optimal' : 'good',
      score10: +Math.max(3.5, score).toFixed(1),
      isSheltered,
      detail: `Vent ${snapshot.windDirCompass} ${speed} km/h (raf. ${gusts} km/h) pile de terre.`,
    };
  }

  if (deltaOffshore <= 68) {
    const score = effectiveWind <= 20 ? 8.6 : effectiveWind <= 32 ? 7.0 : 5.1;
    return {
      regime: 'cross-off',
      label: 'Cross-Offshore propre',
      shortLabel: 'Cross-Off',
      tone: score >= 7.5 ? 'optimal' : 'good',
      score10: score,
      isSheltered,
      detail: `Vent ${snapshot.windDirCompass} ${speed} km/h légèrement de biais terre.`,
    };
  }

  if (isSheltered && deltaOffshore <= 125) {
    const shelterScore = effectiveWind <= 24 ? 8.0 : effectiveWind <= 38 ? 6.7 : 5.2;
    const shelterName = shelteredSouth ? 'Abrité par la Digue' : 'Abrité du Nord';
    return {
      regime: 'sheltered',
      label: `${shelterName} (plan d’eau protégé)`,
      shortLabel: shelterName,
      tone: 'good',
      score10: shelterScore,
      isSheltered: true,
      detail: prot.details || 'Protection côtière active réduisant le clapot.',
    };
  }

  if (deltaOffshore <= 105) {
    const score = effectiveWind <= 14 ? 6.8 : effectiveWind <= 24 ? 5.1 : effectiveWind <= 35 ? 3.6 : 2.2;
    return {
      regime: 'cross',
      label: speed <= 16 ? 'Cross-shore léger' : 'Cross-shore (dérive latérale)',
      shortLabel: 'Cross',
      tone: speed <= 16 ? 'moderate' : 'poor',
      score10: score,
      isSheltered: false,
      detail: `Vent traversier ${snapshot.windDirCompass} ${speed} km/h (raf. ${gusts} km/h).`,
    };
  }

  const score = effectiveWind <= 12 ? 5.5 : effectiveWind <= 20 ? 3.8 : effectiveWind <= 32 ? 2.3 : 1.1;
  return {
    regime: 'onshore',
    label: speed <= 14 ? 'Onshore faible' : speed <= 28 ? 'Onshore (clapot)' : 'Onshore fort (mer hachée)',
    shortLabel: 'Onshore',
    tone: speed <= 13 ? 'moderate' : 'bad',
    score10: score,
    isSheltered: false,
    detail: `Vent de mer ${snapshot.windDirCompass} ${speed} km/h (raf. ${gusts} km/h) dégradant les faces.`,
  };
}

/**
 * Évalue la houle primaire + angle d'attaque + houle secondaire (wedge vs clapot) + closeout longue période.
 */
export function evaluateSwellForSpot(spot, snapshot, surferLevel = 'intermediaire') {
  const h = snapshot.spotWaveHeightM;
  const tp = snapshot.primaryPeriodS;
  const waveDir = snapshot.waveDirDeg ?? 285;
  const sz = spot.idealSwell.sizeMeters;
  const per = spot.idealSwell.periodSec;
  const dirs = spot.idealSwell.directionsDeg || { min: 265, optimal: 292, max: 320 };

  let sizeScore = 5;
  let status = 'ok';
  let summary = `${h.toFixed(1)} m @ ${tp}s`;

  if (h < sz.min * 0.72) {
    sizeScore = 1.5;
    status = 'flat';
    summary = 'Trop petit / Quasi plat';
  } else if (h < sz.min) {
    sizeScore = surferLevel === 'debutant' ? 6.8 : 4.2;
    status = 'small';
    summary = 'Petites vagues (longboard / mousse)';
  } else if (h >= sz.optimalMin && h <= sz.optimalMax) {
    sizeScore = 9.5;
    status = 'optimal';
    summary = 'Taille idéale pour les bancs';
  } else if (h > sz.optimalMax && h <= sz.maxHold) {
    sizeScore = 7.9;
    status = 'solid';
    summary = 'Solide et puissant';
  } else if (h < sz.optimalMin) {
    sizeScore = surferLevel === 'debutant' ? 8.8 : 7.4;
    status = 'fun';
    summary = 'Joli et accessible';
  } else {
    const overRatio = h / sz.maxHold;
    sizeScore = overRatio > 1.35 ? 1.3 : overRatio > 1.15 ? 2.6 : 4.0;
    status = 'saturated';
    summary = `Saturé / Ferme au large (max ~${sz.maxHold} m)`;
  }

  // Adéquation de l'angle de houle primaire
  let dirDelta = 0;
  const optAngleDiff = angleDiffDeg(waveDir, dirs.optimal || 292);
  if (optAngleDiff <= 15) dirDelta = 0.35;
  else if (waveDir < dirs.min - 12 || waveDir > dirs.max + 12) dirDelta = -1.1; // Très oblique -> fort courant latéral

  // Adéquation de la période & VRAIE pénalité Closeout sur les beachbreaks rectilignes (même à taille optimale !)
  let periodDelta = 0;
  if (tp > per.maxHold + 1.2 && !LONG_PERIOD_HOLD_SPOTS.has(spot.id)) {
    const excessS = tp - per.maxHold;
    periodDelta = -Math.min(2.6, 0.75 + excessS * 0.45);
    summary = `Houle longue (${tp}s) : risque de barres fermantes`;
  } else if (tp >= per.optimalMin && tp <= per.optimalMax) {
    periodDelta = 0.7;
  } else if (tp > per.optimalMax && LONG_PERIOD_HOLD_SPOTS.has(spot.id)) {
    periodDelta = 0.85; // La Gravière, La Nord et La Piste adorent les 15-17s !
  } else if (tp < per.min) {
    periodDelta = -1.4;
  }

  // Houle secondaire : bonus "Wedge / Pics en A" si croisée propre (écart 18°..55° et période >= 9s)
  let secDelta = 0;
  const sec = snapshot.secondarySwell;
  if (sec && sec.heightM >= 0.35 && sec.dirDeg != null) {
    const crossAngle = angleDiffDeg(waveDir, sec.dirDeg);
    if (crossAngle >= 18 && crossAngle <= 58 && sec.periodS >= 8.5) {
      secDelta = 0.55; // Crée des pics triangulaires qui ouvrent sur le sable !
    } else if (sec.periodS < 6.5 && sec.heightM >= 0.7) {
      secDelta = -0.5; // Clapot croisé parasite
    }
  }

  // Pénalité mer du vent dominante
  const chopPenalty =
    snapshot.windWaveHeightM > snapshot.offshoreSwellHeightM * 0.85 && snapshot.windWaveHeightM > 1.0 ? -1.0 : 0;

  // Adaptation stricte au NIVEAU DU SURFEUR !
  let levelAdjustment = 0;
  let levelNote = null;
  if (surferLevel === 'debutant') {
    if (spot.id === 'hossegor-la-nord' && h >= 1.5) {
      levelAdjustment = -6.5;
      levelNote = 'Spot Big-Wave au large réservé aux experts';
    } else if (HEAVY_EXPERT_SPOTS.has(spot.id) && h >= 1.35) {
      levelAdjustment = -5.8;
      levelNote = 'Tube creux sur peu d’eau : dangereux pour débuter (repli La Sud / Prévent)';
    } else if (h > 1.65 || snapshot.spotEnergyKj > 950) {
      levelAdjustment = -4.6;
      levelNote = 'Trop puissant pour débutant → privilégier un spot de repli';
    } else if (h >= 0.45 && h <= 1.15 && !HEAVY_EXPERT_SPOTS.has(spot.id)) {
      levelAdjustment = 1.1;
      levelNote = 'Taille douce idéale pour progresser';
    }
  } else if (surferLevel === 'intermediaire') {
    if (spot.id === 'hossegor-la-nord' && h >= 2.3) {
      levelAdjustment = -4.2;
      levelNote = 'Engagement Big-Wave élevé pour niveau intermédiaire';
    } else if (HEAVY_EXPERT_SPOTS.has(spot.id) && h >= 2.0) {
      levelAdjustment = -2.8;
      levelNote = 'Lèvre lourde & casse planches dès 2 m';
    } else if (h > 2.3) {
      levelAdjustment = -2.2;
      levelNote = 'Barre physique à passer';
    }
  } else if (surferLevel === 'chargeur') {
    if (h < 1.0) {
      levelAdjustment = -1.6;
      levelNote = 'Manque de poussée pour un programme chargeur';
    } else if (HEAVY_EXPERT_SPOTS.has(spot.id) && h >= 1.8 && h <= sz.maxHold && tp >= 13) {
      levelAdjustment = 0.8;
      levelNote = 'Conditions World-Class à tubes / engagement';
    }
  }

  const score10 = Math.max(
    1.0,
    Math.min(10, +(sizeScore + dirDelta + periodDelta + secDelta + chopPenalty + levelAdjustment).toFixed(1))
  );

  return {
    score10,
    status,
    summary,
    levelNote,
    hasWedgeBonus: secDelta > 0,
    isFallbackCandidate:
      snapshot.offshoreWaveHeightM >= 2.5 &&
      (spot.goufInfluence?.swellMultiplier ?? 1) <= 0.7 &&
      status !== 'saturated',
  };
}

/**
 * Évalue la marée actuelle par rapport à la fenêtre optimale du spot et au coefficient (>85).
 */
export function evaluateTideForSpot(spot, snapshot) {
  const tide = snapshot.tide;
  if (!tide) {
    return { score10: 6.5, status: 'unknown', label: 'Marée en calcul' };
  }

  const opt = spot.idealTide?.optimalTideHeightM || { min: 0.8, max: 3.0 };
  const h = tide.heightZH;
  const bestPhaseText = (spot.idealTide?.bestPhase || '').toLowerCase();
  const prefersRising = bestPhaseText.includes('montante');

  let score = 6.5;
  let status = 'acceptable';
  let label = 'Jouable à cette marée';

  if (h >= opt.min && h <= opt.max) {
    score = prefersRising && tide.isRising ? 9.5 : 8.6;
    status = 'optimal';
    label = tide.isRising ? 'Créneau optimal (montante)' : 'Bonne hauteur d’eau';
  } else {
    const dist = h < opt.min ? opt.min - h : h - opt.max;
    if (dist <= 0.45) {
      score = 6.6;
      status = 'transition';
      label = h < opt.min ? 'Un peu bas (attendre la montante)' : 'Un peu haut (attendre la baissante)';
    } else {
      score = 3.4;
      status = 'off-window';
      label = h < opt.min ? 'Trop bas (fermant)' : 'Trop haut (shorebreak / backwash)';
    }
  }

  if (tide.coef >= 85 && h > opt.max) {
    score = Math.max(1.8, score - 1.6);
    label = `Plein haut gros coef (${tide.coef}) : shorebreak / backwash`;
  }

  return {
    score10: +score.toFixed(1),
    status,
    label,
    optimalMinM: opt.min,
    optimalMaxM: opt.max,
  };
}

export function getLocalCrowdVote(spotId) {
  try {
    if (typeof localStorage === 'undefined') return null;
    const votes = JSON.parse(localStorage.getItem(CROWD_VOTES_KEY) || '{}');
    const v = votes[spotId];
    if (v && Date.now() - v.ts < 2.5 * 3600_000) return v;
  } catch {
    // Ignore
  }
  return null;
}

export function saveLocalCrowdVote(spotId, levelScore10, label) {
  try {
    if (typeof localStorage === 'undefined') return;
    const votes = JSON.parse(localStorage.getItem(CROWD_VOTES_KEY) || '{}');
    votes[spotId] = { score10: levelScore10, label, ts: Date.now() };
    localStorage.setItem(CROWD_VOTES_KEY, JSON.stringify(votes));
  } catch {
    // Ignore
  }
}

export function evaluateCrowdForSpot(spot, snapshot, surfScore10) {
  const parts = getParisDateParts(snapshot.timestamp);
  const hour = parts.decimalHour;

  if (!snapshot.isSurfableLight || hour < 5.75 || hour > 22.0) {
    return {
      score10: 0,
      level: 'night',
      label: 'Nuit sur la côte (0 à l’eau)',
      shortLabel: 'Nuit (0)',
      surfersCount: 0,
      hasUserVote: false,
    };
  }

  if (surfScore10 <= 2.3) {
    return {
      score10: 1.0,
      level: 'empty',
      label: 'Désert (conditions impraticables)',
      shortLabel: 'Désert',
      surfersCount: 0,
      hasUserVote: false,
    };
  }

  const cf = spot.crowdFactor;
  const month = parts.month;
  const day = parts.weekday;

  let base = cf.basePopularity;
  if (month === 7 || month === 8) base = cf.summerPeakScore;
  else if (month === 9 || month === 10) base = cf.autumnPeakScore;
  else if (month === 12 || month === 1 || month === 2) base = cf.winterScore;
  else base = (cf.basePopularity + cf.autumnPeakScore) / 2;

  let hourMult = 1.0;
  if (hour < 8.2) hourMult = 0.62;
  else if (hour < 10.0) hourMult = 0.94;
  else if (hour < 12.5) hourMult = month >= 6 && month <= 9 ? 1.18 : 1.04;
  else if (hour < 14.5) hourMult = 0.78;
  else if (hour < 17.5) hourMult = 1.1;
  else hourMult = 1.22;

  const isWeekend = day === 0 || day === 6 || (day === 5 && hour >= 16.5);
  const dayMult = isWeekend ? cf.weekendMultiplier : 0.9;

  const stars5 = surfScore10 / 2;
  const qualityMult = Math.max(0.45, 1 + (stars5 - 3) * 0.18 * cf.waveQualitySensitivity);
  const fallbackMult = snapshot.offshoreWaveHeightM >= 2.6 ? cf.fallbackSurgeOnBigSwell : 1.0;
  const rainDiscount = snapshot.precipMm >= 1.5 ? 0.75 : 1.0;

  let score10 = +Math.min(
    10,
    Math.max(1, (base * hourMult * dayMult * qualityMult * fallbackMult * rainDiscount) / 1.15)
  ).toFixed(1);

  const vote = Math.abs(snapshot.timestamp - Date.now()) < 45 * 60_000 ? getLocalCrowdVote(spot.id) : null;
  if (vote) {
    score10 = +(score10 * 0.35 + vote.score10 * 0.65).toFixed(1);
  }

  const surfersCount = Math.max(1, Math.round(Math.pow(score10 / 10, 1.8) * 62));

  let level = 'low';
  let label = 'Tranquille (pics disponibles)';
  let shortLabel = 'Tranquille';
  if (score10 >= 8.2) {
    level = 'packed';
    label = 'Blindé (priorité disputée)';
    shortLabel = 'Blindé';
  } else if (score10 >= 6.4) {
    level = 'busy';
    label = 'Chargé (du monde au pic)';
    shortLabel = 'Chargé';
  } else if (score10 >= 4.2) {
    level = 'moderate';
    label = 'Modéré (bonne rotation)';
    shortLabel = 'Modéré';
  }

  return {
    score10,
    level,
    label: vote ? `${label} • Signalé live` : label,
    shortLabel,
    surfersCount,
    hasUserVote: Boolean(vote),
  };
}

/**
 * Recommandation précise Néoprène + Wax + Planche personnalisée selon le niveau du surfeur !
 */
export function recommendGear(spot, snapshot, surferLevel = 'intermediaire') {
  const wt = snapshot.waterTempC;
  const chill = snapshot.apparentTempC;

  let wetsuit = '3/2 mm intégrale';
  let accessories = 'Sans chaussons';
  let wax = 'Cool (14–19°C)';

  if (wt < 12.5) {
    wetsuit = '5/4/3 mm intégrale';
    accessories = 'Chaussons 3–5 mm + Cagoule + Gants si vent d’Est froid';
    wax = 'Cold (<14°C)';
  } else if (wt < 14.8 || (wt < 16.0 && chill < 9)) {
    wetsuit = '4/3 mm intégrale';
    accessories = chill < 8 ? 'Chaussons 3 mm recommandés (air frais)' : 'Chaussons optionnels à l’aube';
    wax = wt < 14 ? 'Cold (<14°C)' : 'Cool (14–19°C)';
  } else if (wt < 17.8) {
    wetsuit = '3/2 mm intégrale';
    accessories = 'Aucun accessoire nécessaire';
    wax = 'Cool (14–19°C)';
  } else if (wt < 20.5) {
    wetsuit = 'Shorty manches longues 2/2 mm ou 3/2 fine';
    accessories = 'Crème solaire zinc UV';
    wax = 'Warm (19–24°C)';
  } else {
    wetsuit = 'Boardshort / Maillot + Top néoprène 1.5 mm';
    accessories = 'Protection UV indice 50+';
    wax = 'Warm (19–24°C)';
  }

  const h = snapshot.spotWaveHeightM;
  let board = 'Shortboard polyvalent / Daily driver';

  if (surferLevel === 'debutant') {
    board =
      h <= 1.2
        ? 'Planche en mousse (Softboard) 7’6"–8’6" ou Mini-Malibu volumineux'
        : 'Conditions trop puissantes pour débuter — privilégier un cours encadré sur repli';
  } else if (surferLevel === 'intermediaire') {
    if (h < 1.0) board = 'Mid-length 7’0"–7’6", Fish généreux ou Longboard';
    else if (h <= 1.75) board = 'Hybride évolutive / Shortboard confortable (volume généreux)';
    else board = 'Mid-length sécurisant ou repli vers Le Prévent / La Sud';
  } else if (h < 0.85) {
    board = 'Longboard 9’0+, Mid-length ou Twin/Fish volumineux';
  } else if (h < 1.35) {
    board = 'Fish, Twin-fin ou Shortboard hybride joueur';
  } else if (h <= 2.2) {
    board = HEAVY_EXPERT_SPOTS.has(spot.id)
      ? 'Shortboard performant round-pin (prise de carre dans le tube) + leash neuf'
      : 'Shortboard standard affûté';
  } else if (h <= 3.2) {
    board = 'Step-up 6’2"–6’8" + Leash épais 7 mm (forte poussée d’eau)';
  } else {
    board =
      spot.id === 'hossegor-la-nord'
        ? 'Gun / Semi-Gun 7’2"–8’6" + Gilet d’impact (session La Nord)'
        : 'Step-up solide ou repli conseillé vers La Sud / Le Prévent';
  }

  return { wetsuit, accessories, wax, board };
}

/**
 * Synthèse complète v2 d'un spot à l'instant donné, calibrée selon `surferLevel`.
 */
export function evaluateSpotConditions(spot, snapshot, surferLevel = 'intermediaire') {
  if (!snapshot) return null;

  const wind = evaluateWindForSpot(spot, snapshot);
  const swell = evaluateSwellForSpot(spot, snapshot, surferLevel);
  const tide = evaluateTideForSpot(spot, snapshot);
  const baines = computeBainesRisk(spot, snapshot);
  const waterQuality = computeWaterQualityAlert(spot, snapshot);

  let rawScore = swell.score10 * 0.48 + wind.score10 * 0.34 + tide.score10 * 0.18;

  if (swell.status === 'saturated') {
    rawScore = Math.min(rawScore, swell.score10 + 0.6);
  } else if (swell.status === 'flat') {
    rawScore = Math.min(rawScore, 2.5);
  }

  // Plafond strict sécurité par niveau surfeur
  const lvlSpec = SURFER_LEVELS[surferLevel] || SURFER_LEVELS.intermediaire;
  if (snapshot.spotWaveHeightM > lvlSpec.dangerAboveM || (surferLevel === 'debutant' && swell.score10 <= 3.2)) {
    rawScore = Math.min(rawScore, 3.2);
  }

  if (wind.regime === 'onshore' && snapshot.windSpeedKmh >= 34) {
    rawScore = Math.min(rawScore, 3.1);
  }

  // Légère pénalité sanitaire si alerte panache fluvial active (évite de classer Tarnos #1 en pleine crue de l'Adour !)
  if (waterQuality.status === 'alert') {
    rawScore = Math.max(1.2, rawScore - 1.5);
  }

  // Pénalité baïnes extrêmes pour Débutant
  if (surferLevel === 'debutant' && baines.level >= 4) {
    rawScore = Math.min(rawScore, 3.4);
  }

  const score10 = +Math.max(1.0, Math.min(9.9, rawScore)).toFixed(1);

  let verdict = 'Moyen / À surveiller';
  let verdictTone = 'moderate';
  if (swell.levelNote && score10 <= 3.6 && snapshot.spotWaveHeightM > lvlSpec.idealMaxM) {
    verdict = `Trop gros (${lvlSpec.label})`;
    verdictTone = 'bad';
  } else if (swell.status === 'saturated') {
    verdict = 'Saturé / Trop gros';
    verdictTone = 'bad';
  } else if (swell.status === 'flat') {
    verdict = 'Trop petit';
    verdictTone = 'poor';
  } else if (waterQuality.status === 'alert' && score10 < 6.5) {
    verdict = 'Alerte Eau Post-Pluie';
    verdictTone = 'bad';
  } else if (score10 >= 8.2) {
    verdict = 'Session Épique';
    verdictTone = 'optimal';
  } else if (score10 >= 6.8) {
    verdict = swell.isFallbackCandidate ? 'Excellent Repli Actif' : 'Très Bon Créneau';
    verdictTone = 'good';
  } else if (score10 >= 5.2) {
    verdict = 'Surfable / Correct';
    verdictTone = 'moderate';
  } else {
    verdict = 'Dégradé / Venté';
    verdictTone = 'bad';
  }

  // L'affluence réelle à l'eau dépend de la qualité intrinsèque (niveau confirmé), pas du filtre débutant !
  const intrinsicSwell = surferLevel === 'confirme' ? swell : evaluateSwellForSpot(spot, snapshot, 'confirme');
  const intrinsicScore = Math.min(9.9, intrinsicSwell.score10 * 0.48 + wind.score10 * 0.34 + tide.score10 * 0.18);
  const crowd = evaluateCrowdForSpot(spot, snapshot, intrinsicScore);
  const gear = recommendGear(spot, snapshot, surferLevel);

  return {
    score10,
    verdict,
    verdictTone,
    wind,
    swell,
    tide,
    baines,
    waterQuality,
    crowd,
    gear,
  };
}

/**
 * Scanne les 48 prochaines heures (heures de jour surfables) selon le `surferLevel` choisi !
 */
export function findBestUpcomingSessions(
  spots,
  telemetryBySpot,
  getSnapshotFn,
  fromMs = Date.now(),
  surferLevel = 'intermediaire'
) {
  const candidates = [];
  const startHourMs = Math.ceil(fromMs / 3600_000) * 3600_000;

  for (const spot of spots) {
    const tel = telemetryBySpot[spot.id];
    if (!tel) continue;

    let currentWindow = null;

    for (let h = 0; h <= 48; h++) {
      const ts = startHourMs + h * 3600_000;
      const snap = getSnapshotFn(spot, tel, ts, false);
      if (!snap || !snap.isSurfableLight) {
        if (currentWindow) {
          candidates.push(currentWindow);
          currentWindow = null;
        }
        continue;
      }

      const evalRes = evaluateSpotConditions(spot, snap, surferLevel);
      if (evalRes.score10 >= 6.4 && evalRes.swell.status !== 'saturated' && evalRes.swell.status !== 'flat') {
        if (!currentWindow) {
          currentWindow = {
            spot,
            startMs: ts,
            endMs: ts + 3600_000,
            peakScore: evalRes.score10,
            bestSnap: snap,
            bestEval: evalRes,
            hoursCount: 1,
          };
        } else {
          currentWindow.endMs = ts + 3600_000;
          currentWindow.hoursCount += 1;
          if (evalRes.score10 > currentWindow.peakScore) {
            currentWindow.peakScore = evalRes.score10;
            currentWindow.bestSnap = snap;
            currentWindow.bestEval = evalRes;
          }
        }
      } else if (currentWindow) {
        candidates.push(currentWindow);
        currentWindow = null;
      }
    }
    if (currentWindow) candidates.push(currentWindow);
  }

  if (candidates.length < 4) {
    for (const spot of spots) {
      const tel = telemetryBySpot[spot.id];
      if (!tel) continue;
      let bestForSpot = null;
      for (let h = 1; h <= 48; h++) {
        const ts = startHourMs + h * 3600_000;
        const snap = getSnapshotFn(spot, tel, ts, false);
        if (!snap || !snap.isSurfableLight) continue;
        const evalRes = evaluateSpotConditions(spot, snap, surferLevel);
        if (!bestForSpot || evalRes.score10 > bestForSpot.peakScore) {
          bestForSpot = {
            spot,
            startMs: ts,
            endMs: ts + 2 * 3600_000,
            peakScore: evalRes.score10,
            bestSnap: snap,
            bestEval: evalRes,
            hoursCount: 2,
          };
        }
      }
      if (
        bestForSpot &&
        !candidates.some((c) => c.spot.id === spot.id && Math.abs(c.startMs - bestForSpot.startMs) < 4 * 3600_000)
      ) {
        candidates.push(bestForSpot);
      }
    }
  }

  return candidates
    .sort(
      (a, b) =>
        b.peakScore - a.peakScore ||
        (b.spot.waveProfile?.qualityRating ?? 7) - (a.spot.waveProfile?.qualityRating ?? 7) ||
        b.hoursCount - a.hoursCount
    )
    .slice(0, 9)
    .map((w) => {
      const cappedEndMs = w.bestSnap?.lastLightMs ? Math.min(w.endMs, w.bestSnap.lastLightMs) : w.endMs;
      return {
        ...w,
        dayLabel: formatParisShortDate(w.startMs),
        windowLabel: `${formatParisTime(w.startMs)} – ${formatParisTime(cappedEndMs)}`,
      };
    });
}
