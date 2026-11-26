/**
 * Lecteur Universel Multi-Protocole de Webcams Surf Live v2 :
 * - Loupe Interactive "Check Line-up" (`1×`, `2×`, `3×`, `4×` + Drag Pan souris/doigt) pour compter les têtes au pic !
 * - Bouton Picture-in-Picture (`PiP`) natif sur les flux vidéo HLS
 * - Badge contextuel Nuit (`🌙 Nuit sur la côte · First light HHhMM`) pour éviter l'effet "boîte noire"
 * - Architecture Mur Vidéo Éco-4G :
 *   - `IntersectionObserver` + Plafond strict `MAX_CONCURRENT_WALL_STREAMS = 4` (zéro crash décodeur 4K mobile)
 *   - `capLevelToPlayerSize: true` dans HLS.js pour adapter la résolution (720p/1080p vs 4K) à la taille réelle du cadre
 *   - Mode Aperçu HD intelligent (`wallEcoPreview`) en 4G faible / `saveData` avec lancement 1-clic
 *   - Mise en veille automatique sur `visibilitychange` quand l'onglet passe en arrière-plan.
 */

const activeHlsInstances = new WeakMap();
const activeImageTimers = new WeakMap();
const wallVisibilityObservers = new WeakMap();

const MAX_CONCURRENT_WALL_STREAMS = 4;
const activeWallMounts = []; // File FIFO des lecteurs actifs sur le Mur Vidéo

function evictOldestWallStreamIfNeeded() {
  while (activeWallMounts.length >= MAX_CONCURRENT_WALL_STREAMS) {
    const oldest = activeWallMounts.shift();
    if (oldest && document.body.contains(oldest.mountEl)) {
      oldest.downgradeToPreview?.();
    }
  }
}

function removeFromActiveWallPool(mountEl) {
  const idx = activeWallMounts.findIndex((item) => item.mountEl === mountEl);
  if (idx >= 0) activeWallMounts.splice(idx, 1);
}

export function isLowBandwidthConnection() {
  const conn = typeof navigator !== 'undefined' ? navigator.connection : null;
  if (!conn) return false;
  return Boolean(conn.saveData || /^(slow-2g|2g|3g)$/.test(conn.effectiveType || ''));
}

export function destroyWebcamInside(container) {
  if (!container) return;
  const obs = wallVisibilityObservers.get(container);
  if (obs) {
    obs.disconnect();
    wallVisibilityObservers.delete(container);
  }
  removeFromActiveWallPool(container);

  container.querySelectorAll('[data-wall-card-mount]').forEach((sub) => {
    const subObs = wallVisibilityObservers.get(sub);
    if (subObs) {
      subObs.disconnect();
      wallVisibilityObservers.delete(sub);
    }
    removeFromActiveWallPool(sub);
  });

  container.querySelectorAll('video').forEach((video) => {
    const hls = activeHlsInstances.get(video);
    if (hls) {
      hls.destroy();
      activeHlsInstances.delete(video);
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
  });
  container.querySelectorAll('img[data-live-refresh]').forEach((img) => {
    const timer = activeImageTimers.get(img);
    if (timer) {
      clearInterval(timer);
      activeImageTimers.delete(img);
    }
  });
  container.querySelectorAll('img[data-mjpeg]').forEach((img) => {
    img.src = '';
  });
}

// Pause économique automatique quand l'onglet est masqué
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    document.querySelectorAll('.webcam-viewport video').forEach((v) => {
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    });
    document.querySelectorAll('.webcam-viewport img[data-mjpeg]').forEach((img) => {
      if (document.hidden) {
        if (img.src) img.dataset.savedSrc = img.src;
        img.src = '';
      } else if (img.dataset.savedSrc) {
        img.src = img.dataset.savedSrc;
      }
    });
  });
}

function attachHlsWithMirrorFailover(videoEl, urls, compact, onAllFailed) {
  if (!videoEl || !urls.length) {
    onAllFailed?.();
    return;
  }

  let mirrorIdx = 0;

  const tryCurrentMirror = () => {
    const currentUrl = urls[mirrorIdx];
    const prev = activeHlsInstances.get(videoEl);
    if (prev) {
      prev.destroy();
      activeHlsInstances.delete(videoEl);
    }

    if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: !compact,
        capLevelToPlayerSize: true, // Évite de décoder du 3840x2160 4K dans une vignette de 380px !
        maxBufferLength: compact ? 8 : 16,
        maxMaxBufferLength: compact ? 15 : 30,
      });
      activeHlsInstances.set(videoEl, hls);
      hls.loadSource(currentUrl);
      hls.attachMedia(videoEl);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        videoEl.play().catch(() => {});
      });
      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          hls.destroy();
          activeHlsInstances.delete(videoEl);
          mirrorIdx += 1;
          if (mirrorIdx < urls.length) {
            tryCurrentMirror();
          } else {
            onAllFailed?.();
          }
        }
      });
      return;
    }

    if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = currentUrl;
      videoEl.onloadedmetadata = () => videoEl.play().catch(() => {});
      videoEl.onerror = () => {
        mirrorIdx += 1;
        if (mirrorIdx < urls.length) tryCurrentMirror();
        else onAllFailed?.();
      };
      return;
    }

    onAllFailed?.();
  };

  tryCurrentMirror();
}

/**
 * Active la Loupe Line-up interactive (`1×`, `2×`, `3×`, `4×` + Drag Pan souris/tactile)
 * sur le conteneur média `[data-media-slot]`.
 */
function setupLineupZoomAndPan(mountEl, mediaSlot) {
  if (!mediaSlot) return;
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let dragging = false;
  let startX = 0;
  let startY = 0;

  const applyTransform = () => {
    const maxOffset = (scale - 1) * 140;
    panX = Math.max(-maxOffset, Math.min(maxOffset, panX));
    panY = Math.max(-maxOffset, Math.min(maxOffset, panY));
    mediaSlot.style.transform = scale === 1 ? 'scale(1)' : `scale(${scale}) translate(${(panX / scale).toFixed(1)}px, ${(panY / scale).toFixed(1)}px)`;
    mediaSlot.style.cursor = scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default';
  };

  mountEl.querySelectorAll('[data-zoom]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      scale = Number(btn.getAttribute('data-zoom') || 1);
      if (scale === 1) {
        panX = 0;
        panY = 0;
      }
      mountEl.querySelectorAll('[data-zoom]').forEach((b) => {
        b.classList.toggle('is-active', Number(b.getAttribute('data-zoom')) === scale);
      });
      applyTransform();
    });
  });

  mediaSlot.addEventListener('pointerdown', (e) => {
    if (scale <= 1) return;
    dragging = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
    mediaSlot.setPointerCapture?.(e.pointerId);
    applyTransform();
  });

  mediaSlot.addEventListener('pointermove', (e) => {
    if (!dragging || scale <= 1) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    applyTransform();
  });

  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    applyTransform();
  };
  mediaSlot.addEventListener('pointerup', endDrag);
  mediaSlot.addEventListener('pointercancel', endDrag);
}

/**
 * Monte un lecteur webcam complet (Inspecteur ou Mur Vidéo Éco-4G).
 */
export function mountSpotWebcamPlayer(
  mountEl,
  spot,
  {
    activeCamIndex = 0,
    compact = false,
    wallMode = false,
    ecoMode = false,
    isNight = false,
    firstLightText = '',
    onCamChange,
  } = {}
) {
  if (!mountEl) return;
  destroyWebcamInside(mountEl);
  if (wallMode) mountEl.setAttribute('data-wall-card-mount', 'true');

  const cams = spot.webcams || [];
  if (!cams.length) {
    mountEl.innerHTML = `
      <div class="webcam-stage">
        <div class="webcam-viewport">
          <div class="webcam-fallback-box">
            <h4>Banc naturel sans caméra fixe</h4>
            <p>${spot.shortName} ne dispose pas de mât vidéo en front de dune.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  const safeIdx = Math.min(Math.max(0, activeCamIndex), cams.length - 1);
  const cam = cams[safeIdx];

  const typeLabelMap = {
    hls_m3u8: 'DIRECT HD (HLS)',
    mjpeg_stream: 'DIRECT MJPEG',
    iframe_embed: 'PLAYER VIEWSURF',
    live_image: 'CAPTURE LIVE HD',
  };

  const badgeText = cam.isProxy
    ? `${cam.proxyBadge || 'CAM PROCHE'} · ${typeLabelMap[cam.type] || 'LIVE'}`
    : `${typeLabelMap[cam.type] || 'LIVE'} · ${cam.provider || 'Côte Sud'}`;

  const dotColor = cam.isProxy ? '#de9e36' : '#3dd68c';

  const nightBannerHtml = isNight
    ? `<div class="webcam-night-pill">🌙 Nuit sur la côte${firstLightText ? ` · Aube ${firstLightText}` : ''}</div>`
    : '';

  const zoomControlsHtml =
    !compact && (cam.type === 'hls_m3u8' || cam.type === 'mjpeg_stream' || cam.type === 'live_image')
      ? `
      <div class="webcam-zoom-controls" aria-label="Loupe de zoom sur le line-up">
        <span class="mono" style="font-size:0.66rem;opacity:0.8;padding:0 3px;">Loupe</span>
        <button type="button" class="zoom-step-btn is-active" data-zoom="1">1×</button>
        <button type="button" class="zoom-step-btn" data-zoom="2">2×</button>
        <button type="button" class="zoom-step-btn" data-zoom="3">3×</button>
        <button type="button" class="zoom-step-btn" data-zoom="4">4×</button>
      </div>
    `
      : '';

  const pipBtnHtml =
    !compact && cam.type === 'hls_m3u8' && typeof document !== 'undefined' && document.pictureInPictureEnabled
      ? `<button type="button" class="cam-badge-live" data-pip-btn title="Mode Picture-in-Picture flottant" style="cursor:pointer;">⧉ PiP</button>`
      : '';

  const switcherHtml =
    !compact && (cams.length > 1 || cam.pageUrl)
      ? `
      <div class="cam-switcher-bar">
        <div class="cam-angle-tabs">
          ${cams
            .map(
              (c, idx) => `
              <button type="button" class="cam-angle-btn ${idx === safeIdx ? 'is-active' : ''}" data-cam-idx="${idx}">
                ${c.angleLabel || c.title}
              </button>
            `
            )
            .join('')}
        </div>
        ${
          cam.pageUrl
            ? `<a href="${cam.pageUrl}" target="_blank" rel="noopener noreferrer" class="mono" style="font-size:0.72rem;white-space:nowrap;">Source officielle ↗</a>`
            : ''
        }
      </div>
    `
      : '';

  mountEl.innerHTML = `
    <div class="webcam-stage">
      <div class="webcam-viewport" data-viewport>
        <div class="webcam-overlay-top">
          <span class="cam-badge-live">
            <span class="live-dot" style="color:${dotColor}"></span>
            ${badgeText}
          </span>
          <div style="display:flex;gap:0.35rem;pointer-events:auto;">
            ${pipBtnHtml}
            <button type="button" class="cam-badge-live" data-fullscreen-btn title="Plein écran" style="cursor:pointer;">
              ⛶
            </button>
          </div>
        </div>
        ${nightBannerHtml}
        ${zoomControlsHtml}
        <div data-media-slot style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;transition:transform 120ms ease-out;transform-origin:center 44%;"></div>
      </div>
      ${switcherHtml}
    </div>
  `;

  const slot = mountEl.querySelector('[data-media-slot]');
  const viewport = mountEl.querySelector('[data-viewport]');
  setupLineupZoomAndPan(mountEl, slot);

  const renderIframe = (embedUrl) => {
    slot.innerHTML = `
      <iframe
        src="${embedUrl}"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
        title="${cam.title}">
      </iframe>
    `;
  };

  const renderFallback = (reasonText = '') => {
    if (!slot) return;
    const posterHtml = cam.posterUrl
      ? `<img src="${cam.posterUrl}" alt="${cam.title}" style="position:absolute;inset:0;opacity:0.35;" loading="lazy" />`
      : '';
    slot.innerHTML = `
      ${posterHtml}
      <div class="webcam-fallback-box" style="position:relative;z-index:2;">
        <h4>${cam.title}</h4>
        <p>${reasonText || cam.note || 'Flux vidéo momentanément en maintenance.'}</p>
        ${
          cam.pageUrl
            ? `<a href="${cam.pageUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary">Ouvrir la webcam officielle ↗</a>`
            : ''
        }
      </div>
    `;
  };

  const startLiveStream = () => {
    if (!slot) return;
    slot.innerHTML = '';

    if (wallMode) {
      removeFromActiveWallPool(mountEl);
      evictOldestWallStreamIfNeeded();
      activeWallMounts.push({ mountEl, downgradeToPreview: renderEcoPreviewCard });
    }

    if (cam.type === 'hls_m3u8') {
      const mirrors = cam.streamMirrors?.length ? cam.streamMirrors : cam.streamUrl ? [cam.streamUrl] : [];
      const video = document.createElement('video');
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.controls = true;
      if (cam.posterUrl) video.poster = cam.posterUrl;
      slot.appendChild(video);

      attachHlsWithMirrorFailover(video, mirrors, compact, () => {
        if (cam.fallbackEmbedUrl) renderIframe(cam.fallbackEmbedUrl);
        else renderFallback('Flux HLS indisponible.');
      });
    } else if (cam.type === 'mjpeg_stream' && cam.imageUrl) {
      const img = document.createElement('img');
      img.alt = cam.title;
      img.setAttribute('data-mjpeg', 'true');
      img.src = cam.imageUrl;
      img.addEventListener('error', () => {
        if (cam.fallbackEmbedUrl) renderIframe(cam.fallbackEmbedUrl);
        else renderFallback('Flux MJPEG Labenne momentanément hors-ligne.');
      });
      slot.appendChild(img);
    } else if (cam.type === 'iframe_embed' && cam.embedUrl) {
      renderIframe(cam.embedUrl);
    } else if (cam.type === 'live_image' && cam.imageUrl) {
      const img = document.createElement('img');
      img.alt = cam.title;
      img.setAttribute('data-live-refresh', 'true');
      const buildUrl = () => {
        const sep = cam.imageUrl.includes('?') ? '&' : '?';
        return `${cam.imageUrl}${sep}_t=${Math.floor(Date.now() / 30000)}`;
      };
      img.src = buildUrl();
      img.addEventListener('error', () => {
        const t = activeImageTimers.get(img);
        if (t) clearInterval(t);
        if (cam.fallbackEmbedUrl) renderIframe(cam.fallbackEmbedUrl);
        else renderFallback('Capture live momentanément indisponible.');
      });
      slot.appendChild(img);

      const timer = setInterval(() => {
        if (!document.body.contains(img)) {
          clearInterval(timer);
          return;
        }
        img.src = buildUrl();
      }, 30_000);
      activeImageTimers.set(img, timer);
    } else {
      renderFallback();
    }
  };

  function renderEcoPreviewCard() {
    if (!slot) return;
    // Coupe tout flux actif dans ce slot avant d'afficher la miniature HD légère
    slot.querySelectorAll('video').forEach((v) => {
      const h = activeHlsInstances.get(v);
      if (h) {
        h.destroy();
        activeHlsInstances.delete(v);
      }
      v.pause();
      v.removeAttribute('src');
      v.load();
    });
    slot.querySelectorAll('img[data-mjpeg]').forEach((im) => {
      im.src = '';
    });

    const previewImg = cam.posterUrl || (cam.type === 'live_image' ? cam.imageUrl : null);
    const previewSep = previewImg && previewImg.includes('?') ? '&' : '?';
    slot.innerHTML = `
      ${
        previewImg
          ? `<img src="${previewImg}${previewSep}_p=${Math.floor(Date.now() / 60000)}" alt="${cam.title}" loading="lazy" style="position:absolute;inset:0;opacity:0.68;" />`
          : `<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 40%, #162938, #070d12);"></div>`
      }
      <button type="button" class="wall-play-overlay-btn" data-start-wall-stream>
        <span style="font-size:1.05rem;">▶</span> Lancer le Direct HD
      </button>
    `;
    slot.querySelector('[data-start-wall-stream]')?.addEventListener('click', () => {
      startLiveStream();
    });
  }

  // Logique intelligente Mur Vidéo vs Inspecteur
  if (wallMode) {
    if (ecoMode || isLowBandwidthConnection()) {
      renderEcoPreviewCard();
    } else if (typeof IntersectionObserver !== 'undefined') {
      renderEcoPreviewCard();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && activeWallMounts.length < MAX_CONCURRENT_WALL_STREAMS) {
              startLiveStream();
            } else if (!entry.isIntersecting && activeWallMounts.some((x) => x.mountEl === mountEl)) {
              removeFromActiveWallPool(mountEl);
              renderEcoPreviewCard();
            }
          }
        },
        { threshold: 0.4 }
      );
      observer.observe(mountEl);
      wallVisibilityObservers.set(mountEl, observer);
    } else {
      startLiveStream();
    }
  } else {
    startLiveStream();
  }

  mountEl.querySelectorAll('[data-cam-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextIdx = Number(btn.getAttribute('data-cam-idx'));
      onCamChange?.(nextIdx);
      mountSpotWebcamPlayer(mountEl, spot, {
        activeCamIndex: nextIdx,
        compact,
        wallMode,
        ecoMode,
        isNight,
        firstLightText,
        onCamChange,
      });
    });
  });

  mountEl.querySelector('[data-fullscreen-btn]')?.addEventListener('click', () => {
    if (viewport?.requestFullscreen) {
      viewport.requestFullscreen().catch(() => {});
    }
  });

  mountEl.querySelector('[data-pip-btn]')?.addEventListener('click', () => {
    const vid = slot?.querySelector('video');
    if (vid?.requestPictureInPicture) {
      vid.requestPictureInPicture().catch(() => {});
    }
  });
}
