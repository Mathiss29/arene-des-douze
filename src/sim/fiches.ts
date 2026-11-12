import MONSTRES from '../data/monstres.json';
import FICHES from '../data/fiches.json';
import type { FicheMonstre, Leader, MonstreCombat, Sort, Stats } from './types';

interface FicheCombat {
  stats: Stats;
  sorts: Sort[];
  leader?: Leader;
}

const PAR_ID = new Map((MONSTRES as FicheMonstre[]).map((m) => [m.id, m]));
const COMBAT = FICHES as unknown as Record<string, FicheCombat>;

/** Monstre prêt pour le combat (stats au niveau max provisoires de l'alpha). */
export function monstreCombat(id: string): MonstreCombat {
  const m = PAR_ID.get(id);
  const f = COMBAT[id];
  if (!m || !f) throw new Error(`Monstre inconnu : ${id}`);
  return { id, nom: m.nom, element: m.element, stats: { ...f.stats }, sorts: f.sorts, leader: f.leader };
}

export const fiche = (id: string): FicheMonstre => PAR_ID.get(id)!;
