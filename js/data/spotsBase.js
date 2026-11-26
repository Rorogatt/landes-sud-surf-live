/**
 * Base de données exhaustive des 19 spots de surf des Landes du Sud (40)
 * + Modèle bathymétrique du Gouf de Capbreton
 * + Algorithme d'estimation d'affluence (Crowd Factor) temps réel
 */

export const LANDES_SUD_SURF_DATA = {
  "meta": {
    "title": "Atlas Technique & Océanographique des Spots de Surf — Landes du Sud (40)",
    "region": "Nouvelle-Aquitaine",
    "department": "Landes (40) — Côte Sud (Maremne, Seignanx, Pays de Born Sud)",
    "coastlineSpanKm": 38.5,
    "fromNorthToSouth": "Moliets-et-Maâ (Courant d'Huchet) -> Tarnos (Digue Nord de l'Adour)",
    "totalSpots": 19,
    "crs": "EPSG:4326 (WGS84)",
    "tideReferencePorts": [
      {
        "name": "Boucau-Bayonne (Adour)",
        "shomCode": "BOUCAU",
        "meanSpringRangeM": 3.95,
        "maxAstronomicalTideM": 4.65
      },
      {
        "name": "Capbreton",
        "shomCode": "CAPBRETON",
        "offsetMinutesVsBoucau": 5
      }
    ],
    "geographicalNote": "Sur la commune de Capbreton, l'ordre géographique strict du Nord au Sud est : 13. Notre-Dame (rive droite passe) -> Miramar/Estacade -> 15. Le Prévent (43.6496°N) -> 14. Le Santocha / La Savane (43.6458°N) -> 16. La Piste (43.6418°N) -> VVF / Les Océanides (43.6371°N). Chaque entrée conserve son index demandé (idNumero 1 à 19) ET expose `northToSouthRank` pour le tri cartographique strict.",
    "apiGridTip": "Pour les API de houle à maille 0.05°-0.08° (Open-Meteo Marine, MFWAM/CMEMS, WW3), utiliser `coordinates.peak` pour l'affichage carte précis du line-up (200-550m du rivage) et `coordinates.offshoreApiPoint` (~1.5 km au large) si le modèle numérique de terrain masque la cellule côtière."
  },
  "goufDeCapbreton": {
    "name": "Gouf de Capbreton",
    "canyonHeadCoords": {
      "lat": 43.6552,
      "lon": -1.4515,
      "distanceFromEstacadeMeters": 300
    },
    "geomorphology": {
      "lengthKm": 300,
      "depthAt1KmOffshoreM": 180,
      "depthAt15KmOffshoreM": 1000,
      "depthOffCapbretonShelfM": 2150,
      "maxAbyssalDepthM": 4500,
      "summary": "Immense canyon sous-marin entaillant le plateau continental aquitain d'Est en Ouest. Alors que les fonds descendent en pente très douce partout ailleurs dans les Landes (plateau de 35 à 50 km), la tête du Gouf remonte jusqu'à ~300 mètres seulement de la plage face à l'Estacade et à la passe du port de Capbreton."
    },
    "wavePhysics": {
      "law": "Réfraction bathymétrique de Snell-Descartes (célérité en eau peu profonde c = sqrt(g * h))",
      "mechanismSummary": "Lorsqu'une houle longue d'Atlantique Nord (WNW/NW, période 12-18s) approche de la côte, la partie de la crête qui survole les grandes profondeurs du Gouf (>100-500m) conserve toute sa vitesse et son énergie sans frottement sur le fond, tandis que les ailes Nord (plateau d'Hossegor) et Sud (plateau de Capbreton Sud) touchent le fond dès 20-30m et ralentissent brutalement. Les rayons de houle (orthogonales) divergent alors hors de l'axe central du canyon pour converger violemment vers ses deux épaules (flanc Nord et flanc Sud).",
      "zones": [
        {
          "zoneId": "canyon_head_shadow",
          "label": "Tête du Gouf — Zone d'ombre et d'amortissement (Défocalisation)",
          "affectedSpots": [
            "hossegor-la-sud",
            "capbreton-notre-dame-miramar",
            "capbreton-le-prevent"
          ],
          "swellHeightMultiplier": {
            "min": 0.45,
            "typical": 0.55,
            "max": 0.7
          },
          "effect": "L'énergie se disperse latéralement vers le Nord et le Sud. Résultat : face à l'entrée du port, à La Sud et au Prévent, la houle perd 35% à 55% de sa hauteur ! Quand La Gravière ou La Piste saturent à 2.5m-3.0m, La Sud et Le Prévent offrent des vagues propres et gérables d'1.2m à 1.6m (spots de repli par excellence et abri historique des marins)."
        },
        {
          "zoneId": "north_flank_convergence",
          "label": "Épaule Nord du Gouf — Lentille convergente & Zéro perte par friction",
          "affectedSpots": [
            "hossegor-la-nord",
            "hossegor-la-graviere",
            "hossegor-les-culs-nus",
            "seignosse-les-estagnots"
          ],
          "swellHeightMultiplier": {
            "min": 1.15,
            "typical": 1.3,
            "max": 1.5
          },
          "effect": "La houle qui a voyagé en eau profonde dans le canyon pivote brusquement vers le Nord-Est sur le talus Nord abrupt. 1) Sur le haut-fond externe de La Nord (500m au large), elle lève des murs massifs de 2.5m à 6m sans avoir freiné avant. 2) À La Gravière, cette énergie intacte percute un mur de sable très proche du bord, générant les tubes de beachbreak les plus épais et puissants d'Europe. 3) Aux Culs Nus (et jusqu'aux Estagnots par longue période), l'onde réfractée par le Gouf croise la houle incidente WNW pour sculpter des pics triangulaires en A ('wedges') ultra-creux."
        },
        {
          "zoneId": "south_flank_convergence",
          "label": "Épaule Sud du Gouf — Focalisation rapide sur les bancs des Bunkers",
          "affectedSpots": [
            "capbreton-le-santocha",
            "capbreton-la-piste-vvf"
          ],
          "swellHeightMultiplier": {
            "min": 1.1,
            "typical": 1.25,
            "max": 1.4
          },
          "effect": "Symétriquement, les houles de WNW/NW qui franchissent le Gouf réfractent vers le Sud-Est sur le rebord Sud du canyon. Alors que Le Prévent est calme 800m plus au nord, Santocha se réveille nettement et surtout La Piste / VVF concentrent toute la poussée du flanc Sud en cylindres ultra-rapides, creux et techniques."
        }
      ]
    }
  },
  "crowdEstimationModel": {
    "description": "Paramètres calibrés pour estimer l'affluence en temps réel (score 0.0 à 10.0 et estimation du nombre de surfeurs au pic) en croisant l'heure locale, le jour, le mois, la qualité météo-océanique instantanée et l'effet de repli par grosse houle.",
    "formula": "clamp(1, 10, basePopularity * hourlyWeight * dayTypeWeight * seasonWeight * waveQualityWeight * fallbackSurgeWeight)",
    "defaultHourlyCurve": {
      "06h-08h_dawnPatrol": 0.65,
      "08h-10h_morningClean": 0.95,
      "10h-12h30_surfSchoolsPeak": 1.2,
      "12h30-14h30_lunchDip": 0.75,
      "14h30-17h30_afternoonPeak": 1.15,
      "17h30-20h30_afterworkGlassOff": 1.25
    },
    "seasonDefinitions": {
      "winter_DecMar": "Froid (eau 11-13°C), line-ups locaux mais concentrés sur les replis (Prévent, La Sud, Santocha, Digue) dès que ça dépasse 2.5m.",
      "spring_AprJun": "Ponts de mai très chargés (Bordeaux/Toulouse/Pays Basque), bancs de printemps en remise en place.",
      "summer_JulAug": "Saturation touristique maximale sur les plages centrales et écoles (10h-18h), mais spots sauvages (Casernes, Huchet, Métro) respirables à l'aube.",
      "autumn_SepNov": "L'été indien landais (eau 17-20°C, vents d'Est fréquents, Quiksilver/ROXY Pro WSL) : pic absolu de surfeurs confirmés/pros à Hossegor-Seignosse-Capbreton."
    }
  },
  "spots": [
    {
      "id": "moliets-centrale-huchet",
      "idNumero": 1,
      "northToSouthRank": 1,
      "commune": "Moliets-et-Maâ",
      "name": "Moliets — Plage Centrale & Courant d'Huchet",
      "shortName": "Moliets / Huchet",
      "aliases": [
        "Plage Centrale de Moliets",
        "Embouchure du Courant d'Huchet",
        "Les Chênes-Lièges (Sud)"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.84395,
          "lon": -1.40119,
          "label": "Pic principal Plage Centrale (350m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "Banc de l'Embouchure du Courant d'Huchet (Nord)",
            "lat": 43.85383,
            "lon": -1.39764
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.848,
          "lon": -1.416
        },
        "parking": {
          "lat": 43.84275,
          "lon": -1.39455,
          "label": "Grand Parking Avenue de l'Océan — Plage Centrale"
        },
        "secondaryParkings": [
          {
            "name": "Parking Réserve du Courant d'Huchet / Pichelèbe",
            "lat": 43.8521,
            "lon": -1.3902
          }
        ]
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 284,
        "beachOrientationText": "WNW (284°)",
        "idealOffshoreWindDeg": 104,
        "idealOffshoreToleranceDeg": {
          "min": 75,
          "max": 135
        },
        "idealOffshoreWindText": "E / ESE",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Aucune protection au vent : grande côte dunaire ouverte prenant le thermique d'ONO dès la fin de matinée en été."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 275,
          "optimal": 298,
          "max": 320
        },
        "sizeMeters": {
          "min": 0.5,
          "optimalMin": 1.0,
          "optimalMax": 2.0,
          "maxHold": 2.5
        },
        "periodSec": {
          "min": 9,
          "optimalMin": 10,
          "optimalMax": 14,
          "maxHold": 15
        },
        "notes": "Le débit d'eau douce du Courant d'Huchet au Nord découpe des bancs triangulaires qui tiennent mieux la période (13-14s) que la Centrale."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante (Centrale) ; Mi-marée montante ou descendante (Embouchure d'Huchet)",
        "optimalTideHeightM": {
          "min": 0.7,
          "max": 2.8
        },
        "highCoeffImpactGt85": "Par coeff >85, la vidange du Courant d'Huchet à marée descendante crée un fleuve côtier puissant qui déstabilise le line-up et active de grosses baïnes latérales ; au plein haut, fort shorebreak mou contre le talus."
      },
      "waveProfile": {
        "waveType": "Beachbreak landais classique (Centrale) & banc d'embouchure de rivière asymétrique (Courant d'Huchet)",
        "qualityRating": 7,
        "consistencyRating": 9,
        "skillLevel": "Débutant à Confirmé",
        "skillDetails": "Idéal Débutant/Intermédiaire sur la Centrale (<1.3m), Intermédiaire à Confirmé vers l'embouchure d'Huchet.",
        "localHazards": [
          "Courant d'embouchure très dangereux au débouché du Courant d'Huchet (baignade interdite dans le lit)",
          "Baïnes profondes et mobiles entre la Centrale et les Chênes-Lièges",
          "Forte densité de planches en mousse / écoles de surf en juillet-août sur la Centrale",
          "Barre au large physique à passer dès 2m+"
        ]
      },
      "practicalInfo": {
        "parking": "Vaste parking gratuit Avenue de l'Océan mais saturé de 11h à 17h en été ; portiques de hauteur (2.0m) sur certaines zones, interdiction stricte du camping-car/van la nuit.",
        "showersAndFacilities": "Douches de plage, WC publics, poste MNS sur l'esplanade centrale (mai à septembre).",
        "surfSchoolsAndClubs": "Nombreuses écoles (Moliets Surf School, Maa Surf School, École du Courant d'Huchet, etc.) et surf camps européens en forêt.",
        "waterVibe": "Très estivale, jeune et surf-camp cosmopolite sur la Centrale ; sauvage, contemplative et magique à pied vers l'embouchure d'Huchet."
      },
      "crowdFactor": {
        "basePopularity": 7,
        "summerPeakScore": 9.5,
        "autumnPeakScore": 6.5,
        "winterScore": 3.0,
        "weekendMultiplier": 1.25,
        "peakHours": [
          "10:00-12:30",
          "15:00-18:30"
        ],
        "bestUncrowdedWindow": "06:30-09:00 en marchant 10 min vers le Courant d'Huchet ou le Sud (Chênes-Lièges)",
        "waveQualitySensitivity": 1.2,
        "fallbackSurgeOnBigSwell": 0.7
      },
      "goufInfluence": {
        "isAffected": false,
        "type": "none",
        "swellMultiplier": 1.0,
        "explanation": "Hors de portée du Gouf de Capbreton (situé 22 km plus au Sud) : plateau continental en pente douce exposé à 100% aux houles du Golfe de Gascogne."
      }
    },
    {
      "id": "messanges-nord-centrale",
      "idNumero": 2,
      "northToSouthRank": 2,
      "commune": "Messanges",
      "name": "Messanges — Plage Nord / Centrale",
      "shortName": "Messanges",
      "aliases": [
        "Messanges Plage Nord",
        "Messanges Plage Centrale",
        "Messanges Sud"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.81775,
          "lon": -1.40967,
          "label": "Pic Plage Nord / Centrale (350m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "Messanges Plage Sud",
            "lat": 43.8074,
            "lon": -1.4131
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.818,
          "lon": -1.425
        },
        "parking": {
          "lat": 43.81615,
          "lon": -1.4029,
          "label": "Parking forestier de la Plage Nord / Centrale (Route de la Plage)"
        },
        "secondaryParkings": [
          {
            "name": "Parking Plage Sud Messanges",
            "lat": 43.8061,
            "lon": -1.4059
          }
        ]
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 283,
        "beachOrientationText": "WNW (283°)",
        "idealOffshoreWindDeg": 103,
        "idealOffshoreToleranceDeg": {
          "min": 75,
          "max": 135
        },
        "idealOffshoreWindText": "E / ESE",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Aucune protection : immense cordon dunaire sauvage sans construction, très sensible au moindre clapot d'Ouest."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 275,
          "optimal": 295,
          "max": 320
        },
        "sizeMeters": {
          "min": 0.5,
          "optimalMin": 0.9,
          "optimalMax": 1.8,
          "maxHold": 2.3
        },
        "periodSec": {
          "min": 8,
          "optimalMin": 10,
          "optimalMax": 13,
          "maxHold": 14
        },
        "notes": "Véritable aimant à houle l'été ; attention aux houles trop longues (>14-15s) qui forment de longues barres fermantes si les baïnes sont peu marquées."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante",
        "optimalTideHeightM": {
          "min": 0.6,
          "max": 2.6
        },
        "highCoeffImpactGt85": "À marée haute de vif-eau (>85), l'eau monte jusqu'au pied de la dune : backwash, shorebreak désordonné et disparition des bancs."
      },
      "waveProfile": {
        "waveType": "Beachbreak sauvage multi-pics sur fond de sable fin",
        "qualityRating": 7,
        "consistencyRating": 9,
        "skillLevel": "Débutant à Confirmé",
        "skillDetails": "Accessible à tous jusqu'à 1.2m, physique et creux entre 1.5m et 2.0m.",
        "localHazards": [
          "Baïnes landaises puissantes en sortie de banc à mi-marée descendante",
          "Éloignement des secours si l'on marche loin au Nord ou au Sud",
          "Barres au large éprouvantes par houle >2m"
        ]
      },
      "practicalInfo": {
        "parking": "Parking gratuit sous les pins avant la dune (accès plage par chemin sablonneux sur la dune de 5 min) ; barres de hauteur saisonnières.",
        "showersAndFacilities": "Poste de secours MNS l'été, WC au parking, snack-cabane saisonnier, zéro béton sur la plage.",
        "surfSchoolsAndClubs": "Messanges Surf School et quelques écoles locales à taille humaine.",
        "waterVibe": "Authentique, nature et détendue : il suffit de marcher 200m au Nord ou au Sud pour surfer son propre pic."
      },
      "crowdFactor": {
        "basePopularity": 5,
        "summerPeakScore": 7.5,
        "autumnPeakScore": 5.0,
        "winterScore": 2.0,
        "weekendMultiplier": 1.2,
        "peakHours": [
          "10:00-12:30",
          "16:00-19:00"
        ],
        "bestUncrowdedWindow": "Toute la matinée hors juillet-août, ou à 300m des drapeaux en été",
        "waveQualitySensitivity": 1.15,
        "fallbackSurgeOnBigSwell": 0.6
      },
      "goufInfluence": {
        "isAffected": false,
        "type": "none",
        "swellMultiplier": 1.0,
        "explanation": "Aucune influence du Gouf : exposition directe plein Golfe de Gascogne, capte 20 à 30% de houle en plus que Capbreton Centre par petite houle d'été."
      }
    },
    {
      "id": "vieux-boucau-nord-estacade",
      "idNumero": 3,
      "northToSouthRank": 3,
      "commune": "Vieux-Boucau-les-Bains",
      "name": "Vieux-Boucau — Plage Nord (Les Sablères) / Estacade",
      "shortName": "Vieux-Boucau",
      "aliases": [
        "Les Sablères (Plage Nord)",
        "Plage Centrale Vieux-Boucau",
        "Digue Nord du Boucarot"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.78842,
          "lon": -1.41917,
          "label": "Pic Plage Centrale / Estacade Nord (350m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "Les Sablères / Plage Nord",
            "lat": 43.7937,
            "lon": -1.41783
          },
          {
            "name": "Coin de la Digue / Estacade du Lac Marin",
            "lat": 43.7842,
            "lon": -1.4198
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.79,
          "lon": -1.432
        },
        "parking": {
          "lat": 43.78795,
          "lon": -1.41265,
          "label": "Grand Parking de la Grande Plage Centrale"
        },
        "secondaryParkings": [
          {
            "name": "Parking des Sablères (Plage Nord) + Aire Camping-Cars",
            "lat": 43.7931,
            "lon": -1.4106
          }
        ]
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 282,
        "beachOrientationText": "WNW (282°)",
        "idealOffshoreWindDeg": 102,
        "idealOffshoreToleranceDeg": {
          "min": 75,
          "max": 135
        },
        "idealOffshoreWindText": "E / ESE",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": true,
          "details": "Léger abri contre le clapot de Sud / Sud-Ouest uniquement tout contre la jetée Nord du canal du Lac Marin (Estacade) ; Plage Nord (Sablères) totalement exposée."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 280,
          "optimal": 300,
          "max": 325
        },
        "sizeMeters": {
          "min": 0.6,
          "optimalMin": 1.0,
          "optimalMax": 2.2,
          "maxHold": 2.6
        },
        "periodSec": {
          "min": 9,
          "optimalMin": 10,
          "optimalMax": 14,
          "maxHold": 15
        },
        "notes": "La jetée du Boucarot au Sud de la Plage Centrale stabilise d'excellents bancs de sable (droites et gauches creuses) plus réguliers que sur les plages ouvertes."
      },
      "idealTide": {
        "bestPhase": "Mi-marée montante à marée haute (près de l'Estacade/Digue) ; Basse à mi-marée (aux Sablères)",
        "optimalTideHeightM": {
          "min": 1.0,
          "max": 3.4
        },
        "highCoeffImpactGt85": "Par gros coeff (>85), le courant de vidange et de remplissage du Lac Marin de Port d'Albret à l'embouchure du Boucarot est très violent le long de la jetée ; fort ressac au plein haut sur la Centrale."
      },
      "waveProfile": {
        "waveType": "Beachbreak calé par jetée/boucarot (Centrale/Estacade) & beachbreak sauvage (Sablères)",
        "qualityRating": 8,
        "consistencyRating": 9,
        "skillLevel": "Débutant à Confirmé",
        "skillDetails": "Tous niveaux par petite houle ; tubes rapides et engagés pour Confirmés autour de 1.5m-2.0m près de la jetée.",
        "localHazards": [
          "Enrochements de la jetée du Boucarot au Sud de la Plage Centrale",
          "Courant traversier puissant lié aux marées du Lac Marin de Port d'Albret",
          "Forte affluence estivale (station très prisée des surf camps allemands, basques et landais)"
        ]
      },
      "practicalInfo": {
        "parking": "Immense parking gratuit à la Centrale (marché nocturne certains soirs d'été) et parking boisé aux Sablères avec aire officielle de camping-cars adjacente.",
        "showersAndFacilities": "Douches, WC, postes MNS Centrale & Sablères, bars/restaurants/surfshops au pied de la dune à la Centrale.",
        "surfSchoolsAndClubs": "Vieux-Boucau Surf Club (très dynamique, compétitions fédérales) + nombreuses écoles de surf.",
        "waterVibe": "Vivante, sportive et conviviale ; bon niveau local au pic de la jetée mais esprit bon enfant si les règles sont respectées."
      },
      "crowdFactor": {
        "basePopularity": 7.5,
        "summerPeakScore": 9.5,
        "autumnPeakScore": 7.0,
        "winterScore": 4.0,
        "weekendMultiplier": 1.3,
        "peakHours": [
          "09:30-12:30",
          "16:30-19:30"
        ],
        "bestUncrowdedWindow": "06:30-08:30 ou marche entre Les Sablères et Messanges Sud",
        "waveQualitySensitivity": 1.25,
        "fallbackSurgeOnBigSwell": 0.8
      },
      "goufInfluence": {
        "isAffected": false,
        "type": "none",
        "swellMultiplier": 1.0,
        "explanation": "Hors influence du Gouf ; les bancs sont gouvernés par la dérive littorale Nord->Sud bloquée par l'embouchure du Lac Marin."
      }
    },
    {
      "id": "soustons-plage-la-sauvagine",
      "idNumero": 4,
      "northToSouthRank": 4,
      "commune": "Soustons (Port d'Albret)",
      "name": "Soustons-Plage — La Sauvagine (Plage de l'Océan)",
      "shortName": "Soustons / Sauvagine",
      "aliases": [
        "Plage de l'Océan de Soustons",
        "Port d'Albret Rive Sud",
        "La Sauvagine (côté Océan)"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.77737,
          "lon": -1.42249,
          "label": "Pic Plage de l'Océan / Sud Boucarot (350m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "Pic de la Digue Sud du Boucarot",
            "lat": 43.7815,
            "lon": -1.4211
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.778,
          "lon": -1.435
        },
        "parking": {
          "lat": 43.7764,
          "lon": -1.4139,
          "label": "Parking de la Plage de l'Océan — Soustons-Plage (Port d'Albret Sud)"
        },
        "secondaryParkings": [
          {
            "name": "Parking du Lac Marin / La Sauvagine",
            "lat": 43.7801,
            "lon": -1.4095
          }
        ]
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 280,
        "beachOrientationText": "W / WNW (280°)",
        "idealOffshoreWindDeg": 100,
        "idealOffshoreToleranceDeg": {
          "min": 70,
          "max": 130
        },
        "idealOffshoreWindText": "E / ESE",
        "windProtection": {
          "isProtectedNorth": true,
          "isProtectedSouth": false,
          "details": "Léger abri contre un petit vent de Nord juste au sud de la digue Sud du Boucarot ; reste ouvert plus au sud vers Seignosse."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / W",
        "directionsDeg": {
          "min": 270,
          "optimal": 295,
          "max": 315
        },
        "sizeMeters": {
          "min": 0.6,
          "optimalMin": 1.0,
          "optimalMax": 2.0,
          "maxHold": 2.5
        },
        "periodSec": {
          "min": 9,
          "optimalMin": 10,
          "optimalMax": 14,
          "maxHold": 15
        },
        "notes": "Astuce locale : 'La Sauvagine' désigne officiellement la plage lacustre du Lac Marin juste derrière la dune, tandis que le spot océanique est la 'Plage de l'Océan' ! L'embouchure du lac y dépose des bancs de sable superbes, souvent en longues gauches."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante (et mi-marée à haute près de la digue Sud)",
        "optimalTideHeightM": {
          "min": 0.8,
          "max": 3.0
        },
        "highCoeffImpactGt85": "Par coeff >85, l'aspiration sortante du canal du Lac Marin au nord du spot crée un fort courant vers le large ; au sud de la zone surveillée, les baïnes vers Les Casernes sont redoutables."
      },
      "waveProfile": {
        "waveType": "Beachbreak semi-sauvage sculpté par la sortie sud du canal marin",
        "qualityRating": 7.5,
        "consistencyRating": 9,
        "skillLevel": "Débutant à Confirmé",
        "skillDetails": "Parfait pour fuir la foule de Vieux-Boucau tout en profitant des mêmes bancs d'embouchure.",
        "localHazards": [
          "Enrochements de la digue Sud du canal de Port d'Albret",
          "Courant de passe du Boucarot au Nord et grandes baïnes sauvages en descendant au Sud (5 km vierges jusqu'aux Casernes !)",
          "Marche de 6 à 8 minutes dans le sable sur la haute dune depuis le parking"
        ]
      },
      "practicalInfo": {
        "parking": "Grand parking gratuit côté Port d'Albret Sud (Rue de la Plage / Avenue de Port d'Albret), puis traversée piétonne de la dune.",
        "showersAndFacilities": "Poste MNS et sanitaires en saison ; base nautique et calme absolu côté Lac Marin (La Sauvagine) pour l'après-session.",
        "surfSchoolsAndClubs": "Lou Surfou / écoles de Soustons-Marensin.",
        "waterVibe": "Familiale, locale et beaucoup plus paisible que la rive Nord (Vieux-Boucau) située à seulement 150m de l'autre côté du chenal !"
      },
      "crowdFactor": {
        "basePopularity": 5.5,
        "summerPeakScore": 7.5,
        "autumnPeakScore": 5.0,
        "winterScore": 2.5,
        "weekendMultiplier": 1.2,
        "peakHours": [
          "10:30-12:30",
          "16:00-18:30"
        ],
        "bestUncrowdedWindow": "07:00-09:30 ou en marchant 400m au Sud vers la forêt domaniale de Soustons",
        "waveQualitySensitivity": 1.15,
        "fallbackSurgeOnBigSwell": 0.7
      },
      "goufInfluence": {
        "isAffected": false,
        "type": "none",
        "swellMultiplier": 1.0,
        "explanation": "Aucune influence du Gouf ; bathymétrie régie par le panache sédimentaire du Boucarot de Port d'Albret."
      }
    },
    {
      "id": "seignosse-les-casernes",
      "idNumero": 5,
      "northToSouthRank": 5,
      "commune": "Seignosse",
      "name": "Seignosse — Les Casernes",
      "shortName": "Les Casernes",
      "aliases": [
        "Plage des Casernes"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.72307,
          "lon": -1.43585,
          "label": "Pic central des Casernes (350m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "Pics Nord vers la plage sauvage de Soustons",
            "lat": 43.7275,
            "lon": -1.4345
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.7235,
          "lon": -1.45
        },
        "parking": {
          "lat": 43.72135,
          "lon": -1.4282,
          "label": "Parking forestier des Casernes (au bout de la Route des Casernes, après Les Oyats)"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 281,
        "beachOrientationText": "WNW (281°)",
        "idealOffshoreWindDeg": 101,
        "idealOffshoreToleranceDeg": {
          "min": 70,
          "max": 130
        },
        "idealOffshoreWindText": "E / ESE",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Zéro abri au vent : plage 100% sauvage adossée à une haute dune vierge, exposée au moindre souffle onshore."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 275,
          "optimal": 298,
          "max": 320
        },
        "sizeMeters": {
          "min": 0.5,
          "optimalMin": 1.0,
          "optimalMax": 2.0,
          "maxHold": 2.5
        },
        "periodSec": {
          "min": 9,
          "optimalMin": 10,
          "optimalMax": 14,
          "maxHold": 15
        },
        "notes": "Aimant à houle exceptionnel : capte toujours 20 à 30 cm de plus que le sud d'Hossegor en été, avec des pics creux et tubulaires autour des baïnes."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante",
        "optimalTideHeightM": {
          "min": 0.6,
          "max": 2.6
        },
        "highCoeffImpactGt85": "Attention danger : Les Casernes possède certaines des baïnes les plus creuses et actives de Seignosse ! Par coeff >85 entre basse et mi-montante (ou mi-descendante), les courants d'arrachement ('rips') sont redoutables."
      },
      "waveProfile": {
        "waveType": "Beachbreak sauvage puissant et tubulaire à systèmes de baïnes",
        "qualityRating": 8.5,
        "consistencyRating": 9.5,
        "skillLevel": "Intermédiaire à Confirmé (Débutant encadré par <1m)",
        "skillDetails": "Vagues franches, creuses et sans concession dès 1.3m, idéales pour chercher des tubes loin de la foule d'Hossegor.",
        "localHazards": [
          "Baïnes extrêmement puissantes et isolées dès qu'on s'éloigne du poste MNS",
          "Isolement total au Nord (6 km de plage déserte sans route ni réseau téléphonique optimal au pied de la dune)",
          "Vols occasionnels dans les voitures sur le parking isolé en forêt (ne rien laisser d'apparent)"
        ]
      },
      "practicalInfo": {
        "parking": "Parking gratuit en lisière de pinède au bout d'une route sans issue de 2.5 km (portique hauteur en saison, accès vélo royal par la Vélodyssée).",
        "showersAndFacilities": "Poste MNS saisonnier (juin-septembre), cabane-snack mythique en bois l'été, WC secs au parking.",
        "surfSchoolsAndClubs": "Natural Surf Lodge / écoles partenaires des Casernes.",
        "waterVibe": "Sauvage, authentique et contemplative : le spot refuge des amoureux de grands espaces landais."
      },
      "crowdFactor": {
        "basePopularity": 5.5,
        "summerPeakScore": 7.5,
        "autumnPeakScore": 6.5,
        "winterScore": 2.5,
        "weekendMultiplier": 1.2,
        "peakHours": [
          "09:30-12:00",
          "16:30-19:30"
        ],
        "bestUncrowdedWindow": "Aube (06:30-08:30) ou 300m au Nord de l'accès dunaire : solitude garantie même en septembre !",
        "waveQualitySensitivity": 1.25,
        "fallbackSurgeOnBigSwell": 0.55
      },
      "goufInfluence": {
        "isAffected": false,
        "type": "none",
        "swellMultiplier": 1.0,
        "explanation": "À 7.5 km au Nord du Gouf : aucune atténuation ni réfraction du canyon, houle brute et régulière des Landes."
      }
    },
    {
      "id": "seignosse-le-penon",
      "idNumero": 6,
      "northToSouthRank": 6,
      "commune": "Seignosse",
      "name": "Seignosse — Le Penon",
      "shortName": "Le Penon",
      "aliases": [
        "Grande Plage du Penon",
        "L'Agréou (secteur Sud Penon)"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.71008,
          "lon": -1.44089,
          "label": "Pic central du Penon (350m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "L'Agréou (entre Le Penon et Les Bourdaines)",
            "lat": 43.7042,
            "lon": -1.4421
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.71,
          "lon": -1.454
        },
        "parking": {
          "lat": 43.70825,
          "lon": -1.4342,
          "label": "Parkings du Penon / Avenue de la Grande Plage & Place de Castille"
        },
        "secondaryParkings": [
          {
            "name": "Parking de l'Agréou",
            "lat": 43.7038,
            "lon": -1.4357
          }
        ]
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 282,
        "beachOrientationText": "WNW (282°)",
        "idealOffshoreWindDeg": 102,
        "idealOffshoreToleranceDeg": {
          "min": 75,
          "max": 130
        },
        "idealOffshoreWindText": "E / ESE",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Plage ouverte avec cordon dunaire renaturé ; aucune protection au vent du Nord ou du Sud."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 275,
          "optimal": 298,
          "max": 320
        },
        "sizeMeters": {
          "min": 0.5,
          "optimalMin": 1.0,
          "optimalMax": 2.2,
          "maxHold": 2.6
        },
        "periodSec": {
          "min": 9,
          "optimalMin": 10,
          "optimalMax": 14,
          "maxHold": 15
        },
        "notes": "Bancs très généreux et variés du Penon Nord jusqu'à l'Agréou, produisant souvent de belles droites et gauches tubulaires à l'automne."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante (toutes marées si houle <1m)",
        "optimalTideHeightM": {
          "min": 0.7,
          "max": 2.9
        },
        "highCoeffImpactGt85": "Par gros coeff (>85), le plein haut plaque un shorebreak lourd sur le haut de plage et la descendante creuse fortement les baïnes."
      },
      "waveProfile": {
        "waveType": "Beachbreak polyvalent et puissant de référence à Seignosse",
        "qualityRating": 8,
        "consistencyRating": 9,
        "skillLevel": "Débutant à Confirmé",
        "skillDetails": "Terrain d'apprentissage royal en mousse/petite houle l'été, beachbreak sérieux et tubulaire dès l'automne.",
        "localHazards": [
          "Baïnes marquées et courants latéraux",
          "Forte concentration d'écoles et baigneurs face à l'accès central en juillet-août",
          "Shorebreak sec à marée haute"
        ]
      },
      "practicalInfo": {
        "parking": "Nombreux parkings gratuits autour du Penon et du parc aquatique Atlantic Park (attention les mardis/jeudis/dimanches matin de grand marché d'été !).",
        "showersAndFacilities": "Douches, WC, poste MNS principal, skatepark, cafés et surfshops à 2 min à pied.",
        "surfSchoolsAndClubs": "Lou Surfou Seignosse Surf Club (à l'Agréou/Penon, club historique fondé en 1975) + nombreuses écoles.",
        "waterVibe": "Conviviale, sportive et familiale ; moins tendue qu'à La Gravière mais d'excellents locaux côté Agréou."
      },
      "crowdFactor": {
        "basePopularity": 7.5,
        "summerPeakScore": 9.5,
        "autumnPeakScore": 7.5,
        "winterScore": 4.0,
        "weekendMultiplier": 1.25,
        "peakHours": [
          "10:00-12:30",
          "15:30-19:00"
        ],
        "bestUncrowdedWindow": "06:30-08:30 ou entre Le Penon Nord et Les Casernes",
        "waveQualitySensitivity": 1.25,
        "fallbackSurgeOnBigSwell": 0.65
      },
      "goufInfluence": {
        "isAffected": false,
        "type": "none",
        "swellMultiplier": 1.0,
        "explanation": "Trop au Nord pour subir la réfraction directe du Gouf : reçoit la pleine houle landaise."
      }
    },
    {
      "id": "seignosse-les-bourdaines",
      "idNumero": 7,
      "northToSouthRank": 7,
      "commune": "Seignosse",
      "name": "Seignosse — Les Bourdaines",
      "shortName": "Les Bourdaines",
      "aliases": [
        "Plage des Bourdaines"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.69828,
          "lon": -1.44354,
          "label": "Pic central des Bourdaines (350m au large)"
        },
        "secondaryPeaks": [],
        "offshoreApiPoint": {
          "lat": 43.6985,
          "lon": -1.456
        },
        "parking": {
          "lat": 43.69755,
          "lon": -1.4368,
          "label": "Parking des Bourdaines (Avenue des Tucs / Salle des Bourdaines)"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 278,
        "beachOrientationText": "W (278°)",
        "idealOffshoreWindDeg": 98,
        "idealOffshoreToleranceDeg": {
          "min": 70,
          "max": 125
        },
        "idealOffshoreWindText": "E",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "La côte s'incurve plein Ouest : le vent plein Est y est chirurgicalement offshore, mais aucun abri contre le Nord ou l'Ouest."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 280,
          "optimal": 300,
          "max": 320
        },
        "sizeMeters": {
          "min": 0.6,
          "optimalMin": 1.2,
          "optimalMax": 2.2,
          "maxHold": 2.8
        },
        "periodSec": {
          "min": 10,
          "optimalMin": 11,
          "optimalMax": 15,
          "maxHold": 16
        },
        "notes": "Spot d'élite souvent choisi comme site mobile du Quiksilver/ROXY Pro France : tubes longs, creux et rapides mais plus lisibles qu'à La Gravière."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante (parfois magique au bas de l'eau sur bancs d'automne)",
        "optimalTideHeightM": {
          "min": 0.5,
          "max": 2.6
        },
        "highCoeffImpactGt85": "Par coeff >85, la fenêtre parfaite à mi-montant ne dure parfois que 60 à 90 minutes avant que le plein haut ne génère backwash et shorebreak contre la dune."
      },
      "waveProfile": {
        "waveType": "Beachbreak tubulaire world-class (droites et gauches rapides)",
        "qualityRating": 9,
        "consistencyRating": 9,
        "skillLevel": "Intermédiaire à Expert",
        "skillDetails": "Accessible aux intermédiaires sous 1.2m, devient un terrain de tubes engagés de niveau pro entre 1.5m et 2.5m.",
        "localHazards": [
          "Lèvre épaisse pouvant briser les planches à marée basse",
          "Courants de baïne très rapides dès 1.8m",
          "Niveau moyen à l'eau très élevé en automne (difficile d'attraper les bombes sans placement parfait)"
        ]
      },
      "practicalInfo": {
        "parking": "Parking gratuit le long de l'Avenue des Tucs et près de la salle de spectacle Les Bourdaines ; pistes cyclables directes depuis Hossegor et Le Penon.",
        "showersAndFacilities": "Douches, WC, poste MNS, cabanes de plage prisées au coucher du soleil.",
        "surfSchoolsAndClubs": "Écoles locales de Seignosse Sud (cours décalés hors des pics les plus creux).",
        "waterVibe": "Pure culture surf Seignosse : concentrée et performante au pic principal, plus détendue en marchant 150m."
      },
      "crowdFactor": {
        "basePopularity": 8.0,
        "summerPeakScore": 9.0,
        "autumnPeakScore": 9.0,
        "winterScore": 5.0,
        "weekendMultiplier": 1.25,
        "peakHours": [
          "08:00-11:30",
          "16:30-19:30"
        ],
        "bestUncrowdedWindow": "Première lueur de l'aube ou creux de midi (12h30-14h)",
        "waveQualitySensitivity": 1.35,
        "fallbackSurgeOnBigSwell": 0.7
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "far_north_margin",
        "swellMultiplier": 1.05,
        "explanation": "Limite extrême Nord de l'influence du Gouf uniquement par très longue période (>15-16s WNW), qui aide à croiser légèrement les trains de houle."
      }
    },
    {
      "id": "seignosse-les-estagnots",
      "idNumero": 8,
      "northToSouthRank": 8,
      "commune": "Seignosse",
      "name": "Seignosse — Les Estagnots",
      "shortName": "Les Estagnots",
      "aliases": [
        "Plage des Estagnots"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.68751,
          "lon": -1.44504,
          "label": "Pic central des Estagnots (350m au large)"
        },
        "secondaryPeaks": [],
        "offshoreApiPoint": {
          "lat": 43.6875,
          "lon": -1.458
        },
        "parking": {
          "lat": 43.68715,
          "lon": -1.4383,
          "label": "Grand Parking Rond-Point des Estagnots (Avenue Chambrelent)"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 274,
        "beachOrientationText": "Plein Ouest (274°)",
        "idealOffshoreWindDeg": 94,
        "idealOffshoreToleranceDeg": {
          "min": 65,
          "max": 125
        },
        "idealOffshoreWindText": "E",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Exposé plein Ouest sans abri ; sublime par brise thermique de terre (Est matinal) qui creuse les tubes."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 280,
          "optimal": 302,
          "max": 325
        },
        "sizeMeters": {
          "min": 0.6,
          "optimalMin": 1.2,
          "optimalMax": 2.5,
          "maxHold": 3.0
        },
        "periodSec": {
          "min": 10,
          "optimalMin": 11,
          "optimalMax": 16,
          "maxHold": 17
        },
        "notes": "Bancs souvent massifs capables d'encaisser plus de taille que Messanges ou Le Penon grâce aux premiers croisements de houle liés au nord du Gouf."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante (parfois jusqu'à mi-haute selon le banc)",
        "optimalTideHeightM": {
          "min": 0.6,
          "max": 2.8
        },
        "highCoeffImpactGt85": "Par coeff >85, changement radical du spot toutes les 45 min ; violentes baïnes latérales et gros shorebreak au plein haut."
      },
      "waveProfile": {
        "waveType": "Beachbreak lourd, creux et ultra-constant (haut lieu du surf pro européen)",
        "qualityRating": 9,
        "consistencyRating": 9.5,
        "skillLevel": "Intermédiaire à Expert",
        "skillDetails": "Puissance landaise caractéristique : canard solide et lecture rapide du tube indispensables au-dessus d'1.5m.",
        "localHazards": [
          "Vagues très puissantes et lèvre lourde",
          "Baïnes profondes et courant vers le Sud ou le Nord selon la houle",
          "Densité importante de très bons surfeurs (locaux + pros en automne)"
        ]
      },
      "practicalInfo": {
        "parking": "Grand parking sable/bitume gratuit mais pris d'assaut dès 8h30 par bonnes conditions et en été ; accès direct à la plage.",
        "showersAndFacilities": "Douches, WC, poste MNS, restaurants/bars iconiques au pied de la dune (La Cabane des Estagnots / Louvine à proximité).",
        "surfSchoolsAndClubs": "Écoles de surf réputées et entraînement des pôles/clubs locaux.",
        "waterVibe": "Électrique et très surf-centrée : l'un des spots les plus observés depuis le haut de la dune."
      },
      "crowdFactor": {
        "basePopularity": 8.5,
        "summerPeakScore": 9.5,
        "autumnPeakScore": 9.5,
        "winterScore": 6.0,
        "weekendMultiplier": 1.3,
        "peakHours": [
          "08:00-12:00",
          "16:30-19:30"
        ],
        "bestUncrowdedWindow": "Dawn patrol strict (avant 07h30) ou marche vers le Nord en direction des Bourdaines",
        "waveQualitySensitivity": 1.35,
        "fallbackSurgeOnBigSwell": 0.8
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "north_flank_outer_refraction",
        "swellMultiplier": 1.15,
        "explanation": "Par houle longue (>13s), l'onde réfractée au loin par l'épaule Nord du Gouf remonte croiser la houle directe WNW, découpant les barres en pics puissantissimes qui tiennent jusqu'à 2.5m-3m."
      }
    },
    {
      "id": "hossegor-les-culs-nus",
      "idNumero": 9,
      "northToSouthRank": 9,
      "commune": "Soorts-Hossegor",
      "name": "Hossegor — Les Culs Nus",
      "shortName": "Les Culs Nus",
      "aliases": [
        "Plage Naturiste d'Hossegor",
        "Culs Nus"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.68003,
          "lon": -1.44517,
          "label": "Pic des Culs Nus (280m au large)"
        },
        "secondaryPeaks": [],
        "offshoreApiPoint": {
          "lat": 43.68,
          "lon": -1.458
        },
        "parking": {
          "lat": 43.6796,
          "lon": -1.43885,
          "label": "Stationnement Boulevard de la Dune / Accès Nord Gravière - Culs Nus"
        },
        "secondaryParkings": [
          {
            "name": "Parking des Estagnots (marche Sud 600m)",
            "lat": 43.68715,
            "lon": -1.4383
          }
        ]
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 273,
        "beachOrientationText": "Plein Ouest (273°)",
        "idealOffshoreWindDeg": 93,
        "idealOffshoreToleranceDeg": {
          "min": 65,
          "max": 125
        },
        "idealOffshoreWindText": "E",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Plein Ouest face à l'Atlantique, sublimé par le vent d'Est matinal descendant de la forêt landaise."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 280,
          "optimal": 302,
          "max": 325
        },
        "sizeMeters": {
          "min": 0.7,
          "optimalMin": 1.2,
          "optimalMax": 2.5,
          "maxHold": 3.0
        },
        "periodSec": {
          "min": 11,
          "optimalMin": 12,
          "optimalMax": 16,
          "maxHold": 17
        },
        "notes": "Célèbre pour ses 'wedges' en A-frame (droite et gauche tubulaires partant du même pic) générés par la réfraction du flanc Nord du Gouf !"
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante (fonctionne souvent plus bas que La Gravière !)",
        "optimalTideHeightM": {
          "min": 0.5,
          "max": 2.5
        },
        "highCoeffImpactGt85": "À marée haute de coeff >85, la plage très raide transforme la vague en shorebreak violent et in-surfable avec backwash massif."
      },
      "waveProfile": {
        "waveType": "Beachbreak ultra-creux à pics triangulaires (A-frame barrels)",
        "qualityRating": 9.5,
        "consistencyRating": 9,
        "skillLevel": "Confirmé à Expert",
        "skillDetails": "Souvent aussi creux et tubulaire que La Gravière mais fonctionnant sur le créneau marée basse/mi-marée ; prisé du CT WSL.",
        "localHazards": [
          "Tubes ultra-rapides cassant sur très peu d'eau à marée basse (casse de planches et blessures fréquentes)",
          "Shorebreak redoutable à marée haute",
          "Line-up très engagé et compétitif quand La Gravière ne marche pas encore",
          "Plage officiellement naturiste en été (respect de la quiétude des usagers)"
        ]
      },
      "practicalInfo": {
        "parking": "Places limitées le long du Boulevard de la Dune / Avenue du Front de Mer Nord (accès vélo vivement recommandé en saison et pendant le Pro France).",
        "showersAndFacilities": "Poste MNS saisonnier sur la zone naturiste ; douches les plus proches vers La Gravière ou Les Estagnots.",
        "surfSchoolsAndClubs": "Peu d'écoles sur le pic principal (trop creux et zone naturiste).",
        "waterVibe": "Haute performance : photographes sur le sable et chasseurs de tubes à l'eau dès que le vent tourne à l'Est."
      },
      "crowdFactor": {
        "basePopularity": 8.0,
        "summerPeakScore": 8.0,
        "autumnPeakScore": 9.5,
        "winterScore": 6.5,
        "weekendMultiplier": 1.25,
        "peakHours": [
          "07:30-11:30",
          "16:30-19:30"
        ],
        "bestUncrowdedWindow": "Hiver hors week-end ou transition de marée vers La Gravière",
        "waveQualitySensitivity": 1.45,
        "fallbackSurgeOnBigSwell": 0.85
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "north_flank_wedge_focus",
        "swellMultiplier": 1.25,
        "explanation": "Effet majeur du flanc Nord du Gouf : l'onde réfractée en eau profonde remonte du Sud-Ouest et percute la houle WNW, créant des pics en triangle ('A-frames') d'une puissance exceptionnelle."
      }
    },
    {
      "id": "hossegor-la-graviere",
      "idNumero": 10,
      "northToSouthRank": 10,
      "commune": "Soorts-Hossegor",
      "name": "Hossegor — La Gravière",
      "shortName": "La Gravière",
      "aliases": [
        "Plage de la Gravière"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.67145,
          "lon": -1.4446,
          "label": "Pic mythique de La Gravière (à seulement 80-180m du bord !)"
        },
        "secondaryPeaks": [],
        "offshoreApiPoint": {
          "lat": 43.6715,
          "lon": -1.458
        },
        "parking": {
          "lat": 43.67085,
          "lon": -1.43965,
          "label": "Parking Boulevard de la Dune / Avenue du Front de Mer (La Gravière)"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 276,
        "beachOrientationText": "W (276°)",
        "idealOffshoreWindDeg": 96,
        "idealOffshoreToleranceDeg": {
          "min": 65,
          "max": 125
        },
        "idealOffshoreWindText": "E",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Exposé à l'Ouest ; par vent d'Est (90°-105°) soufflant par-dessus la dune, la lèvre est retenue et ouvre des cavernes cylindriques."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 285,
          "optimal": 305,
          "max": 325
        },
        "sizeMeters": {
          "min": 1.0,
          "optimalMin": 1.5,
          "optimalMax": 2.5,
          "maxHold": 3.2
        },
        "periodSec": {
          "min": 12,
          "optimalMin": 13,
          "optimalMax": 17,
          "maxHold": 19
        },
        "notes": "Contrairement aux beachbreaks ordinaires qui ferment à 16s, La Gravière adore les longues périodes (14-17s) canalisées sans perte par le Gouf !"
      },
      "idealTide": {
        "bestPhase": "Mi-marée montante à marée haute (souvent optimal de mi-marée à 1h30 avant le plein haut, puis redémarrage au début du descendant)",
        "optimalTideHeightM": {
          "min": 1.8,
          "max": 3.7
        },
        "highCoeffImpactGt85": "À marée basse ça casse à sec sur une marche de sable dur (dangereux et fermant). Par coeff >85 au plein haut, backwash explosif sur la pente raide et shorebreak de sortie capable de briser une planche en deux dans 50 cm d'eau."
      },
      "waveProfile": {
        "waveType": "Heavy slabbing beachbreak (tubes cylindriques ultra-épais cassant tout près du bord)",
        "qualityRating": 10,
        "consistencyRating": 8.5,
        "skillLevel": "Confirmé à Expert uniquement (dès 1.3m)",
        "skillDetails": "La capitale européenne du tube sur sable (Pipeline des Landes) : engagement total, take-off sous la lèvre uniquement.",
        "localHazards": [
          "Impact d'une violence extrême sur un banc de sable compacté très peu profond (risque traumatique cervical/épaule)",
          "Record européen de planches cassées à la minute les jours de houle longue",
          "Shorebreak de sortie traître à marée haute",
          "Localisme affirmé et hiérarchie stricte au pic (locaux historiques + élite pro mondiale)"
        ]
      },
      "practicalInfo": {
        "parking": "Stationnement gratuit hors été (payant ou très réglementé en haute saison) le long du Boulevard de la Dune ; saturé lors des bonnes sessions.",
        "showersAndFacilities": "Douches et poste MNS en saison, amphithéâtre naturel sur la dune où des centaines de spectateurs regardent les tubes.",
        "surfSchoolsAndClubs": "Hossegor Surf Club (basé Plage Centrale mais entraîne l'élite ici) ; aucun cours débutant sur le pic de La Gravière quand ça rentre !",
        "waterVibe": "Arène gladiateur : intense, silencieuse, ultra-sélective mais respectueuse de l'engagement pur."
      },
      "crowdFactor": {
        "basePopularity": 9.0,
        "summerPeakScore": 8.5,
        "autumnPeakScore": 10.0,
        "winterScore": 7.5,
        "weekendMultiplier": 1.25,
        "peakHours": [
          "Créneau de marée mi-montante à haute (prime sur l'heure solaire !)"
        ],
        "bestUncrowdedWindow": " Sessions froides de janvier-février en semaine (mais jamais seul si c'est 2m offshore !)",
        "waveQualitySensitivity": 1.5,
        "fallbackSurgeOnBigSwell": 0.9
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "north_flank_direct_amplification",
        "swellMultiplier": 1.35,
        "explanation": "Cœur du miracle d'Hossegor : grâce aux eaux abyssales du Gouf juste au Sud-Ouest, la houle arrive au pied du talus côtier sans avoir subi le freinage d'un plateau continental et décharge 100% de son énergie océanique à 50m de la plage."
      }
    },
    {
      "id": "hossegor-la-nord",
      "idNumero": 11,
      "northToSouthRank": 11,
      "commune": "Soorts-Hossegor",
      "name": "Hossegor — La Nord (Plage Centrale)",
      "shortName": "La Nord",
      "aliases": [
        "La Nord d'Hossegor",
        "Outer Sandbar Place des Landais",
        "Plage Centrale Hossegor"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.66565,
          "lon": -1.4488,
          "label": "Pic Big-Wave de La Nord (barre au large à 450-600m du rivage !)"
        },
        "secondaryPeaks": [
          {
            "name": "Reform / Beachbreak de bord Plage Centrale (par petite houle <1.2m)",
            "lat": 43.6651,
            "lon": -1.4452
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.666,
          "lon": -1.46
        },
        "parking": {
          "lat": 43.66387,
          "lon": -1.44128,
          "label": "Parkings Place des Landais / Boulevard de la Dune (Plage Centrale)"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 280,
        "beachOrientationText": "W / WNW (280°)",
        "idealOffshoreWindDeg": 100,
        "idealOffshoreToleranceDeg": {
          "min": 70,
          "max": 130
        },
        "idealOffshoreWindText": "E / ESE",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Pic situé à 500m en mer : totalement exposé au moindre vent, exige un vent d'Est faible à modéré ou un glassy pur."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 285,
          "optimal": 305,
          "max": 325
        },
        "sizeMeters": {
          "min": 2.0,
          "optimalMin": 2.5,
          "optimalMax": 4.5,
          "maxHold": 6.0
        },
        "periodSec": {
          "min": 13,
          "optimalMin": 14,
          "optimalMax": 19,
          "maxHold": 22
        },
        "notes": "La Nord est l'unique vrai spot de grosses vagues (Big Wave outer bar) des Landes : le haut-fond du large ne s'active qu'à partir de 2m-2.5m et tient jusqu'à 5-6m+ en longs murs massifs (surtout en droite vers le chenal du Gouf, façon Sunset Beach)."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée (montante ou descendante) ; par houle XXL (>4.5m), fonctionne aussi à mi-haute",
        "optimalTideHeightM": {
          "min": 0.5,
          "max": 2.5
        },
        "highCoeffImpactGt85": "Par gros coeff (>85) à marée basse, les séries fantômes ('cleanup sets') décalées au large balaient tout le line-up et le courant vers la fosse du Gouf au Sud est impressionnant."
      },
      "waveProfile": {
        "waveType": "Barre externe de gros (Outer sandbar big-wave point-like right & left)",
        "qualityRating": 9.5,
        "consistencyRating": 5,
        "skillLevel": "Expert uniquement (sur le vrai banc du large dès 2.5m+)",
        "skillDetails": "Gun / Step-up (6'8\" à 9'0\"), leash gros surf, apnée et caisse physique irréprochables obligatoires. (En été <1.2m, le bord sert d'école).",
        "localHazards": [
          "Séries décalées ('cleanup sets') venues du Gouf qui ferment à 600m du bord",
          "Rame interminable (15 à 25 min) et isolement loin du rivage en cas de casse de leash (nage très longue en eau froide)",
          "Courant puissant tirant vers le chenal profond du Gouf au Sud (qui sert aussi de passe de remontée pour les initiés !)",
          "Masse d'eau colossale à l'impact"
        ]
      },
      "practicalInfo": {
        "parking": "Place des Landais / Boulevard de laMer (gratuit l'hiver pendant la saison de gros, payant et saturé l'été).",
        "showersAndFacilities": "Douches, WC, Hossegor Surf Club, bars et restaurants mythiques de la Place des Landais (Rock Food, etc.).",
        "surfSchoolsAndClubs": "Hossegor Surf Club (organisateur du légendaire Rip Curl Challenge La Nord).",
        "waterVibe": "Fraternité et respect mutuel des chargeurs de gros l'hiver ; ambiance balnéaire ultra-animée au bord l'été."
      },
      "crowdFactor": {
        "basePopularity": 7.0,
        "summerPeakScore": 9.0,
        "autumnPeakScore": 7.5,
        "winterScore": 5.5,
        "weekendMultiplier": 1.2,
        "peakHours": [
          "09:00-13:00 les jours de houle >3m",
          "10:00-18:00 au bord en été"
        ],
        "bestUncrowdedWindow": "Sur le banc du large à 3.5m+, la sélection naturelle limite le line-up à 15-35 chargeurs équipés de guns !",
        "waveQualitySensitivity": 1.4,
        "fallbackSurgeOnBigSwell": 1.35
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "north_shoulder_deepwater_focus",
        "swellMultiplier": 1.4,
        "explanation": "Posée directement sur l'épaule Nord surplombant l'abîme du Gouf : la houle longue sort du canyon profond, lève un pic massif à 500m au large, tandis que la fosse du Gouf immédiatement au Sud offre un chenal d'eau profonde où la vague s'éteint."
      }
    },
    {
      "id": "hossegor-la-sud",
      "idNumero": 12,
      "northToSouthRank": 12,
      "commune": "Soorts-Hossegor",
      "name": "Hossegor — La Sud",
      "shortName": "La Sud",
      "aliases": [
        "Plage du Sud",
        "Point d'Or",
        "La Kiddies"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.66205,
          "lon": -1.4468,
          "label": "Pic abrité de La Sud (220m au large)"
        },
        "secondaryPeaks": [],
        "offshoreApiPoint": {
          "lat": 43.6625,
          "lon": -1.458
        },
        "parking": {
          "lat": 43.66095,
          "lon": -1.4426,
          "label": "Parking de la Plage Sud / Point d'Or & Impasse de la Digue Nord"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 286,
        "beachOrientationText": "WNW (286°)",
        "idealOffshoreWindDeg": 106,
        "idealOffshoreToleranceDeg": {
          "min": 75,
          "max": 140
        },
        "idealOffshoreWindText": "E / ESE",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": true,
          "details": "Légèrement protégée du clapot de Sud / Sud-Ouest par la jetée Nord d'entrée du port de Capbreton et les résidences du Point d'Or."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 280,
          "optimal": 305,
          "max": 330
        },
        "sizeMeters": {
          "min": 0.9,
          "optimalMin": 1.5,
          "optimalMax": 3.0,
          "maxHold": 4.5
        },
        "periodSec": {
          "min": 10,
          "optimalMin": 11,
          "optimalMax": 17,
          "maxHold": 20
        },
        "notes": "Les tailles indiquées correspondent à la houle au large ! Grâce au Gouf, une houle de 2.5m au large donne un 1.2m-1.5m doux et déroulant à La Sud (alors qu'en dessous de 0.8m au large, le spot est souvent presque plat)."
      },
      "idealTide": {
        "bestPhase": "Mi-marée montante à marée haute (et début de descendante)",
        "optimalTideHeightM": {
          "min": 1.6,
          "max": 3.9
        },
        "highCoeffImpactGt85": "Par gros coeff (>85) au plein haut, il ne reste presque plus de plage sèche devant l'enrochement/promenade du Point d'Or avec du ressac et un courant longeant la jetée Nord de la passe de Capbreton."
      },
      "waveProfile": {
        "waveType": "Beachbreak amorti de repli (vagues douces, longues et progressives)",
        "qualityRating": 7.5,
        "consistencyRating": 6.5,
        "skillLevel": "Débutant à Intermédiaire (Tous niveaux en repli par grosse houle)",
        "skillDetails": "Surnommée 'La Kiddies' : le spot d'apprentissage, de longboard et des jeunes espoirs d'Hossegor, et repli majeur l'hiver.",
        "localHazards": [
          "Enrochements de la jetée Nord de la passe du port de Capbreton au Sud du spot",
          "Surpopulation extrême dans l'eau (collisions, débutants qui lâchent leur planche, écoles)",
          "Courant traversier vers l'entrée du port à marée montante/descendante"
        ]
      },
      "practicalInfo": {
        "parking": "Places le long du Point d'Or / Boulevard des Dunes (payant et ultra-saturé en été, accessible à pied/vélo en 3 min depuis la Place des Landais).",
        "showersAndFacilities": "Douches, WC, poste MNS (mai-octobre), restaurants et glaciers en front de mer.",
        "surfSchoolsAndClubs": "Concentration maximale des écoles de surf d'Hossegor.",
        "waterVibe": "Familiale, longboard, kids du club et débutants l'été ; surpeuplée de tous niveaux l'hiver quand le reste de la côte affiche 3m50."
      },
      "crowdFactor": {
        "basePopularity": 8.5,
        "summerPeakScore": 10.0,
        "autumnPeakScore": 8.5,
        "winterScore": 7.0,
        "weekendMultiplier": 1.3,
        "peakHours": [
          "10:00-18:00 en été",
          "Autour de la marée haute dès que la houle dépasse 2.2m ailleurs"
        ],
        "bestUncrowdedWindow": "06:30-08:30 avant l'ouverture des écoles de surf",
        "waveQualitySensitivity": 1.2,
        "fallbackSurgeOnBigSwell": 1.65
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "canyon_head_shadow_attenuation",
        "swellMultiplier": 0.5,
        "explanation": "Située pile face à la tête du Gouf de Capbreton : la divergence des crêtes au-dessus de la fosse divise la hauteur des vagues par ~2 par rapport à La Nord située seulement 450 mètres plus au Nord !"
      }
    },
    {
      "id": "capbreton-notre-dame-miramar",
      "idNumero": 13,
      "northToSouthRank": 13,
      "commune": "Capbreton",
      "name": "Capbreton — Notre-Dame / Miramar (L'Estacade)",
      "shortName": "Notre-Dame / Miramar",
      "aliases": [
        "Plage Notre-Dame",
        "Plage de l'Estacade",
        "Miramar",
        "La Centrale Capbreton"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.6538,
          "lon": -1.4488,
          "label": "Pic Miramar / Estacade Sud (240m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "Pic de Notre-Dame (Rive Nord de la Passe)",
            "lat": 43.6577,
            "lon": -1.4489
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.655,
          "lon": -1.458
        },
        "parking": {
          "lat": 43.6532,
          "lon": -1.4439,
          "label": "Parking Souterrain & Esplanade de la Liberté / Estacade (Rive Sud)"
        },
        "secondaryParkings": [
          {
            "name": "Parking Plage Notre-Dame / Boulevard François Mitterrand (Rive Nord)",
            "lat": 43.65725,
            "lon": -1.4445
          }
        ]
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 274,
        "beachOrientationText": "W (270° à Miramar/Estacade, 279° à Notre-Dame)",
        "idealOffshoreWindDeg": 94,
        "idealOffshoreToleranceDeg": {
          "min": 60,
          "max": 125
        },
        "idealOffshoreWindText": "E / ENE",
        "windProtection": {
          "isProtectedNorth": true,
          "isProtectedSouth": false,
          "details": "Côté Miramar / Estacade / Centrale (rive Sud de la passe), l'Estacade + la digue Nord + l'esplanade urbaine coupent efficacement le vent de Nord à Nord-Nord-Est !"
        }
      },
      "idealSwell": {
        "directionsText": "WNW / W",
        "directionsDeg": {
          "min": 270,
          "optimal": 295,
          "max": 320
        },
        "sizeMeters": {
          "min": 1.0,
          "optimalMin": 1.6,
          "optimalMax": 3.0,
          "maxHold": 4.2
        },
        "periodSec": {
          "min": 10,
          "optimalMin": 11,
          "optimalMax": 16,
          "maxHold": 19
        },
        "notes": "Comme La Sud et Le Prévent, secteur fortement amorti par la tête du Gouf : nécessite au moins 1.2m-1.5m au large pour bien dérouler."
      },
      "idealTide": {
        "bestPhase": "Mi-marée montante à marée haute",
        "optimalTideHeightM": {
          "min": 1.7,
          "max": 3.8
        },
        "highCoeffImpactGt85": "Par coeff >85 au plein haut, la mer tape directement le perré de l'Esplanade de la Liberté et recouvre les épis rocheux (gros backwash et sortie de l'eau délicate) ; fort courant de marée dans la passe du port."
      },
      "waveProfile": {
        "waveType": "Beachbreak urbain compartimenté par l'Estacade et des épis rocheux (repli abrité)",
        "qualityRating": 7,
        "consistencyRating": 6.5,
        "skillLevel": "Débutant à Confirmé",
        "skillDetails": "Vagues ludiques et abritées idéales en longboard, fish ou repli hivernal quand ça souffle Nord/Nord-Est.",
        "localHazards": [
          "Piliers en bois et enrochements de l'Estacade (interdiction de surfer dans le chenal de navigation des bateaux !)",
          "Épis rocheux immergés à marée haute entre l'Estacade et la Centrale",
          "Ressac contre le mur du front de mer par grande marée haute"
        ]
      },
      "practicalInfo": {
        "parking": "Parking souterrain du Casino/Esplanade (payant en saison) ou parkings du port de pêche / marché aux poissons.",
        "showersAndFacilities": "Douches, WC, postes MNS, vue iconique sur l'Estacade de 1858, restaurants du front de mer et CERS à proximité.",
        "surfSchoolsAndClubs": "Écoles de surf de l'Estacade / Capbreton.",
        "waterVibe": "Urbaine, détendue et pittoresque au pied de l'Estacade et des bateaux de pêche rentrant au port."
      },
      "crowdFactor": {
        "basePopularity": 7.0,
        "summerPeakScore": 8.5,
        "autumnPeakScore": 7.0,
        "winterScore": 6.0,
        "weekendMultiplier": 1.25,
        "peakHours": [
          "10:30-12:30",
          "15:00-18:30",
          "Jours de grosse houle + vent de Nord"
        ],
        "bestUncrowdedWindow": "Matinée à mi-montant hors vacances scolaires",
        "waveQualitySensitivity": 1.2,
        "fallbackSurgeOnBigSwell": 1.45
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "canyon_head_axis_shadow",
        "swellMultiplier": 0.55,
        "explanation": "Exactement à l'aplomb de la tête du Gouf (à 300m du bout de l'Estacade) : défocalisation maximale de la houle, raison historique pour laquelle l'entrée du port de Capbreton reste franchissable même par houle solide."
      }
    },
    {
      "id": "capbreton-le-santocha",
      "idNumero": 14,
      "northToSouthRank": 15,
      "commune": "Capbreton",
      "name": "Capbreton — Le Santocha (La Savane)",
      "shortName": "Le Santocha",
      "aliases": [
        "La Savane",
        "Santosha",
        "Les Blockhaus de Capbreton"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.64624,
          "lon": -1.44999,
          "label": "Pic du Santocha face aux Blockhaus (300m au large)"
        },
        "secondaryPeaks": [],
        "offshoreApiPoint": {
          "lat": 43.646,
          "lon": -1.459
        },
        "parking": {
          "lat": 43.64635,
          "lon": -1.44395,
          "label": "Parking du Santocha / Allée des Ortolans & fin Promenade du Front de Mer"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 278,
        "beachOrientationText": "W (278°)",
        "idealOffshoreWindDeg": 98,
        "idealOffshoreToleranceDeg": {
          "min": 65,
          "max": 125
        },
        "idealOffshoreWindText": "E",
        "windProtection": {
          "isProtectedNorth": true,
          "isProtectedSouth": false,
          "details": "Protection partielle et appréciable sur la partie Nord du spot contre un vent de N / NNE modéré grâce à l'avancée de l'Estacade, des épis et du front de mer bâti de Capbreton au Nord."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 280,
          "optimal": 300,
          "max": 320
        },
        "sizeMeters": {
          "min": 0.7,
          "optimalMin": 1.2,
          "optimalMax": 2.2,
          "maxHold": 2.8
        },
        "periodSec": {
          "min": 10,
          "optimalMin": 11,
          "optimalMax": 15,
          "maxHold": 16
        },
        "notes": "Note géographique : Le Santocha (43.6458°N) se situe immédiatement au SUD du Prévent (43.6496°N). C'est ici que l'on sort de l'ombre du Gouf : les vagues prennent soudainement 40 à 60% de taille et de creux par rapport au Prévent !"
      },
      "idealTide": {
        "bestPhase": "Mi-marée montante à marée haute (et basse à mi-marée par petite houle <1.2m)",
        "optimalTideHeightM": {
          "min": 1.2,
          "max": 3.5
        },
        "highCoeffImpactGt85": "Par gros coeff (>85) à marée haute, les vagues viennent percuter directement les blockhaus ensablés sur la plage avec un fort shorebreak, et certains blocs de béton immergés deviennent invisibles sous la mousse !"
      },
      "waveProfile": {
        "waveType": "Beachbreak creux et rapide calé autour des blockhaus et du dernier épi Sud",
        "qualityRating": 8.5,
        "consistencyRating": 8.5,
        "skillLevel": "Intermédiaire à Confirmé",
        "skillDetails": "Plus accessible et tolérant que La Piste juste au Sud, mais nettement plus puissant et tubulaire que Le Prévent juste au Nord.",
        "localHazards": [
          "DANGER MAJEUR : Blockhaus (bunkers du Mur de l'Atlantique) sur l'estran et blocs de béton immergés/affleurants selon l'ensablement !",
          "Épi rocheux délimitant le Nord du spot (frontière avec Le Prévent)",
          "Shorebreak puissant à marée haute",
          "Localisme présent (fief historique du Capbreton Surf Club : courtoisie et respect des priorités impératifs)"
        ]
      },
      "practicalInfo": {
        "parking": "Parking gratuit très prisé juste derrière le club et la dune (vite complet toute l'année dès qu'il y a des vagues ; pistes cyclables idéales).",
        "showersAndFacilities": "Douches, WC, poste MNS, cabane de plage conviviale et vue carte postale sur les blockhaus graffés et les Pyrénées.",
        "surfSchoolsAndClubs": "Capbreton Surf Club (fondé en 1973, l'un des clubs les plus titrés de France, niché au pied de la dune du Santocha) + écoles locales.",
        "waterVibe": "L'âme surf de Capbreton : authentique, locale, intergénérationnelle mais exigeante sur le respect au pic."
      },
      "crowdFactor": {
        "basePopularity": 8.5,
        "summerPeakScore": 9.5,
        "autumnPeakScore": 9.0,
        "winterScore": 7.0,
        "weekendMultiplier": 1.3,
        "peakHours": [
          "08:30-12:00",
          "16:30-19:30 (session afterwork locale)"
        ],
        "bestUncrowdedWindow": "Aube froide en semaine ou décalage de 200m vers le Sud entre Santocha et La Piste",
        "waveQualitySensitivity": 1.35,
        "fallbackSurgeOnBigSwell": 1.1
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "south_flank_transition_amplification",
        "swellMultiplier": 1.15,
        "explanation": "Zone de transition franche sur le rebord Sud du Gouf : en 400 mètres entre Le Prévent et Le Santocha, on quitte le cône d'ombre pour recevoir la réfraction convergente du flanc Sud du canyon."
      }
    },
    {
      "id": "capbreton-le-prevent",
      "idNumero": 15,
      "northToSouthRank": 14,
      "commune": "Capbreton",
      "name": "Capbreton — Le Prévent",
      "shortName": "Le Prévent",
      "aliases": [
        "Plage du Prévent",
        "Ancien Préventorium / CERS"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.64963,
          "lon": -1.45032,
          "label": "Pic du Prévent entre les deux épis rocheux (260m au large)"
        },
        "secondaryPeaks": [],
        "offshoreApiPoint": {
          "lat": 43.65,
          "lon": -1.459
        },
        "parking": {
          "lat": 43.6495,
          "lon": -1.44425,
          "label": "Stationnement Boulevard du Docteur Junqua / CERS — Le Prévent"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 270,
        "beachOrientationText": "Plein Ouest (270°)",
        "idealOffshoreWindDeg": 90,
        "idealOffshoreToleranceDeg": {
          "min": 55,
          "max": 125
        },
        "idealOffshoreWindText": "E / ENE",
        "windProtection": {
          "isProtectedNorth": true,
          "isProtectedSouth": false,
          "details": "Bonne protection relative contre les vents de Nord et Nord-Nord-Est grâce au front bâti continu de Capbreton, au bâtiment du CERS et au décrochement de l'Estacade au Nord."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 280,
          "optimal": 302,
          "max": 325
        },
        "sizeMeters": {
          "min": 1.1,
          "optimalMin": 1.8,
          "optimalMax": 3.2,
          "maxHold": 4.8
        },
        "periodSec": {
          "min": 10,
          "optimalMin": 12,
          "optimalMax": 17,
          "maxHold": 20
        },
        "notes": "LE spot de repli roi de Capbreton ! Encadré par deux gros épis rocheux et adouci par la tête du Gouf, il reste surfable et bien rangé quand toute la côte landaise ferme à 3m-4m !"
      },
      "idealTide": {
        "bestPhase": "Mi-marée montante à marée haute (et mi-descendante)",
        "optimalTideHeightM": {
          "min": 1.5,
          "max": 3.7
        },
        "highCoeffImpactGt85": "Attention à marée très haute par coeff >85 : les épis rocheux sont partiellement submergés (invisibles entre deux séries !) et le clapot rebondit sur la digue-promenade piétonne en créant un backwash piégeux."
      },
      "waveProfile": {
        "waveType": "Beachbreak de repli encadré par deux épis rocheux (vagues longues et maniables)",
        "qualityRating": 7.5,
        "consistencyRating": 6.5,
        "skillLevel": "Débutant à Confirmé (Intermédiaire+ requis par gros swell d'hiver)",
        "skillDetails": "Spot école doux par houle moyenne, qui se transforme en point de ralliement ultra-qualitatif lors des grosses tempêtes d'hiver.",
        "localHazards": [
          "Épis rocheux massifs au Nord et au Sud de la baie (rochers coupants et moules)",
          "Courants d'arrachement ('rips d'épi') filant vers le large exactement le long des enrochements !",
          "Foule compacte les jours de repli hivernal (jusqu'à 80+ surfeurs concentrés entre les deux épis)"
        ]
      },
      "practicalInfo": {
        "parking": "Stationnement le long du Boulevard du Dr Junqua ou parking Santocha/Centrale à 5 min à pied par la promenade piétonne.",
        "showersAndFacilities": "Douches, WC, poste MNS, promenade bétonnée idéale pour checker le spot au sec.",
        "surfSchoolsAndClubs": "Nombreuses écoles de surf de Capbreton en saison.",
        "waterVibe": "Familiale et longboard l'été ; studieuse et très dense l'hiver quand toute la région s'y replie."
      },
      "crowdFactor": {
        "basePopularity": 8.0,
        "summerPeakScore": 9.0,
        "autumnPeakScore": 8.0,
        "winterScore": 7.5,
        "weekendMultiplier": 1.3,
        "peakHours": [
          "10:00-18:00 en été",
          "Marée mi-haute à haute par houle >2.5m toute l'année"
        ],
        "bestUncrowdedWindow": "Aube par houle moyenne d'automne (quand les bons surfeurs préfèrent Santocha ou La Piste)",
        "waveQualitySensitivity": 1.25,
        "fallbackSurgeOnBigSwell": 1.75
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "canyon_head_south_margin_shadow",
        "swellMultiplier": 0.65,
        "explanation": "Encore protégé par la bordure Sud du cône d'ombre du Gouf de Capbreton ET stabilisé par ses épis rocheux : atténue environ un tiers de la taille brute du large."
      }
    },
    {
      "id": "capbreton-la-piste-vvf",
      "idNumero": 16,
      "northToSouthRank": 16,
      "commune": "Capbreton",
      "name": "Capbreton — La Piste / VVF (Les Océanides)",
      "shortName": "La Piste / VVF",
      "aliases": [
        "La Piste",
        "Les Bunkers Sud",
        "Le VVF",
        "Plage des Océanides",
        "La Pointe (Sud VVF)"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.6425,
          "lon": -1.4508,
          "label": "Pic tubulaire de La Piste (220m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "Pic du VVF / Plage des Océanides",
            "lat": 43.6383,
            "lon": -1.45379
          },
          {
            "name": "La Pointe (Sud VVF, sauvage)",
            "lat": 43.6315,
            "lon": -1.4572
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.64,
          "lon": -1.462
        },
        "parking": {
          "lat": 43.6412,
          "lon": -1.4451,
          "label": "Parking de La Piste (Allée des Ortolans Sud / Piste forestière)"
        },
        "secondaryParkings": [
          {
            "name": "Grand Parking de la Plage des Océanides (VVF)",
            "lat": 43.63685,
            "lon": -1.4465
          }
        ]
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 290,
        "beachOrientationText": "WNW (289° à La Piste, 293° au VVF)",
        "idealOffshoreWindDeg": 110,
        "idealOffshoreToleranceDeg": {
          "min": 80,
          "max": 140
        },
        "idealOffshoreWindText": "ESE / E",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Inflexion de la côte vers le Sud-Ouest : l'offshore idéal bascule à l'ESE (110°) ; aucune protection contre les vents d'Ouest ou Nord."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 285,
          "optimal": 305,
          "max": 325
        },
        "sizeMeters": {
          "min": 0.7,
          "optimalMin": 1.2,
          "optimalMax": 2.5,
          "maxHold": 3.0
        },
        "periodSec": {
          "min": 11,
          "optimalMin": 12,
          "optimalMax": 16,
          "maxHold": 17
        },
        "notes": "Focalisé plein pot par le flanc Sud du Gouf : La Piste délivre des tubes ultra-rapides et très creux (souvent considérée comme l'équivalent capbretonnais de La Gravière, avec des droites légendaires) ; le VVF offre des pics légèrement plus étalés."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante (parfois jusqu'à mi-haute selon l'épaisseur du banc)",
        "optimalTideHeightM": {
          "min": 0.6,
          "max": 2.7
        },
        "highCoeffImpactGt85": "Par coeff >85, la fenêtre de tir entre bas et mi-montant est explosive mais courte ; au plein haut, terrible shorebreak qui claque directement sur la pente abrupte de la dune."
      },
      "waveProfile": {
        "waveType": "Beachbreak tubulaire ultra-rapide et creux (barrels de bord puissants)",
        "qualityRating": 9.5,
        "consistencyRating": 9,
        "skillLevel": "Confirmé à Expert (La Piste) ; Intermédiaire à Confirmé (VVF / Océanides)",
        "skillDetails": "Take-off engagé, réflexes éclairs indispensables pour se caler sous la lèvre avant la fermeture.",
        "localHazards": [
          "Vagues ultra-creuses cassant dans peu d'eau (grosse casse de planches et ailerons)",
          "Vestiges de blockhaus vers la jonction Nord (Santocha/La Piste)",
          "Localisme marqué à La Piste (spot adoré des meilleurs tube-riders locaux et pros : ne jamais griller une priorité)",
          "Baïnes puissantes en descendant vers le VVF et La Pointe"
        ]
      },
      "practicalInfo": {
        "parking": "Parking sablonneux limité à La Piste ; très grand parking gratuit (avec portiques saisonniers) aux Océanides / VVF à 500m au Sud.",
        "showersAndFacilities": "Poste MNS, douches, WC et snacks/écoles aux Océanides (VVF) ; La Piste est plus brute et dunaire.",
        "surfSchoolsAndClubs": "Écoles basées aux Océanides / VVF (qui évitent le pic principal de La Piste quand c'est creux).",
        "waterVibe": "Engagée, core et électrique à La Piste ; plus aérée et décontractée en marchant vers le VVF et La Pointe."
      },
      "crowdFactor": {
        "basePopularity": 8.5,
        "summerPeakScore": 9.0,
        "autumnPeakScore": 9.5,
        "winterScore": 7.0,
        "weekendMultiplier": 1.25,
        "peakHours": [
          "07:30-11:30",
          "16:30-19:30"
        ],
        "bestUncrowdedWindow": "Marcher 500m au Sud du VVF vers La Pointe pour trouver des pics solitaires",
        "waveQualitySensitivity": 1.45,
        "fallbackSurgeOnBigSwell": 0.85
      },
      "goufInfluence": {
        "isAffected": true,
        "type": "south_flank_direct_amplification",
        "swellMultiplier": 1.3,
        "explanation": "Plein foyer de convergence du flanc Sud du Gouf : les houles de NW réfractent sur le rebord Sud du canyon et arrivent avec une énergie survoltée et un angle idéal qui ouvre de longs tubes."
      }
    },
    {
      "id": "labenne-ocean-centrale-chapelle",
      "idNumero": 17,
      "northToSouthRank": 17,
      "commune": "Labenne",
      "name": "Labenne-Océan — Plage Centrale / Chapelle",
      "shortName": "Labenne-Océan",
      "aliases": [
        "Plage Centrale de Labenne",
        "La Chapelle Sainte-Thérèse (Nord)",
        "Hélio-Marin"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.60089,
          "lon": -1.47623,
          "label": "Pic Plage Centrale Labenne (350m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "Pic de la Chapelle / Hélio-Marin (Nord)",
            "lat": 43.6062,
            "lon": -1.4728
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.602,
          "lon": -1.488
        },
        "parking": {
          "lat": 43.59885,
          "lon": -1.47065,
          "label": "Parking Esplanade de la Plage Centrale (Avenue de la Plage)"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 295,
        "beachOrientationText": "WNW (295°)",
        "idealOffshoreWindDeg": 115,
        "idealOffshoreToleranceDeg": {
          "min": 85,
          "max": 145
        },
        "idealOffshoreWindText": "ESE",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Grande plage rectiligne sans abri face au Golfe de Gascogne, avec panorama grandiose sur la Rhune et la Côte Basque."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 290,
          "optimal": 310,
          "max": 330
        },
        "sizeMeters": {
          "min": 0.6,
          "optimalMin": 1.0,
          "optimalMax": 1.8,
          "maxHold": 2.2
        },
        "periodSec": {
          "min": 8,
          "optimalMin": 9,
          "optimalMax": 13,
          "maxHold": 14
        },
        "notes": "Changement morphologique typique du Seignanx : grain de sable plus épais et pente d'estran très forte ! Préfère les houles courtes à moyennes (9-12s) ; au-delà de 14s et 2m, longues barres fermantes fréquentes."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante uniquement",
        "optimalTideHeightM": {
          "min": 0.5,
          "max": 2.3
        },
        "highCoeffImpactGt85": "À marée haute (surtout par coeff >85), le talus très raide provoque un shorebreak 'coup de fusil' injouable en surf et un énorme backwash (paradis occasionnel des bodyboardeurs/bodysurfeurs aguerris, enfer pour les planches en fibre)."
      },
      "waveProfile": {
        "waveType": "Beachbreak pentu et percutant sur sable grossier (creux au bord)",
        "qualityRating": 6.5,
        "consistencyRating": 8.5,
        "skillLevel": "Intermédiaire à Confirmé (Débutant à marée basse par <0.8m)",
        "skillDetails": "Demande de bons bancs de baïnes pour ne pas fermer ; très apprécié en bodyboard pour ses rampes puissantes.",
        "localHazards": [
          "Shorebreak redoutable sur pente raide dès mi-marée haute",
          "Courants de baïnes très forts au Nord (vers La Chapelle) et au Sud (zones non surveillées)",
          "Blockhaus de la Seconde Guerre mondiale présents sur la plage au Nord et au Sud"
        ]
      },
      "practicalInfo": {
        "parking": "Un seul grand parking gratuit au bout de l'Avenue de la Plage (vite saturé les après-midis d'été ; navette Yégo Plage et piste cyclable en pinède).",
        "showersAndFacilities": "Douches, WC, poste MNS, esplanade avec restaurants/glaciers et aire de jeux.",
        "surfSchoolsAndClubs": "Labenne Surf Club & écoles locales sur l'esplanade.",
        "waterVibe": "Locale, familiale et nettement moins 'm'as-tu-vu' qu'Hossegor ; beaucoup d'espace en marchant vers La Chapelle au Nord."
      },
      "crowdFactor": {
        "basePopularity": 5.5,
        "summerPeakScore": 7.5,
        "autumnPeakScore": 5.5,
        "winterScore": 3.0,
        "weekendMultiplier": 1.25,
        "peakHours": [
          "09:30-12:00",
          "16:30-19:00"
        ],
        "bestUncrowdedWindow": "Marche de 10 min vers le Nord (Chapelle Sainte-Thérèse) à marée basse",
        "waveQualitySensitivity": 1.2,
        "fallbackSurgeOnBigSwell": 0.5
      },
      "goufInfluence": {
        "isAffected": false,
        "type": "none",
        "swellMultiplier": 1.0,
        "explanation": "Au Sud de la zone d'influence du Gouf : bathymétrie rectiligne et pentue typique de la côte Labenne-Ondres-Tarnos."
      }
    },
    {
      "id": "ondres-plage",
      "idNumero": 18,
      "northToSouthRank": 18,
      "commune": "Ondres",
      "name": "Ondres-Plage",
      "shortName": "Ondres",
      "aliases": [
        "Plage d'Ondres"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.57916,
          "lon": -1.49184,
          "label": "Pic central d'Ondres-Plage (350m au large)"
        },
        "secondaryPeaks": [],
        "offshoreApiPoint": {
          "lat": 43.58,
          "lon": -1.505
        },
        "parking": {
          "lat": 43.5763,
          "lon": -1.4842,
          "label": "Nouveau Parking rétro-dunaire d'Ondres-Plage (Avenue de la Plage)"
        },
        "secondaryParkings": []
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 297,
        "beachOrientationText": "WNW (297°)",
        "idealOffshoreWindDeg": 117,
        "idealOffshoreToleranceDeg": {
          "min": 85,
          "max": 145
        },
        "idealOffshoreWindText": "ESE",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": false,
          "details": "Plage sauvage renaturée totalement ouverte aux vents d'Ouest et du Nord."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW",
        "directionsDeg": {
          "min": 290,
          "optimal": 312,
          "max": 335
        },
        "sizeMeters": {
          "min": 0.6,
          "optimalMin": 1.0,
          "optimalMax": 1.8,
          "maxHold": 2.2
        },
        "periodSec": {
          "min": 8,
          "optimalMin": 9,
          "optimalMax": 13,
          "maxHold": 14
        },
        "notes": "Comme Labenne, plage de gros sable à forte pente : excellente sur les petites à moyennes houles propres d'ESE, vite fermante si >2m/15s."
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante",
        "optimalTideHeightM": {
          "min": 0.5,
          "max": 2.3
        },
        "highCoeffImpactGt85": "Par coeff >85, la mer monte très haut sur la pente de gravier/sable grossier : rouleau de bord brutal et fort courant de baïne."
      },
      "waveProfile": {
        "waveType": "Beachbreak sauvage et puissant sur estran pentu",
        "qualityRating": 6.5,
        "consistencyRating": 8.5,
        "skillLevel": "Intermédiaire à Confirmé (Débutant par petites conditions à marée basse)",
        "skillDetails": "Vagues franches et rapides loin de l'agitation touristique d'Hossegor et d'Anglet.",
        "localHazards": [
          "Shorebreak sec et puissant dès que la marée dépasse la mi-haute",
          "Baïnes profondes et courants d'arrachement",
          "Marche d'accès légèrement allongée depuis le recul écologique du parking derrière la dune"
        ]
      },
      "practicalInfo": {
        "parking": "Parking gratuit éco-aménagé en retrait de la dune + navette estivale gratuite depuis Ondres-Bourg et grand parking vélos.",
        "showersAndFacilities": "Poste MNS, sanitaires et petits snacks saisonniers à l'entrée de la dune.",
        "surfSchoolsAndClubs": "Écoles de surf locales d'Ondres (ambiance très conviviale).",
        "waterVibe": "Tranquille, locale (Seignanx / Bayonne Nord) et familiale, avec vue imprenable sur Biarritz et les montagnes basques."
      },
      "crowdFactor": {
        "basePopularity": 4.5,
        "summerPeakScore": 6.5,
        "autumnPeakScore": 4.5,
        "winterScore": 2.5,
        "weekendMultiplier": 1.2,
        "peakHours": [
          "09:30-12:00",
          "17:00-19:30"
        ],
        "bestUncrowdedWindow": "Quasi toute l'année en marchant 250m au Nord ou au Sud de l'accès central",
        "waveQualitySensitivity": 1.15,
        "fallbackSurgeOnBigSwell": 0.45
      },
      "goufInfluence": {
        "isAffected": false,
        "type": "none",
        "swellMultiplier": 1.0,
        "explanation": "Hors influence du Gouf de Capbreton."
      }
    },
    {
      "id": "tarnos-metro-la-digue",
      "idNumero": 19,
      "northToSouthRank": 19,
      "commune": "Tarnos",
      "name": "Tarnos — Le Métro / La Digue Nord",
      "shortName": "Le Métro / La Digue",
      "aliases": [
        "Plage de la Digue Nord de l'Adour",
        "La Digue Tarnos",
        "Plage du Métro"
      ],
      "coordinates": {
        "peak": {
          "lat": 43.53644,
          "lon": -1.52246,
          "label": "Pic de La Digue Nord de l'Adour (320m au large)"
        },
        "secondaryPeaks": [
          {
            "name": "Pic de la Plage du Métro (2.8 km plus au Nord)",
            "lat": 43.56104,
            "lon": -1.50445
          }
        ],
        "offshoreApiPoint": {
          "lat": 43.545,
          "lon": -1.535
        },
        "parking": {
          "lat": 43.53515,
          "lon": -1.5159,
          "label": "Parking de la Plage de la Digue (Route de la Barre / Zone Portuaire Tarnos)"
        },
        "secondaryParkings": [
          {
            "name": "Grand Parking de la Plage du Métro (Boulevard de la Plage)",
            "lat": 43.5582,
            "lon": -1.4975
          }
        ]
      },
      "orientationAndWind": {
        "beachAzimuthDeg": 298,
        "beachOrientationText": "WNW (298°)",
        "idealOffshoreWindDeg": 118,
        "idealOffshoreToleranceDeg": {
          "min": 85,
          "max": 165
        },
        "idealOffshoreWindText": "ESE / SE (et abri S / SSW à La Digue !)",
        "windProtection": {
          "isProtectedNorth": false,
          "isProtectedSouth": true,
          "details": "ATOUT STRATÉGIQUE MAJEUR À LA DIGUE NORD : L'immense Digue Nord de l'embouchure de l'Adour (~950m en mer) protège remarquablement le line-up des vents de Sud à Sud-Sud-Ouest (S / SSW) ! (La Plage du Métro 2.8 km plus au Nord est moins abritée)."
        }
      },
      "idealSwell": {
        "directionsText": "WNW / NW / NNW",
        "directionsDeg": {
          "min": 290,
          "optimal": 315,
          "max": 340
        },
        "sizeMeters": {
          "min": 0.7,
          "optimalMin": 1.2,
          "optimalMax": 2.2,
          "maxHold": 2.8
        },
        "periodSec": {
          "min": 9,
          "optimalMin": 10,
          "optimalMax": 15,
          "maxHold": 16
        },
        "notes": "La Digue Nord bloque le transit sableux Nord->Sud et renvoie un 'wedge' par réfraction sur l'ouvrage : superbes gauches longues et tubulaires et pics en A qui tiennent bien mieux la taille et la période que Labenne/Ondres !"
      },
      "idealTide": {
        "bestPhase": "Basse à mi-marée montante (La Digue fonctionne parfois jusqu'à mi-haute par houle solide)",
        "optimalTideHeightM": {
          "min": 0.5,
          "max": 2.8
        },
        "highCoeffImpactGt85": "Par coeff >85 au plein haut, gros backwash croisé entre la pente de galets/sable grossier et la réflexion sur la Digue Nord ; courant fluvial de l'Adour accentué en sortie d'estuaire."
      },
      "waveProfile": {
        "waveType": "Jetty wedge & bancs calés contre digue portuaire (La Digue) / Beachbreak brut et puissant (Le Métro)",
        "qualityRating": 8,
        "consistencyRating": 8.5,
        "skillLevel": "Intermédiaire à Confirmé (Confirmé à La Digue dès 1.5m)",
        "skillDetails": "Vagues pêchues et creuses (haut lieu du surf et du bodyboard de l'agglomération Bayonne-Anglet-Boucau-Tarnos).",
        "localHazards": [
          "POLLUTION & DÉBRIS POST-CRUE : Proximité immédiate de l'embouchure de l'Adour (eau turbide marron, bactéries et troncs d'arbres flottants après fortes pluies au Pays Basque/Béarn !)",
          "Blocs de béton et enrochements cyclopéens de la Digue Nord + courant longeant la digue",
          "Shorebreak lourd sur sable grossier/graviers au Métro et à marée haute à La Digue",
          "Localisme réel à La Digue Nord (ambiance ouvrière/locale soudée : discrétion et respect absolu des priorités)"
        ]
      },
      "practicalInfo": {
        "parking": "Parking gratuit au pied de l'aciérie/zone industrialo-portuaire à La Digue (décor atypique type 'Mad Max' face aux Pyrénées !) ; grand parking gratuit aménagé et desservi par bus TxikTxak au Métro.",
        "showersAndFacilities": "Douches, WC, poste MNS et placette avec cafés/snacks au Métro ; équipement minimaliste et ambiance brute à La Digue (surveillance saisonnière spécifique).",
        "surfSchoolsAndClubs": "Tarnos Surf Club / écoles basées principalement Plage du Métro.",
        "waterVibe": "Contraste saisissant : nature sauvage et immense au Métro ; bastion core, industriel et ultra-local à La Digue Nord."
      },
      "crowdFactor": {
        "basePopularity": 7.0,
        "summerPeakScore": 7.5,
        "autumnPeakScore": 7.5,
        "winterScore": 6.0,
        "weekendMultiplier": 1.3,
        "peakHours": [
          "17:00-20:00 (afterwork Bayonne/Anglet/Tarnos)",
          "Jours de vent du Sud où toute la côte landaise est ridée"
        ],
        "bestUncrowdedWindow": "Plage du Métro en matinée (toujours 3x moins peuplée que La Digue ou Anglet !)",
        "waveQualitySensitivity": 1.35,
        "fallbackSurgeOnBigSwell": 1.15
      },
      "goufInfluence": {
        "isAffected": false,
        "type": "none",
        "swellMultiplier": 1.0,
        "explanation": "Aucune influence du Gouf ; la bathymétrie est ici sculptée par l'embouchure de l'Adour et le mur de 950m de la Digue Nord."
      }
    }
  ]
};

export const LANDES_SUD_SPOTS = LANDES_SUD_SURF_DATA.spots;
export const GOUF_DE_CAPBRETON = LANDES_SUD_SURF_DATA.goufDeCapbreton;
