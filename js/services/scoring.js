/**
 * Moteur Physique de Scoring Surf (/10), Régime de Vent Côtier,
 * Affluence Temps Réel (Europe/Paris), Équipement Néoprène/Quiver
 * et Recherche des Meilleurs Créneaux 48h sur les 19 spots du Sud Landes.
 */

import { getParisDateParts, formatParisTime, formatParisShortDate } from './time.js';

const CROWD_VOTES_KEY = 'landes_surf_crowd_votes_v1';

function angleDiffDeg(a, b) {
  const diff = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return diff;
}

/**
 * Qualifie précisément le vent par rapport à l'azimut exact de la plage et aux abris locaux
 * (Estacade de Capbreton au Nord, Digue de Tarnos au Sud, Front bâti du Prévent).
 */
export function evaluateWindForSpot(spot, snapshot) {
  const speed = snapshot.windSpeedKmh ?? 0;
  const gusts = snapshot.windGustsKmh ?? speed;
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
    const score = speed <= 22 ? 9.6 : speed <= 34 ? 8.3 : 6.8;
    return {
      regime: 'offshore',
      label: speed <= 25 ? 'Pur Offshore (creuse et lisse)' : 'Offshore soutenu (embruns)',
      shortLabel: 'Offshore',
      tone: 'optimal',
      score10: score,
      isSheltered,
      detail: `Vent ${snapshot.windDirCompass} ${speed} km/h pile de terre (idéal ${spot.orientationAndWind.idealOffshoreWindText}).`,
    };
  }

  if (deltaOffshore <= 68) {
    const score = speed <= 20 ? 8.5 : speed <= 32 ? 7.2 : 5.6;
    return {
      regime: 'cross-off',
      label: 'Cross-Offshore propre',
      shortLabel: 'Cross-Off',
      tone: 'optimal',
      score10: score,
      isSheltered,
      detail: `Vent ${snapshot.windDirCompass} ${speed} km/h légèrement de biais terre.`,
    };
  }

  if (isSheltered && deltaOffshore <= 125) {
    const shelterScore = speed <= 24 ? 7.9 : speed <= 38 ? 6.8 : 5.4;
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
    const score = speed <= 14 ? 6.8 : speed <= 24 ? 5.2 : speed <= 35 ? 3.8 : 2.4;
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

  // Onshore
  const score = speed <= 12 ? 5.6 : speed <= 20 ? 4.0 : speed <= 32 ? 2.5 : 1.2;
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
 * Évalue l'adéquation de la houle (taille au spot après réfraction du Gouf + période + direction).
 */
export function evaluateSwellForSpot(spot, snapshot) {
  const h = snapshot.spotWaveHeightM;
  const tp = snapshot.primaryPeriodS;
  const sz = spot.idealSwell.sizeMeters;
  const per = spot.idealSwell.periodSec;

  let sizeScore = 5;
  let status = 'ok';
  let summary = `${h.toFixed(1)} m @ ${tp}s`;

  if (h < sz.min * 0.75) {
    sizeScore = 1.5;
    status = 'flat';
    summary = 'Trop petit / Quasi plat';
  } else if (h < sz.min) {
    sizeScore = 4.2;
    status = 'small';
    summary = 'Petites vagues (longboard / mousse)';
  } else if (h >= sz.optimalMin && h <= sz.optimalMax) {
    sizeScore = 9.5;
    status = 'optimal';
    summary = 'Taille idéale pour les bancs';
  } else if (h > sz.optimalMax && h <= sz.maxHold) {
    sizeScore = 7.8;
    status = 'solid';
    summary = 'Solide et puissant (engagement requis)';
  } else if (h < sz.optimalMin) {
    sizeScore = 7.2;
    status = 'fun';
    summary = 'Joli et accessible';
  } else {
    // Au-dessus du maxHold !
    const overRatio = h / sz.maxHold;
    sizeScore = overRatio > 1.35 ? 1.4 : overRatio > 1.15 ? 2.8 : 4.2;
    status = 'saturated';
    summary = `Saturé / Ferme au large (max tenu ~${sz.maxHold} m)`;
  }

  // Bonus/malus période
  let periodDelta = 0;
  if (tp >= per.optimalMin && tp <= per.optimalMax) periodDelta = 0.8;
  else if (tp > per.maxHold + 2 && status !== 'optimal' && spot.id !== 'hossegor-la-nord' && spot.id !== 'hossegor-la-graviere') {
    periodDelta = -0.8; // Closeouts sur beachbreak classique par 17s+
  } else if (tp < per.min) {
    periodDelta = -1.4; // Houle courte / mer du vent molle
  }

  // Ratio mer du vent vs houle primaire
  const chopPenalty =
    snapshot.windWaveHeightM > snapshot.offshoreSwellHeightM * 0.85 && snapshot.windWaveHeightM > 1.0 ? -1.0 : 0;

  const score10 = Math.max(1, Math.min(10, +(sizeScore + periodDelta + chopPenalty).toFixed(1)));
  return {
    score10,
    status,
    summary,
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
    label = tide.isRising ? 'Dans le créneau optimal (montante)' : 'Dans la bonne hauteur d’eau';
  } else {
    const dist = h < opt.min ? opt.min - h : h - opt.max;
    if (dist <= 0.45) {
      score = 6.6;
      status = 'transition';
      label = h < opt.min ? 'Un peu bas (attendre la montante)' : 'Un peu haut (attendre la baissante)';
    } else {
      score = 3.4;
      status = 'off-window';
      label = h < opt.min ? 'Trop bas (bancs rapides / fermants)' : 'Trop haut (shorebreak / backwash)';
    }
  }

  // Pénalité grand coef (>85) à marée haute sur plages à fort talus / backwash
  if (tide.coef >= 85 && h > opt.max) {
    score = Math.max(1.8, score - 1.6);
    label = `Plein haut gros coef (${tide.coef}) : fort shorebreak / backwash`;
  }

  return {
    score10: +score.toFixed(1),
    status,
    label,
    optimalMinM: opt.min,
    optimalMaxM: opt.max,
  };
}

/**
 * Lecture / écriture des signalements d'affluence locaux (vote communautaire instantané).
 */
export function getLocalCrowdVote(spotId) {
  try {
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
    const votes = JSON.parse(localStorage.getItem(CROWD_VOTES_KEY) || '{}');
    votes[spotId] = { score10: levelScore10, label, ts: Date.now() };
    localStorage.setItem(CROWD_VOTES_KEY, JSON.stringify(votes));
  } catch {
    // Ignore
  }
}

/**
 * Estime l'affluence ("Monde à l'eau") dans le fuseau exact Europe/Paris + lumière réelle + météo + repli.
 */
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
      label: 'Désert (conditions tempête / impraticables)',
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

  let score10 = +Math.min(10, Math.max(1, (base * hourMult * dayMult * qualityMult * fallbackMult * rainDiscount) / 1.15)).toFixed(1);

  const vote = Math.abs(snapshot.timestamp - Date.now()) < 45 * 60_000 ? getLocalCrowdVote(spot.id) : null;
  if (vote) {
    score10 = +((score10 * 0.35 + vote.score10 * 0.65)).toFixed(1);
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
 * Recommandation précise Néoprène + Wax + Planche selon l'eau, le ressenti et la vague.
 */
export function recommendGear(spot, snapshot) {
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
  if (h < 0.85) {
    board = 'Longboard 9’0+, Mid-length ou Fish volumineux';
  } else if (h < 1.35) {
    board = 'Fish, Twin-fin ou Shortboard hybride joueur';
  } else if (h <= 2.2) {
    board =
      spot.id.includes('graviere') || spot.id.includes('piste') || spot.id.includes('culs-nus') || spot.id.includes('bourdaines')
        ? 'Shortboard performant round-pin (prise de carre dans le creux) + leash neuf'
        : 'Shortboard standard ou Mid-length affûté';
  } else if (h <= 3.2) {
    board = 'Step-up 6’2"–6’8" + Leash épais 7 mm (grosse poussée d’eau)';
  } else {
    board =
      spot.id === 'hossegor-la-nord'
        ? 'Gun / Semi-Gun 7’2"–8’6" + Gilet d’impact (session La Nord)'
        : 'Step-up solide ou repli conseillé vers La Sud / Le Prévent';
  }

  return { wetsuit, accessories, wax, board };
}

/**
 * Synthèse complète d'un spot à l'instant donné :
 * Note globale sur 10, verdict francophone, sous-notes (Houle, Vent, Marée), Affluence et Équipement.
 */
export function evaluateSpotConditions(spot, snapshot) {
  if (!snapshot) return null;

  const wind = evaluateWindForSpot(spot, snapshot);
  const swell = evaluateSwellForSpot(spot, snapshot);
  const tide = evaluateTideForSpot(spot, snapshot);

  // Pondération réaliste : si le spot sature complètement ou est plat, le score global plafonne
  let rawScore = swell.score10 * 0.44 + wind.score10 * 0.36 + tide.score10 * 0.2;
  if (swell.status === 'saturated') {
    rawScore = Math.min(rawScore, swell.score10 + 0.8);
  } else if (swell.status === 'flat') {
    rawScore = Math.min(rawScore, 2.6);
  }
  if (wind.regime === 'onshore' && snapshot.windSpeedKmh >= 34) {
    rawScore = Math.min(rawScore, 3.2);
  }

  const score10 = +Math.max(1.0, Math.min(9.9, rawScore)).toFixed(1);

  let verdict = 'Moyen / À surveiller';
  let verdictTone = 'moderate';
  if (swell.status === 'saturated') {
    verdict = 'Saturé / Trop gros';
    verdictTone = 'bad';
  } else if (swell.status === 'flat') {
    verdict = 'Trop petit';
    verdictTone = 'poor';
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

  const crowd = evaluateCrowdForSpot(spot, snapshot, score10);
  const gear = recommendGear(spot, snapshot);

  return {
    score10,
    verdict,
    verdictTone,
    wind,
    swell,
    tide,
    crowd,
    gear,
  };
}

/**
 * Scanne les 48 prochaines heures (heures de jour surfables) sur les 19 spots
 * pour identifier les meilleures fenêtres de surf à venir ("Où et quand surfer ?").
 */
export function findBestUpcomingSessions(spots, telemetryBySpot, getSnapshotFn, fromMs = Date.now()) {
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

      const evalRes = evaluateSpotConditions(spot, snap);
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

  // Si tempête majeure et peu de créneaux >= 6.4, on prend quand même les meilleurs replis diurnes >= 4.8
  if (candidates.length < 4) {
    for (const spot of spots) {
      const tel = telemetryBySpot[spot.id];
      if (!tel) continue;
      let bestForSpot = null;
      for (let h = 1; h <= 48; h++) {
        const ts = startHourMs + h * 3600_000;
        const snap = getSnapshotFn(spot, tel, ts, false);
        if (!snap || !snap.isSurfableLight) continue;
        const evalRes = evaluateSpotConditions(spot, snap);
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
      if (bestForSpot && !candidates.some((c) => c.spot.id === spot.id && Math.abs(c.startMs - bestForSpot.startMs) < 4 * 3600_000)) {
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
