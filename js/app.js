/**
 * Contrôleur Principal v2 — Sud Landes Surf Live (Moliets -> Tarnos, 19 Spots)
 *
 * Nouveautés v2 :
 * - Profils Surfeur (`debutant` | `intermediaire` | `confirme` | `chargeur`)
 * - Agent "Coach Surf Local" + Podium Top 3 immédiat + Nowcast AROME 90 min
 * - Double Vigie Sécurité : Indice Baïnes (1–5) & Qualité d'Eau Post-Pluie 48h
 * - Découplage strict des flux Webcams lors du glissement du slider temporel 168h
 * - Graphique interactif 7 jours (`drawForecast7dChart`) + Loupe Line-up `1×–4×`
 * - Ergonomie Mobile "Parking Check" (Tiroir plein écran, Bottom Nav au pouce, Carte repliable)
 * - Partage WhatsApp & Deep-Link URL (`?spot=...&ts=...&level=...`) + PWA Service Worker.
 */

import { LANDES_SUD_SPOTS, GOUF_DE_CAPBRETON } from './data/spotsBase.js';
import { WEBCAMS_BY_SPOT_ID, getAllCoastalWebcams } from './data/webcams.js';
import {
  getParisDateParts,
  parseParisLocalISO,
  formatParisTime,
  formatParisFullDateTime,
  formatParisShortDate,
} from './services/time.js';
import { fetchAllSpotsTelemetry, getSpotSnapshotAt } from './services/oceanApi.js';
import { fetchAllBuoys } from './services/buoys.js';
import {
  evaluateSpotConditions,
  findBestUpcomingSessions,
  saveLocalCrowdVote,
} from './services/scoring.js';
import { buildLocalCoachBriefing, SURFER_LEVELS } from './services/safetyAndCoach.js';
import { renderCoastMap } from './components/coastMap.js';
import {
  mountSpotWebcamPlayer,
  destroyWebcamInside,
  isLowBandwidthConnection,
} from './components/webcamPlayer.js';
import { drawTideChart24h, drawForecast7dChart, drawBuoySparkline } from './components/charts.js';

const SPOTS = LANDES_SUD_SPOTS.map((spot) => ({
  ...spot,
  webcams: WEBCAMS_BY_SPOT_ID[spot.id] || [],
}));

const FAVORITES_KEY = 'landes_surf_favorites_v1';
const THEME_KEY = 'landes_surf_theme_v1';
const WIND_UNIT_KEY = 'landes_surf_wind_unit_v1';
const LEVEL_KEY = 'landes_surf_level_v1';
const SANDBAR_NOTES_KEY = 'landes_surf_sandbars_v1';

// Lecture des paramètres Deep-Link URL éventuels (?spot=...&ts=...&level=...&mode=...)
const initialParams = new URLSearchParams(window.location.search);
const urlSpot = initialParams.get('spot');
const urlLevel = initialParams.get('level');
const urlTs = Number(initialParams.get('ts') || 0);
const urlMode = initialParams.get('mode');

const state = {
  mode: ['radar', 'wall', 'sessions', 'buoys'].includes(urlMode) ? urlMode : 'radar',
  surferLevel:
    urlLevel && SURFER_LEVELS[urlLevel]
      ? urlLevel
      : localStorage.getItem(LEVEL_KEY) || 'intermediaire',
  isRealtime: !(urlTs > Date.now() + 1800_000),
  sliderHoursOffset:
    urlTs > Date.now() + 1800_000
      ? Math.min(
          168,
          Math.max(0, Math.round((urlTs - Math.ceil(Date.now() / 3600_000) * 3600_000) / 3600_000))
        )
      : 0,
  targetMs: urlTs > Date.now() + 1800_000 ? urlTs : Date.now(),
  selectedSpotId:
    urlSpot && SPOTS.some((s) => s.id === urlSpot) ? urlSpot : 'hossegor-la-graviere',
  mobileInspectorOpen: Boolean(urlSpot),
  mobileShowMap: false,
  selectedCamIdxBySpot: {},
  mountedInspectorCamKey: '',
  wallMountedSignature: '',
  wallEcoMode: isLowBandwidthConnection(),
  showGoufRays: true,
  mapZoomSector: 'all', // 'all' | 'core'
  windUnit: localStorage.getItem(WIND_UNIT_KEY) || 'kmh',
  theme: localStorage.getItem(THEME_KEY) || 'dark',
  favorites: new Set(
    JSON.parse(
      localStorage.getItem(FAVORITES_KEY) ||
        '["hossegor-la-graviere","seignosse-les-bourdaines","capbreton-le-santocha"]'
    )
  ),
  filters: {
    search: '',
    commune: 'all',
    sort: 'score-desc',
    camsOnly: false,
    fallbackOnly: false,
    lowCrowd: false,
    favoritesOnly: false,
  },
  wallLayout: 'auto',
  wallZone: 'all',
  comparatorSpotIds: [
    'hossegor-la-graviere',
    'capbreton-le-prevent',
    'tarnos-metro-la-digue',
  ],
  telemetryBySpot: {},
  isStaleOffline: false,
  spotStates: {},
  upcomingSessions: [],
  buoys: [],
  loading: true,
  error: null,
};

function showToast(msg) {
  const el = document.getElementById('toast-banner');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function getSandbarNote(spotId) {
  try {
    const map = JSON.parse(localStorage.getItem(SANDBAR_NOTES_KEY) || '{}');
    const entry = map[spotId];
    if (entry && Date.now() - entry.updatedAt < 10 * 24 * 3600_000) return entry;
  } catch {
    return null;
  }
  return null;
}

function setSandbarNote(spotId, statusText) {
  try {
    const map = JSON.parse(localStorage.getItem(SANDBAR_NOTES_KEY) || '{}');
    map[spotId] = { text: statusText, updatedAt: Date.now() };
    localStorage.setItem(SANDBAR_NOTES_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
}

function syncUrlDeepLink() {
  try {
    const params = new URLSearchParams();
    params.set('spot', state.selectedSpotId);
    params.set('level', state.surferLevel);
    if (state.mode !== 'radar') params.set('mode', state.mode);
    if (!state.isRealtime) params.set('ts', String(state.targetMs));
    const nextUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, '', nextUrl);
  } catch {
    // Ignore
  }
}

function buildSharePayload(spot) {
  const st = state.spotStates[spot.id];
  const snap = st?.snapshot;
  const ev = st?.evaluation;
  const url = new URL(window.location.href);
  url.searchParams.set('spot', spot.id);
  url.searchParams.set('level', state.surferLevel);
  if (!state.isRealtime) url.searchParams.set('ts', String(state.targetMs));
  else url.searchParams.delete('ts');

  const whenTxt = state.isRealtime
    ? `En direct (${formatParisTime(Date.now())})`
    : formatParisFullDateTime(state.targetMs);
  const text =
    `🏄 Session Surf — ${spot.name}\n` +
    `🕒 ${whenTxt}\n` +
    `🌊 ${snap ? `${snap.spotWaveHeightM.toFixed(1)}m @ ${snap.primaryPeriodS}s (${snap.spotEnergyKj} kJ)` : '--'} · ${ev?.wind?.shortLabel || ''} ${snap ? formatWindSpeed(snap.windSpeedKmh) : ''}\n` +
    `🌙 Marée ${snap?.tide ? `${snap.tide.heightZH.toFixed(2)}m (Coef ${snap.tide.coef})` : '--'} · Note ${ev ? ev.score10.toFixed(1) : '--'}/10 (${SURFER_LEVELS[state.surferLevel].label})\n` +
    `👉 ${url.toString()}`;

  return { url: url.toString(), text };
}

async function shareSpotSession(spot, viaWhatsApp = false) {
  const { url, text } = buildSharePayload(spot);
  if (viaWhatsApp) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    return;
  }
  if (navigator.share) {
    try {
      await navigator.share({ title: `Surf — ${spot.shortName}`, text, url });
      return;
    } catch {
      // L'utilisateur a annulé ou API indisponible -> copie presse-papiers
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast('Brief de session & lien copiés dans le presse-papiers !');
  } catch {
    showToast('Lien mis à jour dans la barre d’adresse.');
  }
}

function formatWindSpeed(kmh) {
  if (kmh == null) return '--';
  if (state.windUnit === 'kn') {
    return `${Math.round(kmh * 0.539957)} nds`;
  }
  return `${Math.round(kmh)} km/h`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? 'Clair' : 'Sombre';
  refreshActiveCanvases();
}

function recomputeAllSpotStates() {
  const targetMs = state.isRealtime
    ? Date.now()
    : Math.ceil(Date.now() / 3600_000) * 3600_000 + state.sliderHoursOffset * 3600_000;
  state.targetMs = targetMs;

  const nextStates = {};
  for (const spot of SPOTS) {
    const tel = state.telemetryBySpot[spot.id];
    if (!tel) continue;
    const snapshot = getSpotSnapshotAt(spot, tel, targetMs, state.isRealtime);
    const evaluation = evaluateSpotConditions(spot, snapshot, state.surferLevel);
    nextStates[spot.id] = { snapshot, evaluation };
  }
  state.spotStates = nextStates;

  if (Object.keys(state.telemetryBySpot).length) {
    state.upcomingSessions = findBestUpcomingSessions(
      SPOTS,
      state.telemetryBySpot,
      getSpotSnapshotAt,
      Date.now(),
      state.surferLevel
    );
  }
}

function updateTopbarTelemetry() {
  const clockEl = document.getElementById('pulse-clock');
  if (clockEl) clockEl.textContent = formatParisTime(Date.now());

  const offlineBadge = document.getElementById('offline-cache-badge');
  if (offlineBadge) {
    offlineBadge.classList.toggle('hidden', !state.isStaleOffline && navigator.onLine !== false);
  }

  const ref =
    state.spotStates['capbreton-le-santocha'] ||
    state.spotStates['hossegor-la-graviere'] ||
    Object.values(state.spotStates)[0];

  const tideEl = document.getElementById('pulse-tide');
  if (tideEl && ref?.snapshot?.tide) {
    const t = ref.snapshot.tide;
    tideEl.textContent = `${t.heightZH.toFixed(2)}m ${t.isRising ? '↗' : '↘'} · C.${t.coef}`;
  }

  const tempsEl = document.getElementById('pulse-temps');
  if (tempsEl && ref?.snapshot) {
    tempsEl.textContent = `${ref.snapshot.waterTempC}° / ${ref.snapshot.airTempC}°C`;
  }

  const buoyEl = document.getElementById('pulse-buoy');
  if (buoyEl) {
    const liveBuoy =
      state.buoys.find((b) => b.key === 'bilbao-vizcaya' && b.latest) ||
      state.buoys.find((b) => b.latest);
    if (liveBuoy?.latest) {
      buoyEl.textContent = `${liveBuoy.latest.hm0.toFixed(1)}m @ ${(liveBuoy.latest.tp || 0).toFixed(0)}s`;
    } else if (ref?.snapshot) {
      buoyEl.textContent = `${ref.snapshot.offshoreWaveHeightM.toFixed(1)}m @ ${ref.snapshot.primaryPeriodS}s`;
    }
  }

  const countCamsEl = document.getElementById('count-cams');
  if (countCamsEl) countCamsEl.textContent = String(getAllCoastalWebcams(SPOTS).length);

  // Compteur d'alertes créneaux >= 7.2/10 sur les spots Favoris
  const favAlertsEl = document.getElementById('count-fav-alerts');
  if (favAlertsEl) {
    const favHits = state.upcomingSessions.filter(
      (w) => state.favorites.has(w.spot.id) && w.peakScore >= 7.0
    ).length;
    favAlertsEl.textContent = favHits > 0 ? `★ ${favHits}` : '48h';
  }

  const liveBtn = document.getElementById('btn-live-now');
  const readoutEl = document.getElementById('time-readout-label');
  if (liveBtn) liveBtn.classList.toggle('is-live', state.isRealtime);
  if (readoutEl) {
    readoutEl.textContent = state.isRealtime
      ? `Direct (${formatParisTime(Date.now())})`
      : formatParisFullDateTime(state.targetMs);
  }
}

function renderCoachAndPodium() {
  const mount = document.getElementById('coach-briefing-mount');
  if (!mount) return;

  const brief = buildLocalCoachBriefing({
    spots: SPOTS,
    spotStates: state.spotStates,
    telemetryBySpot: state.telemetryBySpot,
    surferLevel: state.surferLevel,
    targetMs: state.targetMs,
    isRealtime: state.isRealtime,
    upcomingBestSessions: state.upcomingSessions,
  });

  if (!brief) {
    mount.innerHTML = `<div class="coach-subline">Synchronisation du Coach Surf Local et des 19 spots...</div>`;
    return;
  }

  // Top 3 Podium actuel selon le niveau choisi
  const top3 = [...SPOTS]
    .filter((s) => state.spotStates[s.id]?.evaluation)
    .sort(
      (a, b) =>
        (state.spotStates[b.id].evaluation.score10 ?? 0) -
        (state.spotStates[a.id].evaluation.score10 ?? 0)
    )
    .slice(0, 3);

  const alertHtml = brief.alertBadge
    ? `<span class="spot-tag tone-${brief.alertBadge.tone}">${escapeHtml(brief.alertBadge.text)}</span>`
    : '';

  mount.innerHTML = `
    <div class="coach-text-col">
      <div class="coach-kicker">
        <span>● Agent Coach Local · Profil ${escapeHtml(brief.levelInfo.label)}</span>
        ${alertHtml}
      </div>
      <div class="coach-headline">${escapeHtml(brief.headline)}</div>
      <p class="coach-subline">${escapeHtml(brief.subline)}</p>
    </div>

    <div class="podium-strip" role="list" aria-label="Podium Top 3 des spots actuels">
      ${top3
        .map((s, idx) => {
          const st = state.spotStates[s.id];
          return `
            <button type="button" class="podium-chip" data-podium-spot="${s.id}" role="listitem">
              <span class="mono tone-${st.evaluation.verdictTone}" style="padding:0.2rem 0.42rem;border-radius:4px;font-weight:700;font-size:0.8rem;">
                #${idx + 1} · ${st.evaluation.score10.toFixed(1)}
              </span>
              <div>
                <div style="font-size:0.81rem;font-weight:650;color:var(--text-primary);">${escapeHtml(s.shortName)}</div>
                <div class="mono" style="font-size:0.69rem;color:var(--text-muted);">
                  ${st.snapshot.spotWaveHeightM.toFixed(1)}m · ${escapeHtml(st.evaluation.wind.shortLabel)}
                </div>
              </div>
            </button>
          `;
        })
        .join('')}
    </div>
  `;

  mount.querySelectorAll('[data-podium-spot]').forEach((btn) => {
    btn.addEventListener('click', () => selectSpot(btn.getAttribute('data-podium-spot'), true));
  });
}

function getFilteredSpots() {
  const q = state.filters.search.trim().toLowerCase();
  const filtered = SPOTS.filter((spot) => {
    const st = state.spotStates[spot.id];
    if (q) {
      const hay = [
        spot.name,
        spot.shortName,
        spot.commune,
        ...(spot.aliases || []),
        spot.waveProfile?.waveType || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.filters.commune !== 'all' && spot.commune !== state.filters.commune) {
      return false;
    }
    if (state.filters.camsOnly && (!spot.webcams || spot.webcams.length === 0)) {
      return false;
    }
    if (state.filters.fallbackOnly) {
      const isGoufShadow = (spot.goufInfluence?.swellMultiplier ?? 1) <= 0.75;
      const hasWindShelter =
        spot.orientationAndWind?.windProtection?.isProtectedNorth ||
        spot.orientationAndWind?.windProtection?.isProtectedSouth;
      if (!isGoufShadow && !hasWindShelter) return false;
    }
    if (state.filters.lowCrowd) {
      const crowdScore = st?.evaluation?.crowd?.score10 ?? 5;
      if (crowdScore > 5.2) return false;
    }
    if (state.filters.favoritesOnly && !state.favorites.has(spot.id)) {
      return false;
    }
    return true;
  });

  const sortMode = state.filters.sort;
  filtered.sort((a, b) => {
    const sa = state.spotStates[a.id];
    const sb = state.spotStates[b.id];
    if (sortMode === 'score-desc') {
      return (sb?.evaluation?.score10 ?? 0) - (sa?.evaluation?.score10 ?? 0);
    }
    if (sortMode === 'crowd-asc') {
      return (sa?.evaluation?.crowd?.score10 ?? 99) - (sb?.evaluation?.crowd?.score10 ?? 99);
    }
    if (sortMode === 'wave-desc') {
      return (sb?.snapshot?.spotWaveHeightM ?? 0) - (sa?.snapshot?.spotWaveHeightM ?? 0);
    }
    return a.northToSouthRank - b.northToSouthRank;
  });

  return filtered;
}

function renderSpotsList() {
  const listMount = document.getElementById('spots-list-mount');
  const countEl = document.getElementById('count-spots');
  if (!listMount) return;

  if (state.loading && !Object.keys(state.spotStates).length) {
    listMount.innerHTML = `<div class="panel-surface" style="padding:2rem;text-align:center;color:var(--text-secondary);">Chargement en direct des modèles houle CMEMS, vent AROME 1.5 km et marées SHOM sur les 19 spots...</div>`;
    return;
  }

  const spots = getFilteredSpots();
  if (countEl) countEl.textContent = String(spots.length);

  if (!spots.length) {
    listMount.innerHTML = `
      <div class="panel-surface" style="padding:1.8rem;text-align:center;">
        <p style="margin:0 0 0.7rem;color:var(--text-secondary);">Aucun spot ne correspond aux filtres actifs.</p>
        <button type="button" class="btn-ghost" id="btn-reset-filters">Réinitialiser les filtres</button>
      </div>
    `;
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      state.filters = {
        search: '',
        commune: 'all',
        sort: 'score-desc',
        camsOnly: false,
        fallbackOnly: false,
        lowCrowd: false,
        favoritesOnly: false,
      };
      document.getElementById('search-spots').value = '';
      document.getElementById('filter-commune').value = 'all';
      document.querySelectorAll('.filter-toolbar .btn-chip').forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      renderAll({ preserveStreams: true });
    });
    return;
  }

  listMount.innerHTML = spots
    .map((spot) => {
      const st = state.spotStates[spot.id];
      const snap = st?.snapshot;
      const ev = st?.evaluation;
      const isSelected = spot.id === state.selectedSpotId;
      const isFav = state.favorites.has(spot.id);
      const camCount = spot.webcams?.length || 0;
      const goufMult = spot.goufInfluence?.swellMultiplier ?? 1;

      const goufTag =
        goufMult <= 0.7
          ? `<span class="spot-tag tag-gouf">Repli ×${goufMult}</span>`
          : goufMult >= 1.15
            ? `<span class="spot-tag tag-gouf">Gouf ×${goufMult}</span>`
            : '';

      const camTag =
        camCount > 0
          ? `<span class="spot-tag tag-cam">● ${camCount} Cam${camCount > 1 ? 's' : ''}</span>`
          : '';

      const safetyAlertTag =
        ev?.waterQuality?.status === 'alert'
          ? `<span class="spot-tag tag-alert">⚠ Eau Post-Pluie</span>`
          : ev?.baines?.level >= 4
            ? `<span class="spot-tag tag-alert">Baïnes ${ev.baines.level}/5</span>`
            : '';

      return `
        <article
          class="spot-row-card ${isSelected ? 'is-selected' : ''}"
          data-spot-card="${spot.id}"
          role="listitem"
          tabindex="0"
        >
          <div class="score-medallion tone-${ev?.verdictTone || 'moderate'}">
            <span class="score-num">${ev ? ev.score10.toFixed(1) : '--'}</span>
            <span class="score-max">/10</span>
          </div>

          <div class="spot-row-main">
            <div class="spot-row-top">
              <h3 class="spot-row-title">${escapeHtml(spot.name)}</h3>
              <span class="spot-row-commune">${escapeHtml(spot.commune)}</span>
            </div>

            <div class="spot-row-metrics">
              <span><strong>${snap ? snap.spotWaveHeightM.toFixed(1) + ' m' : '--'}</strong> (${snap?.primaryPeriodS ?? '--'}s ${snap?.waveDirCompass ?? ''})</span>
              <span>·</span>
              <span>${ev?.wind?.shortLabel || '--'} ${snap ? formatWindSpeed(snap.windSpeedKmh) : ''} (${snap?.windDirCompass || ''})</span>
              <span>·</span>
              <span>${snap ? snap.spotEnergyKj + ' kJ' : ''}</span>
            </div>

            <div style="margin-top:0.38rem;display:flex;gap:0.32rem;flex-wrap:wrap;">
              <span class="spot-tag">${escapeHtml(ev?.verdict || '')}</span>
              ${camTag}
              ${goufTag}
              ${safetyAlertTag}
            </div>
          </div>

          <div class="spot-row-right">
            <button
              type="button"
              class="btn-ghost"
              data-fav-toggle="${spot.id}"
              aria-label="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
              style="padding:0.16rem 0.45rem;min-height:30px;font-size:0.82rem;color:${isFav ? 'var(--accent-amber)' : 'var(--text-muted)'};"
            >
              ${isFav ? '★' : '☆'}
            </button>
            <span class="crowd-pill">
              ${
                ev?.crowd?.level === 'night'
                  ? 'Nuit (0)'
                  : `${escapeHtml(ev?.crowd?.shortLabel || '--')} · ~${ev?.crowd?.surfersCount ?? 0}`
              }
            </span>
            <span class="mono" style="font-size:0.69rem;color:var(--text-muted);">
              ${escapeHtml(ev?.tide?.status === 'optimal' ? 'Marée OK' : snap?.tide ? `${snap.tide.heightZH.toFixed(1)}m` : '')}
            </span>
          </div>
        </article>
      `;
    })
    .join('');

  listMount.querySelectorAll('[data-spot-card]').forEach((card) => {
    const spotId = card.getAttribute('data-spot-card');
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-fav-toggle]')) return;
      selectSpot(spotId, true);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSpot(spotId, true);
      }
    });
  });

  listMount.querySelectorAll('[data-fav-toggle]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-fav-toggle');
      if (state.favorites.has(id)) state.favorites.delete(id);
      else state.favorites.add(id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
      updateTopbarTelemetry();
      renderSpotsList();
    });
  });
}

function renderSpotInspector({ preserveWebcam = false } = {}) {
  const panel = document.getElementById('spot-inspector-panel');
  const headerMount = document.getElementById('inspector-header-mount');
  const webcamSlot = document.getElementById('inspector-webcam-slot');
  const detailsMount = document.getElementById('inspector-details-mount');
  if (!panel || !headerMount || !webcamSlot || !detailsMount) return;

  panel.classList.toggle('is-mobile-open', state.mobileInspectorOpen);

  const spot = SPOTS.find((s) => s.id === state.selectedSpotId) || SPOTS[0];
  const st = state.spotStates[spot.id];
  const snap = st?.snapshot;
  const ev = st?.evaluation;
  const tel = state.telemetryBySpot[spot.id];

  if (!snap || !ev) {
    headerMount.innerHTML = `<div style="padding:1.5rem;color:var(--text-secondary);">Synchronisation océanique pour ${escapeHtml(spot.name)}...</div>`;
    detailsMount.innerHTML = '';
    return;
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${spot.coordinates.parking.lat},${spot.coordinates.parking.lon}`;
  const upcomingTides = (snap.tide?.upcomingExtrema || []).slice(0, 4);
  const sandbarNote = getSandbarNote(spot.id);

  headerMount.innerHTML = `
    <div class="inspector-hero">
      <div class="inspector-kicker">
        <span>#${spot.northToSouthRank} Nord→Sud · ${escapeHtml(spot.commune)}</span>
        <span>Plage ${spot.orientationAndWind.beachAzimuthDeg}° · Offshore ${escapeHtml(spot.orientationAndWind.idealOffshoreWindText)}</span>
      </div>
      <h2 class="inspector-spot-name">${escapeHtml(spot.name)}</h2>

      <div class="inspector-verdict-row">
        <div style="display:flex;align-items:center;gap:0.45rem;flex-wrap:wrap;">
          <span class="spot-tag tone-${ev.verdictTone}" style="font-size:0.8rem;padding:0.22rem 0.6rem;">
            <strong>${ev.score10.toFixed(1)}/10</strong> · ${escapeHtml(ev.verdict)}
          </span>
          <span class="spot-tag">${escapeHtml(SURFER_LEVELS[state.surferLevel].label)}</span>
          ${ev.swell.hasWedgeBonus ? '<span class="spot-tag tag-cam">Pics en A (Houle croisée)</span>' : ''}
        </div>
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <button type="button" class="btn-ghost" id="btn-share-whatsapp" style="padding:0.24rem 0.55rem;min-height:30px;font-size:0.73rem;" title="Envoyer ce créneau sur WhatsApp">
            WhatsApp ↗
          </button>
          <button type="button" class="btn-ghost" id="btn-copy-deeplink" style="padding:0.24rem 0.55rem;min-height:30px;font-size:0.73rem;" title="Copier le lien profond vers ce créneau">
            Copier lien
          </button>
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="mono" style="font-size:0.73rem;">
            📍 GPS ↗
          </a>
        </div>
      </div>
      ${
        ev.swell.levelNote
          ? `<div style="margin-top:0.45rem;font-size:0.76rem;color:var(--accent-amber);">↳ ${escapeHtml(ev.swell.levelNote)}</div>`
          : ''
      }
    </div>
  `;

  // Montage du lecteur Webcam UNIQUEMENT si le spot ou l'angle a changé (100% même nœud DOM pendant tout drag du slider 168h !)
  const activeCamIndex = state.selectedCamIdxBySpot[spot.id] || 0;
  const desiredCamKey = `${spot.id}:${activeCamIndex}`;
  const showNightBadge = state.isRealtime && !snap.isSurfableLight;
  if (!preserveWebcam || state.mountedInspectorCamKey !== desiredCamKey) {
    state.mountedInspectorCamKey = desiredCamKey;
    mountSpotWebcamPlayer(webcamSlot, spot, {
      activeCamIndex,
      isNight: showNightBadge,
      firstLightText: formatParisTime(snap.firstLightMs),
      onCamChange: (idx) => {
        state.selectedCamIdxBySpot[spot.id] = idx;
        state.mountedInspectorCamKey = `${spot.id}:${idx}`;
      },
    });
  } else {
    const nightPill = webcamSlot.querySelector('.webcam-night-pill');
    if (nightPill) nightPill.classList.toggle('hidden', !showNightBadge);
  }

  // Tableau horaire 24h
  const hourlyRows = [];
  if (tel) {
    const baseHour = Math.ceil(state.targetMs / 3600_000) * 3600_000;
    for (let h = 0; h <= 21; h += 3) {
      const rTs = baseHour + h * 3600_000;
      const rSnap = getSpotSnapshotAt(spot, tel, rTs, false);
      if (!rSnap) continue;
      const rEv = evaluateSpotConditions(spot, rSnap, state.surferLevel);
      hourlyRows.push({ rTs, rSnap, rEv });
    }
  }

  detailsMount.innerHTML = `
    <!-- Double Vigie Sécurité Côtière Live : Baïnes & Qualité d'Eau 48h -->
    <div class="safety-vigie-bar">
      <div class="vigie-box">
        <div class="tel-label">Indice Courants de Baïnes</div>
        <div style="margin-top:0.2rem;display:flex;align-items:center;gap:0.45rem;">
          <span class="spot-tag tone-${ev.baines.tone} mono">${escapeHtml(ev.baines.shortLabel)}</span>
          <strong style="font-size:0.8rem;">${escapeHtml(ev.baines.label)}</strong>
        </div>
        <div class="tel-sub">${escapeHtml(ev.baines.explanation)}</div>
      </div>

      <div class="vigie-box">
        <div class="tel-label">Qualité d'Eau &amp; Pluie 48h</div>
        <div style="margin-top:0.2rem;display:flex;align-items:center;gap:0.45rem;">
          <span class="spot-tag tone-${ev.waterQuality.tone} mono">${snap.rain48hMm} mm/48h</span>
          <strong style="font-size:0.8rem;">${escapeHtml(ev.waterQuality.shortLabel)}</strong>
        </div>
        <div class="tel-sub">${escapeHtml(ev.waterQuality.detail)}</div>
      </div>
    </div>

    <!-- Grille Télémétrique 6 Cellules -->
    <div class="telemetry-grid">
      <div class="telemetry-cell">
        <div class="tel-label">Vagues au Pic (Réfractées)</div>
        <div class="tel-main">${snap.spotWaveHeightM.toFixed(2)} m · ${snap.primaryPeriodS}s</div>
        <div class="tel-sub">
          Faces ${snap.spotFaceRangeText} · ${snap.waveDirCompass} (${snap.waveDirDeg}°) · <strong>${snap.spotEnergyKj} kJ</strong>
          ${snap.secondarySwell ? `<br/>Houle II : ${snap.secondarySwell.heightM}m @ ${snap.secondarySwell.periodS}s (${snap.secondarySwell.dirCompass})` : ''}
        </div>
      </div>

      <div class="telemetry-cell">
        <div class="tel-label">Vent AROME HD 1.5 km</div>
        <div class="tel-main">${formatWindSpeed(snap.windSpeedKmh)} ${snap.windDirCompass}</div>
        <div class="tel-sub">
          Raf. ${formatWindSpeed(snap.windGustsKmh)} · <strong>${escapeHtml(ev.wind.label)}</strong>
        </div>
      </div>

      <div class="telemetry-cell">
        <div class="tel-label">Marée SHOM &amp; Coef</div>
        <div class="tel-main">
          ${snap.tide ? `${snap.tide.heightZH.toFixed(2)} m ${snap.tide.isRising ? '↗' : '↘'} · Coef ${snap.tide.coef}` : '--'}
        </div>
        <div class="tel-sub">
          ${escapeHtml(snap.tide?.stageLabel || '')} (${snap.tide ? `${snap.tide.sixthHour}e h · ${snap.tide.twelfthSpeed}/12` : ''})
          <br/><strong>${escapeHtml(ev.tide.label)}</strong>
        </div>
      </div>

      <div class="telemetry-cell">
        <div class="tel-label">Monde à l'eau (Affluence)</div>
        <div class="tel-main">
          ${ev.crowd.level === 'night' ? '0 surfeur (Nuit)' : `~${ev.crowd.surfersCount} au pic · ${ev.crowd.score10}/10`}
        </div>
        <div class="tel-sub">${escapeHtml(ev.crowd.label)}</div>
      </div>

      <div class="telemetry-cell">
        <div class="tel-label">Eau, Air &amp; Courant</div>
        <div class="tel-main">Eau ${snap.waterTempC}°C · Air ${snap.airTempC}°C</div>
        <div class="tel-sub">
          Ressenti ${snap.apparentTempC}°C · ${snap.pressureHpa} hPa · Courant ${snap.currentVelKmh} km/h ${snap.currentDirCompass}
        </div>
      </div>

      <div class="telemetry-cell">
        <div class="tel-label">Lumière &amp; Ciel</div>
        <div class="tel-main">${escapeHtml(snap.weatherLabel)}</div>
        <div class="tel-sub">
          Aube ${formatParisTime(snap.firstLightMs)} · Crépuscule ${formatParisTime(snap.lastLightMs)} · UV ${snap.uvIndex}
        </div>
      </div>
    </div>

    <!-- NOUVEAU v2 : Graphique Interactif 7 Jours (Houle + Score + Ruban Vent) -->
    <div class="inspector-section">
      <div class="section-heading">
        <span>Prévisions 7 Jours (Houle + Note ${escapeHtml(SURFER_LEVELS[state.surferLevel].label)} + Vent)</span>
        <span class="mono" style="font-size:0.68rem;">Cliquer pour projeter</span>
      </div>
      <div style="width:100%;">
        <canvas id="inspector-7d-canvas"></canvas>
      </div>
    </div>

    <!-- Courbe des Marées 24h + Fenêtre Optimale du Spot -->
    <div class="inspector-section">
      <div class="section-heading">
        <span>Courbe des Marées 24h &amp; Fenêtre du Banc</span>
        <span class="mono" style="font-size:0.69rem;">Idéal : ${spot.idealTide.optimalTideHeightM.min}–${spot.idealTide.optimalTideHeightM.max} m</span>
      </div>
      <div style="width:100%;">
        <canvas id="inspector-tide-canvas"></canvas>
      </div>
      <div class="extrema-pills">
        ${upcomingTides
          .map(
            (ext) => `
            <div class="extremum-item">
              <div style="color:var(--text-muted);font-size:0.65rem;">${ext.type} ${ext.coef ? `· C.${ext.coef}` : ''}</div>
              <div style="font-weight:700;margin-top:1px;">${ext.timeLabel}</div>
              <div style="color:var(--accent-sea);font-size:0.68rem;">${ext.heightZH.toFixed(2)} m</div>
            </div>
          `
          )
          .join('')}
      </div>
    </div>

    <!-- Signalement Monde à l'eau + État du Banc de Sable -->
    <div class="inspector-section">
      <div class="section-heading">
        <span>Terrain : Monde au pic &amp; État du Banc de Sable</span>
        <span class="mono" style="font-size:0.68rem;">${sandbarNote ? `Banc noté : ${escapeHtml(sandbarNote.text)}` : 'Aucun retour récent'}</span>
      </div>
      <div class="crowd-vote-strip">
        <button type="button" class="btn-ghost" data-crowd-vote="2.0" style="padding:0.24rem 0.52rem;font-size:0.73rem;">Quasi vide</button>
        <button type="button" class="btn-ghost" data-crowd-vote="4.5" style="padding:0.24rem 0.52rem;font-size:0.73rem;">Rotation sympa</button>
        <button type="button" class="btn-ghost" data-crowd-vote="7.2" style="padding:0.24rem 0.52rem;font-size:0.73rem;">Chargé</button>
        <button type="button" class="btn-ghost" data-crowd-vote="9.4" style="padding:0.24rem 0.52rem;font-size:0.73rem;">Blindé</button>
      </div>
      <div class="crowd-vote-strip" style="margin-top:0.45rem;">
        <button type="button" class="btn-ghost" data-sandbar-note="Pics triangulaires calés" style="padding:0.22rem 0.5rem;font-size:0.72rem;">▲ Banc calé en A</button>
        <button type="button" class="btn-ghost" data-sandbar-note="Banc standard mobile" style="padding:0.22rem 0.5rem;font-size:0.72rem;">≈ Banc standard</button>
        <button type="button" class="btn-ghost" data-sandbar-note="Banc rectiligne fermant" style="padding:0.22rem 0.5rem;font-size:0.72rem;">▬ Tendance fermante</button>
      </div>
    </div>

    <!-- Évolution 24h (accessible clavier + clic) -->
    <div class="inspector-section">
      <div class="section-heading">
        <span>Évolution Détaillée 24h</span>
        <span class="mono" style="font-size:0.69rem;">Pas 3h</span>
      </div>
      <table class="hourly-strip-table">
        <thead>
          <tr>
            <th>Heure</th>
            <th>Vague</th>
            <th>Énergie</th>
            <th>Vent</th>
            <th>Marée</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          ${hourlyRows
            .map(
              ({ rTs, rSnap, rEv }) => `
              <tr data-jump-ts="${rTs}" tabindex="0" role="button" aria-label="Simuler ${formatParisTime(rTs)}, note ${rEv.score10}">
                <td>${formatParisTime(rTs)}</td>
                <td>${rSnap.spotWaveHeightM.toFixed(1)}m · ${rSnap.primaryPeriodS}s</td>
                <td>${rSnap.spotEnergyKj} kJ</td>
                <td>${formatWindSpeed(rSnap.windSpeedKmh)} ${rSnap.windDirCompass} (${rEv.wind.shortLabel})</td>
                <td>${rSnap.tide ? `${rSnap.tide.heightZH.toFixed(1)}m ${rSnap.tide.isRising ? '↗' : '↘'}` : '--'}</td>
                <td class="tone-${rEv.verdictTone}" style="font-weight:700;border-radius:4px;text-align:center;">${rEv.score10.toFixed(1)}</td>
              </tr>
            `
            )
            .join('')}
        </tbody>
      </table>
    </div>

    <!-- Équipement Recommandé -->
    <div class="inspector-section">
      <div class="section-heading"><span>Quiver &amp; Néoprène (${escapeHtml(SURFER_LEVELS[state.surferLevel].label)})</span></div>
      <div class="gear-list">
        <div class="gear-row"><span>Combinaison</span><strong class="mono">${escapeHtml(ev.gear.wetsuit)}</strong></div>
        <div class="gear-row"><span>Accessoires</span><span>${escapeHtml(ev.gear.accessories)}</span></div>
        <div class="gear-row"><span>Wax</span><span class="mono">${escapeHtml(ev.gear.wax)}</span></div>
        <div class="gear-row"><span>Planche idéale</span><span>${escapeHtml(ev.gear.board)}</span></div>
      </div>
    </div>

    <!-- Connaissance Locale, Gouf & Dangers -->
    <div class="inspector-section">
      <div class="section-heading"><span>Expertise Locale du Banc &amp; Dangers</span></div>
      <div class="local-guide-list">
        <div><strong>Type :</strong> ${escapeHtml(spot.waveProfile.waveType)}</div>
        <div><strong>Effet Gouf de Capbreton :</strong> ${escapeHtml(spot.goufInfluence.explanation)}</div>
        <div><strong>Marée &amp; Gros Coefs (&gt;85) :</strong> ${escapeHtml(spot.idealTide.highCoeffImpactGt85)}</div>
        <div><strong>Abri au vent :</strong> ${escapeHtml(spot.orientationAndWind.windProtection.details)}</div>
        <div><strong>Parking &amp; Accès :</strong> ${escapeHtml(spot.practicalInfo.parking)}</div>
        <div>
          <strong>Points de vigilance :</strong>
          <ul class="hazard-list">
            ${(spot.waveProfile.localHazards || []).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
  `;

  drawForecast7dChart(document.getElementById('inspector-7d-canvas'), spot, tel, {
    surferLevel: state.surferLevel,
    targetMs: state.targetMs,
    onSelectTimestamp: (ts) => jumpToTimestamp(ts),
  });
  drawTideChart24h(document.getElementById('inspector-tide-canvas'), spot, tel, state.targetMs);

  document.getElementById('btn-share-whatsapp')?.addEventListener('click', () => shareSpotSession(spot, true));
  document.getElementById('btn-copy-deeplink')?.addEventListener('click', () => shareSpotSession(spot, false));

  detailsMount.querySelectorAll('[data-crowd-vote]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-crowd-vote'));
      saveLocalCrowdVote(spot.id, val, btn.textContent.trim());
      showToast('Affluence mise à jour pour ce spot !');
      recomputeAllSpotStates();
      renderSpotsList();
      renderSpotInspector({ preserveWebcam: true });
    });
  });

  detailsMount.querySelectorAll('[data-sandbar-note]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setSandbarNote(spot.id, btn.getAttribute('data-sandbar-note'));
      showToast('État du banc de sable enregistré !');
      renderSpotInspector({ preserveWebcam: true });
    });
  });

  detailsMount.querySelectorAll('[data-jump-ts]').forEach((row) => {
    const trigger = () => jumpToTimestamp(Number(row.getAttribute('data-jump-ts')));
    row.addEventListener('click', trigger);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trigger();
      }
    });
  });
}

function renderWebcamWall({ telemetryOnly = false } = {}) {
  const wallMount = document.getElementById('webcam-wall-mount');
  if (!wallMount) return;

  wallMount.className = 'webcam-wall-grid';
  if (state.wallLayout === 'grid-2x2') wallMount.classList.add('grid-2x2');
  if (state.wallLayout === 'grid-3x3') wallMount.classList.add('grid-3x3');

  const allEntries = getAllCoastalWebcams(SPOTS).filter(({ spot }) => {
    if (state.wallZone === 'all') return true;
    const rank = spot.northToSouthRank;
    if (state.wallZone === 'north') return rank <= 4;
    if (state.wallZone === 'seignosse') return rank >= 5 && rank <= 8;
    if (state.wallZone === 'hossegor') return rank >= 9 && rank <= 12;
    if (state.wallZone === 'capbreton') return rank >= 13 && rank <= 16;
    if (state.wallZone === 'south') return rank >= 17;
    return true;
  });

  const signature = `${state.wallZone}:${state.wallEcoMode}:${allEntries.length}`;

  // Si on glisse simplement le slider 168h sur le Mur, on ne détruit AUCUN flux vidéo : on met à jour les textes !
  if (telemetryOnly && state.wallMountedSignature === signature && wallMount.children.length === allEntries.length) {
    allEntries.forEach(({ spot }, i) => {
      const st = state.spotStates[spot.id];
      const snap = st?.snapshot;
      const ev = st?.evaluation;
      const subEl = wallMount.querySelector(`[data-wall-tel="${i}"]`);
      const badgeEl = wallMount.querySelector(`[data-wall-score="${i}"]`);
      if (subEl && snap && ev) {
        subEl.textContent = `${snap.spotWaveHeightM.toFixed(1)}m @ ${snap.primaryPeriodS}s · ${ev.wind.shortLabel} ${formatWindSpeed(snap.windSpeedKmh)} · ${ev.crowd.level === 'night' ? 'Nuit (0)' : `~${ev.crowd.surfersCount} à l'eau`}`;
      }
      if (badgeEl && ev) {
        badgeEl.className = `spot-tag tone-${ev.verdictTone} mono`;
        badgeEl.textContent = `${ev.score10.toFixed(1)}/10`;
      }
    });
    return;
  }

  state.wallMountedSignature = signature;
  destroyWebcamInside(wallMount);

  wallMount.innerHTML = allEntries
    .map(({ spot, cam, camIndex }, i) => {
      const st = state.spotStates[spot.id];
      const snap = st?.snapshot;
      const ev = st?.evaluation;
      return `
        <article class="wall-cam-card">
          <div data-wall-cam-slot="${i}"></div>
          <div class="wall-cam-footer">
            <div style="min-width:0;">
              <div style="font-weight:650;font-size:0.88rem;">
                ${escapeHtml(spot.shortName)} · <span style="color:var(--text-secondary);font-weight:500;">${escapeHtml(cam.angleLabel || cam.title)}</span>
              </div>
              <div class="mono" data-wall-tel="${i}" style="font-size:0.74rem;color:var(--text-secondary);margin-top:0.15rem;">
                ${snap ? `${snap.spotWaveHeightM.toFixed(1)}m @ ${snap.primaryPeriodS}s` : '--'} ·
                ${ev?.wind?.shortLabel || '--'} ${snap ? formatWindSpeed(snap.windSpeedKmh) : ''} ·
                ${ev?.crowd?.level === 'night' ? 'Nuit (0)' : `~${ev?.crowd?.surfersCount ?? 0} à l'eau`}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:0.4rem;flex-shrink:0;">
              <span class="spot-tag tone-${ev?.verdictTone || 'moderate'} mono" data-wall-score="${i}">${ev ? ev.score10.toFixed(1) : '--'}/10</span>
              <button type="button" class="btn-ghost" data-inspect-from-wall="${spot.id}" data-cam-idx="${camIndex}" style="padding:0.26rem 0.55rem;min-height:30px;font-size:0.74rem;white-space:nowrap;">
                Détails →
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  allEntries.forEach(({ spot, camIndex }, i) => {
    const slot = wallMount.querySelector(`[data-wall-cam-slot="${i}"]`);
    const snap = state.spotStates[spot.id]?.snapshot;
    mountSpotWebcamPlayer(slot, spot, {
      activeCamIndex: camIndex,
      compact: true,
      wallMode: true,
      ecoMode: state.wallEcoMode,
      isNight: state.isRealtime && snap ? !snap.isSurfableLight : false,
      firstLightText: snap ? formatParisTime(snap.firstLightMs) : '',
    });
  });

  wallMount.querySelectorAll('[data-inspect-from-wall]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-inspect-from-wall');
      const idx = Number(btn.getAttribute('data-cam-idx') || 0);
      state.selectedCamIdxBySpot[id] = idx;
      state.selectedSpotId = id;
      state.mobileInspectorOpen = true;
      switchMode('radar');
    });
  });
}

function renderSessionsAndComparator() {
  const sessionsMount = document.getElementById('best-sessions-mount');
  const selectorsMount = document.getElementById('comparator-selectors');
  const tableMount = document.getElementById('comparator-table-mount');
  const lvlLbl = document.getElementById('sessions-level-label');
  if (lvlLbl) lvlLbl.textContent = SURFER_LEVELS[state.surferLevel].label;
  if (!sessionsMount || !tableMount) return;

  sessionsMount.innerHTML = state.upcomingSessions
    .map(
      (win, idx) => `
      <article class="session-card" data-session-spot="${win.spot.id}" data-session-ts="${win.startMs}" tabindex="0" role="button">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
          <span class="mono" style="font-size:0.75rem;color:var(--accent-amber);font-weight:600;">
            ${escapeHtml(win.dayLabel)} · ${escapeHtml(win.windowLabel)}
          </span>
          <div style="display:flex;align-items:center;gap:0.35rem;">
            <span class="spot-tag tone-${win.bestEval.verdictTone} mono" style="font-weight:700;">
              ${win.peakScore.toFixed(1)}/10
            </span>
            <button type="button" class="btn-ghost" data-share-win="${idx}" title="Partager ce créneau sur WhatsApp" style="padding:0.15rem 0.42rem;min-height:26px;font-size:0.7rem;">
              WhatsApp ↗
            </button>
          </div>
        </div>
        <h3 style="margin:0.42rem 0 0.22rem;font-size:1.02rem;">
          ${state.favorites.has(win.spot.id) ? '★ ' : ''}${escapeHtml(win.spot.name)}
        </h3>
        <div class="mono" style="font-size:0.78rem;color:var(--text-secondary);">
          ${win.bestSnap.spotWaveHeightM.toFixed(1)} m @ ${win.bestSnap.primaryPeriodS}s (${win.bestSnap.spotEnergyKj} kJ) ·
          ${escapeHtml(win.bestEval.wind.shortLabel)} ${formatWindSpeed(win.bestSnap.windSpeedKmh)}
        </div>
        <div style="margin-top:0.42rem;font-size:0.75rem;color:var(--text-muted);display:flex;justify-content:space-between;">
          <span>Marée : ${win.bestSnap.tide ? `${win.bestSnap.tide.heightZH.toFixed(1)}m (C.${win.bestSnap.tide.coef})` : '--'}</span>
          <span>${escapeHtml(win.bestEval.baines.shortLabel)} · ${escapeHtml(win.bestEval.crowd.shortLabel)}</span>
        </div>
      </article>
    `
    )
    .join('');

  sessionsMount.querySelectorAll('[data-share-win]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const win = state.upcomingSessions[Number(btn.getAttribute('data-share-win'))];
      if (!win) return;
      const url = new URL(window.location.href);
      url.searchParams.set('spot', win.spot.id);
      url.searchParams.set('level', state.surferLevel);
      url.searchParams.set('ts', String(win.startMs));
      const msg =
        `🏄 Créneau Surf repéré — ${win.spot.name}\n` +
        `📅 ${win.dayLabel} · ${win.windowLabel}\n` +
        `🌊 ${win.bestSnap.spotWaveHeightM.toFixed(1)}m @ ${win.bestSnap.primaryPeriodS}s (${win.bestSnap.spotEnergyKj} kJ) · ${win.bestEval.wind.shortLabel} ${formatWindSpeed(win.bestSnap.windSpeedKmh)}\n` +
        `⭐ Note ${win.peakScore.toFixed(1)}/10 (${SURFER_LEVELS[state.surferLevel].label})\n` +
        `👉 ${url.toString()}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
    });
  });

  sessionsMount.querySelectorAll('[data-session-spot]').forEach((card) => {
    const activate = (e) => {
      if (e?.target?.closest?.('[data-share-win]')) return;
      state.selectedSpotId = card.getAttribute('data-session-spot');
      state.mobileInspectorOpen = true;
      jumpToTimestamp(Number(card.getAttribute('data-session-ts')));
      switchMode('radar');
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate(e);
      }
    });
  });

  if (selectorsMount) {
    selectorsMount.innerHTML = [0, 1, 2]
      .map(
        (colIdx) => `
        <select class="select-input" data-comp-select="${colIdx}" aria-label="Spot comparé ${colIdx + 1}">
          ${SPOTS.map(
            (s) =>
              `<option value="${s.id}" ${s.id === state.comparatorSpotIds[colIdx] ? 'selected' : ''}>${escapeHtml(s.shortName)}</option>`
          ).join('')}
        </select>
      `
      )
      .join('');

    selectorsMount.querySelectorAll('[data-comp-select]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const idx = Number(sel.getAttribute('data-comp-select'));
        state.comparatorSpotIds[idx] = sel.value;
        renderSessionsAndComparator();
      });
    });
  }

  const compSpots = state.comparatorSpotIds.map((id) => SPOTS.find((s) => s.id === id) || SPOTS[0]);
  const rows = [
    {
      label: `Note (${SURFER_LEVELS[state.surferLevel].label})`,
      render: (s) => {
        const ev = state.spotStates[s.id]?.evaluation;
        return ev ? `<strong class="mono">${ev.score10.toFixed(1)} / 10</strong> (${escapeHtml(ev.verdict)})` : '--';
      },
    },
    {
      label: 'Vagues au Pic (après Gouf)',
      render: (s) => {
        const sn = state.spotStates[s.id]?.snapshot;
        return sn ? `<span class="mono">${sn.spotWaveHeightM.toFixed(2)} m @ ${sn.primaryPeriodS}s · ${sn.spotEnergyKj} kJ</span>` : '--';
      },
    },
    {
      label: 'Multiplicateur Gouf',
      render: (s) => `<span class="mono">×${s.goufInfluence.swellMultiplier}</span> — ${escapeHtml(s.goufInfluence.type)}`,
    },
    {
      label: 'Sécurité : Baïnes & Eau',
      render: (s) => {
        const ev = state.spotStates[s.id]?.evaluation;
        return ev ? `${escapeHtml(ev.baines.shortLabel)} (${escapeHtml(ev.baines.label)})<br/>${escapeHtml(ev.waterQuality.label)}` : '--';
      },
    },
    {
      label: 'Orientation & Vent Actuel',
      render: (s) => {
        const st = state.spotStates[s.id];
        return st
          ? `Plage ${s.orientationAndWind.beachAzimuthDeg}° · <strong>${escapeHtml(st.evaluation.wind.label)}</strong> (${formatWindSpeed(st.snapshot.windSpeedKmh)} ${st.snapshot.windDirCompass})`
          : '--';
      },
    },
    {
      label: 'Fenêtre de Marée Idéale',
      render: (s) =>
        `<span class="mono">${s.idealTide.optimalTideHeightM.min}–${s.idealTide.optimalTideHeightM.max} m</span> · ${escapeHtml(s.idealTide.bestPhase)}`,
    },
    {
      label: 'Monde à l’eau estimé',
      render: (s) => {
        const cr = state.spotStates[s.id]?.evaluation?.crowd;
        return cr ? `${escapeHtml(cr.label)} (~${cr.surfersCount} au pic)` : '--';
      },
    },
  ];

  tableMount.innerHTML = `
    <table class="comparator-table">
      <thead>
        <tr>
          <th>Critère Technique</th>
          ${compSpots.map((s) => `<th><strong style="font-size:0.94rem;">${escapeHtml(s.name)}</strong></th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r) => `
            <tr>
              <td>${escapeHtml(r.label)}</td>
              ${compSpots.map((s) => `<td>${r.render(s)}</td>`).join('')}
            </tr>
          `
          )
          .join('')}
      </tbody>
    </table>
  `;
}

function renderBuoysAndGouf() {
  const buoysMount = document.getElementById('buoys-grid-mount');
  const goufMount = document.getElementById('gouf-explainer-mount');
  if (!buoysMount || !goufMount) return;

  buoysMount.innerHTML = state.buoys
    .map((b, idx) => {
      const lt = b.latest;
      const statusBadge =
        b.status === 'live'
          ? `<span class="spot-tag tag-cam">● EN LIGNE (${escapeHtml(lt?.ageLabel || '')})</span>`
          : b.status === 'relay'
            ? `<span class="spot-tag tone-good">● Relais CMEMS Temps Réel</span>`
            : b.status === 'delayed'
              ? `<span class="spot-tag tag-gouf">Cache / Délai GTS</span>`
              : `<span class="spot-tag">Maintenance GTS</span>`;

      return `
        <article class="buoy-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
            <div>
              <h3 style="margin:0;font-size:0.98rem;">${escapeHtml(b.name)}</h3>
              <div style="font-size:0.74rem;color:var(--text-muted);margin-top:0.15rem;">
                ${escapeHtml(b.role)} · ${b.coords.lat.toFixed(2)}°N, ${b.coords.lon.toFixed(2)}°W
              </div>
            </div>
            ${statusBadge}
          </div>

          ${
            lt
              ? `
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;margin:0.85rem 0;">
                <div>
                  <div class="tel-label">Hm0 Signif.</div>
                  <div class="mono" style="font-size:1.18rem;font-weight:700;">${lt.hm0.toFixed(2)} m</div>
                  <div class="mono" style="font-size:0.7rem;color:var(--text-muted);">
                    3h : ${lt.trendDeltaM >= 0 ? '+' : ''}${lt.trendDeltaM} m
                  </div>
                </div>
                <div>
                  <div class="tel-label">Hmax Série</div>
                  <div class="mono" style="font-size:1.18rem;font-weight:700;color:var(--accent-coral);">
                    ${lt.hmax ? lt.hmax.toFixed(2) + ' m' : '--'}
                  </div>
                  <div class="mono" style="font-size:0.7rem;color:var(--text-muted);">
                    ${lt.wavePowerKw ? lt.wavePowerKw + ' kW/m' : ''}
                  </div>
                </div>
                <div>
                  <div class="tel-label">Période Pic</div>
                  <div class="mono" style="font-size:1.18rem;font-weight:700;">
                    ${(lt.tp || lt.tm02 || 0).toFixed(1)} s
                  </div>
                  <div class="mono" style="font-size:0.7rem;color:var(--text-muted);">
                    ${lt.dirCompass} (${lt.peakDir ?? '--'}°)
                  </div>
                </div>
              </div>
              <div style="width:100%;">
                <canvas data-buoy-canvas="${idx}"></canvas>
              </div>
              <div class="mono" style="margin-top:0.4rem;font-size:0.71rem;color:var(--text-muted);display:flex;justify-content:space-between;">
                <span>Eau : ${lt.waterTemp != null ? lt.waterTemp.toFixed(1) + '°C' : '--'}</span>
                <span>${escapeHtml(b.source)}</span>
              </div>
            `
              : `<p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.9rem;">${escapeHtml(b.error || 'Synchronisation en cours...')}</p>`
          }
        </article>
      `;
    })
    .join('');

  state.buoys.forEach((b, idx) => {
    if (b.history24h?.length > 1) {
      const canvas = buoysMount.querySelector(`[data-buoy-canvas="${idx}"]`);
      drawBuoySparkline(canvas, b.history24h);
    }
  });

  goufMount.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:0.5rem;">
      <h3 style="margin:0;font-family:var(--font-serif);font-size:1.5rem;font-weight:400;">
        Mécanique du ${escapeHtml(GOUF_DE_CAPBRETON.name)} (-2 150 m face à l'Estacade)
      </h3>
      <span class="mono" style="font-size:0.75rem;color:var(--accent-amber);">
        ${escapeHtml(GOUF_DE_CAPBRETON.wavePhysics.law)}
      </span>
    </div>
    <p style="margin:0.55rem 0 0;font-size:0.85rem;color:var(--text-secondary);max-width:1080px;">
      ${escapeHtml(GOUF_DE_CAPBRETON.wavePhysics.mechanismSummary)}
    </p>
    <div class="gouf-zones-grid">
      ${GOUF_DE_CAPBRETON.wavePhysics.zones
        .map(
          (z) => `
          <div class="gouf-zone-block">
            <div class="mono" style="font-size:0.74rem;color:var(--accent-sea);font-weight:700;">
              Multiplicateur Houle : ×${z.swellHeightMultiplier.min} à ×${z.swellHeightMultiplier.max}
            </div>
            <h4 style="margin:0.3rem 0 0.42rem;font-size:0.95rem;">${escapeHtml(z.label)}</h4>
            <p style="margin:0;font-size:0.79rem;color:var(--text-secondary);">${escapeHtml(z.effect)}</p>
          </div>
        `
        )
        .join('')}
    </div>
  `;
}

function renderMapPanel() {
  const mapPanel = document.getElementById('coast-map-panel');
  const listMount = document.getElementById('spots-list-mount');
  mapPanel?.classList.toggle('mobile-map-collapsed', !state.mobileShowMap);
  if (window.innerWidth <= 960 && listMount) {
    listMount.classList.toggle('hidden', state.mobileShowMap);
  } else {
    listMount?.classList.remove('hidden');
  }

  renderCoastMap(document.getElementById('coast-map-mount'), {
    spots: SPOTS,
    spotStates: state.spotStates,
    selectedSpotId: state.selectedSpotId,
    showGoufPhysics: state.showGoufRays,
    zoomSector: state.mapZoomSector,
    onSelectSpot: (spotId) => selectSpot(spotId, true),
  });
}

function refreshActiveCanvases() {
  if (state.mode === 'radar') {
    const spot = SPOTS.find((s) => s.id === state.selectedSpotId) || SPOTS[0];
    const tel = state.telemetryBySpot[spot.id];
    if (tel) {
      drawForecast7dChart(document.getElementById('inspector-7d-canvas'), spot, tel, {
        surferLevel: state.surferLevel,
        targetMs: state.targetMs,
        onSelectTimestamp: (ts) => jumpToTimestamp(ts),
      });
      drawTideChart24h(document.getElementById('inspector-tide-canvas'), spot, tel, state.targetMs);
    }
  } else if (state.mode === 'buoys') {
    renderBuoysAndGouf();
  }
}

function selectSpot(spotId, openMobileDrawer = false) {
  state.selectedSpotId = spotId;
  if (openMobileDrawer && window.innerWidth <= 960) {
    state.mobileInspectorOpen = true;
  }
  syncUrlDeepLink();
  renderMapPanel();
  renderSpotsList();
  renderSpotInspector({ preserveWebcam: true });
}

function jumpToTimestamp(tsMs) {
  const baseHour = Math.ceil(Date.now() / 3600_000) * 3600_000;
  const diffH = Math.max(0, Math.min(168, Math.round((tsMs - baseHour) / 3600_000)));
  state.isRealtime = diffH === 0;
  state.sliderHoursOffset = diffH;
  const slider = document.getElementById('time-slider-168h');
  if (slider) slider.value = String(diffH);
  recomputeAllSpotStates();
  syncUrlDeepLink();
  renderAll({ preserveStreams: true });
}

function switchMode(nextMode) {
  if (state.mode === 'wall' && nextMode !== 'wall') {
    state.wallMountedSignature = '';
    destroyWebcamInside(document.getElementById('webcam-wall-mount'));
  }
  state.mode = nextMode;
  syncUrlDeepLink();

  document.querySelectorAll('.mode-tab').forEach((tab) => {
    const active = tab.getAttribute('data-mode') === nextMode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  document.getElementById('view-radar')?.classList.toggle('hidden', nextMode !== 'radar');
  document.getElementById('view-wall')?.classList.toggle('hidden', nextMode !== 'wall');
  document.getElementById('view-sessions')?.classList.toggle('hidden', nextMode !== 'sessions');
  document.getElementById('view-buoys')?.classList.toggle('hidden', nextMode !== 'buoys');

  renderAll({ preserveStreams: false });
}

function renderAll({ preserveStreams = false } = {}) {
  updateTopbarTelemetry();
  if (state.mode === 'radar') {
    renderCoachAndPodium();
    renderMapPanel();
    renderSpotsList();
    renderSpotInspector({ preserveWebcam: preserveStreams });
  } else if (state.mode === 'wall') {
    renderWebcamWall({ telemetryOnly: preserveStreams });
  } else if (state.mode === 'sessions') {
    renderSessionsAndComparator();
  } else if (state.mode === 'buoys') {
    renderBuoysAndGouf();
  }
}

async function loadLiveTelemetry({ forceRefresh = false } = {}) {
  state.loading = true;
  const refreshBtn = document.getElementById('btn-refresh-live');
  if (refreshBtn) refreshBtn.textContent = '…';

  fetchAllBuoys({ forceRefresh })
    .then((buoys) => {
      state.buoys = buoys;
      updateTopbarTelemetry();
      if (state.mode === 'buoys') renderBuoysAndGouf();
    })
    .catch(() => {});

  try {
    const oceanPayload = await fetchAllSpotsTelemetry(SPOTS, { forceRefresh });
    state.telemetryBySpot = oceanPayload.bySpotId;
    state.isStaleOffline = Boolean(oceanPayload.isStaleCache);
    state.loading = false;
    recomputeAllSpotStates();
    renderAll({ preserveStreams: true });
  } catch (err) {
    state.loading = false;
    state.error = err?.message || 'Erreur réseau';
    renderAll({ preserveStreams: true });
  } finally {
    if (refreshBtn) refreshBtn.textContent = '↻';
  }
}

function bindGlobalEvents() {
  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.getAttribute('data-mode')));
  });

  // Sélecteur de Niveau Surfeur
  const lvlSel = document.getElementById('select-surfer-level');
  if (lvlSel) {
    lvlSel.value = state.surferLevel;
    lvlSel.addEventListener('change', (e) => {
      state.surferLevel = e.target.value;
      localStorage.setItem(LEVEL_KEY, state.surferLevel);
      recomputeAllSpotStates();
      syncUrlDeepLink();
      renderAll({ preserveStreams: true });
      showToast(`Profil recalibré : ${SURFER_LEVELS[state.surferLevel].label}`);
    });
  }

  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  const unitBtn = document.getElementById('btn-wind-unit');
  if (unitBtn) {
    unitBtn.textContent = state.windUnit === 'kn' ? 'nds' : 'km/h';
    unitBtn.addEventListener('click', () => {
      state.windUnit = state.windUnit === 'kmh' ? 'kn' : 'kmh';
      localStorage.setItem(WIND_UNIT_KEY, state.windUnit);
      unitBtn.textContent = state.windUnit === 'kn' ? 'nds' : 'km/h';
      renderAll({ preserveStreams: true });
    });
  }

  document.getElementById('btn-refresh-live')?.addEventListener('click', () => {
    loadLiveTelemetry({ forceRefresh: true });
  });

  document.getElementById('btn-live-now')?.addEventListener('click', () => {
    state.isRealtime = true;
    state.sliderHoursOffset = 0;
    document.getElementById('time-slider-168h').value = '0';
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('is-active'));
    recomputeAllSpotStates();
    syncUrlDeepLink();
    renderAll({ preserveStreams: true });
  });

  const sliderEl = document.getElementById('time-slider-168h');
  if (sliderEl) {
    sliderEl.value = String(state.sliderHoursOffset);
    sliderEl.addEventListener('input', (e) => {
      const val = Number(e.target.value);
      state.sliderHoursOffset = val;
      state.isRealtime = val === 0;
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('is-active'));
      recomputeAllSpotStates();
      renderAll({ preserveStreams: true }); // Zéro destruction des webcams !
    });
    sliderEl.addEventListener('change', () => syncUrlDeepLink());
  }

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const preset = btn.getAttribute('data-preset');
      const tomorrowParts = getParisDateParts(Date.now() + 24 * 3600_000);
      const targetHour =
        preset === 'tomorrow-dawn' ? '08:00' : preset === 'tomorrow-noon' ? '12:00' : '17:00';
      jumpToTimestamp(parseParisLocalISO(`${tomorrowParts.dateKey}T${targetHour}`));
    });
  });

  document.getElementById('search-spots')?.addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    renderSpotsList();
  });

  document.getElementById('filter-commune')?.addEventListener('change', (e) => {
    state.filters.commune = e.target.value;
    renderSpotsList();
  });

  document.getElementById('sort-spots')?.addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderSpotsList();
  });

  const bindToggleChip = (id, key) => {
    const el = document.getElementById(id);
    el?.addEventListener('click', () => {
      state.filters[key] = !state.filters[key];
      el.classList.toggle('is-active', state.filters[key]);
      el.setAttribute('aria-pressed', String(state.filters[key]));
      renderSpotsList();
    });
  };
  bindToggleChip('filter-cams-only', 'camsOnly');
  bindToggleChip('filter-fallback-only', 'fallbackOnly');
  bindToggleChip('filter-low-crowd', 'lowCrowd');
  bindToggleChip('filter-favorites-only', 'favoritesOnly');

  // Contrôles Carte (Zoom Secteur Hossegor/Capbreton & Rayons Gouf)
  const zoomBtn = document.getElementById('btn-map-zoom-sector');
  zoomBtn?.addEventListener('click', () => {
    state.mapZoomSector = state.mapZoomSector === 'all' ? 'core' : 'all';
    zoomBtn.textContent = state.mapZoomSector === 'core' ? 'Côte 40 km' : 'Zoom Hossegor';
    renderMapPanel();
  });

  const goufBtn = document.getElementById('btn-toggle-gouf-rays');
  goufBtn?.addEventListener('click', () => {
    state.showGoufRays = !state.showGoufRays;
    goufBtn.textContent = `Gouf : ${state.showGoufRays ? 'ON' : 'OFF'}`;
    renderMapPanel();
  });

  // Contrôles Mobile Liste / Carte & Tiroir Inspecteur & Bottom Nav
  const mobListBtn = document.getElementById('btn-mob-show-list');
  const mobMapBtn = document.getElementById('btn-mob-show-map');
  const setMobMapState = (showMap) => {
    state.mobileShowMap = showMap;
    mobListBtn?.classList.toggle('is-active', !showMap);
    mobMapBtn?.classList.toggle('is-active', showMap);
    renderMapPanel();
  };
  mobListBtn?.addEventListener('click', () => setMobMapState(false));
  mobMapBtn?.addEventListener('click', () => setMobMapState(true));

  document.getElementById('btn-close-mobile-inspector')?.addEventListener('click', () => {
    state.mobileInspectorOpen = false;
    document.getElementById('spot-inspector-panel')?.classList.remove('is-mobile-open');
  });

  document.getElementById('btn-share-spot-mobile')?.addEventListener('click', () => {
    const spot = SPOTS.find((s) => s.id === state.selectedSpotId) || SPOTS[0];
    shareSpotSession(spot, false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.mobileInspectorOpen) {
      state.mobileInspectorOpen = false;
      document.getElementById('spot-inspector-panel')?.classList.remove('is-mobile-open');
    }
  });

  document.querySelectorAll('[data-mob-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-mob-nav');
      state.mobileInspectorOpen = false;
      document.getElementById('spot-inspector-panel')?.classList.remove('is-mobile-open');
      document.querySelectorAll('[data-mob-nav]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      if (target === 'radar-list') {
        setMobMapState(false);
        switchMode('radar');
      } else if (target === 'radar-map') {
        setMobMapState(true);
        switchMode('radar');
      } else {
        switchMode(target);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // Contrôles Mur Vidéo (Éco-4G + Grille + Zone)
  const ecoBtn = document.getElementById('btn-wall-eco-toggle');
  if (ecoBtn) {
    ecoBtn.classList.toggle('is-active', state.wallEcoMode);
    ecoBtn.setAttribute('aria-pressed', String(state.wallEcoMode));
    ecoBtn.textContent = `Mode Éco-4G : ${state.wallEcoMode ? 'ON' : 'OFF'}`;
    ecoBtn.addEventListener('click', () => {
      state.wallEcoMode = !state.wallEcoMode;
      ecoBtn.classList.toggle('is-active', state.wallEcoMode);
      ecoBtn.setAttribute('aria-pressed', String(state.wallEcoMode));
      ecoBtn.textContent = `Mode Éco-4G : ${state.wallEcoMode ? 'ON' : 'OFF'}`;
      renderWebcamWall({ telemetryOnly: false });
    });
  }

  document.querySelectorAll('[data-wall-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-wall-layout]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.wallLayout = btn.getAttribute('data-wall-layout');
      renderWebcamWall({ telemetryOnly: true });
    });
  });

  document.getElementById('wall-zone-filter')?.addEventListener('change', (e) => {
    state.wallZone = e.target.value;
    renderWebcamWall({ telemetryOnly: false });
  });

  window.addEventListener('resize', () => {
    renderMapPanel();
    refreshActiveCanvases();
  });

  window.addEventListener('online', () => updateTopbarTelemetry());
  window.addEventListener('offline', () => updateTopbarTelemetry());
}

// Enregistrement du Service Worker PWA ("Mode Pinède")
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

applyTheme(state.theme);
bindGlobalEvents();
switchMode(state.mode);
loadLiveTelemetry();
setInterval(() => {
  if (state.isRealtime && !state.loading) {
    updateTopbarTelemetry();
  }
}, 20_000);
