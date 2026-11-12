# Alpha jouable

**But :** une boucle Summoners War complète, jouable en 30 à 60 minutes, sans serveur.

| Système | Contenu de l'alpha |
|---|---|
| Monstres | 13 : Pious (1★, 5 éléments), Scarafeuilles (3★, 5 éléments), Kwaks de Flamme, de Vent et de Glace (3★) |
| Combat | Jauge d'attaque, éléments, 3 sorts, malus et bonus, skill de leader, mode auto |
| Histoire | 1 zone de 7 stages (3 vagues, boss au dernier) |
| Donjon | Donjon des Bouftous, 3 niveaux, qui donne des runes |
| Runes | 6 emplacements, 4 sets, forgemagie +0 à +15 |
| Progression | XP, niveaux, évolution jusqu'à 3★ |
| Invocation | Pierres d'âme (1-3★) |
| Sauvegarde | Locale (navigateur) |

Hors alpha : Kolizéum, comptes en ligne, éveil, Tour, 4-5★.

## Étapes

- [x] **1. Squelette** — Vite + TS + Phaser 3.80.1 + vitest, planches Diablofus chargées depuis le R2, vitrine des 13 monstres animés.
- [x] **2. Moteur de combat (`src/sim/`)** — un combat 4 contre 4 tourne dans les tests ; même graine = même résultat.
  `combat.ts` (jauge, sorts, bonus/malus, éléments, leader), `regles.ts` (constantes SW, ✓ vérifiées / ⚠ à confirmer), `ia.ts` (mode auto).
- [ ] **3. Scène de combat Phaser** — un combat entier jouable à la souris : sorts, cibles, animations, mode auto.
- [ ] **4. Données des 13 monstres** — stats, sorts et skills de leader en JSON.
- [ ] **5. Collection et progression** — XP, niveaux, évolution, sauvegarde locale.
- [ ] **6. Histoire** — 7 stages enchaînés avec récompenses.
- [ ] **7. Runes et donjon** — les runes tombent, s'équipent et se forgemagent.
- [ ] **8. Invocation** — les pierres d'âme donnent des monstres.
- [ ] **9. Test** — 3 à 5 joueurs du Discord y jouent.
