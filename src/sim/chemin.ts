/**
 * Chemin de l'invocateur (maquette « Chemin : » 1A…10A, 14 nov. 2026), comme le Summoner's Way de SW ✓ :
 * quêtes faites une seule fois, en paliers (Novice, Intermédiaire, Avancé), et défis par contenu avec une grande récompense
 * (le défi du donjon donne le Chef de Guerre Bouftou 4★, comme Shannon dans SW). Coffre en fin de palier ; le dernier donne
 * la pierre transcendante, et finir Astrub en Enfer un 5★ au choix. Récompenses à réclamer (pastille « ! »).
 * Les quêtes sont des données (`quetes.json`) : l'avancement se lit dans l'état du joueur et ses compteurs. Pur.
 */
import QUETES from '../data/quetes.json';
import MONSTRES from '../data/monstres.json';
import ZONES from '../data/zones.json';
import type { Joueur } from './joueur';
import { placesLibres } from './invocation';
import { appliquerContenu, envoyer, type Contenu } from './reception';
import { setsActifs, SETS, type SetRune } from './runes';
import { NIVEAU_MAX, type Etoiles } from './progression';
import type { FicheMonstre } from './types';

export type Condition =
  | { type: 'stage'; id: string }
  | { type: 'compteur'; cle: string; n: number }
  | { type: 'zone'; zone: string; dif: number }
  | { type: 'donjon'; donjon: string; niveau: number }
  | { type: 'evolue'; n: number }
  | { type: 'niveauMax'; etoiles: number }
  | { type: 'runeNiveau'; n: number }
  | { type: 'runesPortees'; n: number }
  | { type: 'set4' }
  | { type: 'decouverts'; n: number }
  | { type: 'equipe'; n: number };

export type Recompense = Contenu & { choix5?: boolean };
export interface Quete { id: string; titre: string; condition: Condition; recompense: Recompense; ecran: string; desc: string }
export interface Palier { id: string; nom: string; coffre: Recompense; quetes: Quete[] }
export interface Defi { id: string; nom: string; recompense: Recompense; etapes: Quete[] }

export const PALIERS = (QUETES as unknown as { paliers: Palier[] }).paliers;
export const DEFIS = (QUETES as unknown as { defis: Defi[] }).defis;
export const TOUTES = [...PALIERS.flatMap((p) => p.quetes), ...DEFIS.flatMap((d) => d.etapes)];

const NAT = new Map((MONSTRES as FicheMonstre[]).map((m) => [m.id, m.etoiles]));
const STAGES_ZONE = new Map((ZONES as { id: string; stages: string[] }[]).map((z) => [z.id, z.stages]));
/** 5★ au choix : les monstres 5★ naturels qu'on peut invoquer. */
export const CHOIX_5 = (MONSTRES as FicheMonstre[]).filter((m) => m.etoiles === 5 && !m.boss).map((m) => m.id);

/** Avancement d'une quête : où on en est sur combien. */
export function avancement(j: Joueur, c: Condition): { fait: number; objectif: number } {
  const oui = (b: boolean) => ({ fait: b ? 1 : 0, objectif: 1 });
  const runes = j.runes ?? [];
  switch (c.type) {
    case 'stage': return oui(j.stagesFinis.includes(c.id));
    case 'compteur': return { fait: Math.min(c.n, j.compteurs?.[c.cle] ?? 0), objectif: c.n };
    case 'zone': {
      const l = STAGES_ZONE.get(c.zone) ?? [], cle = (s: string) => (c.dif ? `${s}@${c.dif}` : s);
      return { fait: l.filter((s) => j.stagesFinis.includes(cle(s))).length, objectif: l.length || 1 };
    }
    case 'donjon': return oui(j.stagesFinis.includes(`donjon:${c.donjon}-${c.niveau}`));
    case 'evolue': return oui(j.monstres.some((m) => m.etoiles >= c.n && m.etoiles > (NAT.get(m.id) ?? 6)));
    case 'niveauMax': return oui(j.monstres.some((m) => m.etoiles >= c.etoiles && m.niveau >= NIVEAU_MAX[m.etoiles as Etoiles]));
    case 'runeNiveau': return oui(runes.some((r) => r.niveau >= c.n));
    case 'runesPortees': {
      const max = Math.max(0, ...j.monstres.map((m) => runes.filter((r) => r.porteur === m.uid).length));
      return { fait: Math.min(c.n, max), objectif: c.n };
    }
    case 'set4': return oui(j.monstres.some((m) => Object.keys(setsActifs(runes.filter((r) => r.porteur === m.uid))).some((s) => SETS[s as SetRune].pieces === 4)));
    case 'decouverts': return { fait: Math.min(c.n, j.decouverts.length), objectif: c.n };
    case 'equipe': return { fait: Math.min(c.n, j.equipe.length), objectif: c.n };
  }
}

const recu = (j: Joueur, id: string) => (j.chemin ?? []).includes(id);
export const queteFinie = (j: Joueur, q: Quete) => { const a = avancement(j, q.condition); return a.fait >= a.objectif; };
export const queteRecue = (j: Joueur, q: Quete) => recu(j, q.id);
export const peutRecevoirQuete = (j: Joueur, q: Quete) => queteFinie(j, q) && !recu(j, q.id);
export const palierFini = (j: Joueur, p: Palier) => p.quetes.every((q) => recu(j, q.id));
export const coffreRecu = (j: Joueur, p: Palier) => recu(j, `palier:${p.id}`);
export const defiFini = (j: Joueur, d: Defi) => d.etapes.every((q) => recu(j, q.id));
export const defiRecu = (j: Joueur, d: Defi) => recu(j, `defi:${d.id}`);
/** Un palier s'ouvre quand le précédent est fini (comme SW, Novice puis Intermédiaire puis Avancé). */
export const palierOuvert = (j: Joueur, p: Palier) => { const i = PALIERS.indexOf(p); return i <= 0 || palierFini(j, PALIERS[i - 1]); };

/** Donne une récompense : un monstre va à la Réception si la collection est pleine ; `choix5` demande l'id du 5★ choisi. */
function donner(j: Joueur, r: Recompense, cle: string, titre: string, maintenant: number, choix?: string): Joueur {
  const { choix5, monstre, ...reste } = r;
  let k = appliquerContenu(j, reste, maintenant);
  const m = choix5 ? choix : monstre;
  if (choix5 && (!choix || !CHOIX_5.includes(choix))) throw new Error('Choisis un monstre 5★');
  if (m) k = placesLibres(k) > 0 ? appliquerContenu(k, { monstre: m }, maintenant) : envoyer(k, `chemin:${cle}`, `${titre} (collection pleine)`, { monstre: m }, maintenant);
  return { ...k, chemin: [...(k.chemin ?? []), cle] };
}

export function recevoirQuete(j: Joueur, id: string, maintenant: number, choix?: string): Joueur {
  const q = TOUTES.find((x) => x.id === id);
  if (!q || !peutRecevoirQuete(j, q)) throw new Error(`Quête ${id} pas finie ou déjà reçue`);
  const p = PALIERS.find((x) => x.quetes.includes(q));
  if (p && !palierOuvert(j, p)) throw new Error('Palier pas encore ouvert');
  return donner(j, q.recompense, q.id, q.titre, maintenant, choix);
}

export function recevoirCoffre(j: Joueur, id: string, maintenant: number): Joueur {
  const p = PALIERS.find((x) => x.id === id);
  if (!p || !palierFini(j, p) || coffreRecu(j, p)) throw new Error('Coffre fermé');
  return donner(j, p.coffre, `palier:${p.id}`, `Coffre du palier ${p.nom}`, maintenant);
}

export function recevoirDefi(j: Joueur, id: string, maintenant: number): Joueur {
  const d = DEFIS.find((x) => x.id === id);
  if (!d || !defiFini(j, d) || defiRecu(j, d)) throw new Error('Défi pas fini');
  return donner(j, d.recompense, `defi:${d.id}`, `Défi ${d.nom}`, maintenant);
}

/** Quelque chose à recevoir (pastille « ! » et bulle de Ganymède sur l'île). */
export function aRecevoirChemin(j: Joueur): boolean {
  return PALIERS.some((p) => (palierOuvert(j, p) && p.quetes.some((q) => peutRecevoirQuete(j, q))) || (palierFini(j, p) && !coffreRecu(j, p)))
    || DEFIS.some((d) => d.etapes.some((q) => peutRecevoirQuete(j, q)) || (defiFini(j, d) && !defiRecu(j, d)));
}

export const nbQuetes = () => TOUTES.length;
export const nbRecues = (j: Joueur) => TOUTES.filter((q) => recu(j, q.id)).length;
