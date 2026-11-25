# Sud Landes Surf Live (Moliets → Hossegor / Capbreton → Tarnos)

Observatoire surf temps réel et zéro-clé-API couvrant **l'intégralité des 19 spots de la Côte Sud des Landes (40)** sur 38,5 km de littoral, de l'embouchure du **Courant d'Huchet (Moliets-et-Maâ)** jusqu'à la **Digue Nord de l'Adour (Tarnos)**.

Conçu pour éviter d'ouvrir 12 onglets différents le matin avant d'aller à l'eau : **webcams en direct multi-angles, monde au pic, houle réfractée par le Gouf de Capbreton, vent Météo-France AROME 1.5 km, courbe des marées & coefficients SHOM et bouées houlographes** réunis sur une seule interface.

---

## Fonctionnalités Clés

### 1. Webcams en Direct & Mur de Surveillance Multi-Cams
- **Flux directs HLS `.m3u8` 1080p temps réel** (avec bascule automatique sur 3 miroirs CDN Quanteec + fallback player `pv.viewsurf.com`) pour **Vieux-Boucau**, **Seignosse Le Penon**, **Seignosse Les Bourdaines**, **Hossegor La Gravière**, **Capbreton La Passe / Estacade**, **Capbreton Le Prévent** et **Capbreton Le Santocha**.
- **Flux MJPEG temps réel continu** pour **Labenne-Océan** (`DigitalMax`).
- **Players multi-vues haute définition** avec deep-links d'angles (`?i=...`) pour **Moliets (Centrale, Sud Chênes-Lièges, Nord Huchet)**, **Seignosse Les Estagnots**, **Hossegor La Nord / Centrale** et **Ondres-Océan 4K-HD**.
- **Proxies transparents** clairement signalés pour les bancs sauvages sans mât caméra (*Messanges, Soustons-Plage, Les Casernes, Les Culs Nus, La Sud, Tarnos Métro & Digue*).
- **Mur Vidéo Live** : mosaïque fluide, 2×2 grand format ou 3×3 filtrable par secteur côtier.

### 2. Modèle Physique du Gouf de Capbreton (Snell-Descartes)
Intègre l'effet bathymétrique réel du canyon sous-marin de **-2 150 m** dont la tête arrive à 300 m de l'Estacade :
- **Zone d'ombre & repli (`×0.50` à `×0.65`)** : *Hossegor La Sud*, *Capbreton Notre-Dame / Miramar*, *Capbreton Le Prévent*.
- **Convergence Épaule Nord (`×1.15` à `×1.40`)** : *La Nord* (jusqu'à 6 m+), *La Gravière*, *Les Culs Nus*, *Les Estagnots*.
- **Convergence Épaule Sud (`×1.15` à `×1.30`)** : *Le Santocha*, *La Piste / VVF*.

### 3. Télémétrie Océanographique, Marées SHOM & Bouées Physiques
- **Houle & Énergie (`kJ`)** : Houle primaire (`Hs`, période de pic réelle `Tp`, direction), houle secondaire, mer du vent, courants côtiers et température de l'eau (`SST`).
- **Vent Météo-France AROME HD 1.5 km** : Vitesse, rafales et qualification automatique spot par spot selon l'azimut exact de chaque plage (*Glassy*, *Pur Offshore*, *Cross-Off*, *Abrité du Nord par l'Estacade*, *Abrité du Sud par la Digue de Tarnos*, *Onshore*).
- **Marées & Coefficients Français (20–120)** : Calibration de phase (`+38 min` Capbreton/Hossegor, `+32 min` Tarnos/Boucau, `+42 min` Vieux-Boucau/Moliets) et conversion Zéro Hydrographique (`+2.38 m`) avec superposition de la **fenêtre de marée optimale propre à chaque banc de sable**.
- **4 Bouées Houlographes Temps Réel (`CORS *`)** :
  - *Bilbao-Vizcaya 600 m* (`43.63°N`, latitude exacte d'Hossegor — sentinelle ~1h45 avant impact)
  - *Donostia ERDDAP* (`43.57°N, -2.00°W`)
  - *Pasaia II Côtière* (`38 km` de Tarnos)
  - *Gascogne WMO 62001* (sentinelle grand large Golfe de Gascogne)

### 4. Estimation du Monde à l'Eau & Radar des Meilleurs Créneaux 48h
- **Modèle d'affluence temps réel** calé sur `Europe/Paris` croisant saisonnalité locale, courbe horaire (*Dawn Patrol*, écoles, creux méridien, *Afterwork / Glass-off*), week-ends, qualité des vagues, effet entonnoir sur les replis par houle `> 2.6 m` et **signalement collaboratif en 1 clic**.
- **Time-Travel 168h (7 jours)** : Curseur horaire permettant de projeter toute la carte, les 19 notes `/10` et les marées à demain 08h00 ou ce week-end.
- **Comparateur Face-à-Face (3 spots)** & **Recommandation Néoprène / Wax / Planche**.

---

## Les 19 Spots Couverts (Nord → Sud)

1. **Moliets-et-Maâ** — Plage Centrale & Courant d'Huchet
2. **Messanges** — Plage Nord / Centrale
3. **Vieux-Boucau-les-Bains** — Grand'Plage / Sablères / Estacade
4. **Soustons-Plage** — Plage de l'Océan (La Sauvagine)
5. **Seignosse** — Les Casernes
6. **Seignosse** — Le Penon
7. **Seignosse** — Les Bourdaines
8. **Seignosse** — Les Estagnots
9. **Soorts-Hossegor** — Les Culs Nus
10. **Soorts-Hossegor** — La Gravière
11. **Soorts-Hossegor** — La Nord
12. **Soorts-Hossegor** — La Sud
13. **Capbreton** — Notre-Dame / Miramar / Estacade
14. **Capbreton** — Le Prévent *(géographiquement au Nord du Santocha)*
15. **Capbreton** — Le Santocha (La Savane / Bunkers)
16. **Capbreton** — La Piste / VVF (Les Océanides)
17. **Labenne-Océan** — Plage Centrale / Chapelle
18. **Ondres** — Ondres-Plage
19. **Tarnos** — Le Métro / La Digue Nord (Embouchure Adour)

---

## Lancement Local

Aucune clé API ni étape de compilation requise (ES Modules natifs + HTML5/CSS3) :

```bash
npm run dev
# Ouvre http://localhost:4173
```

---

## Structure du Projet

```text
├── index.html                  # Shell sémantique multi-vues (Radar, Mur Vidéo, Créneaux 48h, Bouées)
├── css/index.css               # Design System éditorial & océanographique (Thèmes Sombre & Clair)
├── vendor/hls.min.js           # Décodeur HLS natif pour les flux .m3u8 1080p
└── js/
    ├── app.js                  # Contrôleur réactif, filtres, Time-Travel 168h & comparateur
    ├── data/
    │   ├── spotsBase.js        # Base encyclopédique des 19 spots + physique du Gouf
    │   └── webcams.js          # Catalogue vérifié des flux HLS, MJPEG et players Viewsurf
    ├── services/
    │   ├── oceanApi.js         # Batching Open-Meteo Marine + Météo-France AROME HD 1.5 km
    │   ├── tides.js            # Moteur de marées SHOM Capbreton (+38 min) & coefficients (20..120)
    │   ├── buoys.js            # Client bouées temps réel (Portus & AZTI/EUSKOOS ERDDAP)
    │   ├── scoring.js          # Scoring physique /10, abris de vent, affluence & équipement
    │   └── time.js             # Calculs horaires strictement ancrés sur Europe/Paris
    └── components/
        ├── coastMap.js         # Carte SVG interactive Côte Sud Landes & isobathes du Gouf
        ├── webcamPlayer.js     # Lecteur multi-protocole (HLS multi-miroir, MJPEG, Iframe, Snapshot)
        └── charts.js           # Graphiques Canvas HiDPI (Courbe marée 24h + Sparklines bouées)
```
