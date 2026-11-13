/**
 * Progression des monstres, fidèle à Summoners War: Sky Arena.
 * ✓ = vérifié sur une source SW ; ⚠ = choix provisoire faute de source.
 */
import type { Stats } from './types';

export type Etoiles = 1 | 2 | 3 | 4 | 5 | 6;

/** ✓ Niveau maximum selon les étoiles. */
export const NIVEAU_MAX: Record<Etoiles, number> = { 1: 15, 2: 20, 3: 25, 4: 30, 5: 35, 6: 40 };

/** ✓ XP pour passer du niveau n au niveau n + 1 (index 0 = niveau 1 → 2), par nombre d'étoiles. */
export const XP_NIVEAU: Record<Etoiles, readonly number[]> = {
  1: [460, 516, 579, 650, 728, 818, 918, 1029, 1155, 1296, 1455, 1631, 1831, 2054],
  2: [552, 619, 695, 779, 875, 981, 1102, 1235, 1386, 1555, 1745, 1958, 2197, 2465, 2765, 3103, 3481, 3906, 4423],
  3: [662, 743, 834, 936, 1049, 1178, 1321, 1483, 1663, 1866, 2094, 2350, 2636, 2957, 3319, 3723, 4178, 4687, 5307, 6009, 6802, 7703, 8720, 9962],
  4: [796, 892, 1002, 1124, 1261, 1415, 1587, 1781, 1998, 2243, 2515, 2823, 3167, 3553, 3987, 4473, 5019, 5631, 6376, 7219, 8172, 9254, 10476, 11969, 13673, 15619, 17844, 20386, 23495],
  5: [952, 1068, 1199, 1344, 1509, 1693, 1899, 2131, 2392, 2682, 3010, 3378, 3789, 4252, 4770, 5352, 6006, 6738, 7628, 8638, 9779, 11072, 12535, 14321, 16360, 18690, 21350, 24392, 28113, 32404, 37348, 43048, 49617, 57188],
  6: [1150, 1290, 1447, 1624, 1823, 2044, 2294, 2574, 2888, 3240, 3635, 4079, 4576, 5135, 5762, 6464, 7252, 8138, 9214, 10431, 11811, 13371, 15140, 17296, 19758, 22572, 25786, 29458, 33954, 39134, 45107, 51990, 59924, 69068, 76085, 83816, 92332, 101712, 112046],
};

/**
 * ⚠ Coût en kamas (le mana de SW) pour passer à l'étoile suivante : barème d'avant RELOADED.
 * Depuis la v8.0.0 (2023), SW calcule le coût d'après les étoiles de la nourriture ; montants non trouvés.
 */
export const COUT_EVOLUTION: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 1600, 2: 4000, 3: 9600, 4: 22400, 5: 35200 };

/**
 * ✓ Évolution façon SW depuis RELOADED (v8.0.0, 2023) : plus besoin du niveau max, le niveau ne repart pas à 1,
 * et la nourriture peut avoir autant ou moins d'étoiles. Chaque monstre donné vaut des points selon ses étoiles ;
 * il en faut autant que N monstres N★ (1★ : 1 point ; 2★ : 4 ; 3★ : 18 ; 4★ : 96 ; 5★ : 600).
 */
export const POINTS_NOURRITURE: Record<Etoiles, number> = { 1: 1, 2: 2, 3: 6, 4: 24, 5: 120, 6: 720 };
export const pointsRequis = (e: 1 | 2 | 3 | 4 | 5) => e * POINTS_NOURRITURE[e];

/**
 * ⚠ Croissance des stats. Les fiches donnent les stats 6★ niveau 40 (comme les pages de monstres SW).
 * PV, Attaque et Défense valent cette fraction au niveau max de chaque étoile, et grandissent en ligne droite
 * depuis le niveau 1 (qui reprend ~95 % du niveau max de l'étoile précédente : après évolution, les stats baissent un peu, ✓).
 * Vitesse, critique, précision et résistance ne changent pas avec le niveau (✓).
 */
const PART_MAX: Record<Etoiles, number> = { 1: 0.3, 2: 0.4, 3: 0.52, 4: 0.65, 5: 0.8, 6: 1 };
const PART_NIVEAU_1: Record<Etoiles, number> = { 1: 0.15, 2: 0.285, 3: 0.38, 4: 0.494, 5: 0.6175, 6: 0.76 };

export function partStats(etoiles: Etoiles, niveau: number): number {
  const max = NIVEAU_MAX[etoiles];
  const n = Math.min(Math.max(1, niveau), max);
  return PART_NIVEAU_1[etoiles] + ((PART_MAX[etoiles] - PART_NIVEAU_1[etoiles]) * (n - 1)) / (max - 1);
}

export function statsAuNiveau(stats6: Stats, etoiles: Etoiles, niveau: number): Stats {
  const k = partStats(etoiles, niveau);
  return { ...stats6, pv: Math.round(stats6.pv * k), atq: Math.round(stats6.atq * k), def: Math.round(stats6.def * k) };
}

/** Ajoute de l'XP : renvoie le nouveau niveau et l'XP dans ce niveau. Au niveau max, l'XP en trop est perdue (✓). */
export function ajouterXp(etoiles: Etoiles, niveau: number, xp: number, gain: number): { niveau: number; xp: number } {
  const max = NIVEAU_MAX[etoiles];
  let n = niveau, x = xp + gain;
  while (n < max && x >= XP_NIVEAU[etoiles][n - 1]) {
    x -= XP_NIVEAU[etoiles][n - 1];
    n++;
  }
  return { niveau: n, xp: n >= max ? 0 : x };
}

/**
 * ✓ XP donnée par un monstre sacrifié au Cercle d'amélioration (wiki SW, Power-Up Circle) : niveau 1 et niveau max
 * pour chaque étoile ; ⚠ entre les deux on interpole, et RELOADED a pu changer ces valeurs.
 */
export const XP_NOURRITURE: Record<Etoiles, [number, number]> = {
  1: [800, 1210], 2: [1760, 3086], 3: [3200, 6204], 4: [6724, 13851], 5: [16000, 43708], 6: [44001, 139356],
};
export function xpDonnee(etoiles: Etoiles, niveau: number): number {
  const [a, b] = XP_NOURRITURE[etoiles];
  const max = NIVEAU_MAX[etoiles];
  return Math.round(a + ((b - a) * (Math.min(niveau, max) - 1)) / (max - 1));
}
/** ✓ SW : environ 20 % de chances de recevoir 1,5 fois l'XP. */
export const CHANCE_BONUS_XP = 0.2;
/** ⚠ Kamas par monstre donné (SW : le coût dépend des étoiles de la nourriture ; montants non trouvés). */
export const COUT_NOURRIR: Record<Etoiles, number> = { 1: 100, 2: 300, 3: 900, 4: 2700, 5: 8100, 6: 24300 };
/** SW : jusqu'à 5 monstres donnés d'un coup. */
export const NOURRITURE_MAX = 5;
