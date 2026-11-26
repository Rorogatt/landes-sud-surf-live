/**
 * Carte Océanographique Interactive v2 — Côte Sud des Landes (Moliets -> Tarnos)
 * - Zéro collision de texte (colonne terrestre dédiée avec algorithme d'espacement bidirectionnel)
 * - Zéro rognage de bord droit (marge terrestre calibrée sur viewBox 500x720)
 * - Toggle Zoom Secteur : `all` (Côte entière 40 km) vs `core` (Zoom Seignosse · Hossegor · Capbreton)
 * - Bathymétrie réelle du Gouf de Capbreton & Rayons de réfraction Snell-Descartes.
 */

const BOUNDS_ALL = {
  latMax: 43.875,
  latMin: 43.515,
  lonMin: -1.615,
  lonMax: -1.255, // Large espace terrestre à droite pour 0 rognage des labels
};

const BOUNDS_CORE = {
  latMax: 43.732,
  latMin: 43.628,
  lonMin: -1.535,
  lonMax: -1.365,
};

const COASTLINE_WGS84 = [
  [43.875, -1.392],
  [43.854, -1.397],
  [43.843, -1.400],
  [43.817, -1.408],
  [43.794, -1.416],
  [43.785, -1.418],
  [43.777, -1.421],
  [43.748, -1.429],
  [43.723, -1.434],
  [43.710, -1.439],
  [43.698, -1.442],
  [43.687, -1.443],
  [43.680, -1.443],
  [43.671, -1.443],
  [43.665, -1.444],
  [43.661, -1.445],
  [43.656, -1.448],
  [43.650, -1.448],
  [43.646, -1.448],
  [43.642, -1.449],
  [43.637, -1.452],
  [43.618, -1.464],
  [43.600, -1.474],
  [43.578, -1.489],
  [43.560, -1.502],
  [43.536, -1.520],
  [43.531, -1.531],
  [43.527, -1.526],
  [43.515, -1.534],
];

const GOUF_ISOBATHS = [
  {
    depth: '-100 m',
    opacity: 0.24,
    points: [
      [43.690, -1.615],
      [43.676, -1.525],
      [43.664, -1.472],
      [43.656, -1.452],
      [43.649, -1.470],
      [43.635, -1.525],
      [43.618, -1.615],
    ],
  },
  {
    depth: '-500 m',
    opacity: 0.36,
    points: [
      [43.681, -1.615],
      [43.669, -1.535],
      [43.659, -1.482],
      [43.655, -1.463],
      [43.650, -1.482],
      [43.641, -1.535],
      [43.628, -1.615],
    ],
  },
  {
    depth: '-1 500 m',
    opacity: 0.5,
    points: [
      [43.672, -1.615],
      [43.662, -1.545],
      [43.656, -1.498],
      [43.652, -1.545],
      [43.640, -1.615],
    ],
  },
];

function project([lat, lon], width, height, bounds) {
  const padLeft = 18;
  const padRight = 18;
  const padY = 26;
  const usableW = width - padLeft - padRight;
  const usableH = height - padY * 2;
  const x = padLeft + ((lon - bounds.lonMin) / (bounds.lonMax - bounds.lonMin)) * usableW;
  const y = padY + ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * usableH;
  return [+x.toFixed(1), +y.toFixed(1)];
}

function pointsToSvgPath(coords, width, height, bounds) {
  const pts = coords.map((c) => project(c, width, height, bounds));
  return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
}

function scoreColorClass(tone) {
  if (tone === 'optimal') return 'pin-optimal';
  if (tone === 'good') return 'pin-good';
  if (tone === 'moderate') return 'pin-moderate';
  return 'pin-bad';
}

/**
 * Résout l'espacement vertical d'une liste ordonnée d'étiquettes pour garantir 0 chevauchement
 * tout en restant dans [minY, maxY].
 */
function relaxLabelPositions(rawYs, minGap, minY, maxY) {
  const ys = [...rawYs];
  // Passe descendante
  for (let i = 1; i < ys.length; i++) {
    if (ys[i] < ys[i - 1] + minGap) {
      ys[i] = ys[i - 1] + minGap;
    }
  }
  // Passe ascendante si débordement en bas
  if (ys.length && ys[ys.length - 1] > maxY) {
    ys[ys.length - 1] = maxY;
    for (let i = ys.length - 2; i >= 0; i--) {
      if (ys[i] > ys[i + 1] - minGap) {
        ys[i] = Math.max(minY, ys[i + 1] - minGap);
      }
    }
  }
  return ys;
}

export function renderCoastMap(
  container,
  {
    spots,
    spotStates,
    selectedSpotId,
    showGoufPhysics = true,
    zoomSector = 'all', // 'all' | 'core'
    onSelectSpot,
  }
) {
  if (!container) return;
  const width = 500;
  const height = 700;
  const bounds = zoomSector === 'core' ? BOUNDS_CORE : BOUNDS_ALL;

  const refState =
    spotStates['hossegor-la-graviere'] ||
    spotStates['seignosse-les-bourdaines'] ||
    Object.values(spotStates)[0];

  const swellDeg = refState?.snapshot?.waveDirDeg ?? 288;
  const swellH = refState?.snapshot?.offshoreWaveHeightM ?? 1.8;
  const swellTp = refState?.snapshot?.primaryPeriodS ?? 12;
  const windDeg = refState?.snapshot?.windDirDeg ?? 95;
  const windKmh = refState?.snapshot?.windSpeedKmh ?? 12;
  const windComp = refState?.snapshot?.windDirCompass ?? 'E';
  const swellComp = refState?.snapshot?.waveDirCompass ?? 'ONO';

  const coastPts = COASTLINE_WGS84.map((c) => project(c, width, height, bounds));
  const coastLineD = coastPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const landPolyD = `${coastLineD} L${width + 20},${coastPts[coastPts.length - 1][1]} L${width + 20},${coastPts[0][1]} Z`;

  const [vbX, vbY] = project([43.783, -1.407], width, height, bounds);
  const [hossLacX, hossLacY] = project([43.676, -1.431], width, height, bounds);
  const [goufHeadX, goufHeadY] = project([43.6555, -1.452], width, height, bounds);
  const [laNordX, laNordY] = project([43.666, -1.449], width, height, bounds);
  const [graviereX, graviereY] = project([43.6715, -1.445], width, height, bounds);
  const [laPisteX, laPisteY] = project([43.642, -1.451], width, height, bounds);
  const [digueTipX, digueTipY] = project([43.531, -1.531], width, height, bounds);
  const [digueBaseX, digueBaseY] = project([43.536, -1.520], width, height, bounds);

  const isobathsSvg = GOUF_ISOBATHS.map((iso, idx) => {
    const d = pointsToSvgPath(iso.points, width, height, bounds);
    // Étiquettes de profondeur placées tout à gauche côté océan (x = 18) hors de tout texte
    const [, lblY] = project(iso.points[0], width, height, bounds);
    return `
      <path d="${d}" class="gouf-isobath" style="opacity:${iso.opacity}" />
      ${idx > 0 ? `<text x="16" y="${lblY - 3}" class="map-bathy-label">${iso.depth}</text>` : ''}
    `;
  }).join('');

  const goufRaysSvg = showGoufPhysics
    ? `
      <g class="gouf-refraction-group">
        <path d="M 24,${goufHeadY - 18} Q ${goufHeadX - 48},${goufHeadY - 9} ${laNordX},${laNordY}" class="gouf-ray gouf-ray-amp" marker-end="url(#arrowAmp)" />
        <path d="M 24,${goufHeadY - 4} Q ${goufHeadX - 34},${goufHeadY - 2} ${graviereX},${graviereY}" class="gouf-ray gouf-ray-amp" marker-end="url(#arrowAmp)" />
        <path d="M 24,${goufHeadY + 13} Q ${goufHeadX - 36},${goufHeadY + 7} ${laPisteX},${laPisteY}" class="gouf-ray gouf-ray-amp" marker-end="url(#arrowAmp)" />
        <circle cx="${goufHeadX + 2}" cy="${goufHeadY}" r="16" class="gouf-shadow-zone" />
        <!-- Légende du Gouf placée au Sud-Ouest sous les rayons (x = 18), 0 collision avec les isobathes -500m/-1500m ! -->
        <text x="18" y="${goufHeadY + 32}" text-anchor="start" class="gouf-canyon-title">GOUF DE CAPBRETON</text>
        <text x="18" y="${goufHeadY + 43}" text-anchor="start" class="gouf-canyon-sub">Canyon -2 150 m · Lentille houle</text>
      </g>
    `
    : '';

  const visibleSpots = [...spots]
    .filter((s) => {
      const lat = s.coordinates.peak.lat;
      return lat <= bounds.latMax && lat >= bounds.latMin;
    })
    .sort((a, b) => a.northToSouthRank - b.northToSouthRank);

  const projected = visibleSpots.map((spot) => {
    const [px, py] = project([spot.coordinates.peak.lat, spot.coordinates.peak.lon], width, height, bounds);
    return { spot, px, py };
  });

  const minGap = zoomSector === 'core' ? 38 : 31;
  const relaxedYs = relaxLabelPositions(
    projected.map((p) => p.py + 3),
    minGap,
    30,
    height - 20
  );

  // Colonne d'étiquettes alignée proprement côté pinède à droite du trait de côte
  const labelColumnX = zoomSector === 'core' ? 258 : 284;

  const pinsSvg = projected
    .map(({ spot, px, py }, idx) => {
      const st = spotStates[spot.id];
      const isSelected = spot.id === selectedSpotId;
      const score = st?.evaluation?.score10 ?? 0;
      const tone = st?.evaluation?.verdictTone ?? 'moderate';
      const waveM = st?.snapshot?.spotWaveHeightM?.toFixed(1) ?? '--';
      const hasCam = (spot.webcams?.length ?? 0) > 0;
      const ly = relaxedYs[idx];
      const lx = Math.max(px + 20, labelColumnX);

      return `
        <g class="map-spot-node ${scoreColorClass(tone)} ${isSelected ? 'is-selected' : ''}"
           data-spot-id="${spot.id}"
           tabindex="0"
           role="button"
           aria-label="${spot.name} — Note ${score.toFixed(1)} sur 10, vagues ${waveM} m">
          <!-- Zone de clic/touch élargie invisible (accessibilité tactile) -->
          <rect x="${lx - 8}" y="${ly - 13}" width="${width - lx + 4}" height="20" fill="transparent" />
          <circle cx="${px}" cy="${py}" r="12" fill="transparent" />
          <path d="M ${px + 5},${py} L ${lx - 14},${ly - 3} L ${lx - 5},${ly - 3}" fill="none" class="map-leader-line" />
          ${isSelected ? `<circle cx="${px}" cy="${py}" r="10.5" class="map-pin-halo" />` : ''}
          <circle cx="${px}" cy="${py}" r="${isSelected ? 6.2 : 4.8}" class="map-pin-dot" />
          <text x="${lx}" y="${ly}" text-anchor="start" class="map-spot-label">
            <tspan class="map-spot-name">${spot.shortName}</tspan>
            <tspan class="map-spot-metrics"> ${waveM}m · ${score.toFixed(1)}</tspan>
            ${hasCam ? '<tspan class="map-cam-dot"> ●</tspan>' : ''}
          </text>
        </g>
      `;
    })
    .join('');

  const swellTravelDeg = (swellDeg + 180) % 360;
  const windTravelDeg = (windDeg + 180) % 360;

  container.innerHTML = `
    <div class="coast-map-frame">
      <svg viewBox="0 0 ${width} ${height}" class="coast-map-svg" role="img" aria-label="Carte océanographique des 19 spots de surf des Landes du Sud et du Gouf de Capbreton">
        <defs>
          <clipPath id="mapClipBox">
            <rect x="0" y="0" width="${width}" height="${height}" />
          </clipPath>
          <linearGradient id="oceanDepthGrad" x1="0%" y1="0%" x2="65%" y2="0%">
            <stop offset="0%" stop-color="var(--map-ocean-deep)" />
            <stop offset="68%" stop-color="var(--map-ocean-mid)" />
            <stop offset="100%" stop-color="var(--map-ocean-shoal)" />
          </linearGradient>
          <marker id="arrowAmp" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--accent-amber)" />
          </marker>
        </defs>

        <g clip-path="url(#mapClipBox)">
          <rect x="0" y="0" width="${width}" height="${height}" fill="url(#oceanDepthGrad)" />

          <g class="map-bathymetry-layer">
            ${isobathsSvg}
            ${goufRaysSvg}
          </g>

          <path d="${landPolyD}" class="map-land-mass" />
          <path d="${coastLineD}" class="map-coastline-stroke" />

          <!-- Lacs Marins dessinés discrètement sans surcharger le couloir de texte -->
          <ellipse cx="${vbX}" cy="${vbY}" rx="5" ry="9" class="map-marine-lake" />
          <ellipse cx="${hossLacX}" cy="${hossLacY}" rx="4.5" ry="11" class="map-marine-lake" />

          <!-- Ouvrages côtiers (Estacade Capbreton & Digue Tarnos 950m) -->
          <line x1="${goufHeadX + 12}" y1="${goufHeadY}" x2="${goufHeadX + 3}" y2="${goufHeadY}" class="map-jetty-line" />
          <line x1="${digueBaseX}" y1="${digueBaseY}" x2="${digueTipX}" y2="${digueTipY}" class="map-jetty-line" />
          ${
            zoomSector === 'all'
              ? `<text x="18" y="${height - 16}" text-anchor="start" class="map-geo-caption">Sud : Digue de Tarnos / Adour</text>`
              : ''
          }

          <!-- Rose Houle & Vent Temps Réel (Haut Gauche en mer) -->
          <g transform="translate(82, 74)" class="map-compass-widget">
            <circle cx="0" cy="0" r="35" class="compass-ring" />
            <text x="0" y="-40" text-anchor="middle" class="compass-cardinal">N</text>
            <g transform="rotate(${swellTravelDeg})">
              <line x1="0" y1="22" x2="0" y2="-22" class="compass-swell-vec" />
              <polygon points="0,-27 -4.2,-18 4.2,-18" class="compass-swell-head" />
            </g>
            <g transform="rotate(${windTravelDeg})">
              <line x1="0" y1="16" x2="0" y2="-16" class="compass-wind-vec" />
              <polygon points="0,-20 -3.4,-13 3.4,-13" class="compass-wind-head" />
            </g>
            <text x="0" y="50" text-anchor="middle" class="compass-readout-swell">Houle ${swellH.toFixed(1)}m @ ${swellTp}s (${swellComp})</text>
            <text x="0" y="62" text-anchor="middle" class="compass-readout-wind">AROME ${windKmh} km/h (${windComp})</text>
          </g>

          <g class="map-spots-layer">
            ${pinsSvg}
          </g>
        </g>
      </svg>
    </div>
  `;

  container.querySelectorAll('.map-spot-node').forEach((node) => {
    const id = node.getAttribute('data-spot-id');
    node.addEventListener('click', () => onSelectSpot?.(id));
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelectSpot?.(id);
      }
    });
  });
}
