/**
 * Catalogue Exhaustif & Vérifié (`curl` HTTP 200 OK + CORS `*` + absence de X-Frame-Options)
 * des Webcams Surf Live de toute la Côte Sud des Landes (Moliets-et-Maâ -> Tarnos).
 *
 * Contient :
 * - Les flux directs HLS 1080p temps réel (`master.m3u8` sur 3 miroirs CDN Quanteec + fallback `pv.viewsurf.com`)
 * - Les players multi-angles `pv.viewsurf.com` avec deep-link base64 (`?i=...`) pour Moliets, Estagnots, La Nord, Ondres
 * - Le flux MJPEG continu temps réel `stream.digitalmax.fr/lab-plage` pour Labenne-Océan
 * - Les caméras voisines clairement identifiées (`isProxy: true`) pour les plages sauvages sans mât (Messanges, Soustons, Casernes, Culs Nus, La Sud, Tarnos).
 */

function quanteecMirrors(uuid, primaryNode = 'ds1-cache') {
  const secondary = primaryNode === 'ds1-cache' ? 'ds2-cache' : 'ds1-cache';
  return [
    `https://${primaryNode}.quanteec.com/contents/encodings/live/${uuid}/master.m3u8`,
    `https://${secondary}.quanteec.com/contents/encodings/live/${uuid}/master.m3u8`,
    `https://deliverys5.quanteec.com/contents/encodings/live/${uuid}/master.m3u8`,
  ];
}

export const WEBCAMS_BY_SPOT_ID = {
  // 1. MOLIETS-ET-MAÂ
  'moliets-centrale-huchet': [
    {
      id: 'moliets-centrale',
      title: 'Moliets — Plage Centrale',
      angleLabel: 'Plage Centrale',
      provider: 'XL Landes / Viewsurf',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2344/Golf-de-Moliets-Ocean?i=ODE5Njp1bmRlZmluZWQ',
      pageUrl: 'https://www.plages-landes.info/moliets-et-maa/plage-centrale-4/webcam-plage-centrale-moliets/',
      includeInWall: true,
    },
    {
      id: 'moliets-sud-chenes',
      title: 'Moliets — Sud / Chênes-Lièges',
      angleLabel: 'Sud / Chênes-Lièges',
      provider: 'XL Landes / Viewsurf',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2344/Golf-de-Moliets-Ocean?i=ODIwNDp1bmRlZmluZWQ',
      pageUrl: 'https://www.plages-landes.info/moliets-et-maa/plage-centrale-4/webcam-plage-centrale-moliets/',
      includeInWall: false,
    },
    {
      id: 'moliets-nord-huchet',
      title: 'Moliets — Nord (vers Courant d’Huchet)',
      angleLabel: 'Nord / Huchet',
      provider: 'XL Landes / Viewsurf',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2344/Golf-de-Moliets-Ocean?i=ODIwMDp1bmRlZmluZWQ',
      pageUrl: 'https://www.plages-landes.info/moliets-et-maa/plage-centrale-4/webcam-plage-centrale-moliets/',
      includeInWall: false,
    },
  ],

  // 2. MESSANGES (Plage sauvage -> proxy Vieux-Boucau à 3 km Sud + Moliets Sud à 3.5 km Nord)
  'messanges-nord-centrale': [
    {
      id: 'messanges-proxy-vb',
      title: 'Référence Vieux-Boucau Live (3 km Sud)',
      angleLabel: 'Cam Vieux-Boucau (3 km S)',
      provider: 'Quanteec Live 1080p',
      isProxy: true,
      proxyBadge: 'PROXY À 3 KM SUD',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('bff998d4-87d4-448a-3531-3530-6d61-63-9a25-a4bda605e718d', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/vieuxboucau01_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2688/Vieux-Boucau-Quiksilver',
      pageUrl: 'https://www.landesatlantiquesud.com/webcams/messanges/',
      includeInWall: false,
    },
    {
      id: 'messanges-proxy-moliets',
      title: 'Référence Moliets Sud (3.5 km Nord)',
      angleLabel: 'Cam Moliets Sud (3.5 km N)',
      provider: 'Viewsurf',
      isProxy: true,
      proxyBadge: 'PROXY À 3.5 KM NORD',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2344/Golf-de-Moliets-Ocean?i=ODIwNDp1bmRlZmluZWQ',
      pageUrl: 'https://www.plages-landes.info/moliets-et-maa/plage-centrale-4/webcam-plage-centrale-moliets/',
      includeInWall: false,
    },
  ],

  // 3. VIEUX-BOUCAU-LES-BAINS
  'vieux-boucau-nord-estacade': [
    {
      id: 'vieux-boucau-live',
      title: 'Vieux-Boucau — Grand’Plage Live 1080p',
      angleLabel: 'Direct 1080p (HLS)',
      provider: 'Viewsurf / Quiksilver',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('bff998d4-87d4-448a-3531-3530-6d61-63-9a25-a4bda605e718d', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/vieuxboucau01_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2688/Vieux-Boucau-Quiksilver',
      pageUrl: 'https://www.quiksilver.fr/surf-webcams/vieux-boucau-plage.html',
      includeInWall: true,
    },
    {
      id: 'vieux-boucau-player',
      title: 'Vieux-Boucau — Player Viewsurf Complet',
      angleLabel: 'Player + Replay',
      provider: 'Viewsurf',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2688/Vieux-Boucau-Quiksilver',
      pageUrl: 'https://www.quiksilver.fr/surf-webcams/vieux-boucau-plage.html',
      includeInWall: false,
    },
  ],

  // 4. SOUSTONS-PLAGE (1.2 km au Sud immédiat du boucarot de Vieux-Boucau)
  'soustons-plage-la-sauvagine': [
    {
      id: 'soustons-proxy-vb',
      title: 'Vue Boucarot / Vieux-Boucau (1.2 km Nord)',
      angleLabel: 'Cam Vieux-Boucau (1.2 km N)',
      provider: 'Quanteec Live 1080p',
      isProxy: true,
      proxyBadge: 'CAM À 1.2 KM NORD',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('bff998d4-87d4-448a-3531-3530-6d61-63-9a25-a4bda605e718d', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/vieuxboucau01_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2688/Vieux-Boucau-Quiksilver',
      pageUrl: 'https://www.landesatlantiquesud.com/webcams/soustons/',
      includeInWall: false,
    },
  ],

  // 5. SEIGNOSSE — LES CASERNES (Dune sauvage -> proxy Le Penon à 1.5 km Sud)
  'seignosse-les-casernes': [
    {
      id: 'casernes-proxy-penon',
      title: 'Référence Seignosse Le Penon (1.5 km Sud)',
      angleLabel: 'Cam Le Penon (1.5 km S)',
      provider: 'CC-MACS Live 1080p',
      isProxy: true,
      proxyBadge: 'CAM À 1.5 KM SUD',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('0c5055bb-8a96-4c3c-3837-3430-6d61-63-943b-480da283f7bed', 'ds2-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/seignosse02_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2652/Seignosse-Le-Penon',
      pageUrl: 'https://www.plages-landes.info/seignosse/plage-des-casernes/',
      includeInWall: false,
    },
  ],

  // 6. SEIGNOSSE — LE PENON
  'seignosse-le-penon': [
    {
      id: 'seignosse-penon-live',
      title: 'Seignosse — Le Penon Live 1080p',
      angleLabel: 'Direct 1080p (HLS)',
      provider: 'CC-MACS / Viewsurf',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('0c5055bb-8a96-4c3c-3837-3430-6d61-63-943b-480da283f7bed', 'ds2-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/seignosse02_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2652/Seignosse-Le-Penon',
      pageUrl: 'https://www.cc-macs.org/macs-territoire/les-webcams/',
      includeInWall: true,
    },
    {
      id: 'seignosse-penon-player',
      title: 'Seignosse — Le Penon Player MACS',
      angleLabel: 'Player MACS + Timelapse',
      provider: 'CC-MACS',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2652/Seignosse-Le-Penon',
      pageUrl: 'https://www.cc-macs.org/macs-territoire/les-webcams/',
      includeInWall: false,
    },
  ],

  // 7. SEIGNOSSE — LES BOURDAINES
  'seignosse-les-bourdaines': [
    {
      id: 'seignosse-bourdaines-live',
      title: 'Seignosse — Les Bourdaines Live 1080p',
      angleLabel: 'Direct 1080p (HLS)',
      provider: 'Ville de Seignosse',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('8da4aff9-9afb-47ce-3937-3430-6d61-63-b10b-bae5e6dead40d', 'ds2-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/seignosse01_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/1244/Seignosse-Les-Bourdaines?i=NTMwNjo',
      pageUrl: 'https://www.plages-landes.info/seignosse/plage-des-bourdaines/webcam-plage-des-bourdaines-seignosse/',
      includeInWall: true,
    },
    {
      id: 'seignosse-bourdaines-zoom',
      title: 'Seignosse — Bourdaines Cadrage Zoomé',
      angleLabel: 'Zoom Bancs + 5 Vues',
      provider: 'Viewsurf',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/1244/Seignosse-Les-Bourdaines?i=NTMxMDp1bmRlZmluZWQ',
      pageUrl: 'https://viewsurf.com/univers/surf/vue/14334-france-aquitaine-seignosse-live',
      includeInWall: false,
    },
  ],

  // 8. SEIGNOSSE — LES ESTAGNOTS
  'seignosse-les-estagnots': [
    {
      id: 'seignosse-estagnots-zoom',
      title: 'Seignosse — Plage des Estagnots (Cadrage Sud)',
      angleLabel: 'Cadrage Estagnots',
      provider: 'Ville de Seignosse',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2368/Seignosse-Les-Bourdaines',
      posterUrl: 'https://filmspv.viewsurf.com/seignosse01_live/media.jpg',
      pageUrl: 'https://www.plages-landes.info/seignosse/plage-des-estagnots/webcam-plage-des-estagnots-seignosse/',
      includeInWall: true,
    },
    {
      id: 'seignosse-estagnots-hls',
      title: 'Tourelle Bourdaines–Estagnots Live 1080p',
      angleLabel: 'Tourelle Live 1080p (HLS)',
      provider: 'Ville de Seignosse',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('8da4aff9-9afb-47ce-3937-3430-6d61-63-b10b-bae5e6dead40d', 'ds2-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/seignosse01_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2368/Seignosse-Les-Bourdaines',
      pageUrl: 'https://www.plages-landes.info/seignosse/plage-des-estagnots/webcam-plage-des-estagnots-seignosse/',
      includeInWall: false,
    },
  ],

  // 9. HOSSEGOR — LES CULS NUS (Plage naturiste sans caméra -> Gravière à 700 m Sud + Estagnots à 800 m Nord)
  'hossegor-les-culs-nus': [
    {
      id: 'culs-nus-proxy-graviere',
      title: 'Vue adjacente La Gravière Live (700 m Sud)',
      angleLabel: 'Cam Gravière (700m S)',
      provider: 'CC-MACS Live 1080p',
      isProxy: true,
      proxyBadge: 'CAM À 700 M SUD',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('04593c63-5af6-462d-3536-3230-6d61-63-9bbe-827fb3625ccfd', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/hossegor01_live.stream/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2676/Hossegor-La-Graviere',
      pageUrl: 'https://www.hossegor.fr/infos-pratiques/webcam-et-meteo-en-direct',
      includeInWall: false,
    },
    {
      id: 'culs-nus-proxy-estagnots',
      title: 'Vue adjacente Les Estagnots (800 m Nord)',
      angleLabel: 'Cam Estagnots (800m N)',
      provider: 'Viewsurf',
      isProxy: true,
      proxyBadge: 'CAM À 800 M NORD',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2368/Seignosse-Les-Bourdaines',
      pageUrl: 'https://www.plages-landes.info/seignosse/plage-des-estagnots/webcam-plage-des-estagnots-seignosse/',
      includeInWall: false,
    },
  ],

  // 10. HOSSEGOR — LA GRAVIÈRE
  'hossegor-la-graviere': [
    {
      id: 'hossegor-graviere-live',
      title: 'Hossegor — La Gravière Live 1080p',
      angleLabel: 'Direct 1080p (HLS)',
      provider: 'CC-MACS / Quiksilver',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('04593c63-5af6-462d-3536-3230-6d61-63-9bbe-827fb3625ccfd', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/hossegor01_live.stream/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2676/Hossegor-La-Graviere',
      pageUrl: 'https://www.quiksilver.fr/surf-webcams/hossegor.html',
      includeInWall: true,
    },
    {
      id: 'hossegor-graviere-player',
      title: 'Hossegor — Player Officiel MACS',
      angleLabel: 'Player MACS + Timelapse',
      provider: 'CC-MACS',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2646/Hossegor',
      pageUrl: 'https://www.cc-macs.org/macs-territoire/les-webcams/',
      includeInWall: false,
    },
  ],

  // 11. HOSSEGOR — LA NORD / PLAGE CENTRALE
  'hossegor-la-nord': [
    {
      id: 'hossegor-lanord-centrale',
      title: 'Hossegor — La Nord & Plage Centrale',
      angleLabel: 'Pic La Nord / Centrale',
      provider: 'XL Landes / Viewsurf',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2340/Hossegor',
      posterUrl: 'https://filmspv.viewsurf.com/hossegor01_live.stream/media.jpg',
      pageUrl: 'https://www.plages-landes.info/hossegor/plage-centrale-ocean/webcam-plage-centrale-hossegor/',
      includeInWall: true,
    },
    {
      id: 'hossegor-lanord-live-macs',
      title: 'Hossegor — Flux Live 1080p Centrale/Gravière',
      angleLabel: 'Flux Live 1080p (HLS)',
      provider: 'CC-MACS',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('04593c63-5af6-462d-3536-3230-6d61-63-9bbe-827fb3625ccfd', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/hossegor01_live.stream/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2646/Hossegor',
      pageUrl: 'https://www.hossegor.fr/infos-pratiques/webcam-et-meteo-en-direct',
      includeInWall: false,
    },
  ],

  // 12. HOSSEGOR — LA SUD (Face à la passe du Port -> Cam La Passe à 400 m Sud + Centrale à 500 m Nord)
  'hossegor-la-sud': [
    {
      id: 'lasud-proxy-passe',
      title: 'Entrée Passe Capbreton / Zone La Sud (400 m)',
      angleLabel: 'Cam Passe / Chenal (400m)',
      provider: 'CC-MACS Port Live',
      isProxy: true,
      proxyBadge: 'VUE PASSE À 400 M',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('35ccf36d-d766-411f-3233-3130-6d61-63-8262-3b961ae38d74d', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/capbretonport2_live.stream/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/1706/Port-de-Capbreton-la-Passe',
      pageUrl: 'https://www.cc-macs.org/port-de-capbreton/webcams-port-de-capbreton/',
      includeInWall: false,
    },
    {
      id: 'lasud-proxy-centrale',
      title: 'Hossegor Centrale (500 m Nord)',
      angleLabel: 'Cam Centrale (500m N)',
      provider: 'Viewsurf',
      isProxy: true,
      proxyBadge: 'CAM À 500 M NORD',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2340/Hossegor',
      pageUrl: 'https://www.hossegor.fr/infos-pratiques/webcam-et-meteo-en-direct',
      includeInWall: false,
    },
  ],

  // 13. CAPBRETON — NOTRE-DAME / MIRAMAR / ESTACADE
  'capbreton-notre-dame-miramar': [
    {
      id: 'capbreton-passe-estacade',
      title: 'Capbreton — La Passe / Estacade & Notre-Dame Live',
      angleLabel: 'La Passe / Estacade (HLS)',
      provider: 'Port de Capbreton MACS',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('35ccf36d-d766-411f-3233-3130-6d61-63-8262-3b961ae38d74d', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/capbretonport2_live.stream/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/1706/Port-de-Capbreton-la-Passe',
      pageUrl: 'https://www.cc-macs.org/port-de-capbreton/webcams-port-de-capbreton/',
      includeInWall: true,
    },
    {
      id: 'capbreton-port-quai',
      title: 'Capbreton — Capitainerie & Avant-Port Live',
      angleLabel: 'Capitainerie / Avant-Port',
      provider: 'Port de Capbreton MACS',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('c07d6d28-9261-4a9a-3133-3130-6d61-63-b2a8-f33e32959371d', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/capbretonport1_live.stream/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/1490/Capbreton-Port-Quai',
      pageUrl: 'https://www.cc-macs.org/port-de-capbreton/webcams-port-de-capbreton/',
      includeInWall: false,
    },
  ],

  // 14. CAPBRETON — LE SANTOCHA (LA SAVANE)
  'capbreton-le-santocha': [
    {
      id: 'capbreton-santocha-live',
      title: 'Capbreton — Le Santocha / Bunkers Live 1080p',
      angleLabel: 'Direct 1080p (HLS)',
      provider: 'CC-MACS / Quiksilver',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('0c2f35a6-eb76-46ee-3932-3130-6d61-63-9e6e-ec65d58221a1d', 'ds2-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/capbreton02_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2650/Capbreton-Santocha',
      pageUrl: 'https://www.cc-macs.org/macs-territoire/les-webcams/',
      includeInWall: true,
    },
    {
      id: 'capbreton-santocha-timelapse',
      title: 'Capbreton — Santocha Player + Timelapse',
      angleLabel: 'Player + Timelapse',
      provider: 'CC-MACS',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2534/Capbreton-Santocha',
      pageUrl: 'https://www.landesatlantiquesud.com/webcams/capbreton/',
      includeInWall: false,
    },
  ],

  // 15. CAPBRETON — LE PRÉVENT
  'capbreton-le-prevent': [
    {
      id: 'capbreton-prevent-live',
      title: 'Capbreton — Plage du Prévent Live 1080p',
      angleLabel: 'Direct 1080p (HLS)',
      provider: 'CC-MACS / Quiksilver',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('c2e5b4bd-c7be-413f-3832-3130-6d61-63-9268-057378aad627d', 'ds1-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/capbreton01_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2648/Capbreton-Plage-du-Prevent',
      pageUrl: 'https://www.quiksilver.fr/surf-webcams/capbreton-prevent.html',
      includeInWall: true,
    },
    {
      id: 'capbreton-prevent-timelapse',
      title: 'Capbreton — Le Prévent Player + Timelapse',
      angleLabel: 'Player + Timelapse',
      provider: 'CC-MACS',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/2536/Capbreton-Plage-du-Prevent',
      pageUrl: 'https://www.landesatlantiquesud.com/webcams/capbreton/',
      includeInWall: false,
    },
  ],

  // 16. CAPBRETON — LA PISTE / VVF (Caméra Océanides / Jonction Santocha–La Piste)
  'capbreton-la-piste-vvf': [
    {
      id: 'capbreton-piste-oceanides',
      title: 'Capbreton — Océanides / Jonction Santocha–La Piste',
      angleLabel: 'Océanides / Bunkers (HLS)',
      provider: 'CC-MACS Live 1080p',
      isProxy: true,
      proxyBadge: 'CAM JONCTION BUNKERS',
      type: 'hls_m3u8',
      streamMirrors: quanteecMirrors('0c2f35a6-eb76-46ee-3932-3130-6d61-63-9e6e-ec65d58221a1d', 'ds2-cache'),
      posterUrl: 'https://filmspv.viewsurf.com/capbreton02_live/media.jpg',
      fallbackEmbedUrl: 'https://pv.viewsurf.com/2650/Capbreton-Santocha',
      pageUrl: 'https://gosurf.fr/webcam/fr/83/Capbreton-Plage-du-Santosha-de-La-Piste',
      includeInWall: false,
    },
  ],

  // 17. LABENNE-OCÉAN (Flux MJPEG Temps Réel DigitalMax !)
  'labenne-ocean-centrale-chapelle': [
    {
      id: 'labenne-ocean-mjpeg',
      title: 'Labenne-Océan — Plage Centrale Live MJPEG',
      angleLabel: 'Direct Vidéo MJPEG',
      provider: 'Mairie de Labenne / DigitalMax',
      type: 'mjpeg_stream',
      imageUrl: 'https://stream.digitalmax.fr/lab-plage',
      fallbackEmbedUrl: 'https://stream.digitalmax.fr/lab-plage',
      pageUrl: 'https://www.landesatlantiquesud.com/webcams/labenne/',
      includeInWall: true,
    },
  ],

  // 18. ONDRES-PLAGE (Viewsurf 4K-HD avec deep-link direct sur la Vidéo !)
  'ondres-plage': [
    {
      id: 'ondres-ocean-video',
      title: 'Ondres-Océan — Vidéo Plage 4K-HD',
      angleLabel: 'Vidéo Plage HD',
      provider: 'Mairie d’Ondres / Seignanx',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/722/Ondres?i=Mzk5Mjp1bmRlZmluZWQ',
      pageUrl: 'https://www.ondres.fr/la-plage/webcam/',
      includeInWall: true,
    },
    {
      id: 'ondres-ocean-pano4k',
      title: 'Ondres-Océan — Panoramique 4K',
      angleLabel: 'Panoramique 4K',
      provider: 'Mairie d’Ondres / Seignanx',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/722/Ondres',
      pageUrl: 'https://www.seignanx.com/webcam/',
      includeInWall: false,
    },
  ],

  // 19. TARNOS — LE MÉTRO / LA DIGUE NORD (Proxy Ondres à 1.6 km du Métro + Anglet La Barre juste en face de la Digue !)
  'tarnos-metro-la-digue': [
    {
      id: 'tarnos-proxy-ondres',
      title: 'Vue Banc du Métro via Ondres-Océan (1.6 km Nord)',
      angleLabel: 'Cam Ondres / Métro (1.6 km N)',
      provider: 'Seignanx / Viewsurf',
      isProxy: true,
      proxyBadge: 'CAM À 1.6 KM DU MÉTRO',
      type: 'iframe_embed',
      embedUrl: 'https://pv.viewsurf.com/722/Ondres?i=Mzk5Mjp1bmRlZmluZWQ',
      pageUrl: 'https://www.seignanx.com/webcam/',
      includeInWall: false,
    },
    {
      id: 'tarnos-embouchure-adour-barre',
      title: 'Embouchure Adour — Vue face Digue (Anglet La Barre)',
      angleLabel: 'Face Digue / Embouchure Adour',
      provider: 'Viewsurf Anglet',
      isProxy: true,
      proxyBadge: 'RIVE SUD ADOUR FACE DIGUE',
      type: 'live_image',
      imageUrl: 'https://films.viewsurf.com/anglet02_1_1.stream/media.jpg',
      pageUrl: 'https://gosurf.fr/webcam/fr/150/Anglet-Plage-de-la-Barre',
      includeInWall: true,
    },
  ],
};

/**
 * Retourne la liste dédupliquée des caméras physiques uniques du Nord au Sud
 * pour le Mur Vidéo Live (évite d'afficher 2 fois le même flux proxy sur le mur).
 */
export function getAllCoastalWebcams(spots) {
  const ordered = [...spots].sort((a, b) => a.northToSouthRank - b.northToSouthRank);
  const result = [];
  for (const spot of ordered) {
    (spot.webcams || []).forEach((cam, camIndex) => {
      if (cam.includeInWall) {
        result.push({ spot, cam, camIndex });
      }
    });
  }
  return result;
}
