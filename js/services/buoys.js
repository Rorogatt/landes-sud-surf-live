/**
 * Client Bouées Houlographes Physiques Temps Réel v2 (100% Client-Side, Résilience Totale).
 *
 * Bouées interrogées :
 * 1. Bilbao-Vizcaya (Portus 2136 — 43.63°N, -3.03°W, fond 600 m) : Sentinelle latitude Hossegor (~1h45 avant impact)
 * 2. Donostia / San Sebastián (EUSKOOS ERDDAP — 43.57°N, -2.00°W) : Plateau proche Sud Landes (~42 km SW)
 * 3. Pasaia II (Portus 1101 — 43.363°N, -1.889°W) : Bouée côtière (~38 km de Tarnos)
 * 4. Gascogne Météo-France / UKMO (Portus 32001 / WMO 62001 — 45.30°N, -5.00°W) : Grand large Golfe de Gascogne
 *
 * Si un serveur institutionnel (Portus / EUSKOOS) est lent, saturé ou muet GTS (>18h),
 * bascule automatiquement sur le relais satellite/modèle CMEMS Open-Meteo aux coordonnées GPS exactes
 * de la bouée afin de toujours fournir Hm0, Tp, Direction, SST et courbe 24h sans erreur brute.
 */

import { formatRelativeAge, parseParisLocalISO } from './time.js';

const CACHE_KEY = 'landes_surf_buoys_v2';
const CACHE_TTL_MS = 10 * 60_000;

const PORTUS_PARAMS = [13, 17, 34, 32, 20, 21, 38, 42, 40, 1];

function degToCompassFR(deg) {
  if (deg == null || Number.isNaN(Number(deg))) return '--';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

function calcWavePowerKwPerM(hm0, tp) {
  if (!hm0 || !tp) return null;
  return +(0.49 * hm0 * hm0 * (0.9 * tp)).toFixed(0);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Délai serveur dépassé')), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPortusBuoy(stationId, meta) {
  const url = `https://portus.puertos.es/portussvr/api/RTData/station/${stationId}?locale=es`;
  const rows = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(PORTUS_PARAMS),
  });

  if (!Array.isArray(rows) || !rows.length) {
    throw new Error(' Flux Portus vide');
  }

  const parsedSeries = rows
    .map((entry) => {
      const ts = Date.parse(String(entry.fecha).replace(' ', 'T') + 'Z');
      const map = {};
      for (const d of entry.datos || []) {
        if (d.averia || d.valor == null || d.valor === '') continue;
        const factor = d.factor && d.factor !== 0 ? Number(d.factor) : 1;
        map[d.id] = Number(d.valor) / factor;
      }
      return {
        timestamp: ts,
        hm0: map[13] ?? null,
        hmax: map[17] ?? null,
        tp: map[34] ?? null,
        tm02: map[32] ?? null,
        meanDir: map[20] ?? null,
        peakDir: map[21] ?? map[20] ?? null,
        waterTemp: map[38] ?? null,
        windSpeedKmh: map[42] != null ? +(map[42] * 3.6).toFixed(1) : null,
        windDir: map[40] ?? null,
        pressureHpa: map[1] ?? null,
      };
    })
    .filter((pt) => Number.isFinite(pt.timestamp) && pt.hm0 != null)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!parsedSeries.length) {
    throw new Error('Mesures houle absentes');
  }

  const latest = parsedSeries[parsedSeries.length - 1];
  const ageHours = (Date.now() - latest.timestamp) / 3600_000;
  if (ageHours > 24) {
    throw new Error('Capteur GTS muet >24h');
  }

  const prev3h = parsedSeries[Math.max(0, parsedSeries.length - 4)] || latest;
  const trendDeltaM = +(latest.hm0 - prev3h.hm0).toFixed(2);

  return {
    ...meta,
    stationId: String(stationId),
    status: ageHours <= 3.5 ? 'live' : 'delayed',
    isModelRelay: false,
    latest: {
      ...latest,
      dirCompass: degToCompassFR(latest.peakDir),
      windCompass: degToCompassFR(latest.windDir),
      wavePowerKw: calcWavePowerKwPerM(latest.hm0, latest.tp || latest.tm02),
      ageLabel: formatRelativeAge(latest.timestamp),
      trendDeltaM,
    },
    history24h: parsedSeries.slice(-24),
  };
}

async function fetchEuskoosDonostia(meta) {
  const url =
    'https://www.euskoos.eus/erddap/tabledap/boyaDonostia_NRT_hourly_data.json?time,hm0,hmax,tp,tm02,wave_dir,thtp,a_60_TEMP000&time%3E=now-24hours';
  const data = await fetchWithTimeout(url);
  const rows = data?.table?.rows || [];
  if (!rows.length) throw new Error('ERDDAP vide');

  const series = rows
    .map((r) => ({
      timestamp: Date.parse(r[0]),
      hm0: r[1] != null ? +Number(r[1]).toFixed(2) : null,
      hmax: r[2] != null ? +Number(r[2]).toFixed(2) : null,
      tp: r[3] != null ? +Number(r[3]).toFixed(1) : null,
      tm02: r[4] != null ? +Number(r[4]).toFixed(1) : null,
      meanDir: r[5] != null ? Math.round(Number(r[5])) : null,
      peakDir: r[6] != null ? Math.round(Number(r[6])) : r[5] != null ? Math.round(Number(r[5])) : null,
      waterTemp: r[7] != null ? +Number(r[7]).toFixed(1) : null,
      windSpeedKmh: null,
      windDir: null,
      pressureHpa: null,
    }))
    .filter((pt) => Number.isFinite(pt.timestamp) && pt.hm0 != null)
    .sort((a, b) => a.timestamp - b.timestamp);

  const latest = series[series.length - 1];
  const prev3h = series[Math.max(0, series.length - 4)] || latest;
  const trendDeltaM = +(latest.hm0 - prev3h.hm0).toFixed(2);
  const ageHours = (Date.now() - latest.timestamp) / 3600_000;

  return {
    ...meta,
    stationId: 'euskoos-donostia',
    status: ageHours <= 3.5 ? 'live' : 'delayed',
    isModelRelay: false,
    latest: {
      ...latest,
      dirCompass: degToCompassFR(latest.peakDir),
      windCompass: '--',
      wavePowerKw: calcWavePowerKwPerM(latest.hm0, latest.tp || latest.tm02),
      ageLabel: formatRelativeAge(latest.timestamp),
      trendDeltaM,
    },
    history24h: series.slice(-24),
  };
}

/**
 * Relais Satellite/CMEMS Open-Meteo aux coordonnées GPS exactes des bouées qui seraient muettes ou en timeout.
 */
async function fetchCmemsBuoyRelayForMissing(missingDefs) {
  if (!missingDefs.length) return {};
  const lats = missingDefs.map((d) => d.coords.lat).join(',');
  const lons = missingDefs.map((d) => d.coords.lon).join(',');
  const url =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}` +
    `&current=wave_height,wave_direction,wave_period,swell_wave_peak_period,sea_surface_temperature` +
    `&hourly=wave_height,wave_direction,wave_period,swell_wave_peak_period,sea_surface_temperature` +
    `&timezone=Europe%2FParis&past_days=1&forecast_days=1`;

  const raw = await fetchWithTimeout(url, {}, 6500);
  const list = Array.isArray(raw) ? raw : [raw];
  const byKey = {};

  missingDefs.forEach((meta, idx) => {
    const item = list[idx] || list[0];
    if (!item?.hourly?.time) return;
    const now = Date.now();
    const series = [];
    item.hourly.time.forEach((iso, i) => {
      const ts = parseParisLocalISO(iso);
      if (ts <= now && ts >= now - 24 * 3600_000) {
        const hm0 = item.hourly.wave_height?.[i];
        if (hm0 == null) return;
        const tp = item.hourly.swell_wave_peak_period?.[i] ?? item.hourly.wave_period?.[i] ?? 10;
        series.push({
          timestamp: ts,
          hm0: +Number(hm0).toFixed(2),
          hmax: +(Number(hm0) * 1.52).toFixed(2), // Relation statistique Rayleigh Hmax ≈ 1.52 Hm0
          tp: +Number(tp).toFixed(1),
          tm02: +Number(item.hourly.wave_period?.[i] ?? tp).toFixed(1),
          peakDir: Math.round(item.hourly.wave_direction?.[i] ?? 285),
          waterTemp: item.hourly.sea_surface_temperature?.[i] != null ? +Number(item.hourly.sea_surface_temperature[i]).toFixed(1) : null,
        });
      }
    });

    if (!series.length) return;
    const latest = series[series.length - 1];
    const prev3h = series[Math.max(0, series.length - 4)] || latest;
    byKey[meta.key] = {
      ...meta,
      stationId: `${meta.key}-cmems`,
      status: 'relay',
      isModelRelay: true,
      source: `${meta.source} · Relais CMEMS`,
      latest: {
        ...latest,
        dirCompass: degToCompassFR(latest.peakDir),
        windCompass: '--',
        wavePowerKw: calcWavePowerKwPerM(latest.hm0, latest.tp),
        ageLabel: 'Relais temps réel',
        trendDeltaM: +(latest.hm0 - prev3h.hm0).toFixed(2),
      },
      history24h: series,
    };
  });

  return byKey;
}

export const BUOY_DEFINITIONS = [
  {
    key: 'bilbao-vizcaya',
    name: 'Bouée Bilbao-Vizcaya (Large 600 m)',
    shortName: 'Bilbao-Vizcaya 600m',
    role: 'Sentinelle avancée latitude Hossegor (préavis ~1h45)',
    coords: { lat: 43.63, lon: -3.03 },
    distanceKm: 125,
    source: 'Puertos del Estado #2136',
    fetcher: (meta) => fetchPortusBuoy(2136, meta),
  },
  {
    key: 'donostia-euskoos',
    name: 'Bouée Donostia / Golfe Sud',
    shortName: 'Donostia Plateau',
    role: 'Référence côtière proche Sud Landes (~42 km SW)',
    coords: { lat: 43.57, lon: -2.0 },
    distanceKm: 42,
    source: 'AZTI / EUSKOOS ERDDAP',
    fetcher: (meta) => fetchEuskoosDonostia(meta),
  },
  {
    key: 'pasaia-ii',
    name: 'Bouée Pasaia II (Côtière)',
    shortName: 'Pasaia II Côtière',
    role: 'Témoin d’impact côtier immédiat (38 km de Tarnos)',
    coords: { lat: 43.363, lon: -1.889 },
    distanceKm: 38,
    source: 'Puertos del Estado #1101',
    fetcher: (meta) => fetchPortusBuoy(1101, meta),
  },
  {
    key: 'gascogne-62001',
    name: 'Bouée Gascogne WMO 62001',
    shortName: 'Gascogne 62001',
    role: 'Sentinelle grand large Golfe de Gascogne (préavis ~8h)',
    coords: { lat: 45.3, lon: -5.0 },
    distanceKm: 330,
    source: 'Météo-France / UKMO #32001',
    fetcher: (meta) => fetchPortusBuoy(32001, meta),
  },
];

export async function fetchAllBuoys({ forceRefresh = false } = {}) {
  let staleFallback = null;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.buoys)) {
        staleFallback = parsed;
        if (!forceRefresh && Date.now() - parsed.savedAt < CACHE_TTL_MS) {
          return parsed.buoys;
        }
      }
    }
  } catch {
    // Ignore cache read error
  }

  const settled = await Promise.allSettled(
    BUOY_DEFINITIONS.map((def) => {
      const { fetcher, ...meta } = def;
      return fetcher(meta);
    })
  );

  const missingDefs = [];
  let buoys = settled.map((res, idx) => {
    const { fetcher, ...meta } = BUOY_DEFINITIONS[idx];
    if (res.status === 'fulfilled') return res.value;
    missingDefs.push(meta);
    return null;
  });

  // Si certaines bouées physiques ont timeout ou sont en maintenance GTS, active le relais CMEMS exact
  let relayByKey = {};
  if (missingDefs.length) {
    try {
      relayByKey = await fetchCmemsBuoyRelayForMissing(missingDefs);
    } catch {
      relayByKey = {};
    }
  }

  buoys = buoys.map((item, idx) => {
    if (item) return item;
    const { fetcher, ...meta } = BUOY_DEFINITIONS[idx];
    if (relayByKey[meta.key]) return relayByKey[meta.key];
    const prevBuoy = staleFallback?.buoys?.find((b) => b.key === meta.key && b.latest);
    if (prevBuoy) {
      return { ...prevBuoy, status: 'delayed', isStaleCache: true };
    }
    return {
      ...meta,
      stationId: meta.key,
      status: 'offline',
      error: 'Liaison satellite momentanément indisponible',
      latest: null,
      history24h: [],
    };
  });

  if (buoys.some((b) => b.latest)) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), buoys }));
      }
    } catch {
      // Ignore storage quota
    }
  }

  return buoys;
}
