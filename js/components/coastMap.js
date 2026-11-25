/**
 * Carte Océanographique Interactive Côte Sud des Landes (Moliets -> Tarnos)
 * + Bathymétrie réelle du Gouf de Capbreton & Rayons de réfraction Snell-Descartes
 * + Vecteurs Houle & Vent AROME temps réel + Pins interactifs des 19 spots.
 */

const BOUNDS = {
  latMax: 43.872,
  latMin: 43.518,
  lonMin: -1.595,
  lonMax: -1.365,
};

// Trait de côte WGS84 haute fidélité du Nord (Moliets/Huchet) au Sud (Digue de Tarnos / Adour)
const COASTLINE_WGS84 = [
  [43.872, -1.393],
  [43.854, -1.397], // Embouchure Courant d'Huchet
  [43.843, -1.400], // Moliets Centrale
  [43.817, -1.408], // Messanges
  [43.794, -1.416], // Sablères
  [43.785, -1.418], // Vieux-Boucau Boucarot
  [43.777, -1.421], // Soustons Océan
  [43.748, -1.429], // Forêt domaniale Seignosse Nord
  [43.723, -1.434], // Les Casernes
  [43.710, -1.439], // Le Penon
  [43.698, -1.442], // Les Bourdaines
  [43.687, -1.443], // Les Estagnots
  [43.680, -1.443], // Les Culs Nus
  [43.671, -1.443], // La Gravière
  [43.665, -1.444], // La Nord (bord)
  [43.661, -1.445], // La Sud
  [43.656, -1.448], // Passe du Port / Estacade Capbreton
  [43.650, -1.448], // Le Prévent
  [43.646, -1.448], // Le Santocha
  [43.642, -1.449], // La Piste
  [43.637, -1.452], // VVF Océanides
  [43.618, -1.464], // Dunes de Labenne Nord
  [43.600, -1.474], // Labenne-Océan
  [43.578, -1.489], // Ondres-Plage
  [43.560, -1.502], // Tarnos Le Métro
  [43.536, -1.520], // Tarnos La Digue Nord
  [43.531, -1.531], // Extrémité Digue Nord Adour (950m en mer)
  [43.527, -1.526], // Embouchure Adour
  [43.518, -1.533], // Anglet La Barre (limite 64)
];

// Isobathes simplifiées du Gouf de Capbreton (canyon sous-marin entaillant le plateau d'Ouest en Est)
const GOUF_ISOBATHS = [
  {
    depth: '-100 m',
    opacity: 0.22,
    points: [
      [43.690, -1.595],
      [43.676, -1.525],
      [43.664, -1.472],
      [43.656, -1.452], // Tête du Gouf à 300m de l'Estacade !
      [43.649, -1.470],
      [43.635, -1.525],
      [43.618, -1.595],
    ],
  },
  {
    depth: '-500 m',
    opacity: 0.34,
    points: [
      [43.681, -1.595],
      [43.669, -1.535],
      [43.659, -1.482],
      [43.655, -1.463],
      [43.650, -1.482],
      [43.641, -1.535],
      [43.628, -1.595],
    ],
  },
  {
    depth: '-1 200 m',
    opacity: 0.48,
    points: [
      [43.672, -1.595],
      [43.662, -1.545],
      [43.656, -1.498],
      [43.652, -1.545],
      [43.640, -1.595],
    ],
  },
];

function project([lat, lon], width, height) {
  const padX = 28;
  const padY = 26;
  const usableW = width - padX * 2;
  const usableH = height - padY * 2;
  const x = padX + ((lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin)) * usableW;
  const y = padY + ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * usableH;
  return [+(x).toFixed(1), +(y).toFixed(1)];
}

function pointsToSvgPath(coords, width, height, closeLand = false) {
  const pts = coords.map((c) => project(c, width, height));
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  if (!closeLand) return d;
  return `${d} L${width},0 L${width},${height} L${pts[pts.length - 1][0]},${height} Z`;
}

function scoreColorClass(tone) {
  if (tone === 'optimal') return 'pin-optimal';
  if (tone === 'good') return 'pin-good';
  if (tone === 'moderate') return 'pin-moderate';
  return 'pin-bad';
}

/**
 * Rendu SVG interactif de l'atlas côtier des 19 spots + Gouf de Capbreton.
 */
export function renderCoastMap(container, {
  spots,
  spotStates,
  selectedSpotId,
  showGoufPhysics = true,
  onSelectSpot,
}) {
  if (!container) return;
  const width = 460;
  const height = 740;

  // Vecteur moyen houle & vent sur Hossegor/Capbreton pour la rose océanique
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

  // Construction du polygone terrestre (à l'Est du trait de côte)
  const coastPts = COASTLINE_WGS84.map((c) => project(c, width, height));
  const coastLineD = coastPts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const landPolyD = `${coastLineD} L${width},${coastPts[coastPts.length - 1][1]} L${width},${coastPts[0][1]} Z`;

  // Lacs marins (Port d'Albret + Lac d'Hossegor) pour le repérage visuel authentique
  const [vbX, vbY] = project([43.783, -1.406], width, height);
  const [hossLacX, hossLacY] = project([43.676, -1.430], width, height);
  const [goufHeadX, goufHeadY] = project([43.6555, -1.452], width, height);
  const [laNordX, laNordY] = project([43.666, -1.449], width, height);
  const [graviereX, graviereY] = project([43.6715, -1.445], width, height);
  const [laPisteX, laPisteY] = project([43.642, -1.451], width, height);
  const [laSudX, laSudY] = project([43.6615, -1.446], width, height);
  const [digueTipX, digueTipY] = project([43.531, -1.531], width, height);
  const [digueBaseX, digueBaseY] = project([43.536, -1.520], width, height);

  const isobathsSvg = GOUF_ISOBATHS.map((iso) => {
    const d = pointsToSvgPath(iso.points, width, height, false);
    const [lblX, lblY] = project(iso.points[1], width, height);
    return `
      <path d="${d}" class="gouf-isobath" style="opacity:${iso.opacity}" />
      <text x="${lblX - 8}" y="${lblY - 4}" class="map-bathy-label">${iso.depth}</text>
    `;
  }).join('');

  // Rayons de réfraction Snell-Descartes si activés
  const goufRaysSvg = showGoufPhysics
    ? `
      <g class="gouf-refraction-group">
        <!-- Convergence Épaule Nord (La Nord / La Gravière ×1.35-1.40) -->
        <path d="M 32,${goufHeadY - 16} Q ${goufHeadX - 42},${goufHeadY - 8} ${laNordX},${laNordY}" class="gouf-ray gouf-ray-amp" marker-end="url(#arrowAmp)" />
        <path d="M 32,${goufHeadY - 4} Q ${goufHeadX - 30},${goufHeadY - 2} ${graviereX},${graviereY}" class="gouf-ray gouf-ray-amp" marker-end="url(#arrowAmp)" />
        <!-- Convergence Épaule Sud (La Piste ×1.30) -->
        <path d="M 32,${goufHeadY + 12} Q ${goufHeadX - 32},${goufHeadY + 6} ${laPisteX},${laPisteY}" class="gouf-ray gouf-ray-amp" marker-end="url(#arrowAmp)" />
        <!-- Ombre / Défocalisation Tête du Gouf (La Sud / Prévent ×0.50-0.65) -->
        <circle cx="${goufHeadX + 2}" cy="${goufHeadY}" r="18" class="gouf-shadow-zone" />
        <text x="${goufHeadX - 118}" y="${goufHeadY + 4}" class="gouf-canyon-title">GOUF DE CAPBRETON</text>
        <text x="${goufHeadX - 118}" y="${goufHeadY + 15}" class="gouf-canyon-sub">Canyon -2 150 m • Lentille houle</text>
      </g>
    `
    : '';

  // Tri du Nord au Sud pour placement propre d'étiquettes sans collision dans la grappe Hossegor/Capbreton
  const orderedSpots = [...spots].sort((a, b) => a.northToSouthRank - b.northToSouthRank);

  // Calcul anti-chevauchement vertical des étiquettes droite/gauche
  let lastRightY = -999;
  let lastLeftY = -999;

  const pinsSvg = orderedSpots
    .map((spot) => {
      const st = spotStates[spot.id];
      const [px, py] = project([spot.coordinates.peak.lat, spot.coordinates.peak.lon], width, height);
      const isSelected = spot.id === selectedSpotId;
      const score = st?.evaluation?.score10 ?? 0;
      const tone = st?.evaluation?.verdictTone ?? 'moderate';
      const waveM = st?.snapshot?.spotWaveHeightM?.toFixed(1) ?? '--';
      const hasCam = (spot.webcams?.length ?? 0) > 0;

      // Alterne côté mer (gauche) / côté pinède (droite) dans la zone très dense Seignosse -> Capbreton
      const denseCluster = spot.northToSouthRank >= 7 && spot.northToSouthRank <= 16;
      const placeLeft = denseCluster && spot.northToSouthRank % 2 === 1;

      let labelY = py;
      if (placeLeft) {
        if (labelY - lastLeftY < 17) labelY = lastLeftY + 17;
        lastLeftY = labelY;
      } else {
        if (labelY - lastRightY < 17) labelY = lastRightY + 17;
        lastRightY = labelY;
      }

      const labelX = placeLeft ? px - 14 : px + 14;
      const anchor = placeLeft ? 'end' : 'start';

      return `
        <g class="map-spot-node ${scoreColorClass(tone)} ${isSelected ? 'is-selected' : ''}"
           data-spot-id="${spot.id}"
           tabindex="0"
           role="button"
           aria-label="${spot.name} — Note ${score} sur 10, vagues ${waveM} m">
          <line x1="${px}" y1="${py}" x2="${placeLeft ? labelX + 4 : labelX - 4}" y2="${labelY - 3}" class="map-leader-line" />
          ${isSelected ? `<circle cx="${px}" cy="${py}" r="11" class="map-pin-halo" />` : ''}
          <circle cx="${px}" cy="${py}" r="${isSelected ? 6 : 4.6}" class="map-pin-dot" />
          <text x="${labelX}" y="${labelY}" text-anchor="${anchor}" class="map-spot-label">
            <tspan class="map-spot-name">${spot.shortName}</tspan>
            <tspan class="map-spot-metrics"> ${waveM}m · ${score.toFixed(1)}</tspan>
            ${hasCam ? '<tspan class="map-cam-dot"> ●</tspan>' : ''}
          </text>
        </g>
      `;
    })
    .join('');

  // Flèche directionnelle de provenance de la houle (la flèche pointe dans le sens de propagation = provenance + 180°)
  const swellTravelDeg = (swellDeg + 180) % 360;
  const windTravelDeg = (windDeg + 180) % 360;

  container.innerHTML = `
    <div class="coast-map-frame">
      <svg viewBox="0 0 ${width} ${height}" class="coast-map-svg" role="img" aria-label="Carte océanographique des 19 spots de surf des Landes du Sud et du Gouf de Capbreton">
        <defs>
          <linearGradient id="oceanDepthGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="var(--map-ocean-deep)" />
            <stop offset="72%" stop-color="var(--map-ocean-mid)" />
            <stop offset="100%" stop-color="var(--map-ocean-shoal)" />
          </linearGradient>
          <marker id="arrowAmp" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--accent-amber)" />
          </marker>
        </defs>

        <!-- Fond océanique Golfe de Gascogne -->
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#oceanDepthGrad)" />

        <!-- Isobathes du Gouf de Capbreton -->
        <g class="map-bathymetry-layer">
          ${isobathsSvg}
          ${goufRaysSvg}
        </g>

        <!-- Masse terrestre & Pinède des Landes -->
        <path d="${landPolyD}" class="map-land-mass" />
        <!-- Cordon dunaire & Trait de côte -->
        <path d="${coastLineD}" class="map-coastline-stroke" />

        <!-- Lacs Marins & Ouvrages côtiers majeurs -->
        <ellipse cx="${vbX}" cy="${vbY}" rx="7" ry="11" class="map-marine-lake" />
        <text x="${vbX + 10}" y="${vbY + 3}" class="map-geo-caption">Lac Port d'Albret</text>

        <ellipse cx="${hossLacX}" cy="${hossLacY}" rx="5.5" ry="13" class="map-marine-lake" />
        <text x="${hossLacX + 9}" y="${hossLacY + 2}" class="map-geo-caption">Lac d'Hossegor</text>

        <!-- Estacade de Capbreton -->
        <line x1="${goufHeadX + 11}" y1="${goufHeadY}" x2="${goufHeadX + 3}" y2="${goufHeadY}" class="map-jetty-line" />
        <!-- Digue Nord de Tarnos (Adour) -->
        <line x1="${digueBaseX}" y1="${digueBaseY}" x2="${digueTipX}" y2="${digueTipY}" class="map-jetty-line" />
        <text x="${digueTipX - 6}" y="${digueTipY + 13}" text-anchor="end" class="map-geo-caption">Embouchure Adour / Digue 950m</text>

        <!-- Rose Houle & Vent Temps Réel (Haut Gauche en mer) -->
        <g transform="translate(64, 76)" class="map-compass-widget">
          <circle cx="0" cy="0" r="38" class="compass-ring" />
          <text x="0" y="-43" text-anchor="middle" class="compass-cardinal">N</text>
          <!-- Vecteur Houle -->
          <g transform="rotate(${swellTravelDeg})">
            <line x1="0" y1="24" x2="0" y2="-24" class="compass-swell-vec" />
            <polygon points="0,-29 -4.5,-19 4.5,-19" class="compass-swell-head" />
          </g>
          <!-- Vecteur Vent -->
          <g transform="rotate(${windTravelDeg})">
            <line x1="0" y1="18" x2="0" y2="-18" class="compass-wind-vec" />
            <polygon points="0,-22 -3.5,-14 3.5,-14" class="compass-wind-head" />
          </g>
          <text x="0" y="54" text-anchor="middle" class="compass-readout-swell">Houle ${swellH.toFixed(1)}m @ ${swellTp}s (${swellComp})</text>
          <text x="0" y="67" text-anchor="middle" class="compass-readout-wind">Vent AROME ${windKmh} km/h (${windComp})</text>
        </g>

        <!-- Pins des 19 Spots -->
        <g class="map-spots-layer">
          ${pinsSvg}
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
