import MONSTRES from '../data/monstres.json';
import FICHES from '../data/fiches.json';
import { NIVEAU_MAX, statsAuNiveau, type Etoiles } from './progression';
import type { FicheMonstre, Leader, MonstreCombat, Sort, Stats } from './types';

interface FicheCombat {
  /** Stats 6★ niveau 40 (comme les pages de monstres de SW). */
  stats: Stats;
  sorts: Sort[];
  leader?: Leader;
}

const PAR_ID = new Map((MONSTRES as FicheMonstre[]).map((m) => [m.id, m]));
const COMBAT = FICHES as unknown as Record<string, FicheCombat>;

/** Monstre prêt pour le combat, à un nombre d'étoiles et un niveau donnés (par défaut : ses étoiles naturelles, niveau max). */
export function monstreCombat(id: string, etoiles?: Etoiles, niveau?: number): MonstreCombat {
  const m = PAR_ID.get(id);
  const f = COMBAT[id];
  if (!m || !f) throw new Error(`Monstre inconnu : ${id}`);
  const e = etoiles ?? (m.etoiles as Etoiles);
  const n = niveau ?? NIVEAU_MAX[e];
  return { id, nom: m.nom, element: m.element, stats: statsAuNiveau(f.stats, e, n), sorts: f.sorts, leader: f.leader, etoiles: e, niveau: n };
}

export const fiche = (id: string): FicheMonstre => PAR_ID.get(id)!;
