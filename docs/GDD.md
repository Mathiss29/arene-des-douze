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
- Monstre choisi au centre, 5 cases de nourriture en arc au-dessus, collection en bas : on touche un monstre pour le donner.
- Cadenas : les monstres de l'équipe ; les 3★ et plus quand on nourrit (gardés pour l'évolution).
- Stats avant → après au même niveau ; coût en kamas sur le bouton ; étoiles qui s'allument une à une puis éclair ;
  confirmation seulement si la nourriture compte un 3★ ou plus.

### Île (maquette « Île : » 1A 2A 3A 4A 5A 6C 7A 8A 9B 10B, 13 nov. 2026 ; « Incarnam : » 1A 2A 3C 4A 5A 6A 7A 8A 9A, 14 nov. 2026)
- « Incarnam : » : l'île d'Incarnam telle quelle, cimetière compris ; nos bâtiments sont certains des siens, à leur place
  (donc pas de placement libre pour l'instant : il faudrait vider l'île et effacer les ombres des bâtiments retirés).
  Vivante comme Diablofus : nappes d'eau et de brume qui glissent, eau qui change de couleur, lueurs qui respirent, particules
  officielles, ciel. Arbres immobiles (choix de Mathis).
- Fait : écran d'accueil, glisser et zoomer, étiquettes, pastilles « ! » (Cercle d'amélioration si une évolution est possible,
  Zaap s'il reste un stage), mine (600 kamas/h, 4 000 au plus ⚠ à équilibrer), Zaap et « Combattre » vers le prochain stage.
  Cercle d'invocation, Boutique, Temple des Douze et Maison de Ganymède : « bientôt ».
- Écran d'accueil : Incarnam, l'île flottante de Dofus, comme l'île de SW. On la fait glisser et on zoome.
- Bâtiments placés librement par le joueur (mode « Déplacer »). Au départ, seulement ceux qui servent déjà :
  Cercle d'invocation, Cercle d'amélioration, Zaap, Boutique, Mine de kamas.
- Mine de kamas : produit avec le temps, on touche la bulle pour récolter (comme le mana de SW).
- Combats : bouton « Combattre » en bas à droite et le Zaap (les deux ouvrent la carte).
- Barre du bas : Monstres · Sac · Boutique · Combattre. Ambiance coucher de soleil.
- Toute la collection se promène sur l'île (8 monstres au plus).
- Idées retenues (13 nov. 2026) : 1. vrais décors de Dofus 3 (images 2x) ; 2. musique (île, combat, victoire) et bouton son ;
  3. pastilles « ! » sur les bâtiments ; 4. mine à production horaire et stockage max, améliorable (comme les bâtiments à mana de SW) ;
  5. toucher un monstre qui se promène (animation + bulle ; appui long = fiche) ;
  6. niveau d'invocateur et arbre de compétences (comme SW v8.1.4), plutôt après l'invocation et les stages.
- Aussi retenu : 7. guide des débutants (Ganymède d'Incarnam, comme Ellia et la Voie de l'invocateur de SW) ; 8. missions quotidiennes ;
  9. boutique qui se renouvelle chaque heure (Boutique magique de SW) ; 10. un vœu par jour au Temple des Douze (Temple des souhaits) ;
  11. récompenses de connexion. Plus tard : 12. agrandir l'île et la décorer. ⚠ Chaque mécanique sera vérifiée sur SW actuel avant d'être codée.

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
  les autres stats sont fixes ✓.
- Stats de base comme SW ✓ : PV/15 + Attaque + Défense (6★ niv. 40) est le même pour tous les monstres d'une même étoile naturelle.
  ✓ Moyennes réelles (API SWARFARM, 837 monstres non éveillés, 15 nov. 2026) : 1★ 1 317 · 2★ 1 482 · 3★ 1 647 · 4★ 1 812 · 5★ 1 977
  (+165 par étoile ; l'éveil ajoute un palier, soit les anciens chiffres du wiki). Nos fiches prennent les PV, ATQ et DEF moyens de SW
  pour leur étoile et leur type (Attaque, Défense, PV, Soutien), critique 15 %, dégâts critiques 50 %, résistance 15 %, précision 0 % ✓.
- Sorts ✓ : multiplicateurs recalés sur les médianes de SW (SWARFARM, 3 000 sorts) selon le rang du sort, le nombre de coups et la zone :
  sort 1 ×3,8 (2 coups ×1,9, 3 coups ×1,3) ; sort 2 ×5,5 (3 coups ×2,0, zone ×3,0) ; sort 3 ×6,75 (zone ×4,4) ; −15 % s'il étourdit ⚠.
  Fichier des moyennes : `outils/swarfarm_moyennes.json` (hors dépôt). Le Bouftou Royal est à part (boss).
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
| Kwakères 4★ | Flamme | Terre | Glace | d'Or (couleur refaite) | Vent |
| Koalaks 4★ | Griotte | Reinette | Indigo | Coco | Myrtille (couleur refaite) |
| Dragoss 5★ | d'Argile | Calcaire | d'Ardoise | Doré (couleur refaite) | de Charbon |
| Gelées Royales 5★ | Fraise | Menthe | Bleuet | Citron | Mûre (couleur refaite) |

Maquette « 5★ : » 1A 2A 3A 4A 5A (14 nov. 2026) : comme SW ✓, chaque monstre existe dans les 5 éléments (même modèle,
couleurs différentes). 5★ de la 0.1 : Dragoss et Gelées Royales. L'élément qui manque dans Dofus est fait en refaisant la couleur
d'un monstre de la famille. Kwakères et Koalaks : 4★. Grands monstres seuls (Kwakwa, Wa Wabbit, Bouftou Royal, Dopeuls…) :
recolorés en 5 éléments plus tard, pour devenir des familles 5★. Types, sorts et noms définitifs : ⏳ (avec les fiches).

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

## Chemin de l'invocateur (maquette « Chemin : » 1A…10A, 14 nov. 2026)
Comme le Summoner's Way de SW ✓ : quêtes qui apprennent le jeu pas à pas, faites une seule fois, en paliers (Novice, Confirmé, Expert…),
onglets Progression et Défis (un défi par contenu, comme celui du Castel du Géant qui donne Shannon ✓), icône en haut à gauche de l'île ✓.
- Récompenses à réclamer (pastille « ! »), coffre en fin de palier, bouton « Y aller » vers le bon écran, Ganymède félicite en bulle sur l'île.
- Défi Donjon des Bouftous : Chef de Guerre Bouftou 4★ au bout. Dernier palier : 5★ au choix en finissant Astrub en Enfer.
- Beaucoup de quêtes (choix de Mathis) : elles sont des données (`quetes.json`), le chemin grandit à chaque version avec le contenu
  (Arène, Tour, autres zones, éveil…). 0.1 : toutes les quêtes possibles avec son contenu.
- ✓ Vu dans SW 9.3.9 (vidéo de Mathis, 15 nov.) : onglets Progression (paliers Novice / Intermédiaire / Avancé), Défis, Spécial.
  Paliers de 55, 21 et 18 quêtes ; chaque palier fini donne un coffre (ex. Avancé : 1 000 cristaux + un objet).
  Quêtes en cartes : titre, compteur (1/1, 3/3, 20/20…), récompense (ex. 20 de chaque essence + 150 000 mana, 10 morceaux de vélin,
  200 000 ou 300 000 mana, 5 parchemins, 100 cristaux…), « Terminé » ; Ellia explique la quête en bas (chez nous Ganymède).
  Exemples : finir le 7e stage d'une zone, fabriquer une boîte magique, niveau du Labyrinthe, Tribunal d'ascension étage 100 (Normal)
  puis étage 1 (Hell), rune antique 3/3, énergie dimensionnelle 20/20.
- ✓ Onglet Spécial « Aide pour les monstres 4★ » : une liste de missions qui remplit une barre (70 % chez Mathis) ;
  à 100 %, on invoque le monstre 4★ naturel de son choix. Puis « Aide pour les monstres 5★ » et « Amélioration des monstres 5★ » (verrouillés).
  Idée pour nous : un Chemin « Aide aux 4★ » qui finit sur un 4★ au choix.

## Missions du jour et Trophées (✓ vus dans SW 9.3.9, vidéo de Mathis, 15 nov. 2026)
- Missions du jour à points : chaque mission donne +15 ou +20 points, 100 points suffisent (sur 180 possibles), remise à zéro chaque jour.
  · +15 : Début de la journée (se connecter) · Le devoir d'un invocateur (invoquer 3 fois) · Entretien de rune (améliorer une rune) ·
    Construction d'amitié (5 fois, amis)
  · +20 : Tête à tête (5 combats d'arène) · Exploration de l'Histoire (10 stages) · Conquérant de l'Espoir (10 donjons) ·
    Chance d'Ameria I et II (250 puis 500, sans doute de l'énergie dépensée) · 3 missions de guilde
- Paliers de points : 20 → 100 000 mana + 10 Vélins inconnus · 40 → 100 000 mana + 3 objets · 60 → 100 000 mana + 1 rune ·
  80 → 50 d'énergie + 1 vélin · 100 → 30 cristaux + 2 morceaux de vélin de transcendance.
  Pour nous : même système (pierres d'âme, kamas, énergie, rune, Ogrines, 2 fragments), avec les missions de notre contenu
  (connexion, invoquer, améliorer, stages, donjon, énergie dépensée).
- Trophées (succès faits une fois) par thème : Histoire, Cairos, Rift, Arène, Monstre, Autres, avec un score total.
  Ex. Histoire : finir une zone en Difficile → 50 000 mana ; en Enfer → 30 cristaux. Monstre : invoquer un Eau, un Feu et un Vent → 30 000 mana.
  Cairos : finir le B10 avec seulement des monstres Feu → 150 000 mana. Pour nous : plus tard, après la 0.1 (zones Difficile/Enfer d'abord).
- Missions de retour (joueurs revenus) : 7 jours de missions à +20 points ; pas pour nous.
- ✓ Fait (maquette « Missions : » 1A 2B 3A 4B 5A 6B 7A 8C 9A) : bouton Missions en bas de l'île avec pastille « ! », 10 missions toujours
  les mêmes (4 à +15, 6 à +20, 180 points ; donjon, rune et Kolizéum grisés « Bientôt »), remise à zéro à 6 h (heure de Paris),
  coffres qui brillent (20 : 5 000 kamas + 3 pierres d'âme · 40 : 5 000 kamas + 5 pierres d'âme · 60 : 10 000 kamas · 80 : 20 énergie +
  1 pierre parfaite · 100 : 10 000 kamas + 2 fragments ⚠), « Recevoir » par mission et « Tout recevoir ». Code : `src/sim/missions.ts`.

## Réception (maquette « Réception : » 1A 2C 3B 4A 5C 6C 7B, ✓ fait le 15 nov. 2026)
- Bouton « Réception » en haut à gauche de l'île avec le nombre de cadeaux, « Nouveau » sur ceux pas encore vus.
- Cadeaux ordinaires 7 jours (SW : environ 6 ✓), monstres et pierres sans limite.
- Y passent : cadeaux de mise à jour (`src/data/cadeaux.json`, donnés une fois), codes à taper (ex. DOUZE01 pour Discord),
  récompenses de zone, monstres gagnés quand la collection est pleine (ils attendent qu'il y ait de la place).
- « Tout recevoir » laisse l'énergie de côté, « Recevoir l'énergie » la prend (comme SW). Code : `src/sim/reception.ts`.

## Donjons (maquette « Donjons : » 1C 2B 3C 4C 5C 6C 7A 8A, ✓ fait le 15 nov. 2026)
- Comme Cairos ✓ : un seul lieu sur la carte du Zaap (carte « Donjons »), liste des donjons à gauche, 10 niveaux à droite.
- Trois donjons, chacun ouvert par une zone finie en Normal : Donjon des Bouftous (Astrub ; sets Xélor, Sram, Sadida, Roublard, Steamer,
  comme le Castel du Géant ✓), Antre du Dragon Cochon (Madrestam ; Ecaflip, Zobal, Pandawa, Sacrieur, Crâ, comme la Tanière du Dragon),
  Cimetière des Torturés (Bastion ; Iop, Eniripsa, Féca, puis Ouginak, Eliotrope, Huppermage, comme la Nécropole).
  0.1 : seuls les Bouftous sont jouables (Madrestam et Bastion n'ont pas encore de stages, le Dragon Cochon n'a pas de planche).
- 3 vagues : le troupeau (une ou deux étoiles de moins), puis le Bouftou Royal seul et très gros (PV ×1,5 à partir du niveau 4 ⚠),
  avec « Appel du troupeau » (il appelle deux Bouftons s'il a de la place) et « Charge royale » (tous, 20 % d'étourdir).
- ✓ Énergie 5/5/6/6/7/7/7/8/8/8 et étoiles du boss 3→5★ (SW) ; niveaux du boss adoucis au début : 8, 12, 16, 22, 28, 34, 40, 48, 56, 65 ⚠.
  Runes invisibles des ennemis à partir du niveau 8. Équilibre simulé : 3★ max finit le B3, 5★ max le B7, le B10 demande une équipe 6★ runée.
- Butin : runes des sets du donjon (75 %, 1-2★ au B1 → 6★ Rare à Légendaire au B10 ✓), kamas, pierre d'âme 3 %, pierre parfaite 0,3 %
  (à partir du B6, rares comme le veut Mathis), symbole du donjon 25 % (à partir du B3, pour fabriquer plus tard).
  Premier passage : rune une étoile au-dessus (B1 à B5) ou pierre parfaite (B6 à B10).
- Combats à répétition (5C) : « Répéter ×10/20/30 » dans la préparation (aussi pour l'histoire), auto forcé, vitesse ×1/×2/×3 gardée,
  « Arrêter après ce combat », arrêt sur défaite ou faute d'énergie, résumé du butin et historique.
- Sanctuaires élémentaires : avec l'éveil, après la 0.1. Mission du jour « Gagner 10 combats de donjon » active.

## Envies de Mathis vues dans SW (vidéo du 15 nov. 2026)
- Réception (boîte aux lettres) : les cadeaux y attendent (6 jours), « Recevoir », « Recevoir en 1 fois », « Recevoir l'énergie » ;
  onglets Coffre, Guilde, Points sociaux. Utile pour nous : récompenses du Chemin, cadeaux de mise à jour, compensations.
- Combats à répétition : relancer le même stage jusqu'à 30 fois, récapitulatif du butin (mana, énergie, cristaux, runes), historique,
  arrêt après le combat en cours ; « Amélioration sélective » des runes gagnées.
- Combat d'exploration (combats hors ligne) : Cairos, Rift, Raid ; durée au choix 2 h / 125 énergie / 45 combats, 4 h / 250 / 90,
  8 h / 500 / 180 ; continue hors ligne.
- Compétences d'invocateur (v8.1.4, à la place des bâtiments de gloire) : Combat (VIT +15 %, dégâts critiques +25 %, ATQ +20 %, DEF +20 %,
  PV +20 %, ATQ de chaque élément +21 %), Guilde (ATQ, dégâts crit., PV, DEF en guilde), Autres (recharge d'énergie +30 %,
  stockage d'énergie +3 par niveau jusqu'à +30, tours Arcane, production de mana +50 %, stockage de mana +2 000) ;
  niveaux achetés avec un objet, « Améliorer » / « Améliorer tout ».
- Communauté : amis (cadeau quotidien de cœurs = points sociaux, profil, deck, 50 amis, mentor/apprenti), guilde (Guilde contre Guilde,
  jeu coopératif, boutique de guilde à points : vélins, pièces d'invocation, coffres de runes, Arcenmon… achats limités par semaine/mois,
  classement). Demande un serveur : après la 0.1.
- Île plus grande en plusieurs morceaux, bâtiments Entrepôt (800 places), Profil, Défense, Historique de combat.

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
ne sortent que de leur pierre ✓ (le parchemin légendaire de SW exclut Lumière et Ténèbres ✓). ⚠ Pierre élémentaire : un guide dit
que SW y donne un peu plus de 5★ que le mystique, un autre les mêmes chances : à vérifier.

Maquette « Invocation : » 1A 2A 3A 4A 5C 6A 7B 8A 9A (14 nov. 2026) :
- Écran : cercle au centre, pierres en colonne à gauche ; animation longue comme SW (la pierre tombe dans le cercle, lumière bleue,
  violette ou dorée selon les étoiles, bouton « Passer ») ; le monstre en grand, étoiles qui s'allument une à une, « Nouveau ! ».
- Invoquer ×10 ✓ (SW depuis la v6.6.3). Coût comme SW ✓ : 300 kamas (pierre d'âme), 10 000 kamas (les autres).
- 0.1 : toutes les pierres (âme, parfaite, élémentaires, Bonta/Brâkmar, légendaire). Fragments d'âme : plus tard.
- Pierres parfaites : premiers passages des niveaux du donjon, fins de zone en Difficile/Enfer, vœu du Temple.
- Premier 5★ : un 5★ au choix offert en finissant Astrub en Enfer (dernier palier du chemin de l'invocateur).
- Pierre d'âme transcendante : un 5★ Feu, Air ou Eau assuré ✓ (parchemin de transcendance de SW). Dans la 0.1 : récompense du dernier
  palier du chemin de l'invocateur, et fragments donnés par les missions du jour (2 par jour comme SW ✓ d'après un site de joueurs).
  ✓ SW : 300 morceaux pour un parchemin de Transcendance (100 pour un Légendaire, 50 pour un Lumière & Ténèbres ; pièces de monstre 10/20/40/50/100 du 1★ au 5★).
  Choix de Mathis : 60 fragments chez nous (un mois de missions), plus doux que SW.
  ✓ Les 2 morceaux par jour viennent du dernier palier des missions du jour (100 points), vu dans SW 9.3.9.
  Pas de version Bonta/Brâkmar ni de bénédiction pour l'instant.
- Aussi dans la 0.1 : pas de revente : SW ne vend pas les monstres, ils servent à l'amélioration ou à l'évolution ✓ (Mathis), fiche du monstre juste après l'invocation (« Voir »), bestiaire
  (tous les monstres, en ombre si pas encore eus, petit cadeau par découverte), collection de 120 places d'office, sans achat (choix de Mathis, comme SW actuel).
  ✓ SW : 50 places autrefois, 70 en v6.5.3, puis 120 d'office depuis v7.1.9 (plus d'achat de places) ; au-delà, l'Entrepôt de monstres
  (10 places pour 200 000 mana ou 50 cristaux, jusqu'à 800). Missions du jour avancées dans la 0.1 (pour les fragments).
- Après la 0.1 : fusion ✓ (SW : quatre 4★ précis donnent un 5★ précis, comme Veromos), qui demande les éveils.
- 3★ Bonta/Brâkmar en plus des Scarafeuilles Blanc et Noir : Kwaks (couleur refaite) et Larves (plusieurs couleurs dans Dofus).

## 5. Runes (maquette « Runes : » 1A 2B+C 3C 4C 5C 6A 7B 8C 9A, ✓ fait le 15 nov. 2026)
- ✓ SW (wiki) : 6 emplacements ; 1 ATQ fixe, 3 DEF fixe, 5 PV fixe ; 2, 4, 6 variables (VIT seulement en 2, critiques en 4,
  résistance et précision en 6). 1 à 6★, grades Commune → Légendaire (0 à 4 sous-stats), +0 à +15, sous-stat ajoutée ou montée
  à +3/+6/+9/+12. Valeurs des stats principales et des sous-stats par étoile reprises du wiki. Pourcentages sur la base du monstre.
- ✓ RELOADED : plus d'échec, prix fixe, palier par palier ou d'un coup jusqu'à +15 ; grade d'origine affiché.
  ⚠ Coûts : ceux d'une tentative d'avant RELOADED (wiki), SW a augmenté le prix fixe depuis.
- ✓ Retrait : 1 000 / 2 500 / 5 000 / 10 000 / 25 000 / 50 000 selon les étoiles ; remplacer ou déplacer une rune = la retirer.
  Gratuit pour un joueur nouveau (30 jours) ou de retour (après 14 jours d'absence, pendant 30 jours) ⚠ durées.
  Les runes d'un monstre sacrifié reviennent dans l'inventaire.
- Sets (12 dieux) : Ecaflip = Violent (4, 22 % de rejouer, −45 % par tour gagné de suite), Xélor = Rapide (4, VIT +25 %),
  Sadida = Désespoir (4, 25 % d'étourdir au premier coup ✓ RELOADED), Iop = Rage (4, dégâts crit. +40 %), Sram = Fatal (4, ATQ +35 %),
  Eniripsa = Vampire (4, 35 % des dégâts en PV), Sacrieur = Vengeance (2, 15 % de contre-attaque à 75 %),
  Féca = Bouclier (2, bouclier de 15 % des PV à l'équipe, 3 tours), Crâ = Concentration (2, précision +20 %),
  Pandawa = Endurance (2, résistance +20 %), Osamodas = Combat (2, ATQ des alliés +8 %), Enutrof = Prospection (2, kamas gagnés +20 %, propre au jeu).
- Plus de 12 sets (maquette « Sets : » 1B 2C 3C) : d'autres classes de Dofus d'abord, puis des monstres et des lieux.
  Déjà là : Roublard = Lame (2, taux critique +12 %), Zobal = Garde (2, DEF +15 %), Steamer = Énergie (2, PV +15 %).
  Avec les donjons : Eliotrope = Volonté, Ouginak = Némésis, Huppermage = Destruction, Forgelance = Intangible.
  Plusieurs donjons (choix de Mathis), chacun avec ses sets, comme les donjons de Cairos.
- Sources : zones (set de la zone : Astrub Iop ; Normal 20 % 1-3★, Difficile 30 % 2-4★, Enfer 40 % 3-5★ ⚠), coffre des missions
  à 60 points (1 rune 4★), Réception (6 runes 3★ Fatal et Énergie (Steamer) offertes au départ), donjon (6★) à venir.
- Écran : fiche du monstre, onglet Runes (depuis le Cercle d'amélioration et la préparation d'équipe) : 6 emplacements autour du monstre,
  stats avec le bonus des runes, montée animée à chaque palier, inventaire par emplacement, vente sélective (étoiles et grade),
  3 préréglages par monstre. Prix de vente ⚠ les nôtres.
- Ennemis : runes invisibles ⚠ (rien en Normal, puis +12 % de PV/ATQ/DEF par difficulté et un peu par stage, VIT, crit., rés., préc.).
- Plus tard : les sets de soutien du Royaume spirituel (Sceau, Détermination, Amélioration, Précision, Tolérance).

## 6. Économie
Kamas (le mana de SW), Énergie, Pierres d'âme, Ogrines (les cristaux de SW, gagnées en jouant uniquement), Essences, Jetons de Kolizéum. ⏳ Montants.
✓ Dans SW, l'énergie sert aux combats d'histoire, aux donjons, à la tour et aux failles ; l'Arène a ses propres invitations.
Énergie gardée (maquette « Zaap : » 5A).

## 7. Modes de jeu
- Histoire : zones du Monde des Douze en Normal, Difficile, Enfer ✓ ; 7 stages par zone (SW en compte une vingtaine aujourd'hui).
- Zaap (maquette « Zaap : » 1A 2A 3A 4A 5A 6A 7A 8A, 14 nov. 2026) : carte des combats comme SW. Zones en îles flottantes reliées
  par un chemin, autres modes à droite (Donjons, Tour, Kolizéum, Brèche), liste des 7 stages à droite de l'image de la zone,
  onglets de difficulté, énergie, aperçu (ennemis, butin) avant « Préparer l'équipe », récompense de zone, combat répété (plus tard).
  ✓ La difficulté suivante s'ouvre quand la zone est finie ; la zone suivante quand la précédente est finie en Normal.
  ✓ Énergie : +1 toutes les 5 minutes, payée au départ du combat. ✓ Coûts 3 / 4 / 5 (Normal / Difficile / Enfer, lus dans SW 9.3.9). ⚠ Max 60 (SW : 500 au niveau 100, selon le niveau d'invocateur ; dépassable).
  ✓ Ennemis dans SW (Garen, stage 1) : Normal 1★ niv. 1 ; Difficile 2-3★ niv. 16, un monstre de plus ; Enfer 3-5★ niv. 40.
  ✓ Récompense de zone aussi en Difficile (Garen 7 Difficile : 5 Rois angemon niv. 15 + 1 000 000 de mana).
  ✓ Les stages donnent parfois un monstre (SW : ~1 à 3 %) et de l'énergie ; ⚠ nos taux : 3 % et 25 % (1 à 3).
  ✓ Récompense la première fois qu'une zone est finie en Normal (SW : souvent un monstre) : Astrub donne un Scarafeuille Bleu ★★★.
  ⚠ Difficile / Enfer : +1 / +2 étoiles et +10 / +20 niveaux aux ennemis, récompenses ×2 / ×3 (les nôtres).
  Idées retenues : 1. Brèche du jour (comme la Faille dimensionnelle de SW ⚠ à vérifier sur la version actuelle), quand toutes
  les zones sont finies en Normal ; 2. conseil d'élément dans l'aperçu ; 3. pastilles « Nouveau ! » ; 4. îles vivantes (flottement fait,
  particules plus tard) ; 5. énergie rendue au niveau d'invocateur ⚠ (à vérifier, avec le niveau d'invocateur) ; 6. texte de Ganymède
  à l'entrée d'une zone ; 7. set de runes par zone ✓ (SW : chaque zone donne un set, le stage décide de l'emplacement ; ⚠ actuel) ;
  8. monstres qui tombent ; 9. bouton « Continuer » ; 10. boss plus grand avec sa barre de vie ⚠ ; 11. musique de la carte ;
  12. brume sur les zones pas encore découvertes ; 13. premier combat guidé par Ganymède ; 14. lien avec les missions du jour.
  Fait le 14 nov. : tout sauf 1 (la brèche attend d'autres zones), 4 (particules), 5, 11 et 14 (attendent leurs systèmes).
  Astrub : 7 stages faciles, comme la Forêt de Garen (« très facile » ✓) ; l'équipe de départ la finit en 13 à 27 combats (simulation).
- Vagues ✓ : 3 vagues par stage, le boss à la dernière. Entre deux vagues, les alliés gardent PV, effets et recharges ; toutes les jauges
  repartent de zéro ⚠ (pas trouvé de source SW claire ; à vérifier). Le leader d'une vague ennemie est son premier monstre.
- Donjons : 10 niveaux chacun ✓ (SW v8.0.0, RELOADED : Castel du Géant, Antre du Dragon et Nécropole ramenés de B12 à B10,
  le B10 donne les récompenses de l'ancien B12 pour 8 d'énergie).
  ✓ Lu dans SW 9.3.9 (Castel du Géant), boss / niveau / énergie : B1 3★ 12 / 5 · B2 3★ 15 / 5 · B3 3★ 20 / 6 · B4 4★ 25 / 6 · B5 3★ 30 / 7 ·
    B6 4★ 40 / 7 · B7 4★ 50 / 7 · B8 5★ 55 / 8 · B9 5★ 60 / 8 · B10 5★ 65 / 8 ; puis Abysses Normal (niv. 70) et Hard (niv. 75), 9 d'énergie.
  ✓ Butin affiché au B10 : runes 6★ Rare à Légendaire de 5 sets (Désespoir 4 : assommer +25 % · Énergie 2 : PV +15 % · Fatale 4 : ATQ +35 % ·
    Lame 2 : critique +12 % · Rapide 4 : VIT +25 %), Symbole du Géant, morceaux de rune, Arcenmon, Vélin inconnu, Vélin mystique,
    fragment de vélin gravé, pierres métamorphes. Les Abysses ajoutent le set Intangible.
  Choix de Mathis : les boss de donjon peuvent dépasser le niveau 40 (comme SW), nos monstres jamais (pente des stats prolongée au-delà ⚠). Donjon des Bouftous (runes), Antre du Dragon Cochon (runes de haut niveau), Sanctuaires élémentaires (essences).
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



## Direction artistique (choix de Mathis)

- Identité « Pierre et émeraude » (interface de Dofus 3 assumée : pierre sombre, vert Dofus), à appliquer à tout le jeu ; police Fredoka.
- Lumière (Bonta) : blanc doré éclatant (cœur blanc qui rayonne vers l'or), jamais jaune sable.
- Cartes de monstre : étoiles dessinées sur leur propre bandeau, niveau en plaque, monstre entier dans le cadre.

- ✓ Gestion des runes (vidéo SW du 25/11/2026) : onglet Rune du monstre = roue des 6 places, effet de set, bouton « Gérer », mes runes par set avec leur nombre ; écran « Gérer » = stats du monstre, runes Avant / Après, coût de déséquipement, « Appliquer » ; filtres : set (tuiles avec compteur), places en fleur, propriété principale, deux propriétés secondaires ; tri : grade, propriété secondaire, niveau d'amélioration, obtenu… ; inventaire en grille avec le portrait du porteur.
