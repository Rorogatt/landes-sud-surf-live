/**
 * Contrôleur Principal — Sud Landes Surf Live (Moliets -> Tarnos, 19 Spots)
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
import { renderCoastMap } from './components/coastMap.js';
import { mountSpotWebcamPlayer, destroyWebcamInside } from './components/webcamPlayer.js';
import { drawTideChart24h, drawBuoySparkline } from './components/charts.js';

// Fusion des 19 spots avec leurs webcams vérifiées
const SPOTS = LANDES_SUD_SPOTS.map((spot) => ({
  ...spot,
  webcams: WEBCAMS_BY_SPOT_ID[spot.id] || [],
}));

const FAVORITES_KEY = 'landes_surf_favorites_v1';
const THEME_KEY = 'landes_surf_theme_v1';
const WIND_UNIT_KEY = 'landes_surf_wind_unit_v1';

const state = {
  mode: 'radar', // 'radar' | 'wall' | 'sessions' | 'buoys'
  isRealtime: true,
  sliderHoursOffset: 0,
  targetMs: Date.now(),
  selectedSpotId: 'hossegor-la-graviere',
  selectedCamIdxBySpot: {},
  showGoufRays: true,
  windUnit: localStorage.getItem(WIND_UNIT_KEY) || 'kmh', // 'kmh' | 'kn'
  theme: localStorage.getItem(THEME_KEY) || 'dark',
  favorites: new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || '["hossegor-la-graviere","seignosse-les-bourdaines","capbreton-le-santocha"]')),
  filters: {
    search: '',
    commune: 'all',
    sort: 'north-south',
    camsOnly: false,
    fallbackOnly: false,
    lowCrowd: false,
    favoritesOnly: false,
  },
  wallLayout: 'auto',
  wallZone: 'all',
  comparatorSpotIds: [
    'hossegor-la-graviere',
    'seignosse-les-bourdaines',
    'capbreton-le-santocha',
  ],
  telemetryBySpot: {},
  spotStates: {},
  buoys: [],
  loading: true,
  error: null,
};

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
  if (btn) btn.textContent = theme === 'dark' ? 'Mode Clair' : 'Mode Sombre';
  // Redessine les canvas actifs
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
    const evaluation = evaluateSpotConditions(spot, snapshot);
    nextStates[spot.id] = { snapshot, evaluation };
  }
  state.spotStates = nextStates;
}

function updateTopbarTelemetry() {
  const clockEl = document.getElementById('pulse-clock');
  if (clockEl) {
    clockEl.textContent = formatParisTime(Date.now());
  }

  const ref =
    state.spotStates['capbreton-le-santocha'] ||
    state.spotStates['hossegor-la-graviere'] ||
    Object.values(state.spotStates)[0];

  const tideEl = document.getElementById('pulse-tide');
  if (tideEl && ref?.snapshot?.tide) {
    const t = ref.snapshot.tide;
    const arrow = t.isRising ? '↗' : '↘';
    tideEl.textContent = `${t.heightZH.toFixed(2)} m ${arrow} · Coef ${t.coef}`;
  }

  const tempsEl = document.getElementById('pulse-temps');
  if (tempsEl && ref?.snapshot) {
    tempsEl.textContent = `Eau ${ref.snapshot.waterTempC}°C · Air ${ref.snapshot.airTempC}°C`;
  }

  const buoyEl = document.getElementById('pulse-buoy');
  if (buoyEl) {
    const liveBuoy =
      state.buoys.find((b) => b.key === 'bilbao-vizcaya' && b.latest) ||
      state.buoys.find((b) => b.latest);
    if (liveBuoy?.latest) {
      buoyEl.textContent = `${liveBuoy.latest.hm0.toFixed(1)} m @ ${(liveBuoy.latest.tp || liveBuoy.latest.tm02 || 0).toFixed(0)}s (${liveBuoy.latest.dirCompass})`;
    } else if (!state.loading) {
      buoyEl.textContent = ref?.snapshot
        ? `${ref.snapshot.offshoreWaveHeightM.toFixed(1)} m @ ${ref.snapshot.primaryPeriodS}s`
        : 'Indisponible';
    }
  }

  const bestEl = document.getElementById('pulse-best-spot');
  if (bestEl) {
    let bestSpot = null;
    let bestScore = -1;
    for (const spot of SPOTS) {
      const sc = state.spotStates[spot.id]?.evaluation?.score10 ?? -1;
      if (sc > bestScore) {
        bestScore = sc;
        bestSpot = spot;
      }
    }
    if (bestSpot && bestScore > 0) {
      bestEl.textContent = `${bestSpot.shortName} (${bestScore.toFixed(1)}/10)`;
    }
  }

  // Compteur total de webcams
  const allCams = getAllCoastalWebcams(SPOTS);
  const countCamsEl = document.getElementById('count-cams');
  if (countCamsEl) countCamsEl.textContent = String(allCams.length);

  // Libellé Scrubber Temporel
  const liveBtn = document.getElementById('btn-live-now');
  const readoutEl = document.getElementById('time-readout-label');
  if (liveBtn) liveBtn.classList.toggle('is-live', state.isRealtime);
  if (readoutEl) {
    readoutEl.textContent = state.isRealtime
      ? `En direct (${formatParisTime(Date.now())})`
      : formatParisFullDateTime(state.targetMs);
  }
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
        sort: 'north-south',
        camsOnly: false,
        fallbackOnly: false,
        lowCrowd: false,
        favoritesOnly: false,
      };
      document.getElementById('search-spots').value = '';
      document.getElementById('filter-commune').value = 'all';
      document.querySelectorAll('.filter-toolbar .btn-chip').forEach((b) => b.classList.remove('is-active'));
      renderAll();
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
          ? `<span class="spot-tag tag-gouf" title="Zone d'amortissement du Gouf de Capbreton">Repli Gouf ×${goufMult}</span>`
          : goufMult >= 1.15
            ? `<span class="spot-tag tag-gouf" title="Amplification bathymétrique du Gouf de Capbreton">Gouf ×${goufMult}</span>`
            : '';

      const camTag =
        camCount > 0
          ? `<span class="spot-tag tag-cam">● ${camCount} Cam${camCount > 1 ? 's' : ''}</span>`
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

            <div style="margin-top:0.42rem;display:flex;gap:0.35rem;flex-wrap:wrap;">
              <span class="spot-tag">${escapeHtml(ev?.verdict || '')}</span>
              ${camTag}
              ${goufTag}
            </div>
          </div>

          <div class="spot-row-right">
            <button
              type="button"
              class="btn-ghost"
              data-fav-toggle="${spot.id}"
              title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}"
              style="padding:0.18rem 0.45rem;font-size:0.82rem;color:${isFav ? 'var(--accent-amber)' : 'var(--text-muted)'};"
            >
              ${isFav ? '★' : '☆'}
            </button>
            <span class="crowd-pill" title="${escapeHtml(ev?.crowd?.label || '')}">
              ${
                ev?.crowd?.level === 'night'
                  ? 'Nuit (0)'
                  : `${escapeHtml(ev?.crowd?.shortLabel || '--')} · ~${ev?.crowd?.surfersCount ?? 0}`
              }
            </span>
            <span class="mono" style="font-size:0.7rem;color:var(--text-muted);">
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
      selectSpot(spotId);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectSpot(spotId);
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
      renderSpotsList();
    });
  });
}

function renderSpotInspector() {
  const mount = document.getElementById('spot-inspector-mount');
  if (!mount) return;

  const spot = SPOTS.find((s) => s.id === state.selectedSpotId) || SPOTS[0];
  const st = state.spotStates[spot.id];
  const snap = st?.snapshot;
  const ev = st?.evaluation;
  const tel = state.telemetryBySpot[spot.id];

  destroyWebcamInside(mount);

  if (!snap || !ev) {
    mount.innerHTML = `<div style="padding:1.8rem;color:var(--text-secondary);">Synchronisation des capteurs océaniques pour ${escapeHtml(spot.name)}...</div>`;
    return;
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${spot.coordinates.parking.lat},${spot.coordinates.parking.lon}`;
  const upcomingTides = (snap.tide?.upcomingExtrema || []).slice(0, 4);

  // Tableau horaire 24h à venir (pas de 3h pour lisibilité immédiate)
  const hourlyRows = [];
  if (tel) {
    const baseHour = Math.ceil(state.targetMs / 3600_000) * 3600_000;
    for (let h = 0; h <= 21; h += 3) {
      const rTs = baseHour + h * 3600_000;
      const rSnap = getSpotSnapshotAt(spot, tel, rTs, false);
      if (!rSnap) continue;
      const rEv = evaluateSpotConditions(spot, rSnap);
      hourlyRows.push({ rTs, rSnap, rEv });
    }
  }

  mount.innerHTML = `
    <div class="inspector-hero">
      <div class="inspector-kicker">
        <span>#${spot.northToSouthRank} Nord→Sud · ${escapeHtml(spot.commune)}</span>
        <span>Azimut Plage ${spot.orientationAndWind.beachAzimuthDeg}° (Offshore ${escapeHtml(spot.orientationAndWind.idealOffshoreWindText)})</span>
      </div>
      <h2 class="inspector-spot-name">${escapeHtml(spot.name)}</h2>

      <div class="inspector-verdict-row">
        <div style="display:flex;align-items:center;gap:0.55rem;flex-wrap:wrap;">
          <span class="spot-tag tone-${ev.verdictTone}" style="font-size:0.8rem;padding:0.24rem 0.62rem;">
            <strong>${ev.score10.toFixed(1)}/10</strong> · ${escapeHtml(ev.verdict)}
          </span>
          <span class="spot-tag">${escapeHtml(spot.waveProfile.skillLevel)}</span>
        </div>
        <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" class="mono" style="font-size:0.74rem;">
          📍 Parking GPS ↗
        </a>
      </div>
    </div>

    <!-- Lecteur Webcam Live Multi-Angles -->
    <div id="inspector-webcam-slot"></div>

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
          ${escapeHtml(snap.tide?.stageLabel || '')} (${snap.tide ? `${snap.tide.sixthHour}e heure · ${snap.tide.twelfthSpeed}/12` : ''})
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
        <div class="tel-label">Lumière &amp; Météo</div>
        <div class="tel-main">${escapeHtml(snap.weatherLabel)}</div>
        <div class="tel-sub">
          First light ${formatParisTime(snap.firstLightMs)} · Last light ${formatParisTime(snap.lastLightMs)} · UV ${snap.uvIndex}
        </div>
      </div>
    </div>

    <!-- Signalement collaboratif du monde au pic -->
    <div class="inspector-section">
      <div class="section-heading">
        <span>Signaler le monde réel au line-up</span>
        <span class="mono" style="font-size:0.7rem;">Créneau calme : ${escapeHtml(spot.crowdFactor.bestUncrowdedWindow)}</span>
      </div>
      <div class="crowd-vote-strip">
        <button type="button" class="btn-ghost" data-crowd-vote="2.0" style="padding:0.26rem 0.55rem;font-size:0.74rem;"> quasi vide</button>
        <button type="button" class="btn-ghost" data-crowd-vote="4.5" style="padding:0.26rem 0.55rem;font-size:0.74rem;">Rotation sympa</button>
        <button type="button" class="btn-ghost" data-crowd-vote="7.2" style="padding:0.26rem 0.55rem;font-size:0.74rem;">Chargé</button>
        <button type="button" class="btn-ghost" data-crowd-vote="9.4" style="padding:0.26rem 0.55rem;font-size:0.74rem;">Blindé</button>
      </div>
    </div>

    <!-- Courbe des Marées 24h + Fenêtre Optimale du Spot -->
    <div class="inspector-section">
      <div class="section-heading">
        <span>Courbe des Marées 24h &amp; Fenêtre du Banc</span>
        <span class="mono" style="font-size:0.7rem;">Idéal : ${spot.idealTide.optimalTideHeightM.min}–${spot.idealTide.optimalTideHeightM.max} m</span>
      </div>
      <div style="width:100%;">
        <canvas id="inspector-tide-canvas"></canvas>
      </div>
      <div class="extrema-pills">
        ${upcomingTides
          .map(
            (ext) => `
            <div class="extremum-item">
              <div style="color:var(--text-muted);font-size:0.66rem;">${ext.type} ${ext.coef ? `· C.${ext.coef}` : ''}</div>
              <div style="font-weight:700;margin-top:1px;">${ext.timeLabel}</div>
              <div style="color:var(--accent-sea);font-size:0.69rem;">${ext.heightZH.toFixed(2)} m</div>
            </div>
          `
          )
          .join('')}
      </div>
    </div>

    <!-- Évolution 24h (cliquable pour projeter la carte) -->
    <div class="inspector-section">
      <div class="section-heading">
        <span>Évolution sur 24h (cliquer pour simuler l'heure)</span>
        <span class="mono" style="font-size:0.7rem;">Pas 3h</span>
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
              <tr data-jump-ts="${rTs}">
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
      <div class="section-heading"><span>Quiver &amp; Néoprène Recommandés maintenant</span></div>
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
        <div><strong>Ambiance :</strong> ${escapeHtml(spot.practicalInfo.waterVibe)}</div>
        <div>
          <strong>Points de vigilance :</strong>
          <ul class="hazard-list">
            ${(spot.waveProfile.localHazards || []).map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
          </ul>
        </div>
      </div>
    </div>
  `;

  // Montage du lecteur webcam
  const webcamSlot = document.getElementById('inspector-webcam-slot');
  const activeCamIndex = state.selectedCamIdxBySpot[spot.id] || 0;
  mountSpotWebcamPlayer(webcamSlot, spot, {
    activeCamIndex,
    onCamChange: (idx) => {
      state.selectedCamIdxBySpot[spot.id] = idx;
    },
  });

  // Tracé Canvas Courbe des Marées 24h
  const tideCanvas = document.getElementById('inspector-tide-canvas');
  drawTideChart24h(tideCanvas, spot, tel, state.targetMs);

  // Vote collaboratif affluence
  mount.querySelectorAll('[data-crowd-vote]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-crowd-vote'));
      saveLocalCrowdVote(spot.id, val, btn.textContent.trim());
      recomputeAllSpotStates();
      renderSpotsList();
      renderSpotInspector();
    });
  });

  // Saut temporel au clic sur une ligne du tableau 24h
  mount.querySelectorAll('[data-jump-ts]').forEach((row) => {
    row.addEventListener('click', () => {
      const ts = Number(row.getAttribute('data-jump-ts'));
      jumpToTimestamp(ts);
    });
  });
}

function renderWebcamWall() {
  const wallMount = document.getElementById('webcam-wall-mount');
  if (!wallMount) return;

  destroyWebcamInside(wallMount);

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

  wallMount.innerHTML = allEntries
    .map(({ spot, cam, camIndex }, i) => {
      const st = state.spotStates[spot.id];
      const snap = st?.snapshot;
      const ev = st?.evaluation;
      return `
        <article class="wall-cam-card">
          <div data-wall-cam-slot="${i}"></div>
          <div class="wall-cam-footer">
            <div>
              <div style="font-weight:650;font-size:0.9rem;">
                ${escapeHtml(spot.shortName)} · <span style="color:var(--text-secondary);font-weight:500;">${escapeHtml(cam.angleLabel || cam.title)}</span>
              </div>
              <div class="mono" style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.15rem;">
                ${snap ? `${snap.spotWaveHeightM.toFixed(1)}m @ ${snap.primaryPeriodS}s` : '--'} ·
                ${ev?.wind?.shortLabel || '--'} ${snap ? formatWindSpeed(snap.windSpeedKmh) : ''} ·
                ${ev?.crowd?.level === 'night' ? 'Nuit (0)' : `~${ev?.crowd?.surfersCount ?? 0} à l'eau`}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:0.45rem;">
              <span class="spot-tag tone-${ev?.verdictTone || 'moderate'} mono">${ev ? ev.score10.toFixed(1) : '--'}/10</span>
              <button type="button" class="btn-ghost" data-inspect-from-wall="${spot.id}" data-cam-idx="${camIndex}" style="padding:0.28rem 0.55rem;font-size:0.75rem;">
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
    mountSpotWebcamPlayer(slot, spot, { activeCamIndex: camIndex, compact: true });
  });

  wallMount.querySelectorAll('[data-inspect-from-wall]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-inspect-from-wall');
      const idx = Number(btn.getAttribute('data-cam-idx') || 0);
      state.selectedCamIdxBySpot[id] = idx;
      state.selectedSpotId = id;
      switchMode('radar');
    });
  });
}

function renderSessionsAndComparator() {
  const sessionsMount = document.getElementById('best-sessions-mount');
  const selectorsMount = document.getElementById('comparator-selectors');
  const tableMount = document.getElementById('comparator-table-mount');
  if (!sessionsMount || !tableMount) return;

  const bestWindows = findBestUpcomingSessions(
    SPOTS,
    state.telemetryBySpot,
    getSpotSnapshotAt,
    Date.now()
  );

  sessionsMount.innerHTML = bestWindows
    .map(
      (win) => `
      <article class="session-card" data-session-spot="${win.spot.id}" data-session-ts="${win.startMs}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;">
          <span class="mono" style="font-size:0.76rem;color:var(--accent-amber);font-weight:600;">
            ${escapeHtml(win.dayLabel)} · ${escapeHtml(win.windowLabel)}
          </span>
          <span class="spot-tag tone-${win.bestEval.verdictTone} mono" style="font-weight:700;">
            Pic ${win.peakScore.toFixed(1)}/10
          </span>
        </div>
        <h3 style="margin:0.45rem 0 0.25rem;font-size:1.05rem;">${escapeHtml(win.spot.name)}</h3>
        <div class="mono" style="font-size:0.79rem;color:var(--text-secondary);">
          ${win.bestSnap.spotWaveHeightM.toFixed(1)} m @ ${win.bestSnap.primaryPeriodS}s (${win.bestSnap.spotEnergyKj} kJ) ·
          ${escapeHtml(win.bestEval.wind.shortLabel)} ${formatWindSpeed(win.bestSnap.windSpeedKmh)}
        </div>
        <div style="margin-top:0.45rem;font-size:0.77rem;color:var(--text-muted);display:flex;justify-content:space-between;">
          <span>Marée : ${win.bestSnap.tide ? `${win.bestSnap.tide.heightZH.toFixed(1)}m (Coef ${win.bestSnap.tide.coef})` : '--'}</span>
          <span>Affluence est. : ${escapeHtml(win.bestEval.crowd.shortLabel)}</span>
        </div>
      </article>
    `
    )
    .join('');

  sessionsMount.querySelectorAll('[data-session-spot]').forEach((card) => {
    card.addEventListener('click', () => {
      const spotId = card.getAttribute('data-session-spot');
      const ts = Number(card.getAttribute('data-session-ts'));
      state.selectedSpotId = spotId;
      jumpToTimestamp(ts);
      switchMode('radar');
    });
  });

  // Sélecteurs des 3 spots du comparateur
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
      label: 'Note Globale Actuelle',
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
    {
      label: 'Niveau & Type de Vague',
      render: (s) => `<strong>${escapeHtml(s.waveProfile.skillLevel)}</strong><br/>${escapeHtml(s.waveProfile.waveType)}`,
    },
  ];

  tableMount.innerHTML = `
    <table class="comparator-table">
      <thead>
        <tr>
          <th>Critère Technique</th>
          ${compSpots.map((s) => `<th><strong style="font-size:0.95rem;">${escapeHtml(s.name)}</strong></th>`).join('')}
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
          : b.status === 'delayed'
            ? `<span class="spot-tag tag-gouf">Délai GTS (${escapeHtml(lt?.ageLabel || '')})</span>`
            : `<span class="spot-tag">Capteur hors-ligne</span>`;

      return `
        <article class="buoy-card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.5rem;">
            <div>
              <h3 style="margin:0;font-size:1rem;">${escapeHtml(b.name)}</h3>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.15rem;">
                ${escapeHtml(b.role)} · ${b.coords.lat.toFixed(2)}°N, ${b.coords.lon.toFixed(2)}°W
              </div>
            </div>
            ${statusBadge}
          </div>

          ${
            lt
              ? `
              <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.6rem;margin:0.9rem 0;">
                <div>
                  <div class="tel-label">Hm0 Signif.</div>
                  <div class="mono" style="font-size:1.2rem;font-weight:700;">${lt.hm0.toFixed(2)} m</div>
                  <div class="mono" style="font-size:0.71rem;color:var(--text-muted);">
                    3h : ${lt.trendDeltaM >= 0 ? '+' : ''}${lt.trendDeltaM} m
                  </div>
                </div>
                <div>
                  <div class="tel-label">Hmax Série</div>
                  <div class="mono" style="font-size:1.2rem;font-weight:700;color:var(--accent-coral);">
                    ${lt.hmax ? lt.hmax.toFixed(2) + ' m' : '--'}
                  </div>
                  <div class="mono" style="font-size:0.71rem;color:var(--text-muted);">
                    ${lt.wavePowerKw ? lt.wavePowerKw + ' kW/m' : ''}
                  </div>
                </div>
                <div>
                  <div class="tel-label">Période Pic</div>
                  <div class="mono" style="font-size:1.2rem;font-weight:700;">
                    ${(lt.tp || lt.tm02 || 0).toFixed(1)} s
                  </div>
                  <div class="mono" style="font-size:0.71rem;color:var(--text-muted);">
                    ${lt.dirCompass} (${lt.peakDir ?? '--'}°)
                  </div>
                </div>
              </div>
              <div style="width:100%;">
                <canvas data-buoy-canvas="${idx}"></canvas>
              </div>
              <div class="mono" style="margin-top:0.4rem;font-size:0.72rem;color:var(--text-muted);display:flex;justify-content:space-between;">
                <span>Eau : ${lt.waterTemp != null ? lt.waterTemp.toFixed(1) + '°C' : '--'}</span>
                <span>Source : ${escapeHtml(b.source)}</span>
              </div>
            `
              : `<p style="font-size:0.8rem;color:var(--text-muted);margin-top:0.9rem;">Mesures temps réel momentanément indisponibles (${escapeHtml(b.error || 'réseau')}).</p>`
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

  // Atlas explicatif du Gouf de Capbreton
  goufMount.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:0.5rem;">
      <h3 style="margin:0;font-family:var(--font-serif);font-size:1.5rem;font-weight:400;">
        Mécanique du ${escapeHtml(GOUF_DE_CAPBRETON.name)} (-2 150 m face à l'Estacade)
      </h3>
      <span class="mono" style="font-size:0.75rem;color:var(--accent-amber);">
        ${escapeHtml(GOUF_DE_CAPBRETON.wavePhysics.law)}
      </span>
    </div>
    <p style="margin:0.55rem 0 0;font-size:0.86rem;color:var(--text-secondary);max-width:1080px;">
      ${escapeHtml(GOUF_DE_CAPBRETON.wavePhysics.mechanismSummary)}
    </p>
    <div class="gouf-zones-grid">
      ${GOUF_DE_CAPBRETON.wavePhysics.zones
        .map(
          (z) => `
          <div class="gouf-zone-block">
            <div class="mono" style="font-size:0.75rem;color:var(--accent-sea);font-weight:700;">
              Multiplicateur Houle : ×${z.swellHeightMultiplier.min} à ×${z.swellHeightMultiplier.max}
            </div>
            <h4 style="margin:0.3rem 0 0.45rem;font-size:0.96rem;">${escapeHtml(z.label)}</h4>
            <p style="margin:0;font-size:0.8rem;color:var(--text-secondary);">${escapeHtml(z.effect)}</p>
          </div>
        `
        )
        .join('')}
    </div>
  `;
}

function renderMapPanel() {
  const mapMount = document.getElementById('coast-map-mount');
  renderCoastMap(mapMount, {
    spots: SPOTS,
    spotStates: state.spotStates,
    selectedSpotId: state.selectedSpotId,
    showGoufPhysics: state.showGoufRays,
    onSelectSpot: (spotId) => selectSpot(spotId),
  });
}

function refreshActiveCanvases() {
  if (state.mode === 'radar') {
    const spot = SPOTS.find((s) => s.id === state.selectedSpotId) || SPOTS[0];
    const tel = state.telemetryBySpot[spot.id];
    const tideCanvas = document.getElementById('inspector-tide-canvas');
    if (tideCanvas && tel) drawTideChart24h(tideCanvas, spot, tel, state.targetMs);
  } else if (state.mode === 'buoys') {
    renderBuoysAndGouf();
  }
}

function selectSpot(spotId) {
  state.selectedSpotId = spotId;
  renderMapPanel();
  renderSpotsList();
  renderSpotInspector();
}

function jumpToTimestamp(tsMs) {
  const baseHour = Math.ceil(Date.now() / 3600_000) * 3600_000;
  const diffH = Math.max(0, Math.min(168, Math.round((tsMs - baseHour) / 3600_000)));
  state.isRealtime = false;
  state.sliderHoursOffset = diffH;
  const slider = document.getElementById('time-slider-168h');
  if (slider) slider.value = String(diffH);
  recomputeAllSpotStates();
  renderAll();
}

function switchMode(nextMode) {
  if (state.mode === 'wall' && nextMode !== 'wall') {
    destroyWebcamInside(document.getElementById('webcam-wall-mount'));
  }
  state.mode = nextMode;

  document.querySelectorAll('.mode-tab').forEach((tab) => {
    const active = tab.getAttribute('data-mode') === nextMode;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  document.getElementById('view-radar')?.classList.toggle('hidden', nextMode !== 'radar');
  document.getElementById('view-wall')?.classList.toggle('hidden', nextMode !== 'wall');
  document.getElementById('view-sessions')?.classList.toggle('hidden', nextMode !== 'sessions');
  document.getElementById('view-buoys')?.classList.toggle('hidden', nextMode !== 'buoys');

  renderAll();
}

function renderAll() {
  updateTopbarTelemetry();
  if (state.mode === 'radar') {
    renderMapPanel();
    renderSpotsList();
    renderSpotInspector();
  } else if (state.mode === 'wall') {
    renderWebcamWall();
  } else if (state.mode === 'sessions') {
    renderSessionsAndComparator();
  } else if (state.mode === 'buoys') {
    renderBuoysAndGouf();
  }
}

async function loadLiveTelemetry({ forceRefresh = false } = {}) {
  state.loading = true;
  const refreshBtn = document.getElementById('btn-refresh-live');
  if (refreshBtn) refreshBtn.textContent = '↻ Sync...';

  // Lance les bouées en parallèle sans bloquer l'affichage immédiat des 19 spots (~600ms)
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
    state.loading = false;
    recomputeAllSpotStates();
    renderAll();
  } catch (err) {
    state.loading = false;
    state.error = err?.message || 'Erreur réseau';
    renderAll();
  } finally {
    if (refreshBtn) refreshBtn.textContent = '↻ Actualiser';
  }
}

function bindGlobalEvents() {
  // Onglets de mode
  document.querySelectorAll('.mode-tab').forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.getAttribute('data-mode')));
  });

  // Thème Clair / Sombre
  document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // Unité de vent km/h <-> nœuds
  const unitBtn = document.getElementById('btn-wind-unit');
  if (unitBtn) {
    unitBtn.textContent = state.windUnit === 'kn' ? 'nœuds' : 'km/h';
    unitBtn.addEventListener('click', () => {
      state.windUnit = state.windUnit === 'kmh' ? 'kn' : 'kmh';
      localStorage.setItem(WIND_UNIT_KEY, state.windUnit);
      unitBtn.textContent = state.windUnit === 'kn' ? 'nœuds' : 'km/h';
      renderAll();
    });
  }

  // Rafraîchissement forcé
  document.getElementById('btn-refresh-live')?.addEventListener('click', () => {
    loadLiveTelemetry({ forceRefresh: true });
  });

  // Contrôles Temporels (En direct / Presets demain / Slider 168h)
  document.getElementById('btn-live-now')?.addEventListener('click', () => {
    state.isRealtime = true;
    state.sliderHoursOffset = 0;
    document.getElementById('time-slider-168h').value = '0';
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('is-active'));
    recomputeAllSpotStates();
    renderAll();
  });

  document.getElementById('time-slider-168h')?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    state.sliderHoursOffset = val;
    state.isRealtime = val === 0;
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('is-active'));
    recomputeAllSpotStates();
    renderAll();
  });

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const preset = btn.getAttribute('data-preset');
      const tomorrowParts = getParisDateParts(Date.now() + 24 * 3600_000);
      const targetHour =
        preset === 'tomorrow-dawn' ? '08:00' : preset === 'tomorrow-noon' ? '12:00' : '17:00';
      const ts = parseParisLocalISO(`${tomorrowParts.dateKey}T${targetHour}`);
      jumpToTimestamp(ts);
    });
  });

  // Filtres Radar
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
      renderSpotsList();
    });
  };
  bindToggleChip('filter-cams-only', 'camsOnly');
  bindToggleChip('filter-fallback-only', 'fallbackOnly');
  bindToggleChip('filter-low-crowd', 'lowCrowd');
  bindToggleChip('filter-favorites-only', 'favoritesOnly');

  // Toggle rayons bathymétriques du Gouf
  const goufBtn = document.getElementById('btn-toggle-gouf-rays');
  goufBtn?.addEventListener('click', () => {
    state.showGoufRays = !state.showGoufRays;
    goufBtn.textContent = `Rayons Gouf : ${state.showGoufRays ? 'ON' : 'OFF'}`;
    renderMapPanel();
  });

  // Contrôles Mur Vidéo
  document.querySelectorAll('[data-wall-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-wall-layout]').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.wallLayout = btn.getAttribute('data-wall-layout');
      renderWebcamWall();
    });
  });

  document.getElementById('wall-zone-filter')?.addEventListener('change', (e) => {
    state.wallZone = e.target.value;
    renderWebcamWall();
  });

  window.addEventListener('resize', () => {
    refreshActiveCanvases();
  });
}

// Initialisation
applyTheme(state.theme);
bindGlobalEvents();
updateTopbarTelemetry();
loadLiveTelemetry();
setInterval(() => {
  if (state.isRealtime && !state.loading) {
    updateTopbarTelemetry();
  }
}, 20_000);
