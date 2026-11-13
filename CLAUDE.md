# Arène des Douze — notes pour Claude

Jeu de collection au tour par tour **fidèle à Summoners War: Sky Arena**, dans l'univers de Dofus 3 (fan game gratuit, sans achat).
Le GDD est dans `docs/GDD.md` ; la feuille de route de l'alpha dans `docs/ALPHA.md`.

- Répondre en français.
- `npm test` (vitest) et `npm run build` (tsc + vite) doivent passer avant chaque push.
- `src/sim/` ne doit jamais importer Phaser, `window` ni `Math.random()` : tout le hasard passe par `Rng` (`src/sim/rng.ts`).
  Le combat doit rester déterministe : même graine + mêmes choix = même résultat (le serveur rejouera les combats PvP).
- L'affichage (`src/render/`) lit l'état de la sim, il ne modifie pas la partie.
- Le contenu (monstres, sorts, stages) est dans `src/data/*.json` ; l'apparence (planche, échelle, attaques) dans `src/render/looks.ts`.
- Fidélité à Summoners War : en cas de doute sur une mécanique (jauge d'attaque, formules, runes, invocation), vérifier sur une source SW avant de l'inventer.
  Éléments : Feu > Air > Eau > Feu, Bonta ⇄ Brâkmar (Lumière/Ténèbres). Types : Attaque, Défense, PV, Soutien.
- Planches de monstres : celles de Diablofus (dépôt `Mathiss29/dofus-diablo`, `tools/extraction/monster_planche.py`).
  Les atlas JSON sont copiés dans `public/assets/sprites/` ; les AVIF restent sur le R2 de Diablofus
  (en dév, relayés par Vite sous `/r2` ; en ligne, `VITE_ASSETS_URL=https://assets.diablofus.com`).
  Seule la direction 1 sert : alliés tels quels, ennemis en miroir (`flipX`).
- Écrans : combat d'essai par défaut, vitrine des planches avec `#vitrine`. Paysage uniquement, 1280 × 720 mis à l'échelle.
  Débogage dans la console : `window.game.scene.getScene('combat')`.
- État du joueur : `src/sim/joueur.ts` (pur) ; sauvegarde locale sous la clé `arene-des-douze:joueur` (`src/render/sauvegarde.ts`).
  Stages et butin : `src/data/stages.json`, `src/sim/stages.ts`. Pour repartir de zéro : `localStorage.removeItem('arene-des-douze:joueur')`.
- Fiches de combat (stats 6★ niveau 40, sorts, leader) dans `src/data/fiches.json` ; l'animation jouée par chaque sort dans `looks.ts` (`animSorts`).
- Maquettes jouables dans le jeu : adresse `#maquette-<nom>` (ex. `#maquette-eveils`), scène dans `src/render/maquettes/`,
  panneau de questions numérotées à options A/B/C (`panneau.ts`) ; la réponse s'écrit « Nom : 1A 2B… » comme dans Diablofus.
- Effets maison (`src/render/effets.ts`, choix de Mathis : plus beaux que les effets officiels) : particules et halos générés par le jeu,
  une matière par élément (braises, bulles, feuilles, rayons dorés, fumée), cercle runique, halo, moment de l'éveil.
- Effets officiels de Dofus 3 (`src/render/fx.ts`, gardés pour plus tard) : atlas dans `public/assets/fx`, images sur le R2 (`fx/fx_<id>.webp`), définitions dans `src/data/fx.json`.
- Le site est publié sur GitHub Pages (`.github/workflows/deploiement.yml`), seule origine autorisée en CORS par le R2 avec diablofus.com.
