/**
 * Graphiques Océanographiques Haute Précision sur <canvas> (adaptatifs thème sombre / clair) :
 * 1. Courbe des Marées 24h SHOM Capbreton (+ zone de marée optimale du spot sélectionné + aube/crépuscule + curseur live)
 * 2. Courbe Énergie de Houle & Hauteur 7 jours + Barres de Score Surf horaire
 * 3. Sparklines Bouées Houlographes 24h (Hm0 & Hmax)
 */

import { build24hTideCurve, getSpotTidePhaseShiftMin } from '../services/tides.js';
import { getParisDateParts, parseParisLocalISO, formatParisTime } from '../services/time.js';

function getThemePalette() {
  const styles = getComputedStyle(document.documentElement);
  return {
    text: styles.getPropertyValue('--text-primary').trim() || '#edebe6',
    muted: styles.getPropertyValue('--text-muted').trim() || '#8c99a4',
    grid: styles.getPropertyValue('--border-subtle').trim() || 'rgba(255,255,255,0.08)',
    waterStroke: styles.getPropertyValue('--accent-sea').trim() || '#3ca38b',
    waterFillTop: 'rgba(60, 163, 139, 0.28)',
    waterFillBottom: 'rgba(60, 163, 139, 0.02)',
    optZone: 'rgba(222, 158, 54, 0.14)',
    optBorder: 'rgba(222, 158, 54, 0.55)',
    cursor: styles.getPropertyValue('--accent-amber').trim() || '#de9e36',
    nightShade: 'rgba(8, 14, 20, 0.26)',
    hmaxStroke: styles.getPropertyValue('--accent-coral').trim() || '#d9654c',
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

/**
 * Dessine la courbe 24h de marée SHOM (mètres ZH) avec la bande verte/ambrée correspondant
 * exactement à la hauteur d'eau optimale du spot inspecté !
 */
export function drawTideChart24h(canvas, spot, spotTelemetry, targetMs = Date.now()) {
  if (!canvas || !spotTelemetry?.marine?.hourly) return;
  const { ctx, width, height } = setupHiDPICanvas(canvas, 195);
  const pal = getThemePalette();

  const hTimes = spotTelemetry.marine.hourly.time || [];
  const msl = spotTelemetry.marine.hourly.sea_level_height_msl || [];
  const phaseShift = getSpotTidePhaseShiftMin(spot);
  const { dayStartMs, points } = build24hTideCurve(hTimes, msl, targetMs, phaseShift);
  if (!points.length) return;

  const pad = { top: 24, right: 18, bottom: 28, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const minH = 0.0;
  const maxH = 4.8;
  const xForMin = (minOfDay) => pad.left + (minOfDay / 1440) * plotW;
  const yForH = (h) => pad.top + (1 - (h - minH) / (maxH - minH)) * plotH;

  ctx.clearRect(0, 0, width, height);

  // Bandes nuit (avant lever / après coucher du soleil)
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

  // Bande horizontale de la fenêtre de marée idéale du spot (ex: 0.9m -> 2.8m)
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

    ctx.fillStyle = pal.cursor;
    ctx.font = '600 10px "JetBrains Mono", monospace';
    ctx.fillText(`Zone spot idéale (${opt.min}–${opt.max}m)`, pad.left + 6, yTop + 12);
  }

  // Grille horizontale mètres ZH
  ctx.strokeStyle = pal.grid;
  ctx.lineWidth = 1;
  ctx.fillStyle = pal.muted;
  ctx.font = '11px "JetBrains Mono", monospace';
  for (const hTick of [1, 2, 3, 4]) {
    const y = yForH(hTick);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillText(`${hTick}m`, 8, y + 4);
  }

  // Grille horaire X (00h, 06h, 12h, 18h, 24h)
  for (const hr of [0, 4, 8, 12, 16, 20, 24]) {
    const x = xForMin(hr * 60);
    ctx.fillText(`${String(hr).padStart(2, '0')}h`, x - 10, height - 8);
  }

  // Remplissage sous la courbe de marée
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

  // Ligne de courbe de marée
  ctx.beginPath();
  points.forEach((pt, idx) => {
    const x = xForMin(pt.minuteOfDay);
    const y = yForH(pt.heightZH);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = pal.waterStroke;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Curseur de l'instant sélectionné
  const targetMin = (targetMs - dayStartMs) / 60_000;
  if (targetMin >= 0 && targetMin <= 1440) {
    const cx = xForMin(targetMin);
    const nearest = points.reduce((best, p) =>
      Math.abs(p.minuteOfDay - targetMin) < Math.abs(best.minuteOfDay - targetMin) ? p : best
    );
    const cy = yForH(nearest.heightZH);

    ctx.strokeStyle = pal.cursor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, pad.top);
    ctx.lineTo(cx, pad.top + plotH);
    ctx.stroke();

    ctx.fillStyle = pal.cursor;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();

    const tag = `${formatParisTime(targetMs)} • ${nearest.heightZH.toFixed(2)}m`;
    const tagX = Math.min(width - 118, Math.max(pad.left + 4, cx - 48));
    ctx.fillStyle = pal.text;
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(tag, tagX, pad.top - 7);
  }
}

/**
 * Sparkline 24h d'une bouée houlographe (Hm0 plein + Hmax pointillé).
 */
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

  // Hmax pointillé
  if (history24h.some((d) => d.hmax != null)) {
    ctx.beginPath();
    history24h.forEach((d, i) => {
      const x = xAt(i);
      const y = yAt(d.hmax ?? d.hm0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = pal.hmaxStroke;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Hm0 continu
  ctx.beginPath();
  history24h.forEach((d, i) => {
    const x = xAt(i);
    const y = yAt(d.hm0);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = pal.waterStroke;
  ctx.lineWidth = 2;
  ctx.stroke();
}
