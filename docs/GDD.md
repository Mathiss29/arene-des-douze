# GDD — Arène des Douze (v0.1)

> ⏳ = décision encore ouverte.

## 1. Identité
- **Genre :** RPG de collection au tour par tour, fidèle à Summoners War: Sky Arena.
- **Univers :** Dofus 3, avec les vrais assets (autorisation obtenue). Mention « Dofus © Ankama, jeu non officiel ».
- **Plateforme :** navigateur, PC et mobile.
- **Modèle :** fan game gratuit, sans aucun achat ; toute la monnaie se gagne en jouant.
- **Pitch :** tu es un Osamodas ; capture les créatures du Monde des Douze, équipe-les de runes, affronte les donjons et le Kolizéum.
- **Piliers :** collectionner, optimiser (runes, forgemagie), se mesurer (Kolizéum).

## 2. Combat
- Équipes : 4 monstres au Kolizéum, 5 en donjon.
- Jauge d'attaque : à chaque tick, +7 % de la vitesse ; le premier au-dessus de 100 % joue.
- Dégâts : Attaque × multiplicateur × 1000 / (1140 + 3,5 × Défense de la cible).
- Critique : 15 % de taux et 50 % de dégâts critiques au départ.
- Éléments : Feu > Air > Eau > Feu ; Bonta ⇄ Brâkmar, neutres face aux trois autres.
- Avantage d'élément ✓ : +15 % de taux critique et 35 % de chances de coup écrasant (+30 % de dégâts) ; désavantage ✓ : −15 % de taux
  critique et 50 % de chances de coup effleuré (−30 % de dégâts, aucun malus posé, pas de baisse de jauge). Ordre : effleuré, critique, écrasant.
- Variation des dégâts ✓ : ±2,5 % (sauf dégâts fixes).
- Malus : chance de résister = max(15 %, Résistance − Précision) ✓. Un coup effleuré ne pose aucun malus ✓.
- Bonus/malus : Attaque +50 % / −50 % ✓, Vitesse +30 % ✓, taux critique +30 % ✓, dégâts continus 5 % des PV max par pile ✓ ;
  Défense +70 % / −70 % et Lenteur −30 % ⚠ (valeurs usuelles, non confirmées par une source). Toutes les constantes sont dans `src/sim/regles.ts`.
- Sorts : 2 à 4 par monstre, temps de recharge, passifs ; skill de leader pour certains monstres (un seul actif par équipe).
- Moteur déterministe, partagé entre le jeu et le serveur.

### Écran de combat (maquette « Combat : » 1B 2B 3A 4B 5A, 12 nov. 2026)
- Disposition en diagonale à la Dofus : alliés en bas à gauche, ennemis en haut à droite (en miroir).
- Ordre des tours : jauge d'attaque sous chaque monstre + frise de portraits en haut (prochains tours).
- Sorts : boutons ronds en bas à droite (icônes officielles), bulle de description du sort choisi.
- Arène : la salle de la zone ou du donjon où l'on combat (arènes de Diablofus).
- Téléphone : paysage uniquement.

### Préparation et récompenses (maquette « Écrans : » 1B 2B 3B 4A 5A 6A 7A 8A 9A 10A, 13 nov. 2026)
- Préparation en deux panneaux : collection à gauche, ennemis de la vague et équipe à droite.
- Ennemis en blocs : portrait, nom, niveau, couleur d'élément. Pas de bilan d'éléments (comme SW).
- Collection en cases : portrait, étoiles, niveau, pastille d'élément.
- Leader = premier monstre de l'équipe (SW). Bouton Combattre en bas à droite.
- Récompenses : monstres sur leurs socles avec barres d'XP qui se remplissent un par un, « NIVEAU SUPÉRIEUR ! ».
- Butin en cases avec icônes. Boutons : Préparation · Rejouer · Stage suivant (pas de Répéter pour l'instant).

### Cercle d'amélioration (maquette « Évolution : » 1A 2A 3A 4A 5A 6A 7A 8A 9A, 13 nov. 2026)
- Bâtiment de l'île (comme le Power-Up Circle de SW) nommé « Cercle d'amélioration », deux onglets : Nourrir (XP) et Évoluer.
  En attendant l'île, on y entre depuis la préparation.
- Monstre choisi au centre, 5 cases de nourriture en arc au-dessus, collection en bas : on touche un monstre pour le donner.
- Cadenas : les monstres de l'équipe ; les 3★ et plus quand on nourrit (gardés pour l'évolution).
- Stats avant → après au même niveau ; coût en kamas sur le bouton ; étoiles qui s'allument une à une puis éclair ;
  confirmation seulement si la nourriture compte un 3★ ou plus.

### Île (maquette « Île : » 1A 2A 3A 4A 5A 6C 7A 8A 9B 10B, 13 nov. 2026)
- Écran d'accueil : Incarnam, l'île flottante de Dofus, comme l'île de SW. On la fait glisser et on zoome.
- Bâtiments placés librement par le joueur (mode « Déplacer »). Au départ, seulement ceux qui servent déjà :
  Cercle d'invocation, Cercle d'amélioration, Zaap, Boutique, Mine de kamas.
- Mine de kamas : produit avec le temps, on touche la bulle pour récolter (comme le mana de SW).
- Combats : bouton « Combattre » en bas à droite et le Zaap (les deux ouvrent la carte).
- Barre du bas : Monstres · Sac · Boutique · Combattre. Ambiance coucher de soleil.
- Toute la collection se promène sur l'île (8 monstres au plus).

## 3. Monstres
- Types : Attaque, Défense, PV, Soutien.
- Étoiles ✓ : 1 à 5★ à l'invocation, 6★ maximum. Niveau max ✓ : 15 / 20 / 25 / 30 / 35 / 40.
- Évolution ✓ (SW actuel, refonte RELOADED v8.0.0 de 2023) : dans le bâtiment d'amélioration de l'île, sans condition de niveau ;
  nourriture d'autant ou moins d'étoiles, comptée en points (1★ = 1, 2★ = 2, 3★ = 6, 4★ = 24, 5★ = 120 ; il faut N × points(N★) :
  1 / 4 / 18 / 96 / 600) → +1★, le niveau est gardé. Kamas : 1 600 / 4 000 / 9 600 / 22 400 / 35 200 (⚠ barème d'avant RELOADED,
  SW calcule désormais le coût d'après la nourriture). Un monstre de la même famille donné en nourriture monte aussi un sort (à faire).
- Nourrir pour l'XP (SW) : jusqu'à 5 monstres d'un coup, ~20 % de chances d'avoir ×1,5 (⚠ XP par monstre à vérifier, RELOADED l'a changée).
- XP ✓ : table de SW niveau par niveau (`src/sim/progression.ts`, ⚠ d'avant RELOADED) ; l'XP en trop au niveau max est perdue.
- Stats : les fiches donnent les stats 6★ niveau 40 ; PV, Attaque et Défense suivent le niveau et les étoiles (⚠ courbe provisoire),
  les autres stats sont fixes ✓. Choix du jeu (pas une règle SW) : un monstre naturellement 1★ reste 15 % moins fort qu'un 3★ une fois 6★
  (dans SW, chaque monstre a ses propres stats de base, plus hautes pour les étoiles naturelles élevées).
- Départ : Piou Vert (leader), Kwak de Flamme, Piou Bleu, Piou Rouge, niveau 1, et 5 000 kamas.
- Éveil ✓ : avec des essences de son élément et de magie, en trois paliers (bas, moyen, haut ; 5 d'un palier → 1 du suivant au Centre de fusion) ;
  nom, apparence, stats, sort amélioré ou nouveau. Second éveil pour certains monstres (plus tard).
- Montée des sorts ✓ : un monstre de la même famille donné en nourriture, ou un Diablotin (le Devilmon de SW).

### Liste de lancement (35)
| Famille | Feu | Air | Eau | Bonta | Brâkmar |
|---|---|---|---|---|---|
| Pious 1★ | Rouge · Attaque | Vert · Soutien | Bleu · Soutien | Jaune · PV | Violet · Attaque |
| Pichons 2★ | Orange · Attaque | Vert · Attaque | Bleu · PV | Blanc · Soutien | Kloune · Défense |
| Scarafeuilles 3★ | Rouge · Soutien | Vert · Défense | Bleu · Soutien | Blanc · PV | Noir · Attaque |
| Kwaks 3★ | Flamme · Attaque | Vent · Attaque | Glace · Soutien | ⏳ | ⏳ |
| Tortues 3★ | Rouge · Défense | Verte · Soutien | Bleue · PV | Jaune · Défense | ⏳ |
| Bouftous 4★ | Chef de guerre · Attaque | Boufton Orageux · Soutien | Bouftou Nuageux · PV | Boufton Palichon · Soutien | Bouftou Noir · Défense |
| Kwakères 4★ | Flamme · Attaque | Vent · Attaque | Glace · Soutien | ⏳ | ⏳ |

5★ : Kwakwa (Feu, Attaque), Wa Wabbit (Air, Soutien), Bouftou Royal (Eau, PV), Dopeul Iop (Bonta, Attaque), Dopeul Crâ (Brâkmar, Soutien).

Skills de leader (valeurs de départ) : Piou Vert +10 % vitesse ; Tortue Bleue +21 % PV (Arène) ; Scarafeuille Blanc +18 % résistance ;
Kwak de Vent +19 % taux critique (Donjons) ; Bouftou Nuageux +33 % PV ; Boufton Orageux +24 % vitesse (Arène) ;
Kwakère de Flamme +30 % attaque des monstres Feu ; Kwakwa +44 % attaque (Arène) ; Wa Wabbit +24 % vitesse ;
Bouftou Royal +44 % défense (Donjons) ; Dopeul Iop +33 % taux critique (Donjons) ; Dopeul Crâ +41 % précision.

### Éveils (maquette « Éveils : » 1B 2B 3D 4B 5A 6B 7B 8A 9B 10A, 13 nov. 2026)
- Le monstre garde sa planche (pas de forme adulte : les Kwakères et les Bouftous restent des familles à part).
- Aura permanente des éveillés, en combat comme dans la collection : particules d'élément + halo lumineux, intensité normale
  (braises pour le Feu, bulles et ondes pour l'Eau, feuilles en tourbillon pour l'Air, rayons dorés pour Bonta, fumée violette pour Brâkmar).
- Éveillés 12 % plus grands, couleurs plus vives.
- Moment de l'éveil : l'énergie converge sur le monstre, il blanchit, éclair, ondes de choc et gerbe d'étincelles.
- Nom : le nom éveillé, avec le monstre d'origine en dessous (« Ondine · Scarafeuille Bleu »).
- Éléments manquants : recoloration (Kwaks Bonta et Brâkmar depuis le Kwak de Terre).
- Effets faits maison (`src/render/effets.ts`), pas les effets officiels.
- ⏳ Règles de l'éveil (essences, bonus de stats, sort amélioré) à vérifier sur SW puis à coder.

## 4. Invocation
| Objet | Équivalent SW | Résultat |
|---|---|---|
| Pierre d'âme | Parchemin inconnu | 1-3★ Feu/Air/Eau (≈ 74,1 % / 24,6 % / 1,3 %) |
| Pierre d'âme parfaite | Parchemin mystique | 3-5★ Feu/Air/Eau (91,5 % / 8 % / 0,5 %) |
| Pierre élémentaire | Parchemin d'élément | 3-5★ d'un seul élément (mêmes chances) |
| Pierre Bonta/Brâkmar | Parchemin Lumière & Ténèbres | 3-5★ Bonta ou Brâkmar (93,65 % / 6 % / 0,35 %) |
| Pierre légendaire | Parchemin légendaire | 4-5★ (93,5 % / 6,5 %) |
| Fragments d'âme | Pièces d'invocation | Monstre précis (SW : 20 pièces pour un 2★, 40 pour un 3★, 50 pour un 4★) |

✓ Chances vérifiées (tableau de référence de la communauté SW ; celles du parchemin inconnu sont une estimation). Bonta et Brâkmar
ne sortent que de leur pierre (et des pierres légendaires « tous éléments »).

## 5. Runes
- 6 emplacements : 1, 3 et 5 à stat principale fixe (Attaque, Défense, PV fixes) ; 2, 4 et 6 variables ; seul le 2 peut avoir la vitesse.
- Rareté : Commune (0 sous-stat) à Légendaire (4).
- Forgemagie +0 à +15 ; sous-stat ajoutée ou améliorée à +3, +6, +9 et +12. ✓ Depuis RELOADED, plus d'échec : la montée est instantanée
  (+3/+6/+9/+12/+15 au choix) et coûte un montant fixe selon le grade de la rune.
- Sets (dieux du Monde des Douze) : Ecaflip (Violent), Xélor (Swift), Sadida (Despair), Iop (Rage), Sram (Fatal), Eniripsa (Vampire),
  Sacrieur (Revenge), Féca (Shield), Crâ (Focus), Pandawa (Endure), Osamodas (Fight), Enutrof (spécifique au jeu).
  (SW compte d'autres sets : Énergie, Garde, Lame, Némésis, Volonté, Destruction, Détermination, Amélioration, Précision, Tolérance… à placer plus tard.)

## 6. Économie
Kamas (le mana de SW), Énergie, Pierres d'âme, Ogrines (les cristaux de SW, gagnées en jouant uniquement), Essences, Jetons de Kolizéum. ⏳ Montants.
✓ Dans SW, l'énergie sert aux combats d'histoire, aux donjons, à la tour et aux failles ; l'Arène a ses propres invitations.
⏳ Garder l'énergie ou non (jeu gratuit sans achat).

## 7. Modes de jeu
- Histoire : zones du Monde des Douze en Normal, Difficile, Enfer ✓ ; 7 stages par zone (SW en compte une vingtaine aujourd'hui).
- Donjons : Donjon des Bouftous (runes), Antre du Dragon Cochon (runes de haut niveau), Sanctuaires élémentaires (essences).
- Tour des Dimensions : 100 étages.
- Kolizéum : PvP asynchrone (défense jouée par l'IA), classement, ligues. Plus tard : Kolizéum en direct, comme l'Arène mondiale de SW
  (4 monstres, choix alternés).
- Niveau d'invocateur et compétences d'invocateur ✓ (SW v8.1.4) : points gagnés en montant de niveau, à dépenser dans des bonus.

## 8. Technique
TypeScript, Vite, Phaser 3.80.1, vitest (même architecture que Diablofus : `sim/` pur, `render/` qui lit, `data/` en JSON).
Planches de Diablofus sur le R2. Plus tard : serveur de comptes (comme Diablofus) pour la sauvegarde et la validation du PvP.

## 9. Décisions ouvertes ⏳
1. Défense ±70 % et Lenteur −30 % à confirmer ; table d'XP et coûts d'après RELOADED non publiés.
2. Fiches des 35 monstres (stats, sorts, éveils).
3. Apparence Bonta/Brâkmar des Kwaks et Kwakères.
4. Montants de l'économie.
5. Nom définitif.

## Vérification sur Summoners War actuel (13 nov. 2026)
- ✓ Jauge : +7 % de la vitesse par tick, la jauge peut dépasser 100 %, la plus haute joue.
- ✓ Dégâts : réduction 1000 / (1140 + 3,5 × DEF) ; variation ±2,5 % (sauf dégâts fixes).
- ✓ Critique 15 % de base ; avantage d'élément +15 %, désavantage −15 %.
- ✓ Coup écrasant : avantage, 35 % de chances, +30 % (corrigé, c'était 50 %). Coup effleuré : désavantage, 50 %, −30 %, aucun malus posé.
- ✓ Résistance : chance de résister = max(15 %, RÉS − PRÉ).
- ✓ Niveaux max 15 / 20 / 25 / 30 / 35 / 40 (toujours 6★ niv. 40 en 2026).
- ✓ Évolution RELOADED (v8.0.0) : sans niveau max, niveau gardé, nourriture en points.
- ✓ Île : le Summonhenge est là dès le départ ; les bâtiments à mana produisent à l'heure avec un stockage max (ex. 660/h, 4 000 max).
- ✓ Plus de bonus par les bâtiments de gloire ni les drapeaux de guilde depuis la v8.1.4 (nov. 2023) : ce sont des compétences
  d'invocateur (Tour de l'invocateur > Compétences). 5 points par niveau d'invocateur du niv. 21 au niv. 100, 1 point par amélioration,
  400 points en tout. Les anciens bâtiments de gloire ne sont plus que des décorations achetées en mana.
- ✓ Bonus/malus : attaque +50 %, critique +30 %, vitesse +30 %, attaque −50 %, dégâts continus 5 % des PV max.
- ✓ Cercle d'amélioration : bâtiment de départ, gratuit ; jusqu'à 5 monstres d'un coup ; 20 % de chances de ×1,5 d'XP ;
  coût en mana selon les étoiles de la nourriture (montants non publiés : nos kamas restent provisoires).
- ⚠ Toujours à confirmer : défense ±70 %, lenteur −30 %, la nouvelle table d'XP de RELOADED (Com2uS ne l'a pas publiée ;
  on garde l'ancienne, identique au tableau de référence), coûts exacts et XP de la nourriture après RELOADED.

