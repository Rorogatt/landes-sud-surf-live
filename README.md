# Sud Landes Surf Live v2 (Moliets → Hossegor / Capbreton → Tarnos)

Observatoire surf temps réel, mobile-first et hors-ligne (PWA) couvrant **l'intégralité des 19 spots de la Côte Sud des Landes (40)** sur 38,5 km de littoral, de l'embouchure du **Courant d'Huchet (Moliets-et-Maâ)** jusqu'à la **Digue Nord de l'Adour (Tarnos)**.

---

## Nouveautés Majeures v2 (Auditées par Jury Multi-Agents)

### 1. Scoring Personnalisé par Niveau & Agent "Coach Surf Local"
- **4 Profils Surfeur (`Débutant · Intermédiaire · Confirmé · Chargeur`)** : recalibre en direct les notes `/10`, les plafonds de sécurité (ex: un `2.2 m @ 15s` creux à *La Gravière* sort à `9.8/10` pour un *Chargeur* mais `3.2/10 Trop gros` pour un *Débutant*, réorienté vers *La Sud* ou *Le Prévent*), le quiver conseillé et les meilleurs créneaux 48h.
- **Agent Coach Surf Local & Podium Top 3** : briefing synthétique immédiat en tête de page croisant ton niveau, le Plan B moins peuplé, et le **Nowcast Vent AROME 90 minutes (`minutely_15`)** pour détecter un *glass-off* ou une bascule thermique imminente.
- **Physique Houle v2** : angle d'attaque primaire, bonus *Pics en A (Wedge)* par houle secondaire croisée propre, et pénalité réaliste de *closeout* par très longue période (`>16s`) sur les plages rectilignes (*Messanges, Labenne, Ondres*).

### 2. Double Vigie Sécurité Côtière en Temps Réel
- **Indice de Courants de Baïnes (`1/5` à `5/5`)** : croise l'énergie en `kJ`, le coefficient SHOM, la phase critique de marée (BM+1h à mi-montante et 3e/4e heure à `3/12`) et la morphologie de chaque plage.
- **Qualité d'Eau & Panaches Estuariens Post-Pluie (`48h`)** : calcule le cumul glissant de pluie sur 24h et 48h (`past_days=2`) croisé avec la marée descendante pour alerter sur les risques bactériologiques et débris flottants aux embouchures (*Adour* à Tarnos, *Boudigau/Passe* à Capbreton/La Sud, *Courant d'Huchet* à Moliets, *Boucarot* à Vieux-Boucau/Soustons).

### 3. Webcams HD avec Loupe Line-up `1×–4×` & Mur Vidéo Éco-4G
- **Loupe numérique interactive (`1×`, `2×`, `3×`, `4×` + déplacement souris/doigt)** directement dans le cadre vidéo pour compter les surfeurs au pic + mode **Picture-in-Picture (`PiP`)** + badge contextuel de nuit.
- **Mur Vidéo Intelligent** : `IntersectionObserver` + plafond strict de **4 décodeurs HD simultanés** + `capLevelToPlayerSize` (évite la saturation GPU sur les flux 4K UHD Quanteec) + **Mode Éco-4G** en 1 clic.
- **Zéro coupure au scrub temporel** : glisser le curseur 168h met à jour les cartes, le graphique 7 jours et les marées sans jamais recharger le flux vidéo en cours.

### 4. Ergonomie Mobile "Parking Check" & Mode Hors-Ligne Pinède (PWA)
- **Mobile-First (`< 960px`)** : Podium & Liste des 19 spots accessibles dès l'ouverture sans scroller sous la carte, bascule `[Liste | Carte & Gouf]`, **Tiroir Inspecteur Plein Écran** fluide et **Barre de Navigation Inférieure au pouce**.
- **PWA Offline-First (`manifest.webmanifest` + Service Worker `sw.js`)** : installable sur écran d'accueil iOS/Android et conserve les 7 jours de prévisions + marées SHOM (`stale-on-error`) même sans réseau 4G sur les parkings en forêt (*Les Casernes, Courant d'Huchet, Messanges*).
- **Partage Rapide WhatsApp & Deep-Link URL** (`?spot=...&ts=...&level=...`) + mémoire locale de l'état des bancs de sable.

---

## Agent de Contrôle Qualité Automatisé (`npm run judge`)

Le dépôt embarque un juge automatisé sur 4 piliers (`scripts/judge-audit.mjs`), exécuté localement et dans GitHub Actions à chaque déploiement :

```bash
npm run judge
# Vérifie :
# 1. Métier Surf, différenciation Débutant/Chargeur, closeouts 17s & vigies Baïnes/Adour
# 2. Ingénierie Streaming (IntersectionObserver, plafond décodeurs, Loupe 4x, Graphe 7j)
# 3. Conformité PWA Offline Pinède & préservation du cache Stale-on-Error
# 4. Santé HTTP 200 / CORS temps réel des APIs Open-Meteo, Bouées et Manifestes HLS
```

## Lancement Local

```bash
npm run dev
# Serveur statique sur le port 4173
```
