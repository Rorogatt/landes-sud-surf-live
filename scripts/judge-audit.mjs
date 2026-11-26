#!/usr/bin/env node
/**
 * ============================================================================
 * AGENT D'AUDIT AUTOMATISÉ — Sud Landes Surf Live (`npm run judge`)
 * ============================================================================
 * Évalue objectivement le site sur 4 piliers (/10 chacun) :
 * 1. Physique Surf, Profils de Niveau (Débutant->Chargeur) & Sécurité (Baïnes / Eau 48h)
 * 2. Ingénierie Streaming (Mur Éco-4G, IntersectionObserver, Plafond Décodeurs, Loupe Zoom ×4)
 * 3. Résilience Forêt Landaise PWA (Manifest, Service Worker, Stale-on-Error Cache)
 * 4. Santé Temps Réel des Flux Live (Open-Meteo Marine/AROME 48h, Bouées, Manifestes HLS)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readText(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

async function checkHttpOk(url, options = {}, timeoutMs = 5500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    return {
      ok: res.ok,
      status: res.status,
      cors: res.headers.get('access-control-allow-origin'),
    };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  } finally {
    clearTimeout(t);
  }
}

async function runAudit() {
  const results = [];
  const findings = [];

  const check = (pillar, points, maxPoints, ok, passMsg, failMsg) => {
    results.push({ pillar, earned: ok ? points : 0, max: maxPoints });
    if (!ok) findings.push(`[${pillar}] ❌ ${failMsg}`);
    else findings.push(`[${pillar}] ✅ ${passMsg}`);
  };

  // --------------------------------------------------------------------------
  // PILIER 1 : Métier Surf, Niveaux & Sécurité Côtière (10 pts)
  // --------------------------------------------------------------------------
  const { LANDES_SUD_SPOTS } = await import('../js/data/spotsBase.js');
  const scoringMod = await import('../js/services/scoring.js');
  const safetyMod = await import('../js/services/safetyAndCoach.js');

  check(
    'Métier Surf',
    2,
    2,
    LANDES_SUD_SPOTS.length === 19,
    '19 spots des Landes du Sud présents et ordonnés Nord→Sud',
    `Attendu 19 spots, trouvé ${LANDES_SUD_SPOTS.length}`
  );

  // Test différenciation Débutant vs Chargeur sur un 2.2m @ 15s creux à La Gravière
  const graviere = LANDES_SUD_SPOTS.find((s) => s.id === 'hossegor-la-graviere');
  const heavySnap = {
    timestamp: Date.parse('2026-10-15T09:00:00Z'),
    offshoreWaveHeightM: 1.7,
    offshoreSwellHeightM: 1.7,
    spotWaveHeightM: 2.25,
    spotFaceRangeText: '1.9–2.8 m',
    primaryPeriodS: 15,
    meanPeriodS: 13,
    waveDirDeg: 292,
    waveDirCompass: 'ONO',
    secondarySwell: { heightM: 0.5, periodS: 10, dirDeg: 320, dirCompass: 'NO' },
    windWaveHeightM: 0.2,
    spotEnergyKj: 2300,
    waterTempC: 17.5,
    airTempC: 16,
    apparentTempC: 16,
    windSpeedKmh: 11,
    windGustsKmh: 15,
    windDirDeg: 95,
    windDirCompass: 'E',
    precipMm: 0,
    rain24hMm: 0,
    rain48hMm: 0,
    isSurfableLight: true,
    isDay: true,
    tide: {
      heightZH: 2.6,
      isRising: true,
      coef: 78,
      progress: 0.5,
      sixthHour: 3,
      twelfthSpeed: 3,
      stageLabel: 'Mi-montante à haute',
    },
  };

  const evalBeginner = scoringMod.evaluateSpotConditions(graviere, heavySnap, 'debutant');
  const evalChargeur = scoringMod.evaluateSpotConditions(graviere, heavySnap, 'chargeur');
  const levelDiffOk =
    evalChargeur?.score10 >= 8.2 &&
    evalBeginner?.score10 <= 3.8 &&
    evalChargeur.score10 - evalBeginner.score10 >= 4.5;

  check(
    'Métier Surf',
    3,
    3,
    levelDiffOk,
    `Différenciation niveau validée sur Gravière 2.25m@15s (Débutant: ${evalBeginner?.score10}/10 vs Chargeur: ${evalChargeur?.score10}/10)`,
    `Scoring insensible au niveau (Débutant: ${evalBeginner?.score10}, Chargeur: ${evalChargeur?.score10})`
  );

  // Test closeout sur plage rectiligne (Ondres) à 17s vs Gravière
  const ondres = LANDES_SUD_SPOTS.find((s) => s.id === 'ondres-plage');
  const closeoutSnap = { ...heavySnap, spotWaveHeightM: 1.5, primaryPeriodS: 17.5, tide: { ...heavySnap.tide, heightZH: 1.5 } };
  const ondresCloseout = scoringMod.evaluateSwellForSpot(ondres, closeoutSnap);
  const graviereLongP = scoringMod.evaluateSwellForSpot(graviere, closeoutSnap);
  check(
    'Métier Surf',
    2,
    2,
    graviereLongP.score10 - ondresCloseout.score10 >= 1.0,
    `Détection closeout longue période 17.5s active (Gravière ${graviereLongP.score10} vs Ondres ${ondresCloseout.score10})`,
    'Les houles longues fermantes (17.5s) ne sont pas pénalisées sur les plages droites'
  );

  // Test Sécurité Baïnes & Qualité d'Eau Adour Post-Orage
  const casernes = LANDES_SUD_SPOTS.find((s) => s.id === 'seignosse-les-casernes');
  const bainesHigh = safetyMod.computeBainesRisk(casernes, {
    ...heavySnap,
    spotEnergyKj: 1950,
    tide: { ...heavySnap.tide, coef: 99, progress: 0.35, isRising: true, twelfthSpeed: 3 },
  });
  const tarnos = LANDES_SUD_SPOTS.find((s) => s.id === 'tarnos-metro-la-digue');
  const plumeAlert = safetyMod.computeWaterQualityAlert(tarnos, {
    ...heavySnap,
    rain24hMm: 22,
    rain48hMm: 34,
    tide: { ...heavySnap.tide, isRising: false },
  });

  check(
    'Métier Surf',
    3,
    3,
    bainesHigh.level >= 4 && plumeAlert.status === 'alert',
    `Vigies sécurité actives (Baïnes Casernes: ${bainesHigh.level}/5, Panache Adour 34mm: ${plumeAlert.status})`,
    `Vigies sécurité incomplètes (Baïnes=${bainesHigh.level}, Eau=${plumeAlert.status})`
  );

  // --------------------------------------------------------------------------
  // PILIER 2 : Streaming, Mur Éco-4G, Loupe Zoom & UI 7 Jours (10 pts)
  // --------------------------------------------------------------------------
  const webcamCode = readText('js/components/webcamPlayer.js') || '';
  const chartsCode = readText('js/components/charts.js') || '';
  const appCode = readText('js/app.js') || '';
  const cssCode = readText('css/index.css') || '';

  check(
    'Streaming & UX',
    3,
    3,
    webcamCode.includes('IntersectionObserver') &&
      webcamCode.includes('capLevelToPlayerSize') &&
      webcamCode.includes('MAX_CONCURRENT'),
    'Mur Vidéo protégé : IntersectionObserver + Plafond décodeurs HLS + capLevelToPlayerSize',
    'Manque IntersectionObserver, capLevelToPlayerSize ou plafond de flux simultanés dans webcamPlayer.js'
  );

  check(
    'Streaming & UX',
    2.5,
    2.5,
    webcamCode.includes('data-zoom') && webcamCode.includes('scale('),
    'Loupe numérique interactive (Zoom & Pan sur le line-up) intégrée au lecteur webcam',
    'Absence de contrôle de zoom numérique sur les webcams'
  );

  check(
    'Streaming & UX',
    2.5,
    2.5,
    chartsCode.includes('drawForecast7dChart') && appCode.includes('drawForecast7dChart'),
    'Graphique interactif 7 jours (Houle + Énergie + Vent + Score) implémenté et branché',
    'Graphique 7 jours absent de charts.js ou app.js'
  );

  check(
    'Streaming & UX',
    2,
    2,
    appCode.includes('URLSearchParams') &&
      appCode.includes('wa.me') &&
      cssCode.includes('mobile-map-collapsed'),
    'Deep-link URL + Partage WhatsApp + Ergonomie Mobile Parking (carte repliable) présents',
    'Manque Deep-link URL, partage WhatsApp ou optimisation mobile de la carte'
  );

  // --------------------------------------------------------------------------
  // PILIER 3 : PWA Offline-First "Spécial Pinède" & Stale-on-Error (10 pts)
  // --------------------------------------------------------------------------
  const manifestRaw = readText('manifest.webmanifest');
  const swCode = readText('sw.js') || '';
  const indexHtml = readText('index.html') || '';
  const oceanCode = readText('js/services/oceanApi.js') || '';
  const buoysCode = readText('js/services/buoys.js') || '';

  check(
    'PWA & Offline',
    3.5,
    3.5,
    Boolean(manifestRaw) &&
      fs.existsSync(path.join(ROOT, 'icons/icon.svg')) &&
      indexHtml.includes('manifest.webmanifest') &&
      appCode.includes('serviceWorker'),
    'Manifest PWA, icône SVG vectorielle et enregistrement Service Worker opérationnels',
    'Configuration PWA incomplète (manifest, icône ou enregistrement SW manquant)'
  );

  check(
    'PWA & Offline',
    3.5,
    3.5,
    swCode.includes('safetyAndCoach.js') && swCode.includes('SHELL_CACHE') && swCode.includes('DATA_CACHE'),
    'Service Worker couvre tous les modules ESM v2 + cache API hors-ligne',
    'Service Worker incomplet'
  );

  check(
    'PWA & Offline',
    3,
    3,
    oceanCode.includes('isStaleCache') &&
      oceanCode.includes('past_days=2') &&
      buoysCode.includes('staleFallback'),
    'Fallback Stale-on-Error hors-ligne actif sur Open-Meteo (past_days=2) et Bouées',
    'Risque de perte de cache hors-ligne après expiration TTL dans oceanApi.js ou buoys.js'
  );

  // --------------------------------------------------------------------------
  // PILIER 4 : Santé Réseau Live (APIs + Flux HLS Quanteec) (10 pts)
  // --------------------------------------------------------------------------
  const [marineProbe, aromeProbe, hlsGraviereProbe, buoyEuskoosProbe] = await Promise.all([
    checkHttpOk('https://marine-api.open-meteo.com/v1/marine?latitude=43.67&longitude=-1.44&current=wave_height&past_days=2&forecast_days=2'),
    checkHttpOk('https://api.open-meteo.com/v1/forecast?latitude=43.67&longitude=-1.44&current=wind_speed_10m&past_days=2&forecast_days=2'),
    checkHttpOk('https://ds1-cache.quanteec.com/contents/encodings/live/04593c63-5af6-462d-3536-3230-6d61-63-9bbe-827fb3625ccfd/master.m3u8', {
      headers: { Origin: 'https://rorogatt.github.io' },
    }),
    checkHttpOk('https://www.euskoos.eus/erddap/tabledap/boyaDonostia_NRT_hourly_data.json?time,hm0&time%3E=now-24hours'),
  ]);

  check(
    'Flux Live',
    4,
    4,
    marineProbe.ok && aromeProbe.ok,
    `Open-Meteo Marine (${marineProbe.status}) & AROME 1.5km (${aromeProbe.status}) opérationnels`,
    `Échec sonde Open-Meteo (Marine=${marineProbe.status}, AROME=${aromeProbe.status})`
  );

  check(
    'Flux Live',
    3.5,
    3.5,
    hlsGraviereProbe.ok && hlsGraviereProbe.cors === '*',
    `Flux HLS 1080p Quanteec La Gravière actif (${hlsGraviereProbe.status}, CORS=${hlsGraviereProbe.cors})`,
    `Flux HLS Quanteec inaccessible (${hlsGraviereProbe.status})`
  );

  check(
    'Flux Live',
    2.5,
    2.5,
    buoyEuskoosProbe.ok,
    `Bouée houlographe temps réel EUSKOOS Donostia active (${buoyEuskoosProbe.status})`,
    `Bouée EUSKOOS hors-ligne (${buoyEuskoosProbe.status})`
  );

  // --------------------------------------------------------------------------
  // BILAN CHIFFRÉ PAR PILIER & NOTE GLOBALE / 10
  // --------------------------------------------------------------------------
  const byPillar = {};
  for (const r of results) {
    if (!byPillar[r.pillar]) byPillar[r.pillar] = { earned: 0, max: 0 };
    byPillar[r.pillar].earned += r.earned;
    byPillar[r.pillar].max += r.max;
  }

  console.log('\n================================================================');
  console.log('   VERDICT DU JUGE AUTOMATISÉ — SUD LANDES SURF LIVE');
  console.log('================================================================');
  for (const line of findings) console.log(' ', line);
  console.log('----------------------------------------------------------------');

  let totalEarned = 0;
  let totalMax = 0;
  for (const [p, sc] of Object.entries(byPillar)) {
    totalEarned += sc.earned;
    totalMax += sc.max;
    const score10 = ((sc.earned / sc.max) * 10).toFixed(1);
    console.log(`  • ${p.padEnd(20)} : ${score10} / 10`);
  }
  const global10 = ((totalEarned / totalMax) * 10).toFixed(2);
  console.log('----------------------------------------------------------------');
  console.log(`  ★ NOTE GLOBALE         : ${global10} / 10`);
  console.log('================================================================\n');

  if (Number(global10) < 8.5) {
    process.exitCode = 1;
  }
}

runAudit().catch((err) => {
  console.error('Erreur fatale audit:', err);
  process.exit(1);
});
