/**
 * Réception (maquette « Réception : » 1A 2C 3B 4A 5C 6C 7B, 15 nov. 2026), comme la boîte de réception de SW ✓ :
 * les cadeaux attendent qu'on les reçoive. 7 jours pour les cadeaux ordinaires, sans limite pour les monstres et les pierres (2C).
 * Y passent : cadeaux de mise à jour et codes (`cadeaux.json`, 6C), récompenses de zone, monstres gagnés quand la collection est pleine (3B).
 * « Tout recevoir » laisse l'énergie de côté, « Recevoir l'énergie » la prend (5C). Pur : le temps est passé en argument (ms).
 */
import type { Joueur } from './joueur';
import { ajouterMonstre, compter } from './joueur';
import { changerEnergie } from './energie';
import { ajouterPierres, placesLibres, type Pierre } from './invocation';
import CADEAUX from '../data/cadeaux.json';
import { donnerRune } from './inventaire';
import type { ParamsRune } from './runes';

export interface Contenu {
  kamas?: number;
  pierresAme?: number;
  pierres?: Partial<Record<Pierre, number>>;
  energie?: number;
  fragments?: number;
  /** Monstre (id) au niveau 1 de ses étoiles naturelles. */
  monstre?: string;
  /** Runes (tirées à la réception). */
  runes?: ParamsRune[];
}

export interface Cadeau {
  id: string;
  titre: string;
  contenu: Contenu;
  /** Arrivée (ms). */
  arrive: number;
  /** Fin (ms) ; absente = sans limite. */
  expire?: number;
  vu?: boolean;
}

export interface CadeauMaj { id: string; titre: string; contenu: Contenu; code?: string }
export const CADEAUX_MAJ = CADEAUX as CadeauMaj[];

export const DUREE_CADEAU = 7 * 24 * 3_600_000;

const durable = (c: Contenu) => !!(c.monstre || c.runes?.length || c.pierresAme || (c.pierres && Object.values(c.pierres).some((n) => (n ?? 0) > 0)));

/** Cadeaux encore là (les cadeaux expirés disparaissent). */
export const cadeaux = (j: Joueur, maintenant: number): Cadeau[] => (j.reception ?? []).filter((c) => c.expire === undefined || c.expire > maintenant);

/** Envoie un cadeau ; un id déjà présent n'est pas envoyé deux fois. */
export function envoyer(j: Joueur, id: string, titre: string, contenu: Contenu, maintenant: number): Joueur {
  const liste = cadeaux(j, maintenant);
  if (liste.some((c) => c.id === id)) return j;
  const c: Cadeau = { id, titre, contenu, arrive: maintenant, ...(durable(contenu) ? {} : { expire: maintenant + DUREE_CADEAU }) };
  return { ...j, reception: [c, ...liste] };
}

/** Raison pour laquelle un cadeau ne peut pas être reçu maintenant (4A : un monstre attend qu'il y ait de la place). */
export const refusCadeau = (j: Joueur, c: Cadeau): 'places' | undefined => (c.contenu.monstre && placesLibres(j) < 1 ? 'places' : undefined);

/** Donne le contenu d'un cadeau (aussi pour le Chemin de l'invocateur). */
export function appliquerContenu(j: Joueur, c: Contenu, maintenant: number): Joueur {
  let r: Joueur = { ...j, kamas: j.kamas + (c.kamas ?? 0), pierresAme: j.pierresAme + (c.pierresAme ?? 0), fragments: j.fragments + (c.fragments ?? 0) };
  for (const [p, n] of Object.entries(c.pierres ?? {})) if (n) r = ajouterPierres(r, p as Pierre, n);
  if (c.energie) r = changerEnergie(r, c.energie, maintenant);
  if (c.monstre) r = ajouterMonstre(r, c.monstre).joueur;
  (c.runes ?? []).forEach((p, i) => { r = donnerRune(r, p, (maintenant + i * 7919) & 0x7fffffff).joueur; });
  return r;
}

export function recevoir(j: Joueur, id: string, maintenant: number): Joueur {
  const liste = cadeaux(j, maintenant), c = liste.find((x) => x.id === id);
  if (!c) throw new Error(`Cadeau ${id} introuvable`);
  if (refusCadeau(j, c)) throw new Error('Collection pleine');
  return compter(appliquerContenu({ ...j, reception: liste.filter((x) => x !== c) }, c.contenu, maintenant), 'cadeau');
}

/** « Tout recevoir » : tout sauf l'énergie, et les monstres tant qu'il y a de la place. */
export function recevoirTout(j: Joueur, maintenant: number): Joueur {
  let r = j;
  for (const c of [...cadeaux(j, maintenant)].reverse()) if (!c.contenu.energie && !refusCadeau(r, c)) r = recevoir(r, c.id, maintenant);
  return r;
}

/** « Recevoir l'énergie » : les cadeaux qui contiennent de l'énergie. */
export function recevoirEnergie(j: Joueur, maintenant: number): Joueur {
  let r = j;
  for (const c of [...cadeaux(j, maintenant)].reverse()) if (c.contenu.energie && !refusCadeau(r, c)) r = recevoir(r, c.id, maintenant);
  return r;
}

export const marquerVus = (j: Joueur, maintenant: number): Joueur => ({ ...j, reception: cadeaux(j, maintenant).map((c) => (c.vu ? c : { ...c, vu: true })) });

/** Cadeaux de mise à jour sans code, donnés une fois à chaque joueur. */
export function distribuer(j: Joueur, maintenant: number): Joueur {
  let r = j;
  for (const g of CADEAUX_MAJ) if (!g.code && !r.cadeauxDonnes?.includes(g.id)) {
    r = { ...envoyer(r, `maj:${g.id}`, g.titre, g.contenu, maintenant), cadeauxDonnes: [...(r.cadeauxDonnes ?? []), g.id] };
  }
  return r;
}

/** Code tapé par le joueur (comme les codes de SW, partagés sur Discord). */
export function utiliserCode(j: Joueur, code: string, maintenant: number): { joueur: Joueur; cadeau?: CadeauMaj; erreur?: 'inconnu' | 'deja' } {
  const t = code.trim().toUpperCase();
  const g = CADEAUX_MAJ.find((x) => x.code && x.code.toUpperCase() === t);
  if (!g) return { joueur: j, erreur: 'inconnu' };
  if (j.cadeauxDonnes?.includes(g.id)) return { joueur: j, erreur: 'deja' };
  return { joueur: { ...envoyer(j, `code:${g.id}`, g.titre, g.contenu, maintenant), cadeauxDonnes: [...(j.cadeauxDonnes ?? []), g.id] }, cadeau: g };
}
