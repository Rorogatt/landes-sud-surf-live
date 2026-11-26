/**
 * Service Océanographique & Météo AROME HD 1.5 km (v2 — Offline-Resilient & Pluie 48h).
 *
 * Interroge en 2 appels HTTP batchés seulement (1 Marine + 1 Weather AROME/IFS)
 * l'ensemble des 19 spots des Landes du Sud (de Moliets à Tarnos), avec :
 * - Historique `past_days=2` pour calculer les cumuls glissants de pluie 24h et 48h (panaches estuariens)
 * - Fallback `stale-on-error` : conserve et restitue le cache local en zone blanche 4G (pinède des Casernes / Huchet)
 * - Réfraction bathymétrique du Gouf de Capbreton modulée par la période ET l'angle de houle.
 */

import { parseParisLocalISO } from './time.js';
import { getTideStateAt, getSpotTidePhaseShiftMin } from './tides.js';

const CACHE_KEY = 'landes_surf_ocean_v3';
const CACHE_TTL_MS = 12 * 60_000; // 12 minutes

const MARINE_CURRENT_FIELDS = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'wind_wave_height',
  'wind_wave_direction',
  'wind_wave_period',
  'wind_wave_peak_period',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'swell_wave_peak_period',
  'secondary_swell_wave_height',
  'secondary_swell_wave_period',
  'secondary_swell_wave_direction',
  'sea_surface_temperature',
  'ocean_current_velocity',
  'ocean_current_direction',
  'sea_level_height_msl',
].join(',');

const MARINE_HOURLY_FIELDS = MARINE_CURRENT_FIELDS;

const MARINE_DAILY_FIELDS = [
  'wave_height_max',
  'wave_direction_dominant',
  'wave_period_max',
  'swell_wave_height_max',
  'swell_wave_direction_dominant',
  'swell_wave_peak_period_max',
].join(',');

const WEATHER_CURRENT_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'uv_index',
  'visibility',
].join(',');

const WEATHER_HOURLY_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'pressure_msl',
  'cloud_cover',
  'visibility',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'uv_index',
  'is_day',
].join(',');

const WEATHER_DAILY_FIELDS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'uv_index_max',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
].join(',');

export function degToCompassFR(deg) {
  if (deg == null || Number.isNaN(Number(deg))) return '--';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

export function describeWeatherCodeFR(code, isDay = 1) {
  const map = {
    0: isDay ? 'Ciel dégagé' : 'Nuit claire',
    1: isDay ? 'Grand beau peu nuageux' : 'Nuit peu nuageuse',
    2: 'Éclaircies côtières',
    3: 'Couvert',
    45: 'Brouillard marin',
    48: 'Brouillard givrant',
    51: 'Bruine légère',
    53: 'Bruine océanique',
    55: 'Bruine dense',
    61: 'Pluie faible',
    63: 'Pluie modérée',
    65: 'Pluie soutenue',
    80: 'Averses côtières',
    81: 'Grains modérés',
    82: 'Forts grains océaniques',
    95: 'Orage côtier',
    96: 'Orage et grêle',
  };
  return map[code] || 'Variable océanique';
}

/**
 * Calcule l'énergie de houle en kJ (formule surf : kJ ≈ 2.05 * Hs^2 * Tp^2).
 */
export function computeSurfEnergyKj(hsMeters, tpSec) {
  if (!hsMeters || !tpSec) return 0;
  return Math.round(2.05 * hsMeters * hsMeters * tpSec * tpSec);
}

/**
 * Charge en parallèle (batch CSV) les données Marine + Météo AROME pour tous les spots,
 * avec conservation automatique du cache (`stale-on-error`) si la 4G coupe en forêt.
 */
export async function fetchAllSpotsTelemetry(spots, { forceRefresh = false } = {}) {
  let staleFallback = null;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.bySpotId) {
        staleFallback = parsed;
        if (!forceRefresh && Date.now() - parsed.savedAt < CACHE_TTL_MS) {
          return { ...parsed, isStaleCache: false };
        }
      }
    }
  } catch {
    // Ignore storage read error
  }

  const marineLats = spots.map((s) => (s.coordinates.offshoreApiPoint?.lat ?? s.coordinates.peak.lat).toFixed(4)).join(',');
  const marineLons = spots.map((s) => (s.coordinates.offshoreApiPoint?.lon ?? s.coordinates.peak.lon).toFixed(4)).join(',');

  const weatherLats = spots.map((s) => s.coordinates.peak.lat.toFixed(4)).join(',');
  const weatherLons = spots.map((s) => s.coordinates.peak.lon.toFixed(4)).join(',');

  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${marineLats}&longitude=${marineLons}` +
    `&current=${MARINE_CURRENT_FIELDS}` +
    `&hourly=${MARINE_HOURLY_FIELDS}` +
    `&daily=${MARINE_DAILY_FIELDS}` +
    `&timezone=Europe%2FParis&past_days=2&forecast_days=8`;

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${weatherLats}&longitude=${weatherLons}` +
    `&current=${WEATHER_CURRENT_FIELDS}` +
    `&minutely_15=wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation,weather_code` +
    `&hourly=${WEATHER_HOURLY_FIELDS}` +
    `&daily=${WEATHER_DAILY_FIELDS}` +
    `&timezone=Europe%2FParis&past_days=2&forecast_days=8&forecast_minutely_15=24`;

  try {
    const [marineRes, weatherRes] = await Promise.all([fetch(marineUrl), fetch(weatherUrl)]);
    if (!marineRes.ok) throw new Error(`Erreur API Marine (${marineRes.status})`);
    if (!weatherRes.ok) throw new Error(`Erreur API Météo AROME (${weatherRes.status})`);

    const [marineRaw, weatherRaw] = await Promise.all([marineRes.json(), weatherRes.json()]);
    const marineList = Array.isArray(marineRaw) ? marineRaw : [marineRaw];
    const weatherList = Array.isArray(weatherRaw) ? weatherRaw : [weatherRaw];

    const bySpotId = {};
    spots.forEach((spot, idx) => {
      bySpotId[spot.id] = {
        marine: marineList[idx] || marineList[0],
        weather: weatherList[idx] || weatherList[0],
      };
    });

    const payload = {
      savedAt: Date.now(),
      isStaleCache: false,
      bySpotId,
    };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      }
    } catch {
      // Ignore storage quota if full
    }

    return payload;
  } catch (err) {
    if (staleFallback) {
      return { ...staleFallback, isStaleCache: true };
    }
    throw err;
  }
}

/**
 * Extrait un instantané complet d'un spot à n'importe quel timestamp `targetMs`,
 * incluant la réfraction angulaire/périodique du Gouf et le cumul pluviométrique 24h/48h.
 */
export function getSpotSnapshotAt(spot, spotTelemetry, targetMs = Date.now(), isRealtime = true) {
  if (!spotTelemetry?.marine || !spotTelemetry?.weather) return null;
  const { marine, weather } = spotTelemetry;

  const hTimes = marine.hourly?.time || [];
  const parsedHTimes = hTimes.map(parseParisLocalISO);

  let hIdx = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < parsedHTimes.length; i++) {
    const diff = Math.abs(parsedHTimes[i] - targetMs);
    if (diff < bestDiff) {
      bestDiff = diff;
      hIdx = i;
    }
  }

  const wTimes = weather.hourly?.time || [];
  let wIdx = Math.min(hIdx, Math.max(0, wTimes.length - 1));
  if (wTimes.length) {
    let wBest = Infinity;
    for (let i = 0; i < wTimes.length; i++) {
      const diff = Math.abs(parseParisLocalISO(wTimes[i]) - targetMs);
      if (diff < wBest) {
        wBest = diff;
        wIdx = i;
      }
    }
  }

  // Cumul glissant exact de pluie sur les 24h et 48h précédant targetMs (pour alerte panache fluvial)
  const precipArr = weather.hourly?.precipitation || [];
  let rain24hMm = 0;
  let rain48hMm = 0;
  for (let k = Math.max(0, wIdx - 47); k <= wIdx; k++) {
    const p = Number(precipArr[k] || 0);
    rain48hMm += p;
    if (k > wIdx - 24) rain24hMm += p;
  }

  const useCurrent = isRealtime && Math.abs(targetMs - Date.now()) < 35 * 60_000;

  const rawWaveH = useCurrent
    ? (marine.current?.wave_height ?? marine.hourly?.wave_height?.[hIdx] ?? 0)
    : (marine.hourly?.wave_height?.[hIdx] ?? 0);
  const rawSwellH = useCurrent
    ? (marine.current?.swell_wave_height ?? marine.hourly?.swell_wave_height?.[hIdx] ?? rawWaveH)
    : (marine.hourly?.swell_wave_height?.[hIdx] ?? rawWaveH);

  const swellPeakPeriod = useCurrent
    ? (marine.current?.swell_wave_peak_period ??
       marine.hourly?.swell_wave_peak_period?.[hIdx] ??
       marine.current?.wave_period ??
       10)
    : (marine.hourly?.swell_wave_peak_period?.[hIdx] ??
       marine.hourly?.wave_period?.[hIdx] ??
       10);

  const meanWavePeriod = useCurrent
    ? (marine.current?.wave_period ?? marine.hourly?.wave_period?.[hIdx] ?? swellPeakPeriod)
    : (marine.hourly?.wave_period?.[hIdx] ?? swellPeakPeriod);

  const primaryPeriod = +(Math.max(swellPeakPeriod || 0, meanWavePeriod || 0)).toFixed(1);

  const waveDir = useCurrent
    ? (marine.current?.swell_wave_direction ?? marine.current?.wave_direction ?? marine.hourly?.wave_direction?.[hIdx] ?? 285)
    : (marine.hourly?.swell_wave_direction?.[hIdx] ?? marine.hourly?.wave_direction?.[hIdx] ?? 285);

  const secSwellH = useCurrent
    ? (marine.current?.secondary_swell_wave_height ?? marine.hourly?.secondary_swell_wave_height?.[hIdx] ?? 0)
    : (marine.hourly?.secondary_swell_wave_height?.[hIdx] ?? 0);
  const secSwellP = useCurrent
    ? (marine.current?.secondary_swell_wave_period ?? marine.hourly?.secondary_swell_wave_period?.[hIdx] ?? 0)
    : (marine.hourly?.secondary_swell_wave_period?.[hIdx] ?? 0);
  const secSwellDir = useCurrent
    ? (marine.current?.secondary_swell_wave_direction ?? marine.hourly?.secondary_swell_wave_direction?.[hIdx] ?? null)
    : (marine.hourly?.secondary_swell_wave_direction?.[hIdx] ?? null);

  const windWaveH = useCurrent
    ? (marine.current?.wind_wave_height ?? marine.hourly?.wind_wave_height?.[hIdx] ?? 0)
    : (marine.hourly?.wind_wave_height?.[hIdx] ?? 0);

  const waterTemp = useCurrent
    ? (marine.current?.sea_surface_temperature ?? marine.hourly?.sea_surface_temperature?.[hIdx] ?? 15)
    : (marine.hourly?.sea_surface_temperature?.[hIdx] ?? 15);

  const currentVelKmh = useCurrent
    ? (marine.current?.ocean_current_velocity ?? marine.hourly?.ocean_current_velocity?.[hIdx] ?? 0)
    : (marine.hourly?.ocean_current_velocity?.[hIdx] ?? 0);
  const currentDir = useCurrent
    ? (marine.current?.ocean_current_direction ?? marine.hourly?.ocean_current_direction?.[hIdx] ?? 0)
    : (marine.hourly?.ocean_current_direction?.[hIdx] ?? 0);

  // Effet bathymétrique du Gouf modulé par la période ET l'alignement axial (axe du canyon ~278° Ouest-Nord-Ouest)
  const baseGoufMult = spot.goufInfluence?.swellMultiplier ?? 1.0;
  const periodFactor = Math.min(1.15, Math.max(0.8, (primaryPeriod - 8) / 6));
  const canyonAxisDelta = Math.abs(waveDir - 282);
  const angleFactor = canyonAxisDelta <= 22 ? 1.04 : canyonAxisDelta <= 38 ? 0.94 : 0.8;
  const effectiveGoufMult = 1 + (baseGoufMult - 1) * periodFactor * angleFactor;

  const spotWaveHeightM = +(Math.max(0.15, rawWaveH * effectiveGoufMult)).toFixed(2);
  const spotFaceMinM = +(spotWaveHeightM * 0.85).toFixed(1);
  const spotFaceMaxM = +(spotWaveHeightM * 1.25).toFixed(1);

  const windSpeedKmh = useCurrent
    ? (weather.current?.wind_speed_10m ?? weather.hourly?.wind_speed_10m?.[wIdx] ?? 0)
    : (weather.hourly?.wind_speed_10m?.[wIdx] ?? 0);
  const windGustsKmh = useCurrent
    ? (weather.current?.wind_gusts_10m ?? weather.hourly?.wind_gusts_10m?.[wIdx] ?? windSpeedKmh)
    : (weather.hourly?.wind_gusts_10m?.[wIdx] ?? windSpeedKmh);
  const windDir = useCurrent
    ? (weather.current?.wind_direction_10m ?? weather.hourly?.wind_direction_10m?.[wIdx] ?? 0)
    : (weather.hourly?.wind_direction_10m?.[wIdx] ?? 0);

  const airTemp = useCurrent
    ? (weather.current?.temperature_2m ?? weather.hourly?.temperature_2m?.[wIdx] ?? 15)
    : (weather.hourly?.temperature_2m?.[wIdx] ?? 15);
  const apparentTemp = useCurrent
    ? (weather.current?.apparent_temperature ?? weather.hourly?.apparent_temperature?.[wIdx] ?? airTemp)
    : (weather.hourly?.apparent_temperature?.[wIdx] ?? airTemp);
  const weatherCode = useCurrent
    ? (weather.current?.weather_code ?? weather.hourly?.weather_code?.[wIdx] ?? 1)
    : (weather.hourly?.weather_code?.[wIdx] ?? 1);
  const isDay = useCurrent
    ? (weather.current?.is_day ?? weather.hourly?.is_day?.[wIdx] ?? 1)
    : (weather.hourly?.is_day?.[wIdx] ?? 1);
  const pressureHpa = useCurrent
    ? (weather.current?.pressure_msl ?? weather.hourly?.pressure_msl?.[wIdx] ?? 1015)
    : (weather.hourly?.pressure_msl?.[wIdx] ?? 1015);
  const uvIndex = useCurrent
    ? (weather.current?.uv_index ?? weather.hourly?.uv_index?.[wIdx] ?? 0)
    : (weather.hourly?.uv_index?.[wIdx] ?? 0);
  const visibilityKm = +(
    ((useCurrent ? weather.current?.visibility : weather.hourly?.visibility?.[wIdx]) ?? 10000) / 1000
  ).toFixed(1);
  const precipMm = useCurrent
    ? (weather.current?.precipitation ?? weather.hourly?.precipitation?.[wIdx] ?? 0)
    : (weather.hourly?.precipitation?.[wIdx] ?? 0);

  let sunriseMs = null;
  let sunsetMs = null;
  const dailyTimes = weather.daily?.time || [];
  const targetDayIso = (wTimes[wIdx] || '').slice(0, 10);
  const dIdx = dailyTimes.indexOf(targetDayIso);
  if (dIdx >= 0) {
    sunriseMs = parseParisLocalISO(weather.daily.sunrise?.[dIdx]);
    sunsetMs = parseParisLocalISO(weather.daily.sunset?.[dIdx]);
  }
  const firstLightMs = sunriseMs ? sunriseMs - 25 * 60_000 : null;
  const lastLightMs = sunsetMs ? sunsetMs + 25 * 60_000 : null;
  const isSurfableLight =
    firstLightMs && sunsetMs ? targetMs >= firstLightMs && targetMs <= sunsetMs + 10 * 60_000 : Boolean(isDay);

  const phaseShiftMin = getSpotTidePhaseShiftMin(spot);
  const tide = getTideStateAt(hTimes, marine.hourly?.sea_level_height_msl || [], targetMs, phaseShiftMin);

  const offshoreEnergyKj = computeSurfEnergyKj(rawSwellH || rawWaveH, primaryPeriod);
  const spotEnergyKj = computeSurfEnergyKj(spotWaveHeightM, primaryPeriod);

  return {
    timestamp: targetMs,
    offshoreWaveHeightM: +rawWaveH.toFixed(2),
    offshoreSwellHeightM: +rawSwellH.toFixed(2),
    spotWaveHeightM,
    spotFaceRangeText: `${spotFaceMinM}–${spotFaceMaxM} m`,
    goufMultiplierApplied: +effectiveGoufMult.toFixed(2),
    primaryPeriodS: primaryPeriod,
    meanPeriodS: +meanWavePeriod.toFixed(1),
    waveDirDeg: Math.round(waveDir),
    waveDirCompass: degToCompassFR(waveDir),
    secondarySwell:
      secSwellH >= 0.2
        ? {
            heightM: +secSwellH.toFixed(2),
            periodS: +secSwellP.toFixed(1),
            dirDeg: secSwellDir,
            dirCompass: degToCompassFR(secSwellDir),
          }
        : null,
    windWaveHeightM: +windWaveH.toFixed(2),
    offshoreEnergyKj,
    spotEnergyKj,
    waterTempC: +Number(waterTemp).toFixed(1),
    currentVelKmh: +Number(currentVelKmh).toFixed(1),
    currentDirDeg: Math.round(currentDir),
    currentDirCompass: degToCompassFR(currentDir),
    windSpeedKmh: +Number(windSpeedKmh).toFixed(0),
    windGustsKmh: +Number(windGustsKmh).toFixed(0),
    windDirDeg: Math.round(windDir),
    windDirCompass: degToCompassFR(windDir),
    airTempC: +Number(airTemp).toFixed(1),
    apparentTempC: +Number(apparentTemp).toFixed(1),
    weatherCode,
    weatherLabel: describeWeatherCodeFR(weatherCode, isDay),
    pressureHpa: Math.round(pressureHpa),
    uvIndex: +Number(uvIndex).toFixed(1),
    visibilityKm,
    precipMm: +Number(precipMm).toFixed(1),
    rain24hMm: +rain24hMm.toFixed(1),
    rain48hMm: +rain48hMm.toFixed(1),
    isDay: Boolean(isDay),
    isSurfableLight,
    sunriseMs,
    sunsetMs,
    firstLightMs,
    lastLightMs,
    tide,
  };
}
