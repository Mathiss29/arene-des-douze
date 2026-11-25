# Arène des Douze — notes pour Claude

Jeu de collection au tour par tour **fidèle à Summoners War: Sky Arena**, dans l'univers de Dofus 3 (fan game gratuit, sans achat).
Le GDD est dans `docs/GDD.md` ; la feuille de route de l'alpha dans `docs/ALPHA.md`.

- Répondre en français.
- `npm test` (vitest) et `npm run build` (tsc + vite) doivent passer avant chaque push.
- `src/sim/` ne doit jamais importer Phaser, `window` ni `Math.random()` : tout le hasard passe par `Rng` (`src/sim/rng.ts`).
  Le combat doit rester déterministe : même graine + mêmes choix = même résultat (le serveur rejouera les combats PvP).
- L'affichage (`src/render/`) lit l'état de la sim, il ne modifie pas la partie.
- Le contenu (monstres, sorts, stages) est dans `src/data/*.json` ; l'apparence (planche, échelle, attaques) dans `src/render/looks.ts`.
- Fidélité à Summoners War **dans sa version actuelle** : en cas de doute sur une mécanique (jauge d'attaque, formules, runes, invocation),
  vérifier sur une source SW avant de l'inventer, et vérifier qu'elle n'a pas changé depuis (RELOADED 2023 : évolution, runes sans échec ;
  v8.1.4 : compétences d'invocateur à la place des bâtiments de gloire). Le GDD marque ✓ ce qui est vérifié et ⚠ ce qui ne l'est pas.
  Éléments : Feu > Air > Eau > Feu, Bonta ⇄ Brâkmar (Lumière/Ténèbres). Types : Attaque, Défense, PV, Soutien.
- Planches de monstres : celles de Diablofus (dépôt `Mathiss29/dofus-diablo`, `tools/extraction/monster_planche.py`).
  Les atlas JSON sont copiés dans `public/assets/sprites/` ; les AVIF restent sur le R2 de Diablofus
  (en dév, relayés par Vite sous `/r2` ; en ligne, `VITE_ASSETS_URL=https://assets.diablofus.com`).
  Seule la direction 1 sert : alliés tels quels, ennemis en miroir (`flipX`).
- Écrans : île d'Incarnam par défaut (`src/render/IleScene.ts` : trois caméras ciel / île / interface, images et positions dans
  `public/assets/ile/`, faites hors dépôt par `ile_vivante.py`), carte des combats (`ZaapScene.ts`, par le Zaap ou « Combattre » : zones, stages, difficultés),
  préparation d'équipe (`PreparationScene.ts`)
  puis combat (`CombatScene.ts`, récompenses à la fin), Stèle d'amélioration façon SW (`CercleScene.ts`, clé `cercle` : onglets Amélioration / Évoluer / Éveil en colonne, nourriture en rangée, « Sélectionner le monstre », « Sélection auto », collection en grille à droite), Cercle d'invocation (`InvocationScene.ts`, règles dans `src/sim/invocation.ts`), vitrine avec `#vitrine`.
  Autres écrans : missions du jour (`MissionsScene`, `src/sim/missions.ts`), Réception (`ReceptionScene`, `reception.ts`, cadeaux et codes dans `src/data/cadeaux.json`),
  « Gérer » les runes d'un monstre, disposé comme SW (`MonstreScene` : Avant / Après et « Appliquer » à gauche, filtres set / places en fleur / stat principale / deux sous-stats en haut, inventaire en grille avec tri en bas, fiche de rune en fenêtre ; `runes.ts`, `inventaire.ts`) ; la roue est dans l'onglet Runes de l'écran Monstres, donjons façon Cairos (`DonjonsScene`, `donjons.ts`, `src/data/donjons.json`),
  Chemin de l'invocateur (`CheminScene`, `chemin.ts`, quêtes dans `src/data/quetes.json`), collection de monstres façon SW (`BestiaireScene` : un élément à la fois par cinq gemmes, huit colonnes, monstres jamais eus éteints, « Chercher »), options (`OptionsScene`).
  Test de fumée de tous les écrans : `npm run fumee` (Chrome sans tête, lancé aussi avant chaque mise en ligne).
  Mine de kamas : `src/sim/mine.ts` (le temps est passé en argument). Particules officielles : `src/render/particules.ts` (repris de Diablofus).
  Écran « Monstres » façon SW (`MonstresScene`, clé `monstres` : grille ou vue détail animée, onglets Info / Sorts / Runes / Éveil), ouvert par la plaque « Monstres » de l'île.
  DA « Pierre et émeraude » (à étendre à tout le jeu, l'écran Monstres est le modèle) : `src/render/identite.ts` (`decorVivant()` : fond de pierre, rayons, brume, lucioles de la couleur de l'élément ;
  `bandeauPierre()`, `carteMonstre()` en médaillon de pierre (reflet sur les 5★ et 6★, pastilles équipe / cadenas / « Nouveau »), `etoiles()` dessinées,
  `runeMedaillon()` avec les vrais symboles des classes de Dofus 3 (`public/assets/ui/symboles.webp`, tirés de `Picto/UI/class_assets_.bundle` : `symbol_<id de classe>`),
  `emblemeGrave()`, `eclatEntree()`, `hexagoneStats()`), textures de Dofus 3 (`public/assets/ui/`), police Fredoka, `panneau()`, `bouton()` (vert = choisi ou action principale), `boutonOr()` pour les moments forts.
  Lumière (Bonta) : blanc doré, jamais jaune sable.
  Outils d'interface partagés (boutons, portraits, panneaux) : `src/render/ui.ts`. Paysage uniquement : monde de 1280 × 720,
  dessiné à la taille réelle de l'écran (`src/render/nettete.ts` : canevas ×K, caméras zoomées ×K, textes en résolution K).
  Débogage dans la console : `window.game.scene.getScene('combat')`.
- État du joueur : `src/sim/joueur.ts` (pur) ; sauvegarde locale sous la clé `arene-des-douze:joueur` (`src/render/sauvegarde.ts`).
  Zones, stages, difficultés et butin : `src/data/zones.json`, `src/data/stages.json`, `src/sim/stages.ts` (clé « astrub-3@1 » = stage 3 en Difficile) ;
  énergie : `src/sim/energie.ts`. Pour repartir de zéro : `localStorage.removeItem('arene-des-douze:joueur')`.
- Fiches de combat (stats 6★ niveau 40, sorts, leader) dans `src/data/fiches.json` (celles des familles 2 à 5★ sont provisoires, faites par `familles.py` hors dépôt) ;
  couleurs refaites (élément qui manque dans Dofus) : `teinte` dans `looks.ts`, appliquée par `teinter()` (ColorMatrix WebGL) ; l'animation jouée par chaque sort dans `looks.ts` (`animSorts`).
- Maquettes jouables dans le jeu : adresse `#maquette-<nom>` (ex. `#maquette-eveils`), scène dans `src/render/maquettes/`,
  panneau de questions numérotées à options A/B/C (`panneau.ts`) ; la réponse s'écrit « Nom : 1A 2B… » comme dans Diablofus.
- Images d'interface : toujours partir des paquets « 2x » de Dofus 3 (`StreamingAssets/Content/Picto/Spells/spell_assets_2x.bundle` : icônes de sorts 96 px,
  `Picto/Items/item_assets_2x.bundle` : objets 128 px, `aa/StandaloneWindows64/*_2x.bundle`), extraits avec UnityPy ; les « 1x » sont flous une fois agrandis.
- Effets maison (`src/render/effets.ts`, choix de Mathis : plus beaux que les effets officiels) : particules et halos générés par le jeu,
  une matière par élément (braises, bulles, feuilles, rayons dorés, fumée), cercle runique, halo, moment de l'éveil.
- Effets officiels de Dofus 3 (`src/render/fx.ts`, gardés pour plus tard) : atlas dans `public/assets/fx`, images sur le R2 (`fx/fx_<id>.webp`), définitions dans `src/data/fx.json`.
- Le site est publié sur GitHub Pages (`.github/workflows/deploiement.yml`), seule origine autorisée en CORS par le R2 avec diablofus.com.
