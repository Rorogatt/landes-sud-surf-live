/**
 * Lecteur Universel Multi-Protocole de Webcams Surf Live (Côte Sud des Landes) :
 * - `hls_m3u8`      : Flux vidéo 1080p temps réel Quanteec/Viewsurf via HLS.js (multi-miroirs auto-failover + fallback iframe)
 * - `mjpeg_stream`  : Flux vidéo MJPEG continu temps réel (Labenne DigitalMax `multipart/x-mixed-replace`)
 * - `iframe_embed`  : Players `pv.viewsurf.com` vérifiés sans blocage X-Frame-Options / CSP (avec deep-link d'angle `?i=...`)
 * - `live_image`    : Snapshots HD temps réel auto-rafraîchis toutes les 30s (`filmspv.viewsurf.com` CORS *)
 */

const activeHlsInstances = new WeakMap();
const activeImageTimers = new WeakMap();

export function destroyWebcamInside(container) {
  if (!container) return;
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
  // Coupe proprement tout flux MJPEG continu lors d'un changement de vue
  container.querySelectorAll('img[data-mjpeg]').forEach((img) => {
    img.src = '';
  });
}

function attachHlsWithMirrorFailover(videoEl, urls, onAllFailed) {
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
        lowLatencyMode: true,
        maxBufferLength: 18,
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
 * Monte un lecteur webcam complet (avec sélecteur multi-angles et bascule HLS / Player complet)
 * dans `mountEl`.
 */
export function mountSpotWebcamPlayer(mountEl, spot, { activeCamIndex = 0, compact = false, onCamChange } = {}) {
  if (!mountEl) return;
  destroyWebcamInside(mountEl);

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
    hls_m3u8: 'DIRECT 1080P (HLS)',
    mjpeg_stream: 'DIRECT VIDÉO MJPEG',
    iframe_embed: 'PLAYER VIEWSURF HD',
    live_image: 'CAPTURE LIVE HD',
  };

  const badgeText = cam.isProxy
    ? `${cam.proxyBadge || 'CAM PROCHE'} · ${typeLabelMap[cam.type] || 'LIVE'}`
    : `${typeLabelMap[cam.type] || 'LIVE'} · ${cam.provider || 'Côte Sud'}`;

  const dotColor = cam.isProxy ? '#de9e36' : '#3dd68c';

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
            ? `<a href="${cam.pageUrl}" target="_blank" rel="noopener noreferrer" class="mono" style="font-size:0.72rem;">Source officielle ↗</a>`
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
          <button type="button" class="cam-badge-live" data-fullscreen-btn title="Plein écran" style="cursor:pointer;">
            ⛶ Plein écran
          </button>
        </div>
        <div data-media-slot style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;"></div>
      </div>
      ${switcherHtml}
    </div>
  `;

  const slot = mountEl.querySelector('[data-media-slot]');
  const viewport = mountEl.querySelector('[data-viewport]');

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
      ? `<img src="${cam.posterUrl}" alt="${cam.title}" style="position:absolute;inset:0;opacity:0.32;" loading="lazy" />`
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

  if (cam.type === 'hls_m3u8') {
    const mirrors = cam.streamMirrors?.length ? cam.streamMirrors : cam.streamUrl ? [cam.streamUrl] : [];
    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.controls = true;
    if (cam.posterUrl) video.poster = cam.posterUrl;
    slot.appendChild(video);

    attachHlsWithMirrorFailover(video, mirrors, () => {
      if (cam.fallbackEmbedUrl) {
        renderIframe(cam.fallbackEmbedUrl);
      } else {
        renderFallback('Flux HLS indisponible.');
      }
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

  mountEl.querySelectorAll('[data-cam-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextIdx = Number(btn.getAttribute('data-cam-idx'));
      onCamChange?.(nextIdx);
      mountSpotWebcamPlayer(mountEl, spot, { activeCamIndex: nextIdx, compact, onCamChange });
    });
  });

  const fsBtn = mountEl.querySelector('[data-fullscreen-btn]');
  fsBtn?.addEventListener('click', () => {
    if (viewport?.requestFullscreen) {
      viewport.requestFullscreen().catch(() => {});
    }
  });
}
