# Version 0.1

**But :** une boucle Summoners War complète, jouable dans le navigateur (PC et téléphone, en paysage), sans serveur.
En ligne : https://mathiss29.github.io/arene-des-douze/

| Système | Dans la 0.1 |
|---|---|
| Île d'Incarnam | Écran d'accueil vivant, bâtiments, mine de kamas, Ganymède au premier lancement |
| Monstres | 50 monstres (1★ à 5★, 5 éléments), fiches recalées sur les vraies moyennes de SW (SWARFARM) + le Bouftou Royal (boss) |
| Combat | Jauge d'attaque, éléments, 3 sorts, bonus et malus, leader, auto, vitesse ×1/×2/×3, 3 vagues |
| Histoire | Astrub : 7 stages × Normal, Difficile, Enfer (ennemis runés), récompense de zone, énergie |
| Donjons | Écran façon Cairos ; Donjon des Bouftous jouable (10 niveaux, Bouftou Royal) ; Dragon Cochon et Cimetière avec leurs zones |
| Combats à répétition | ×10/20/30 en auto, arrêt, résumé du butin et historique |
| Runes | 6 emplacements, 1 à 6★, grades, montée sans échec à +15, 15 sets, retrait, vente sélective, préréglages |
| Progression | XP, nourrir, évolution jusqu'à 6★ (règles RELOADED) |
| Invocation | Toutes les pierres, ×10, fragments de transcendance, 120 places, bestiaire |
| Chemin de l'invocateur | 42 quêtes (Novice, Intermédiaire, Avancé), 4 défis, coffres, 5★ au choix, Chef de Guerre Bouftou |
| Missions du jour | 10 missions à points, 5 coffres, remise à zéro à 6 h |
| Réception | Cadeaux de mise à jour, codes (DOUZE01), récompenses de zone, monstres en trop |
| Sauvegarde | Locale, versionnée, copie de secours, export/import par code |
| Options | Signaler un bug (rapport pour Discord), plein écran, recommencer |
| Qualité | 200+ tests, test de fumée de tous les écrans avant chaque mise en ligne |

Pas dans la 0.1 : Madrestam et Bastion (et donc les donjons du Dragon Cochon et du Cimetière), compétences d'invocateur,
éveil et Sanctuaires, Kolizéum, Tour, comptes en ligne, amis et guilde, fusion, combat d'exploration.

## Étapes

- [x] **1. Squelette** — Vite + TS + Phaser 3.80.1 + vitest, planches Diablofus depuis le R2.
- [x] **2. Moteur de combat** — déterministe (même graine = même combat), règles SW.
- [x] **3. Scène de combat** — sorts, cibles, animations, auto, vitesse.
- [x] **4. Fiches des monstres** — 50 monstres, stats et multiplicateurs de sorts recalés sur SW (SWARFARM, 15 nov. 2026).
- [x] **5. Collection et progression** — XP, nourrir, évoluer, île, mine.
- [x] **6. Histoire** — Zaap, Astrub en 3 difficultés, énergie, vagues, boss.
- [x] **7. Runes et donjons** — runes, sets, donjons façon Cairos, combats à répétition.
- [x] **8. Invocation** — pierres, fragments, places, bestiaire.
- [x] **8 bis. Chemin de l'invocateur, missions du jour, Réception.**
- [x] **8 ter. Solidité** — sauvegarde versionnée, export/import, signalement de bug, test de fumée.
- [ ] **9. Test** — 3 à 5 joueurs du Discord y jouent (Mathis), retours, puis 0.2.
