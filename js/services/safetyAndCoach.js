/**
 * Module Sécurité Côtière Temps Réel (Baïnes & Qualité d'Eau Post-Pluie),
 * Nowcast Vent AROME 90 minutes (`minutely_15`) et Agent "Coach Surf Local"
 * adapté au profil du surfeur (Débutant · Intermédiaire · Confirmé · Chargeur).
 */

import { parseParisLocalISO, formatParisTime } from './time.js';
import { degToCompassFR } from './oceanApi.js';

export const SURFER_LEVELS = {
  debutant: {
    id: 'debutant',
    label: 'Débutant',
    shortDesc: 'Mousses & vagues douces < 1.1 m, spots abrités sans courant fort',
    idealMaxM: 1.15,
    dangerAboveM: 1.55,
  },
  intermediaire: {
    id: 'intermediaire',
    label: 'Intermédiaire',
    shortDesc: 'Take-off acquis, vagues 0.8–1.7 m propres, évite les slabs lourds',
    idealMaxM: 1.75,
    dangerAboveM: 2.3,
  },
  confirme: {
    id: 'confirme',
    label: 'Confirmé',
    shortDesc: 'Habitué du creux landais (1.2–2.6 m), canard profond & lecture de tubes',
    idealMaxM: 2.65,
    dangerAboveM: 3.6,
  },
  chargeur: {
    id: 'chargeur',
    label: 'Expert / Chargeur',
    shortDesc: 'Gros tubes (Gravière, Piste, Culs Nus) & houles solides (La Nord 3–5 m+)',
    idealMaxM: 5.5,
    dangerAboveM: 7.0,
  },
};

// Sensibilité intrinsèque de chaque spot aux baïnes (1.0 = beachbreak ouvert très exposé)
const BAINES_EXPOSURE_BY_SPOT = {
  'seignosse-les-casernes': 1.25,
  'messanges-nord-centrale': 1.18,
  'moliets-centrale-huchet': 1.15,
  'soustons-plage-la-sauvagine': 1.15,
  'seignosse-le-penon': 1.12,
  'seignosse-les-bourdaines': 1.1,
  'seignosse-les-estagnots': 1.12,
  'hossegor-les-culs-nus': 1.1,
  'labenne-ocean-centrale-chapelle': 1.08,
  'ondres-plage': 1.1,
  'vieux-boucau-nord-estacade': 1.0,
  'hossegor-la-graviere': 0.95,
  'capbreton-la-piste-vvf': 0.98,
  'hossegor-la-nord': 1.05,
  'capbreton-le-santocha': 0.85,
  'tarnos-metro-la-digue': 0.9,
  'capbreton-notre-dame-miramar': 0.65,
  'capbreton-le-prevent': 0.6,
  'hossegor-la-sud': 0.55,
};

// Vulnérabilité aux panaches fluviaux / exutoires après fortes pluies
const ESTUARY_PLUME_PROFILE = {
  'tarnos-metro-la-digue': {
    outletName: 'Embouchure de l’Adour',
    rainThresholdWarnMm48h: 12,
    rainThresholdBadMm48h: 24,
    debrisWarning: true,
    note: 'Panache turbide de l’Adour : bactéries et troncs d’arbres flottants fréquents après pluies basco-béarnaises.',
  },
  'ondres-plage': {
    outletName: 'Dérive Nord Panache Adour',
    rainThresholdWarnMm48h: 22,
    rainThresholdBadMm48h: 38,
    debrisWarning: false,
    note: 'Par houle ou courant Sud→Nord après crue, le panache de l’Adour remonte jusqu’à Ondres.',
  },
  'capbreton-notre-dame-miramar': {
    outletName: 'Passe du Port / Boudigau',
    rainThresholdWarnMm48h: 15,
    rainThresholdBadMm48h: 28,
    debrisWarning: false,
    note: 'Vidange du Boudigau et du port de Capbreton à marée descendante après orages.',
  },
  'hossegor-la-sud': {
    outletName: 'Passe Capbreton / Lac d’Hossegor',
    rainThresholdWarnMm48h: 16,
    rainThresholdBadMm48h: 30,
    debrisWarning: false,
    note: 'Eaux de ruissellement urbaines et vidange du chenal à marée baissante.',
  },
  'capbreton-le-prevent': {
    outletName: 'Proximité Passe Capbreton',
    rainThresholdWarnMm48h: 20,
    rainThresholdBadMm48h: 35,
    debrisWarning: false,
    note: 'Impact modéré du panache portuaire par dérive Nord→Sud après fortes pluies.',
  },
  'moliets-centrale-huchet': {
    outletName: 'Courant d’Huchet (Étang de Léon)',
    rainThresholdWarnMm48h: 16,
    rainThresholdBadMm48h: 30,
    debrisWarning: false,
    note: 'Débit brun tannique et charge organique accrue à l’embouchure d’Huchet après fortes pluies.',
  },
  'vieux-boucau-nord-estacade': {
    outletName: 'Boucarot du Lac Marin (Courant de Soustons)',
    rainThresholdWarnMm48h: 18,
    rainThresholdBadMm48h: 32,
    debrisWarning: false,
    note: 'Vidange du Lac Marin de Port d’Albret à marée descendante.',
  },
  'soustons-plage-la-sauvagine': {
    outletName: 'Sud Boucarot Port d’Albret',
    rainThresholdWarnMm48h: 18,
    rainThresholdBadMm48h: 32,
    debrisWarning: false,
    note: 'Impact du courant de sortie du lac marin par dérive Nord→Sud.',
  },
};

/**
 * Calcule l'indice temps réel de danger de baïnes (échelle 1 à 5).
 */
export function computeBainesRisk(spot, snapshot) {
  if (!snapshot) {
    return { level: 1, label: 'Inconnu', tone: 'good', explanation: '' };
  }

  const exposure = BAINES_EXPOSURE_BY_SPOT[spot.id] ?? 1.0;
  const tide = snapshot.tide;
  const coef = tide?.coef ?? 70;
  const twelfth = tide?.twelfthSpeed ?? 2;
  const progress = tide?.progress ?? 0.5;
  const isRising = tide?.isRising ?? true;

  // Facteur énergie de houle (plus la période et la hauteur montent, plus le wave set-up remplit les bâches)
  const energy = snapshot.spotEnergyKj || 0;
  let energyScore = 1.0;
  if (energy >= 1800) energyScore = 2.5;
  else if (energy >= 950) energyScore = 2.0;
  else if (energy >= 450) energyScore = 1.45;
  else if (energy >= 200) energyScore = 1.05;
  else energyScore = 0.65;

  // Facteur marnage / coefficient
  const coefMult = 0.72 + ((coef - 45) / 75) * 0.58; // ~0.6 à coef 30, ~1.30 à coef 110

  // Facteur phase de marée : pic absolu des baïnes entre BM+1h et mi-montante (quand la barre est submergée) + 3e/4e heure (3/12)
  let phaseMult = 0.85;
  if (isRising && progress >= 0.16 && progress <= 0.58) {
    phaseMult = 1.32;
  } else if (!isRising && progress >= 0.45 && progress <= 0.85) {
    phaseMult = 1.22; // Vidange finale des bâches entre mi-baissante et BM-45min
  } else if (twelfth === 3) {
    phaseMult = 1.2;
  } else if (progress < 0.1 || progress > 0.9) {
    phaseMult = 0.75; // Étale
  }

  const raw = energyScore * coefMult * phaseMult * exposure * 1.45;
  const level = Math.max(1, Math.min(5, Math.round(raw)));

  const map = {
    1: { label: 'Risque Faible', shortLabel: 'Baïnes 1/5', tone: 'optimal' },
    2: { label: 'Modéré (Vigilance)', shortLabel: 'Baïnes 2/5', tone: 'good' },
    3: { label: 'Élevé (Courants actifs)', shortLabel: 'Baïnes 3/5', tone: 'moderate' },
    4: { label: 'Très Fort (Danger réel)', shortLabel: 'Baïnes 4/5', tone: 'poor' },
    5: { label: 'Extrême (Alerte Maximale)', shortLabel: 'Baïnes 5/5', tone: 'bad' },
  };

  const info = map[level];
  let explanation = 'Courants de sortie faibles sur ce créneau.';
  if (level >= 4) {
    explanation = `Alerte tirage maximal (${tide?.sixthHour ?? 3}e h, Coef ${coef}, ${energy} kJ) : les bâches se vident violemment vers le large.`;
  } else if (level === 3) {
    explanation = `Courants de baïnes actifs (${energy} kJ · Coef ${coef}) : repérez les zones sombres sans déferlement avant d’entrer.`;
  } else if (exposure <= 0.68) {
    explanation = 'Plage protégée des grandes baïnes ouvertes, attention toutefois au courant le long des épis/jetées.';
  }

  return {
    level,
    ...info,
    explanation,
  };
}

/**
 * Calcule l'état sanitaire estimé de l'eau (ruissellement / panache estuarien post-pluie 48h).
 */
export function computeWaterQualityAlert(spot, snapshot) {
  const rain24 = snapshot?.rain24hMm ?? 0;
  const rain48 = snapshot?.rain48hMm ?? 0;
  const effectiveRain = Math.max(rain48, rain24 * 1.45);
  const isEbbing = snapshot?.tide ? !snapshot.tide.isRising : false;
  const ebbMultiplier = isEbbing ? 1.25 : 0.95; // La marée descendante pousse l'eau douce des estuaires en mer

  const profile = ESTUARY_PLUME_PROFILE[spot.id];

  if (!profile) {
    if (effectiveRain >= 42) {
      return {
        status: 'watch',
        label: 'Eau brassée (fortes pluies 48h)',
        shortLabel: 'Pluies 48h',
        tone: 'moderate',
        rain48hMm: +rain48.toFixed(1),
        detail: `${rain48.toFixed(0)} mm tombés en 48h, mais plage dunaire éloignée d'embouchure majeure.`,
      };
    }
    return {
      status: 'clean',
      label: 'Eau Océanique Saine',
      shortLabel: 'Eau Saine',
      tone: 'optimal',
      rain48hMm: +rain48.toFixed(1),
      detail: `Aucun exutoire direct (${rain48.toFixed(1)} mm sur 48h).`,
    };
  }

  const adjustedRain = effectiveRain * ebbMultiplier;
  if (adjustedRain >= profile.rainThresholdBadMm48h) {
    return {
      status: 'alert',
      label: profile.debrisWarning
        ? `Alerte Panache & Débris (${profile.outletName})`
        : `Déconseillé Post-Pluie (${profile.outletName})`,
      shortLabel: 'Alerte Eau',
      tone: 'bad',
      rain48hMm: +rain48.toFixed(1),
      detail: `${rain48.toFixed(0)} mm en 48h${isEbbing ? ' + marée descendante' : ''}. ${profile.note}`,
    };
  }

  if (adjustedRain >= profile.rainThresholdWarnMm48h) {
    return {
      status: 'watch',
      label: `Vigilance Exutoire (${profile.outletName})`,
      shortLabel: 'Vigilance Eau',
      tone: 'moderate',
      rain48hMm: +rain48.toFixed(1),
      detail: `${rain48.toFixed(0)} mm cumulés sur 48h. ${profile.note}`,
    };
  }

  return {
    status: 'clean',
    label: 'Qualité d’Eau Normale',
    shortLabel: 'Eau OK',
    tone: 'optimal',
    rain48hMm: +rain48.toFixed(1),
    detail: `Faible cumul de pluie sur 48h (${rain48.toFixed(1)} mm) — pas de crue sur ${profile.outletName}.`,
  };
}

/**
 * Exploite la maille AROME 15 minutes (`weather.minutely_15`) sur les 90 prochaines minutes
 * pour détecter en direct un glass-off, une bascule thermique ou un grain imminent !
 */
export function analyzeWindNowcast90m(spot, spotTelemetry) {
  const m15 = spotTelemetry?.weather?.minutely_15;
  if (!m15?.time?.length) return null;

  const now = Date.now();
  const points = [];
  for (let i = 0; i < m15.time.length; i++) {
    const ts = parseParisLocalISO(m15.time[i]);
    if (ts >= now - 15 * 60_000 && ts <= now + 100 * 60_000) {
      points.push({
        ts,
        timeLabel: formatParisTime(ts),
        speed: m15.wind_speed_10m?.[i] ?? 0,
        gusts: m15.wind_gusts_10m?.[i] ?? 0,
        dir: m15.wind_direction_10m?.[i] ?? 0,
        precip: m15.precipitation?.[i] ?? 0,
      });
    }
  }

  if (points.length < 3) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const deltaSpeed = +(last.speed - first.speed).toFixed(1);
  const maxRain = Math.max(...points.map((p) => p.precip));

  let trendType = 'stable';
  let summary = `Vent stable sur 90 min (~${Math.round(last.speed)} km/h ${degToCompassFR(last.dir)})`;
  if (deltaSpeed <= -6) {
    trendType = 'glassoff';
    summary = `Accalmie / Glass-off en cours (${Math.round(first.speed)} → ${Math.round(last.speed)} km/h d'ici ${last.timeLabel})`;
  } else if (deltaSpeed >= 7) {
    trendType = 'rising';
    summary = `Vent en hausse rapide (${Math.round(first.speed)} → ${Math.round(last.speed)} km/h ${degToCompassFR(last.dir)} d'ici ${last.timeLabel})`;
  }
  if (maxRain >= 0.6) {
    summary += ' · Grain de pluie proche';
  }

  return {
    trendType,
    deltaSpeedKmh: deltaSpeed,
    summary,
    points: points.slice(0, 6),
  };
}

/**
 * Génère le briefing synthétique de l'Agent "Coach Surf Local" en haut du Radar,
 * croisant les 19 spots, le niveau choisi, l'affluence, le nowcast 90 min et la sécurité.
 */
export function buildLocalCoachBriefing({
  spots,
  spotStates,
  telemetryBySpot,
  surferLevel = 'intermediaire',
  targetMs = Date.now(),
  isRealtime = true,
  upcomingBestSessions = [],
}) {
  const levelInfo = SURFER_LEVELS[surferLevel] || SURFER_LEVELS.intermediaire;
  const ranked = spots
    .map((spot) => ({
      spot,
      state: spotStates[spot.id],
    }))
    .filter((x) => x.state?.snapshot && x.state?.evaluation)
    .sort((a, b) => b.state.evaluation.score10 - a.state.evaluation.score10);

  if (!ranked.length) return null;

  const top = ranked[0];
  const topSnap = top.state.snapshot;
  const topEv = top.state.evaluation;

  // Recherche du "Plan B Tranquille" (bon score mais nettement moins de monde)
  const quietAlt = ranked.find(
    (x) =>
      x.spot.id !== top.spot.id &&
      x.state.evaluation.score10 >= Math.max(5.0, topEv.score10 - 1.5) &&
      (x.state.evaluation.crowd.score10 <= topEv.crowd.score10 - 1.2 || x.state.evaluation.crowd.score10 <= 4.8)
  );

  const nowcast = isRealtime ? analyzeWindNowcast90m(top.spot, telemetryBySpot[top.spot.id]) : null;
  const isNightNow = isRealtime && !topSnap.isSurfableLight;

  let headline = '';
  let subline = '';
  let alertBadge = null;

  if (isNightNow) {
    const nextTop = upcomingBestSessions[0];
    headline = `Nuit sur la côte landaise — prépare le Dawn Patrol (${levelInfo.label})`;
    subline = nextTop
      ? `Meilleur créneau repéré : ${nextTop.dayLabel} ${nextTop.windowLabel} à ${nextTop.spot.shortName} (${nextTop.peakScore.toFixed(1)}/10 · ${nextTop.bestSnap.spotWaveHeightM.toFixed(1)}m @ ${nextTop.bestSnap.primaryPeriodS}s).`
      : `Première lueur demain à ${formatParisTime(topSnap.firstLightMs)}. Utilise les boutons rapides "Demain Aube 08h" pour inspecter les bancs.`;
  } else if (topEv.score10 < 4.2) {
    headline = `Côte en souffrance (${topSnap.offshoreWaveHeightM.toFixed(1)}m au large) — prudence pour le profil ${levelInfo.label}`;
    subline = `Même les replis (${top.spot.shortName} à ${topEv.score10.toFixed(1)}/10) subissent le vent ou la saturation. ${
      upcomingBestSessions[0]
        ? `Prochaine vraie fenêtre propre : ${upcomingBestSessions[0].dayLabel} ${upcomingBestSessions[0].windowLabel} (${upcomingBestSessions[0].spot.shortName}).`
        : ''
    }`;
  } else {
    headline = `Direction ${top.spot.shortName} (${topEv.score10.toFixed(1)}/10) pour un profil ${levelInfo.label}`;
    subline = `${topSnap.spotWaveHeightM.toFixed(1)} m @ ${topSnap.primaryPeriodS}s (${topEv.wind.shortLabel} ${topSnap.windSpeedKmh} km/h, ${topSnap.tide?.stageLabel || 'marée en cours'}).`;
    if (quietAlt) {
      subline += ` Option plus calme : ${quietAlt.spot.shortName} (${quietAlt.state.evaluation.score10.toFixed(1)}/10 · ~${quietAlt.state.evaluation.crowd.surfersCount} à l'eau).`;
    }
  }

  if (topEv.waterQuality?.status === 'alert') {
    alertBadge = { tone: 'bad', text: topEv.waterQuality.label };
  } else if (topEv.baines?.level >= 4) {
    alertBadge = { tone: 'poor', text: `Alerte Baïnes ${topEv.baines.level}/5` };
  } else if (nowcast && nowcast.trendType !== 'stable') {
    alertBadge = {
      tone: nowcast.trendType === 'glassoff' ? 'optimal' : 'moderate',
      text: nowcast.summary,
    };
  }

  return {
    levelInfo,
    topChoice: top,
    quietChoice: quietAlt || null,
    isNightNow,
    headline,
    subline,
    nowcast,
    alertBadge,
    nextSession: upcomingBestSessions[0] || null,
  };
}
