/**
 * Runes du joueur : obtenir, équiper, retirer, monter, vendre, préréglages (maquette « Runes : » 1A 5C 6A 7B 8C).
 * ✓ SW : retirer une rune coûte du mana selon ses étoiles (gratuit pour les joueurs nouveaux ou de retour, choix 6A) ;
 * déplacer une rune d'un monstre à l'autre, ou la remplacer, c'est la retirer. Pur.
 */
import type { Joueur } from './joueur';
import { Rng } from './rng';
import { COUT_RETRAIT, coutMontee, creerRune, monter, prixVente, type ParamsRune, type Rune } from './runes';

const JOUR = 86_400_000;
/** Nouveau joueur : 30 jours ; de retour après 14 jours d'absence : 30 jours ⚠ (durées à vérifier dans SW). */
export const DUREE_NOUVEAU = 30 * JOUR, ABSENCE_RETOUR = 14 * JOUR, DUREE_RETOUR = 30 * JOUR;

export const runes = (j: Joueur): Rune[] => j.runes ?? [];
export const runesDe = (j: Joueur, uid: number): Rune[] => runes(j).filter((r) => r.porteur === uid).sort((a, b) => a.emplacement - b.emplacement);
const rune = (j: Joueur, uid: number) => { const r = runes(j).find((x) => x.uid === uid); if (!r) throw new Error(`Rune ${uid} introuvable`); return r; };
const remplacer = (j: Joueur, r: Rune): Joueur => ({ ...j, runes: runes(j).map((x) => (x.uid === r.uid ? r : x)) });

/** Note la visite : date de création, retour après une longue absence. */
export function visite(j: Joueur, maintenant: number): Joueur {
  const retour = j.derniereVisite !== undefined && maintenant - j.derniereVisite > ABSENCE_RETOUR ? maintenant + DUREE_RETOUR : j.retour;
  return { ...j, cree: j.cree ?? maintenant, derniereVisite: maintenant, ...(retour !== undefined ? { retour } : {}) };
}

export const retraitGratuit = (j: Joueur, maintenant: number) =>
  (j.cree !== undefined && maintenant - j.cree < DUREE_NOUVEAU) || (j.retour !== undefined && maintenant < j.retour);

export const coutRetrait = (j: Joueur, r: Rune, maintenant: number) => (r.porteur === undefined || retraitGratuit(j, maintenant) ? 0 : COUT_RETRAIT[r.etoiles]);

export function donnerRune(j: Joueur, p: ParamsRune, graine: number): { joueur: Joueur; rune: Rune } {
  const uid = j.prochainUidRune ?? 1;
  const r = creerRune(uid, p, new Rng(graine));
  return { joueur: { ...j, runes: [...runes(j), r], prochainUidRune: uid + 1 }, rune: r };
}

export function retirerRune(j: Joueur, uid: number, maintenant: number): Joueur {
  const r = rune(j, uid);
  if (r.porteur === undefined) return j;
  const c = coutRetrait(j, r, maintenant);
  if (j.kamas < c) throw new Error(`Il faut ${c} kamas pour retirer cette rune`);
  return remplacer({ ...j, kamas: j.kamas - c }, { ...r, porteur: undefined });
}

/** Coût pour équiper : retrait de la rune si elle est sur un autre monstre, et de celle qui occupe l'emplacement. */
export function coutEquiper(j: Joueur, uid: number, monstre: number, maintenant: number): number {
  const r = rune(j, uid);
  if (r.porteur === monstre) return 0;
  const occupe = runesDe(j, monstre).find((x) => x.emplacement === r.emplacement);
  return coutRetrait(j, r, maintenant) + (occupe ? coutRetrait(j, occupe, maintenant) : 0);
}

export function equiper(j: Joueur, uid: number, monstre: number, maintenant: number): Joueur {
  if (!j.monstres.some((m) => m.uid === monstre)) throw new Error(`Monstre ${monstre} introuvable`);
  const r = rune(j, uid);
  if (r.porteur === monstre) return j;
  const c = coutEquiper(j, uid, monstre, maintenant);
  if (j.kamas < c) throw new Error(`Il faut ${c} kamas`);
  let k: Joueur = { ...j, kamas: j.kamas - c };
  const occupe = runesDe(k, monstre).find((x) => x.emplacement === r.emplacement);
  if (occupe) k = remplacer(k, { ...occupe, porteur: undefined });
  return remplacer(k, { ...r, porteur: monstre });
}

/** Monte une rune (sans échec, prix fixe ✓ RELOADED) : palier par palier ou d'un coup jusqu'à +15. */
export function ameliorer(j: Joueur, uid: number, jusqua: number, graine: number) {
  const r = rune(j, uid);
  const cout = coutMontee(r, jusqua);
  if (jusqua <= r.niveau || r.niveau >= 15) throw new Error('Rune déjà à ce niveau');
  if (j.kamas < cout) throw new Error(`Il faut ${cout} kamas`);
  const m = monter(r, jusqua, new Rng(graine));
  return { joueur: remplacer({ ...j, kamas: j.kamas - cout }, m.rune), rune: m.rune, paliers: m.paliers, cout };
}

export function vendreRunes(j: Joueur, uids: number[]): { joueur: Joueur; kamas: number } {
  const ids = new Set(uids);
  const vendues = runes(j).filter((r) => ids.has(r.uid));
  if (vendues.some((r) => r.porteur !== undefined)) throw new Error('On ne vend pas une rune portée');
  const kamas = vendues.reduce((s, r) => s + prixVente(r), 0);
  return { joueur: { ...j, kamas: j.kamas + kamas, runes: runes(j).filter((r) => !ids.has(r.uid)) }, kamas };
}

/** Vente sélective (choix 7B) : runes non portées, jamais montées, jusqu'à `etoiles` étoiles et `grade` compris. */
export const selection = (j: Joueur, etoiles: number, grade: number) =>
  runes(j).filter((r) => r.porteur === undefined && r.niveau === 0 && r.etoiles <= etoiles && r.grade <= grade).map((r) => r.uid);

// ───────────── préréglages (choix 8C) ─────────────

export const PREREGLAGES_MAX = 3;
export const prereglages = (j: Joueur, monstre: number) => j.prereglages?.[monstre] ?? [];

export function enregistrerPrereglage(j: Joueur, monstre: number, index: number, nom: string): Joueur {
  if (index < 0 || index >= PREREGLAGES_MAX) throw new Error('Préréglage invalide');
  const l = [...prereglages(j, monstre)];
  l[index] = { nom, runes: runesDe(j, monstre).map((r) => r.uid) };
  return { ...j, prereglages: { ...(j.prereglages ?? {}), [monstre]: l } };
}

export function coutPrereglage(j: Joueur, monstre: number, index: number, maintenant: number): number {
  const p = prereglages(j, monstre)[index];
  if (!p) return 0;
  let cout = 0, k = j;
  for (const uid of p.runes) if (runes(k).some((r) => r.uid === uid)) { cout += coutEquiper(k, uid, monstre, maintenant); k = equiper({ ...k, kamas: Infinity }, uid, monstre, maintenant); }
  return cout;
}

/** Remet les runes d'un préréglage (celles qui existent encore), en payant les retraits nécessaires. */
export function appliquerPrereglage(j: Joueur, monstre: number, index: number, maintenant: number): Joueur {
  const p = prereglages(j, monstre)[index];
  if (!p) throw new Error('Préréglage vide');
  const c = coutPrereglage(j, monstre, index, maintenant);
  if (j.kamas < c) throw new Error(`Il faut ${c} kamas`);
  let k = j;
  for (const uid of p.runes) if (runes(k).some((r) => r.uid === uid)) k = equiper(k, uid, monstre, maintenant);
  return k;
}
