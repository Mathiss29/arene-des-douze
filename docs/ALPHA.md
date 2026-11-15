# Alpha jouable

**But :** une boucle Summoners War complète, jouable en 30 à 60 minutes, sans serveur.

| Système | Contenu de l'alpha |
|---|---|
| Monstres | 13 : Pious (1★, 5 éléments), Scarafeuilles (3★, 5 éléments), Kwaks de Flamme, de Vent et de Glace (3★) |
| Combat | Jauge d'attaque, éléments, 3 sorts, malus et bonus, skill de leader, mode auto |
| Histoire | 1 zone de 7 stages (3 vagues, boss au dernier) |
| Donjon | Donjon des Bouftous, 10 niveaux (comme SW depuis RELOADED ✓), qui donne des runes |
| Runes | 6 emplacements, 4 sets, forgemagie +0 à +15 |
| Progression | XP, niveaux, évolution jusqu'à 3★ |
| Invocation | Toutes les pierres (âme, parfaite, élémentaires, Bonta/Brâkmar, légendaire, transcendante), ×10, revente, bestiaire, place limitée |
| Chemin de l'invocateur | Quêtes Novice → Expert et défis, pour tout le contenu de la 0.1 |
| Missions du jour | Quelques missions simples, fragments de pierre transcendante |
| Monstres | + familles 4★ (Kwakères, Koalaks, Bouftous) et 5★ (Dragoss, Gelées Royales), 3★ Bonta/Brâkmar (Kwaks, Larves) |
| Sauvegarde | Locale (navigateur) |

Hors alpha : Kolizéum, comptes en ligne, éveil, Tour, 4-5★.

## Étapes

- [x] **1. Squelette** — Vite + TS + Phaser 3.80.1 + vitest, planches Diablofus chargées depuis le R2, vitrine des 13 monstres animés.
- [x] **2. Moteur de combat (`src/sim/`)** — un combat 4 contre 4 tourne dans les tests ; même graine = même résultat.
  `combat.ts` (jauge, sorts, bonus/malus, éléments, leader), `regles.ts` (constantes SW, ✓ vérifiées / ⚠ à confirmer), `ia.ts` (mode auto).
- [x] **3. Scène de combat Phaser** — un combat entier jouable à la souris : sorts, cibles, animations, mode auto.
  `src/render/CombatScene.ts`, selon la maquette « Combat : » 1B 2B 3A 4B 5A. Combat d'essai 4 contre 4 dans la salle des Scarafeuilles (alliés gagnants ≈ 83 % en auto).
- [ ] **4. Données des 13 monstres** — stats, sorts et skills de leader en JSON.
  Fiches provisoires en place (`src/data/fiches.json`) : stats « niveau max » par type, 2 sorts (Pious) ou 3 sorts, icônes officielles. À équilibrer.
- [ ] **5. Collection et progression** — XP, niveaux, évolution, sauvegarde locale.
  Fait : état du joueur (`src/sim/joueur.ts`), table d'XP et niveaux max de SW, croissance des stats, évolution (`progression.ts`),
  butin des stages (`stages.ts`), sauvegarde locale, XP et montées de niveau après chaque victoire.
  Écrans de préparation (`PreparationScene.ts` : tri, filtre, fiche, équipe retenue par stage, monstres prêts à évoluer)
  et de récompenses (fin de `CombatScene.ts`) faits d'après la maquette « Écrans : ».
  Cercle d'amélioration (`CercleScene.ts`) : nourrir et faire évoluer, règles SW actuelles (RELOADED).
  Île d'Incarnam (`IleScene.ts`) : écran d'accueil vivant, bâtiments, pastilles « ! », mine de kamas.
  Reste : invocation, boutique, temple, Ganymède, monstres qui se promènent, musique, écran de collection hors combat, montée des sorts par la famille.
- [ ] **6. Histoire** — 7 stages enchaînés avec récompenses.
  Fait : Zaap (`ZaapScene.ts`), zone d'Astrub en 7 stages × 3 difficultés (`stages.ts`, `zones.json`), énergie (`energie.ts`),
  récompense de zone, monstres qui tombent, boss au 7ᵉ, 3 vagues par stage (`combat.ts` : `vaguesSuivantes`). Reste : autres zones.
- [ ] **7. Runes et donjon** — les runes tombent, s'équipent et se forgemagent.
- [ ] **8. Invocation** — Cercle d'invocation (maquette « Invocation : »), toutes les pierres, revente, bestiaire, place limitée.
  Fait : écran d'invocation (×1, ×10, animation, résultat, fiche), toutes les pierres, fragments, places ; 37 monstres de plus.
  Reste : écran de revente, bestiaire, sources des pierres (donjon, zones, Temple, chemin, missions).
- [ ] **8 bis. Chemin de l'invocateur et missions du jour** (maquette « Chemin : »).
- [ ] **9. Test** — 3 à 5 joueurs du Discord y jouent.
