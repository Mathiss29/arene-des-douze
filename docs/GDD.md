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
- Avantage d'élément : +15 % de taux critique ; en désavantage, coups « effleurés » (moins de dégâts, aucun malus posé). ⏳ Chiffres exacts des coups effleurés et écrasants.
- Malus : chance de résister = max(15 %, Résistance − Précision) ✓. Un coup effleuré ne pose aucun malus ✓.
- Bonus/malus (valeurs SW usuelles, ⚠ à confirmer) : Attaque +50 % / −50 %, Défense +70 % / −70 %, Vitesse +30 % / −30 %, taux critique +30 %, dégâts continus 5 % des PV max par pile. Toutes les constantes sont dans `src/sim/regles.ts`.
- Sorts : 2 à 4 par monstre, temps de recharge, passifs ; skill de leader pour certains monstres (un seul actif par équipe).
- Moteur déterministe, partagé entre le jeu et le serveur.

### Écran de combat (maquette « Combat : » 1B 2B 3A 4B 5A, 12 nov. 2026)
- Disposition en diagonale à la Dofus : alliés en bas à gauche, ennemis en haut à droite (en miroir).
- Ordre des tours : jauge d'attaque sous chaque monstre + frise de portraits en haut (prochains tours).
- Sorts : boutons ronds en bas à droite (icônes officielles), bulle de description du sort choisi.
- Arène : la salle de la zone ou du donjon où l'on combat (arènes de Diablofus).
- Téléphone : paysage uniquement.

## 3. Monstres
- Types : Attaque, Défense, PV, Soutien.
- Étoiles : 1 à 5★ à l'invocation, 6★ maximum. Niveau max : 15 / 20 / 25 / 30 / 35 / 40.
- Évolution ✓ : monstre au niveau max + autant de monstres de même étoile que son nombre d'étoiles, et des kamas
  (1 600 / 4 000 / 9 600 / 22 400 / 35 200) → +1★, retour au niveau 1.
- XP ✓ : table de SW niveau par niveau (`src/sim/progression.ts`) ; l'XP en trop au niveau max est perdue.
- Stats : les fiches donnent les stats 6★ niveau 40 ; PV, Attaque et Défense suivent le niveau et les étoiles (⚠ courbe provisoire),
  les autres stats sont fixes. Un monstre naturellement 1★ reste 15 % moins fort qu'un 3★ une fois monté 6★.
- Départ : Piou Vert (leader), Kwak de Flamme, Piou Bleu, Piou Rouge, niveau 1, et 5 000 kamas.
- Éveil : avec des essences (nom, apparence, stats, sort amélioré). Amélioration des sorts : doublon ou objet dédié.

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
| Pierre d'âme | Parchemin inconnu | 1-3★ |
| Pierre d'âme parfaite | Parchemin mystique | 3-5★ (≈ 91,5 % / 8 % / 0,5 %) |
| Pierre élémentaire | Parchemin d'élément | 3-5★ d'un seul élément |
| Pierre Bonta/Brâkmar | Parchemin Lumière & Ténèbres | Monstres Bonta ou Brâkmar |
| Fragments d'âme | Pièces d'invocation | Monstre précis |

## 5. Runes
- 6 emplacements : 1, 3 et 5 à stat principale fixe (Attaque, Défense, PV fixes) ; 2, 4 et 6 variables ; seul le 2 peut avoir la vitesse.
- Rareté : Commune (0 sous-stat) à Légendaire (4).
- Forgemagie +0 à +15 ; sous-stat ajoutée ou améliorée à +3, +6, +9 et +12 ; réussite décroissante jusqu'à 5 % pour +14 → +15.
- Sets (dieux du Monde des Douze) : Ecaflip (Violent), Xélor (Swift), Sadida (Despair), Iop (Rage), Sram (Fatal), Eniripsa (Vampire),
  Sacrieur (Revenge), Féca (Shield), Crâ (Focus), Pandawa (Endure), Osamodas (Fight), Enutrof (spécifique au jeu).

## 6. Économie
Kamas, Énergie, Pierres d'âme, Ogrines (gagnées en jouant uniquement), Essences, Jetons de Kolizéum. ⏳ Montants.

## 7. Modes de jeu
- Histoire : zones du Monde des Douze en Normal, Difficile, Enfer.
- Donjons : Donjon des Bouftous (runes), Antre du Dragon Cochon (runes de haut niveau), Sanctuaires élémentaires (essences).
- Tour des Dimensions : 100 étages.
- Kolizéum : PvP asynchrone (défense jouée par l'IA), classement, ligues.

## 8. Technique
TypeScript, Vite, Phaser 3.80.1, vitest (même architecture que Diablofus : `sim/` pur, `render/` qui lit, `data/` en JSON).
Planches de Diablofus sur le R2. Plus tard : serveur de comptes (comme Diablofus) pour la sauvegarde et la validation du PvP.

## 9. Décisions ouvertes ⏳
1. Chances exactes des coups écrasants et effleurés (50 % provisoire) et leurs effets sur les dégâts (±30 % provisoire).
2. Fiches des 35 monstres (stats, sorts, éveils).
3. Apparence Bonta/Brâkmar des Kwaks et Kwakères.
4. Montants de l'économie.
5. Nom définitif.
