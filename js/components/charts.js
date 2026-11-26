/**
 * Graphiques Océanographiques Haute Précision v2 sur <canvas> (adaptatifs thème sombre / clair) :
 * 1. `drawTideChart24h`   : Courbe des Marées 24h SHOM Capbreton + zone optimale du spot + curseur live
 * 2. `drawForecast7dChart`: Frise interactive 7 Jours (168h) Houle réfractée (m) + Score Surf (/10) + Ruban Vent Offshore/Onshore (cliquable !)
 * 3. `drawBuoySparkline`  : Sparklines Bouées Houlographes 24h (Hm0 & Hmax)
 */

import { build24hTideCurve, getSpotTidePhaseShiftMin } from '../services/tides.js';
import { getParisDateParts, parseParisLocalISO, formatParisTime, formatParisShortDate } from '../services/time.js';
import { getSpotSnapshotAt } from '../services/oceanApi.js';
import { evaluateSpotConditions } from '../services/scoring.js';

function getThemePalette() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue('--text-primary').trim() || '#edebe6',
    muted: styles.getPropertyValue('--text-muted').trim() || '#8c99a4',
    grid: styles.getPropertyValue('--border-subtle').trim() || 'rgba(255,255,255,0.08)',
    sea: styles.getPropertyValue('--accent-sea').trim() || '#3ca38b',
    sky: styles.getPropertyValue('--accent-sky').trim() || '#45a6d9',
    amber: styles.getPropertyValue('--accent-amber').trim() || '#de9e36',
    coral: styles.getPropertyValue('--accent-coral').trim() || '#d9654c',
    waterFillTop: 'rgba(60, 163, 139, 0.28)',
    waterFillBottom: 'rgba(60, 163, 139, 0.02)',
    optZone: 'rgba(222, 158, 54, 0.14)',
    optBorder: 'rgba(222, 158, 54, 0.55)',
    nightShade: 'rgba(8, 14, 20, 0.24)',
  };
}

function setupHiDPICanvas(canvas, logicalHeight) {
  const rect = canvas.parentElement?.getBoundingClientRect();
  const width = Math.max(260, Math.floor(rect?.width || canvas.clientWidth || 560));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = logicalHeight * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${logicalHeight}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height: logicalHeight };
}

export function drawTideChart24h(canvas, spot, spotTelemetry, targetMs = Date.now()) {
  if (!canvas || !spotTelemetry?.marine?.hourly) return;
  const { ctx, width, height } = setupHiDPICanvas(canvas, 185);
  const pal = getThemePalette();

  const hTimes = spotTelemetry.marine.hourly.time || [];
  const msl = spotTelemetry.marine.hourly.sea_level_height_msl || [];
  const phaseShift = getSpotTidePhaseShiftMin(spot);
  const { dayStartMs, points } = build24hTideCurve(hTimes, msl, targetMs, phaseShift);
  if (!points.length) return;

  const pad = { top: 24, right: 16, bottom: 26, left: 38 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const minH = 0.0;
  const maxH = 4.8;
  const xForMin = (minOfDay) => pad.left + (minOfDay / 1440) * plotW;
  const yForH = (h) => pad.top + (1 - (h - minH) / (maxH - minH)) * plotH;

  ctx.clearRect(0, 0, width, height);

  const dailyTimes = spotTelemetry.weather?.daily?.time || [];
  const dateKey = getParisDateParts(targetMs).dateKey;
  const dIdx = dailyTimes.indexOf(dateKey);
  if (dIdx >= 0) {
    const srMs = parseParisLocalISO(spotTelemetry.weather.daily.sunrise?.[dIdx]);
    const ssMs = parseParisLocalISO(spotTelemetry.weather.daily.sunset?.[dIdx]);
    const srMin = Math.max(0, (srMs - dayStartMs) / 60_000);
    const ssMin = Math.min(1440, (ssMs - dayStartMs) / 60_000);

    ctx.fillStyle = pal.nightShade;
    ctx.fillRect(pad.left, pad.top, xForMin(srMin) - pad.left, plotH);
    ctx.fillRect(xForMin(ssMin), pad.top, pad.left + plotW - xForMin(ssMin), plotH);
  }

  const opt = spot.idealTide?.optimalTideHeightM;
  if (opt) {
    const yTop = yForH(Math.min(maxH, opt.max));
    const yBot = yForH(Math.max(minH, opt.min));
    ctx.fillStyle = pal.optZone;
    ctx.fillRect(pad.left, yTop, plotW, Math.max(2, yBot - yTop));

    ctx.strokeStyle = pal.optBorder;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, yTop);
    ctx.lineTo(pad.left + plotW, yTop);
    ctx.moveTo(pad.left, yBot);
    ctx.lineTo(pad.left + plotW, yBot);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = pal.amber;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText(`Fenêtre idéale (${opt.min}–${opt.max}m)`, pad.left + 6, yTop + 12);
  }

  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = pal.muted;
  ctx.font = '10.5px "JetBrains Mono", monospace';
  for (const hTick of [1, 2, 3, 4]) {
    const y = yForH(hTick);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillText(`${hTick}m`, 6, y + 4);
  }

  for (const hr of [0, 4, 8, 12, 16, 20, 24]) {
    const x = xForMin(hr * 60);
    ctx.fillText(`${String(hr).padStart(2, '0')}h`, x - 10, height - 7);
  }

  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
  grad.addColorStop(0, pal.waterFillTop);
  grad.addColorStop(1, pal.waterFillBottom);

  ctx.beginPath();
  points.forEach((pt, idx) => {
    const x = xForMin(pt.minuteOfDay);
    const y = yForH(pt.heightZH);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(xForMin(points[points.length - 1].minuteOfDay), pad.top + plotH);
  ctx.lineTo(xForMin(points[0].minuteOfDay), pad.top + plotH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  points.forEach((pt, idx) => {
    const x = xForMin(pt.minuteOfDay);
    const y = yForH(pt.heightZH);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = pal.sea;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  const targetMin = (targetMs - dayStartMs) / 60_000;
  if (targetMin >= 0 && targetMin <= 1440) {
    const cx = xForMin(targetMin);
    const nearest = points.reduce((best, p) =>
      Math.abs(p.minuteOfDay - targetMin) < Math.abs(best.minuteOfDay - targetMin) ? p : best
    );
    const cy = yForH(nearest.heightZH);

    ctx.strokeStyle = pal.amber;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, pad.top);
    ctx.lineTo(cx, pad.top + plotH);
    ctx.stroke();

    ctx.fillStyle = pal.amber;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();

    const tag = `${formatParisTime(targetMs)} · ${nearest.heightZH.toFixed(2)}m`;
    const tagX = Math.min(width - 115, Math.max(pad.left + 4, cx - 45));
    ctx.fillStyle = pal.text;
    ctx.font = '600 10.5px "JetBrains Mono", monospace';
    ctx.fillText(tag, tagX, pad.top - 7);
  }
}

/**
 * NOUVEAU v2 : Graphique Interactif 7 Jours (168h, pas de 3h = 56 créneaux) :
 * - Barres verticales colorées = Score Surf /10 (selon le niveau du surfeur !)
 * - Courbe continue = Hauteur de vagues réfractée au pic (m)
 * - Ruban supérieur = Régime de vent (Vert = Offshore/Glassy/Abrité, Ocre = Cross, Corail = Onshore)
 * - Cliquable : un clic sur n'importe quel créneau projette toute l'application à cette heure !
 */
export function drawForecast7dChart(
  canvas,
  spot,
  spotTelemetry,
  { surferLevel = 'intermediaire', targetMs = Date.now(), onSelectTimestamp } = {}
) {
  if (!canvas || !spotTelemetry?.marine?.hourly) return;
  const { ctx, width, height } = setupHiDPICanvas(canvas, 205);
  const pal = getThemePalette();

  const startHourMs = Math.ceil(Date.now() / (3 * 3600_000)) * (3 * 3600_000);
  const samples = [];
  for (let step = 0; step < 56; step++) {
    const ts = startHourMs + step * 3 * 3600_000;
    const snap = getSpotSnapshotAt(spot, spotTelemetry, ts, false);
    if (!snap) continue;
    const ev = evaluateSpotConditions(spot, snap, surferLevel);
    samples.push({ ts, snap, ev });
  }
  if (samples.length < 6) return;

  const pad = { top: 28, right: 14, bottom: 30, left: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const maxWave = Math.max(2.5, ...samples.map((s) => s.snap.spotWaveHeightM)) * 1.12;
  const colW = plotW / samples.length;
  const xAt = (i) => pad.left + (i + 0.5) * colW;
  const yWave = (m) => pad.top + (1 - m / maxWave) * plotH;
  const yScore = (sc) => pad.top + (1 - sc / 10) * plotH;

  ctx.clearRect(0, 0, width, height);

  // Grille horizontale mètres
  ctx.strokeStyle = pal.grid;
  ctx.fillStyle = pal.muted;
  ctx.font = '10px "JetBrains Mono", monospace';
  const stepM = maxWave > 4.2 ? 2 : 1;
  for (let m = stepM; m < maxWave; m += stepM) {
    const y = yWave(m);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillText(`${m}m`, 4, y + 3);
  }

  // Barres de Score Surf + Ruban Vent supérieur + Séparateurs de jours
  let prevDateKey = '';
  samples.forEach((s, i) => {
    const x = pad.left + i * colW;
    const parts = getParisDateParts(s.ts);

    // Ombrage nuit
    if (!s.snap.isSurfableLight) {
      ctx.fillStyle = pal.nightShade;
      ctx.fillRect(x, pad.top, colW + 0.5, plotH);
    }

    // Séparateur jour à minuit/03h
    if (parts.dateKey !== prevDateKey) {
      prevDateKey = parts.dateKey;
      ctx.strokeStyle = pal.grid;
      ctx.beginPath();
      ctx.moveTo(x, pad.top - 12);
      ctx.lineTo(x, pad.top + plotH + 16);
      ctx.stroke();

      if (x < width - 38) {
        ctx.fillStyle = pal.muted;
        ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
        const fullLbl = formatParisShortDate(s.ts);
        const dayLbl = plotW / 7 < 68 ? fullLbl.split(' ').slice(0, 2).join(' ') : fullLbl;
        ctx.fillText(dayLbl, x + 3, height - 8);
      }
    }

    // Barre Score /10 (plus lumineuse le jour, atténuée la nuit)
    const sc = s.ev.score10;
    const barTop = yScore(sc);
    const barH = pad.top + plotH - barTop;
    let barColor = 'rgba(217, 101, 76, 0.32)';
    if (s.ev.verdictTone === 'optimal') barColor = s.snap.isSurfableLight ? 'rgba(60, 163, 139, 0.58)' : 'rgba(60, 163, 139, 0.2)';
    else if (s.ev.verdictTone === 'good') barColor = s.snap.isSurfableLight ? 'rgba(69, 166, 217, 0.48)' : 'rgba(69, 166, 217, 0.18)';
    else if (s.ev.verdictTone === 'moderate') barColor = s.snap.isSurfableLight ? 'rgba(222, 158, 54, 0.42)' : 'rgba(222, 158, 54, 0.16)';

    ctx.fillStyle = barColor;
    ctx.fillRect(x + 1, barTop, Math.max(1.5, colW - 2), barH);

    // Pastille ruban vent tout en haut (Offshore/Glassy/Abrité = vert, Cross = ocre, Onshore = corail)
    const windTone = s.ev.wind.tone;
    ctx.fillStyle =
      windTone === 'optimal' || windTone === 'good'
        ? pal.sea
        : windTone === 'moderate'
          ? pal.amber
          : pal.coral;
    ctx.fillRect(x + 1, pad.top - 8, Math.max(1.5, colW - 2), 4);
  });

  // Courbe continue de la hauteur de vague réfractée au pic (m)
  ctx.beginPath();
  samples.forEach((s, i) => {
    const cx = xAt(i);
    const cy = yWave(s.snap.spotWaveHeightM);
    if (i === 0) ctx.moveTo(cx, cy);
    else ctx.lineTo(cx, cy);
  });
  ctx.strokeStyle = pal.sky;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Curseur de l'heure active `targetMs`
  let closestIdx = 0;
  let minD = Infinity;
  samples.forEach((s, i) => {
    const d = Math.abs(s.ts - targetMs);
    if (d < minD) {
      minD = d;
      closestIdx = i;
    }
  });
  if (minD < 4 * 3600_000) {
    const cx = xAt(closestIdx);
    const sel = samples[closestIdx];
    ctx.strokeStyle = pal.amber;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, pad.top - 10);
    ctx.lineTo(cx, pad.top + plotH);
    ctx.stroke();

    ctx.fillStyle = pal.text;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    const label = `${sel.snap.spotWaveHeightM.toFixed(1)}m @ ${sel.snap.primaryPeriodS}s · ${sel.ev.score10.toFixed(1)}/10`;
    const lx = Math.min(width - 155, Math.max(pad.left + 2, cx - 65));
    ctx.fillText(label, lx, 12);
  }

  // Gestion clic interactif sur le canvas 7j (stockée proprement sans empiler les listeners)
  canvas.style.cursor = 'pointer';
  canvas.onclick = (evt) => {
    if (!onSelectTimestamp) return;
    const r = canvas.getBoundingClientRect();
    const clickX = evt.clientX - r.left;
    const idx = Math.max(0, Math.min(samples.length - 1, Math.floor((clickX - pad.left) / colW)));
    onSelectTimestamp(samples[idx].ts);
  };
}

export function drawBuoySparkline(canvas, history24h = []) {
  if (!canvas || history24h.length < 2) return;
  const { ctx, width, height } = setupHiDPICanvas(canvas, 62);
  const pal = getThemePalette();

  const vals = history24h.map((d) => d.hm0).filter((v) => v != null);
  const maxVals = history24h.map((d) => d.hmax || d.hm0).filter((v) => v != null);
  const minV = Math.max(0, Math.min(...vals) * 0.8);
  const maxV = Math.max(...maxVals, 1.5) * 1.08;

  const padX = 4;
  const padY = 6;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const xAt = (i) => padX + (i / (history24h.length - 1)) * plotW;
  const yAt = (v) => padY + (1 - (v - minV) / (maxV - minV || 1)) * plotH;

  ctx.clearRect(0, 0, width, height);

  if (history24h.some((d) => d.hmax != null)) {
    ctx.beginPath();
    history24h.forEach((d, i) => {
      const x = xAt(i);
      const y = yAt(d.hmax ?? d.hm0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = pal.coral;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  history24h.forEach((d, i) => {
    const x = xAt(i);
    const y = yAt(d.hm0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = pal.sea;
  ctx.lineWidth = 2;
  ctx.stroke();
}
