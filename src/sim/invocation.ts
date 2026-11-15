/**
 * Invocation (Cercle d'invocation de l'île, maquette « Invocation : »), fidèle aux parchemins de SW.
 * Chances ✓ (tableau de référence de la communauté SW) ; coûts ✓ : 300 (inconnu) et 10 000 (les autres).
 * Pur : le hasard passe par Rng, rien d'autre.
 */
import MONSTRES from '../data/monstres.json';
import { ajouterMonstre, type Joueur } from './joueur';
import { Rng } from './rng';
import type { Element, FicheMonstre } from './types';

export type Pierre = 'ame' | 'parfaite' | 'feu' | 'eau' | 'air' | 'lumiere' | 'legendaire' | 'transcendante';

export interface InfoPierre {
  nom: string;
  /** [étoiles, chance en %]. */
  chances: [number, number][];
  elements: Element[];
  /** Kamas par invocation. */
  cout: number;
}

const FAE: Element[] = ['feu', 'air', 'eau'];
export const PIERRES: Record<Pierre, InfoPierre> = {
  // Parchemin inconnu ✓ (estimation de la communauté)
  ame: { nom: 'Pierre d\'âme', chances: [[1, 74.1], [2, 24.6], [3, 1.3]], elements: FAE, cout: 300 },
  // Parchemin mystique ✓
  parfaite: { nom: 'Pierre d\'âme parfaite', chances: [[3, 91.5], [4, 8], [5, 0.5]], elements: FAE, cout: 10_000 },
  // Parchemins d'élément : mêmes chances que le mystique d'après la référence ✓ (un guide parle d'un peu plus de 5★ ⚠)
  feu: { nom: 'Pierre de Feu', chances: [[3, 91.5], [4, 8], [5, 0.5]], elements: ['feu'], cout: 10_000 },
  eau: { nom: 'Pierre d\'Eau', chances: [[3, 91.5], [4, 8], [5, 0.5]], elements: ['eau'], cout: 10_000 },
  air: { nom: 'Pierre d\'Air', chances: [[3, 91.5], [4, 8], [5, 0.5]], elements: ['air'], cout: 10_000 },
  // Parchemin Lumière & Ténèbres ✓
  lumiere: { nom: 'Pierre de Bonta et Brâkmar', chances: [[3, 93.65], [4, 6], [5, 0.35]], elements: ['bonta', 'brakmar'], cout: 10_000 },
  // Parchemin légendaire ✓ (sans Lumière ni Ténèbres ✓)
  legendaire: { nom: 'Pierre légendaire', chances: [[4, 93.5], [5, 6.5]], elements: FAE, cout: 10_000 },
  // Parchemin de transcendance ✓ : un 5★ assuré ; coût en kamas ⚠ (pas trouvé)
  transcendante: { nom: 'Pierre d\'âme transcendante', chances: [[5, 100]], elements: FAE, cout: 10_000 },
};
export const ORDRE_PIERRES: Pierre[] = ['ame', 'parfaite', 'feu', 'eau', 'air', 'lumiere', 'legendaire', 'transcendante'];

/** Fragments pour une pierre transcendante ⚠ (pas trouvé pour SW ; un mois de missions du jour). */
export const FRAGMENTS_TRANSCENDANCE = 60;

const TOUS = MONSTRES as FicheMonstre[];
/** Monstres qu'une pierre peut donner, par étoiles. */
export function bassin(p: Pierre, etoiles: number): FicheMonstre[] {
  return TOUS.filter((m) => !m.boss && m.etoiles === etoiles && PIERRES[p].elements.includes(m.element));
}

export const nombre = (j: Joueur, p: Pierre) => (p === 'ame' ? j.pierresAme : j.pierres[p] ?? 0);
const retirer = (j: Joueur, p: Pierre, n: number): Joueur =>
  p === 'ame' ? { ...j, pierresAme: j.pierresAme - n } : { ...j, pierres: { ...j.pierres, [p]: (j.pierres[p] ?? 0) - n } };
export const ajouterPierres = (j: Joueur, p: Pierre, n: number): Joueur => retirer(j, p, -n);

export const placesLibres = (j: Joueur) => j.places - j.monstres.length;

export type Refus = 'pierres' | 'kamas' | 'places';
/** Pourquoi on ne peut pas invoquer n fois, ou null si on peut. */
export function refus(j: Joueur, p: Pierre, n: number): Refus | null {
  if (nombre(j, p) < n) return 'pierres';
  if (j.kamas < PIERRES[p].cout * n) return 'kamas';
  if (placesLibres(j) < n) return 'places';
  return null;
}

export interface Invoque { uid: number; id: string; etoiles: number; nouveau: boolean }

/** Une étoile tirée selon les chances de la pierre (les grades sans monstre sont retirés, chances recalculées). */
function tirerEtoiles(p: Pierre, rng: Rng): number {
  const c = PIERRES[p].chances.filter(([e]) => bassin(p, e).length);
  const total = c.reduce((s, [, x]) => s + x, 0);
  let r = rng.suivant() * total;
  for (const [e, x] of c) if ((r -= x) < 0) return e;
  return c[c.length - 1][0];
}

/** Invoque n monstres (1 ou 10, SW ✓) : pierres et kamas payés, monstres ajoutés au niveau 1. */
export function invoquer(j: Joueur, p: Pierre, n: number, graine: number): { joueur: Joueur; invoques: Invoque[] } {
  const r = refus(j, p, n);
  if (r) throw new Error(`Invocation impossible (${r})`);
  const rng = new Rng(graine);
  let jj: Joueur = { ...retirer(j, p, n), kamas: j.kamas - PIERRES[p].cout * n };
  const invoques: Invoque[] = [];
  for (let k = 0; k < n; k++) {
    const e = tirerEtoiles(p, rng), b = bassin(p, e);
    const m = b[Math.floor(rng.suivant() * b.length)];
    const nouveau = !jj.decouverts.includes(m.id);
    const a = ajouterMonstre(jj, m.id);
    jj = a.joueur;
    invoques.push({ uid: a.uid, id: m.id, etoiles: e, nouveau });
  }
  return { joueur: jj, invoques };
}

/** Assemble une pierre transcendante avec ses fragments. */
export function assemblerTranscendante(j: Joueur): Joueur {
  if (j.fragments < FRAGMENTS_TRANSCENDANCE) throw new Error('Pas assez de fragments');
  return ajouterPierres({ ...j, fragments: j.fragments - FRAGMENTS_TRANSCENDANCE }, 'transcendante', 1);
}

/** Pas de revente : dans SW on ne vend pas un monstre, il sert seulement à l'amélioration ou à l'évolution ✓ (Mathis, SW 9.3.9). */

/** Pas d'achat de places : SW donne d'office les 120 places depuis la v7.1.9 ✓ (vu dans SW 9.3.9 : 61/120). L'Entrepôt (800 places) viendra plus tard. */
