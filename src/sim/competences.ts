import FICHES from '../data/fiches.json';
import { fiche } from './fiches';
import type { Rng } from './rng';
import type { Sort } from './types';

/**
 * Niveaux de compétence des monstres, comme dans Summoners War :
 * ✓ chaque sort a un niveau maximum et chaque niveau donne un gain précis (« Dégâts +10 % », « Taux d'effet nocif +10 % »,
 *   « Tour de temps de pause −1 ») — onglet Compétence, vidéo de Mathis du 25/11/2026 ;
 * ✓ on monte un niveau en donnant en nourriture un monstre de la même famille, quel que soit son élément (confirmé par Mathis ;
 *   le Devilmon de SW n'existe pas encore chez nous) ;
 * ⚠ le sort qui monte est tiré au hasard parmi ceux qui ne sont pas au maximum (souvenir de SW, pas revérifié) ;
 * ⚠ la table des gains de chaque sort est la nôtre : elle est déduite de la forme du sort (voir `gainsDe`).
 */
export type Gain = { type: 'degats' | 'effet' | 'soin' | 'recharge'; valeur: number };

const SORTS = FICHES as unknown as Record<string, { sorts: Sort[] }>;

/** Gains des niveaux 2, 3, 4… d'un sort (le niveau maximum est donc `gainsDe(s).length + 1`). */
export function gainsDe(s: Sort): Gain[] {
  if (s.passif || s.invoque) return [];
  const g: Gain[] = [];
  const effet = (s.effets ?? []).some((e) => e.chance < 100) || (s.jauge?.cible !== undefined && s.jauge.cible.chance < 100);
  if (s.mult) {
    if (s.recharge === 0) g.push({ type: 'degats', valeur: 5 }, effet ? { type: 'effet', valeur: 10 } : { type: 'degats', valeur: 5 }, { type: 'degats', valeur: 10 }, effet ? { type: 'effet', valeur: 10 } : { type: 'degats', valeur: 10 });
    else g.push({ type: 'degats', valeur: 10 }, effet ? { type: 'effet', valeur: 10 } : { type: 'degats', valeur: 10 }, { type: 'degats', valeur: 10 });
  } else {
    if (s.soin || s.bouclier) g.push({ type: 'soin', valeur: 10 }, { type: 'soin', valeur: 10 });
    if (effet) g.push({ type: 'effet', valeur: 10 }, { type: 'effet', valeur: 10 });
  }
  if (s.recharge >= 3) g.push({ type: 'recharge', valeur: 1 });
  return g;
}

export const niveauMax = (s: Sort) => gainsDe(s).length + 1;

export function texteGain(g: Gain, s: Sort): string {
  if (g.type === 'degats') return `Dégâts +${g.valeur} %`;
  if (g.type === 'effet') return `Taux d'effet +${g.valeur} %`;
  if (g.type === 'soin') return `${s.soin ? 'Soins' : 'Bouclier'} +${g.valeur} %`;
  return `Recharge −${g.valeur} tour`;
}

/** Le sort tel qu'il est au niveau donné (1 = sort de base). */
export function sortAuNiveau(s: Sort, niveau: number): Sort {
  const acquis = gainsDe(s).slice(0, Math.max(0, niveau - 1));
  if (!acquis.length) return s;
  const somme = (t: Gain['type']) => acquis.filter((g) => g.type === t).reduce((n, g) => n + g.valeur, 0);
  const deg = 1 + somme('degats') / 100, eff = somme('effet'), soin = 1 + somme('soin') / 100, rech = somme('recharge');
  const r: Sort = { ...s, recharge: Math.max(1, s.recharge - rech) };
  if (s.recharge === 0) r.recharge = 0;
  if (s.mult && deg !== 1) r.mult = Object.fromEntries(Object.entries(s.mult).map(([k, v]) => [k, (v ?? 0) * deg]));
  if (eff && s.effets) r.effets = s.effets.map((e) => (e.chance < 100 ? { ...e, chance: Math.min(100, e.chance + eff) } : e));
  if (eff && s.jauge?.cible && s.jauge.cible.chance < 100) r.jauge = { ...s.jauge, cible: { ...s.jauge.cible, chance: Math.min(100, s.jauge.cible.chance + eff) } };
  if (soin !== 1 && s.soin) r.soin = s.soin * soin;
  if (soin !== 1 && s.bouclier) r.bouclier = { ...s.bouclier, part: s.bouclier.part * soin };
  return r;
}

/** Niveaux de compétence d'un monstre possédé (1 partout tant qu'il n'a rien monté). */
export function niveauxDe(m: { id: string; sorts?: number[] }): number[] {
  return SORTS[m.id].sorts.map((s, i) => Math.min(niveauMax(s), Math.max(1, m.sorts?.[i] ?? 1)));
}

export const competencesAuMax = (m: { id: string; sorts?: number[] }) => niveauxDe(m).every((n, i) => n >= niveauMax(SORTS[m.id].sorts[i]));
export const memeFamille = (a: string, b: string) => fiche(a).famille === fiche(b).famille;

/** Monte `fois` niveaux de compétence, chacun sur un sort tiré au hasard parmi ceux qui ne sont pas au maximum. */
export function monterCompetences(m: { id: string; sorts?: number[] }, fois: number, rng: Rng): { sorts: number[]; montes: number[] } {
  const sorts = niveauxDe(m), montes: number[] = [], liste = SORTS[m.id].sorts;
  for (let k = 0; k < fois; k++) {
    const libres = sorts.map((n, i) => (n < niveauMax(liste[i]) ? i : -1)).filter((i) => i >= 0);
    if (!libres.length) break;
    const i = libres[Math.floor(rng.suivant() * libres.length)];
    sorts[i]++; montes.push(i);
  }
  return { sorts, montes };
}

/** Les sorts d'un monstre possédé, à leur niveau. */
export function sortsDe(m: { id: string; sorts?: number[] }): Sort[] {
  const n = niveauxDe(m);
  return SORTS[m.id].sorts.map((s, i) => sortAuNiveau(s, n[i]));
}
