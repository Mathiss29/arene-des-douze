/**
 * Mine de kamas de l'île (maquette « Île : » 4) : comme les bâtiments à mana de SW, elle produit à l'heure
 * jusqu'à un stockage max ✓ (mécanique). Les quantités sont les nôtres ⚠ (à équilibrer, améliorations plus tard).
 * Pur : le temps est passé en argument (millisecondes), jamais lu ici.
 */
import type { Joueur } from './joueur';

export const MINE = { parHeure: 600, max: 4000 } as const;
const HEURE = 3_600_000;

/** Kamas qui attendent dans la mine. */
export function kamasEnMine(j: Joueur, maintenant: number): number {
  const depuis = j.mine ?? maintenant;
  return Math.min(MINE.max, Math.floor((Math.max(0, maintenant - depuis) * MINE.parHeure) / HEURE));
}

/** Récolte : les kamas passent dans la bourse ; la production reprend (le reste de l'heure entamée est gardé). */
export function recolterMine(j: Joueur, maintenant: number): { joueur: Joueur; kamas: number } {
  const kamas = kamasEnMine(j, maintenant);
  if (!kamas) return { joueur: j, kamas: 0 };
  // pleine : le temps passé au-delà du max est perdu ; sinon on avance juste du temps qui a produit ces kamas
  const depuis = j.mine ?? maintenant;
  const plein = kamas >= MINE.max;
  const mine = plein ? maintenant : depuis + Math.ceil((kamas * HEURE) / MINE.parHeure);
  return { joueur: { ...j, kamas: j.kamas + kamas, mine: Math.min(mine, maintenant) }, kamas };
}

/** Temps avant que la mine soit pleine (ms), 0 si elle l'est. */
export function avantPlein(j: Joueur, maintenant: number): number {
  const depuis = j.mine ?? maintenant;
  return Math.max(0, depuis + (MINE.max * HEURE) / MINE.parHeure - maintenant);
}
