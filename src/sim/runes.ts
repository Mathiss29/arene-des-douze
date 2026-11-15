/**
 * Runes (maquette « Runes : » 1A 2B+C 3C 4C 5C 6A 7B 8C 9A, 15 nov. 2026), fidèles à SW.
 * ✓ Wiki SW (Runes) : 6 emplacements (1 ATQ fixe, 3 DEF fixe, 5 PV fixe ; 2, 4, 6 variables, VIT seulement en 2,
 *   taux et dégâts critiques seulement en 4, résistance et précision seulement en 6), 1 à 6★, grades Commune → Légendaire
 *   (0 à 4 sous-stats), +0 à +15, sous-stat ajoutée ou montée à +3, +6, +9, +12 ; valeurs des stats principales et sous-stats,
 *   effets des sets, coût du retrait par étoile.
 * ✓ RELOADED (2023) : plus d'échec, montée instantanée à prix fixe ; le grade d'origine reste affiché.
 * ⚠ Coûts de montée : ceux d'une tentative avant RELOADED (wiki) ; prix de vente : les nôtres.
 * Sets : les 12 dieux du Monde des Douze (GDD) ; Enutrof = Énergie (PV +15 %), choix provisoire.
 * Ne dépend que des types : joueur.ts peut l'importer.
 */
import { Rng } from './rng';
import type { MonstreCombat, Stats } from './types';

export type StatRune = 'pv_fixe' | 'pv' | 'atq_fixe' | 'atq' | 'def_fixe' | 'def' | 'vit' | 'tc' | 'dc' | 'res' | 'pre';
export type SetRune = 'ecaflip' | 'xelor' | 'sadida' | 'iop' | 'sram' | 'eniripsa' | 'sacrieur' | 'feca' | 'cra' | 'pandawa' | 'osamodas' | 'enutrof';
export type EtoilesRune = 1 | 2 | 3 | 4 | 5 | 6;

export interface SousStat { stat: StatRune; valeur: number; montees: number }

export interface Rune {
  uid: number;
  set: SetRune;
  emplacement: 1 | 2 | 3 | 4 | 5 | 6;
  etoiles: EtoilesRune;
  /** Grade d'origine : nombre de sous-stats à l'obtention (0 Commune … 4 Légendaire). */
  grade: 0 | 1 | 2 | 3 | 4;
  niveau: number;
  principale: StatRune;
  sous: SousStat[];
  /** Monstre qui la porte (uid). */
  porteur?: number;
}

export const NOM_STAT_RUNE: Record<StatRune, string> = {
  pv_fixe: 'PV', pv: 'PV %', atq_fixe: 'ATQ', atq: 'ATQ %', def_fixe: 'DEF', def: 'DEF %',
  vit: 'VIT', tc: 'Taux critique %', dc: 'Dégâts critiques %', res: 'Résistance %', pre: 'Précision %',
};
export const GRADES = ['Commune', 'Magique', 'Rare', 'Héroïque', 'Légendaire'] as const;

export interface InfoSet { nom: string; dieu: string; pieces: 2 | 4; effet: string }
export const SETS: Record<SetRune, InfoSet> = {
  ecaflip: { nom: 'Violent', dieu: 'Ecaflip', pieces: 4, effet: '22 % de chances de rejouer (moins à chaque tour gagné de suite)' },
  xelor: { nom: 'Rapide', dieu: 'Xélor', pieces: 4, effet: 'VIT +25 %' },
  sadida: { nom: 'Désespoir', dieu: 'Sadida', pieces: 4, effet: '25 % de chances d\'étourdir au premier coup' },
  iop: { nom: 'Rage', dieu: 'Iop', pieces: 4, effet: 'Dégâts critiques +40 %' },
  sram: { nom: 'Fatal', dieu: 'Sram', pieces: 4, effet: 'ATQ +35 %' },
  eniripsa: { nom: 'Vampire', dieu: 'Eniripsa', pieces: 4, effet: 'Rend 35 % des dégâts infligés en PV' },
  sacrieur: { nom: 'Vengeance', dieu: 'Sacrieur', pieces: 2, effet: '15 % de chances de contre-attaquer' },
  feca: { nom: 'Bouclier', dieu: 'Féca', pieces: 2, effet: 'Bouclier de 15 % des PV aux alliés pendant 3 tours' },
  cra: { nom: 'Concentration', dieu: 'Crâ', pieces: 2, effet: 'Précision +20 %' },
  pandawa: { nom: 'Endurance', dieu: 'Pandawa', pieces: 2, effet: 'Résistance +20 %' },
  osamodas: { nom: 'Combat', dieu: 'Osamodas', pieces: 2, effet: 'ATQ des alliés +8 %' },
  enutrof: { nom: 'Énergie', dieu: 'Enutrof', pieces: 2, effet: 'PV +15 %' },
};
export const LISTE_SETS = Object.keys(SETS) as SetRune[];

/** ✓ Stat principale : [départ, gain par niveau, valeur à +15], de 1 à 6★. */
const PRINCIPALE: Record<StatRune, [number, number, number][]> = {
  pv_fixe: [[40, 45, 804], [70, 60, 1092], [100, 75, 1380], [160, 90, 1704], [270, 105, 2088], [360, 120, 2448]],
  pv: [[1, 1, 18], [2, 1, 19], [4, 2, 38], [5, 2.15, 43], [8, 2.45, 51], [11, 3, 63]],
  atq_fixe: [[3, 3, 54], [5, 4, 73], [7, 5, 92], [10, 6, 112], [15, 7, 135], [22, 8, 160]],
  atq: [[1, 1, 18], [2, 1, 19], [4, 2, 38], [5, 2.15, 43], [8, 2.45, 51], [11, 3, 63]],
  def_fixe: [[3, 3, 54], [5, 4, 73], [7, 5, 92], [10, 6, 112], [15, 7, 135], [22, 8, 160]],
  def: [[1, 1, 18], [2, 1, 19], [4, 2, 38], [5, 2.15, 43], [8, 2.45, 51], [11, 3, 63]],
  vit: [[1, 1, 18], [2, 1, 19], [3, 1.33, 25], [4, 1.5, 30], [5, 2, 39], [7, 2, 42]],
  tc: [[1, 1, 18], [2, 1, 19], [3, 2, 37], [4, 2.15, 42], [5, 2.45, 47], [7, 3, 58]],
  dc: [[2, 1, 19], [3, 2, 37], [4, 2.25, 43], [6, 3, 57], [8, 3.33, 65], [11, 4, 80]],
  res: [[1, 1, 18], [2, 1, 19], [4, 2, 38], [6, 2.15, 44], [9, 2.45, 51], [12, 3, 64]],
  pre: [[1, 1, 18], [2, 1, 19], [4, 2, 38], [6, 2.15, 44], [9, 2.45, 51], [12, 3, 64]],
};

/** ✓ Sous-stats : valeur d'un tirage (min, max), de 1 à 6★. */
const SOUS: Record<StatRune, [number, number][]> = {
  pv_fixe: [[15, 60], [30, 105], [45, 165], [60, 225], [90, 300], [135, 375]],
  pv: [[1, 2], [1, 3], [2, 5], [3, 6], [4, 7], [5, 8]],
  atq_fixe: [[1, 4], [2, 5], [3, 8], [4, 10], [8, 15], [10, 20]],
  atq: [[1, 2], [1, 3], [2, 5], [3, 6], [4, 7], [5, 8]],
  def_fixe: [[1, 4], [2, 5], [3, 8], [4, 10], [8, 15], [10, 20]],
  def: [[1, 2], [1, 3], [2, 5], [3, 6], [4, 7], [5, 8]],
  vit: [[1, 1], [1, 2], [1, 3], [2, 4], [3, 5], [4, 6]],
  tc: [[1, 2], [1, 3], [1, 3], [2, 4], [3, 5], [4, 6]],
  dc: [[1, 2], [1, 3], [2, 4], [2, 5], [3, 5], [4, 7]],
  res: [[1, 2], [1, 3], [2, 4], [2, 5], [3, 7], [4, 8]],
  pre: [[1, 2], [1, 3], [2, 4], [2, 5], [3, 7], [4, 8]],
};

/** ✓ Stats principales possibles par emplacement. */
export const PRINCIPALES: Record<number, StatRune[]> = {
  1: ['atq_fixe'],
  2: ['atq_fixe', 'atq', 'def_fixe', 'def', 'pv_fixe', 'pv', 'vit'],
  3: ['def_fixe'],
  4: ['atq_fixe', 'atq', 'def_fixe', 'def', 'pv_fixe', 'pv', 'tc', 'dc'],
  5: ['pv_fixe'],
  6: ['atq_fixe', 'atq', 'def_fixe', 'def', 'pv_fixe', 'pv', 'res', 'pre'],
};
const TOUTES: StatRune[] = ['pv_fixe', 'pv', 'atq_fixe', 'atq', 'def_fixe', 'def', 'vit', 'tc', 'dc', 'res', 'pre'];

/** ✓ Coût du retrait (mana dans SW, kamas ici), selon les étoiles. */
export const COUT_RETRAIT: Record<EtoilesRune, number> = { 1: 1_000, 2: 2_500, 3: 5_000, 4: 10_000, 5: 25_000, 6: 50_000 };
/** Coût de chaque niveau (+1 … +15), selon les étoiles ⚠ (wiki : coût d'une tentative avant RELOADED). */
const COUT_NIVEAU: Record<EtoilesRune, number[]> = {
  1: [100, 175, 250, 400, 550, 775, 1000, 1300, 1600, 2000, 2400, 2925, 3450, 4100, 4750],
  2: [150, 300, 450, 700, 950, 1275, 1600, 2025, 2450, 3000, 3550, 4225, 4900, 5700, 6500],
  3: [225, 475, 725, 1075, 1425, 1875, 2325, 2850, 3375, 4075, 4775, 5600, 6425, 7375, 8325],
  4: [330, 680, 1030, 1480, 1930, 2455, 2980, 3680, 4380, 5205, 6030, 6980, 7930, 9130, 10330],
  5: [500, 950, 1400, 1925, 2450, 3175, 3900, 4750, 5600, 6600, 7600, 8850, 10100, 11600, 13100],
  6: [750, 1475, 2200, 3050, 3900, 4875, 5850, 6975, 8100, 9350, 10600, 11975, 13350, 14850, 16350],
};
/** Prix de vente ⚠ (le nôtre) : par étoile, +10 % par grade et +5 % par niveau. */
const PRIX_VENTE: Record<EtoilesRune, number> = { 1: 100, 2: 300, 3: 800, 4: 2_000, 5: 5_000, 6: 10_000 };

// ───────────── valeurs ─────────────

export function valeurPrincipale(r: Pick<Rune, 'principale' | 'etoiles' | 'niveau'>): number {
  const [d, g, max] = PRINCIPALE[r.principale][r.etoiles - 1];
  return r.niveau >= 15 ? max : Math.floor(d + g * r.niveau);
}

export const grade = (r: Rune) => GRADES[r.grade];
export const nomRune = (r: Rune) => `Rune de ${SETS[r.set].dieu} (${r.emplacement})`;

export const coutMontee = (r: Rune, jusqua: number) => COUT_NIVEAU[r.etoiles].slice(r.niveau, Math.min(15, jusqua)).reduce((s, c) => s + c, 0);
export const prixVente = (r: Rune) => Math.round(PRIX_VENTE[r.etoiles] * (1 + 0.1 * r.grade + 0.05 * r.niveau));

// ───────────── création ─────────────

function tirer<T>(rng: Rng, l: readonly T[]): T { return l[Math.floor(rng.suivant() * l.length)]; }
const tirage = (rng: Rng, s: StatRune, e: EtoilesRune) => { const [a, b] = SOUS[s][e - 1]; return a + Math.floor(rng.suivant() * (b - a + 1)); };

function nouvelleSous(rng: Rng, r: Pick<Rune, 'principale' | 'sous' | 'etoiles'>): SousStat {
  const libres = TOUTES.filter((s) => s !== r.principale && !r.sous.some((x) => x.stat === s));
  const stat = tirer(rng, libres);
  return { stat, valeur: tirage(rng, stat, r.etoiles), montees: 0 };
}

export interface ParamsRune { etoiles: EtoilesRune; set?: SetRune; emplacement?: Rune['emplacement']; grade?: Rune['grade'] }

/** Chances de grade à l'obtention ⚠ (les nôtres) : Commune 30 %, Magique 30 %, Rare 22 %, Héroïque 13 %, Légendaire 5 %. */
const CHANCES_GRADE = [30, 30, 22, 13, 5];

export function creerRune(uid: number, p: ParamsRune, rng: Rng): Rune {
  const emplacement = p.emplacement ?? ((1 + Math.floor(rng.suivant() * 6)) as Rune['emplacement']);
  const set = p.set ?? tirer(rng, LISTE_SETS);
  let g = p.grade;
  if (g === undefined) { let x = rng.suivant() * 100; g = 0; while (g < 4 && x >= CHANCES_GRADE[g]) { x -= CHANCES_GRADE[g]; g++; } }
  const r: Rune = { uid, set, emplacement, etoiles: p.etoiles, grade: g as Rune['grade'], niveau: 0, principale: tirer(rng, PRINCIPALES[emplacement]), sous: [] };
  for (let i = 0; i < r.grade; i++) r.sous.push(nouvelleSous(rng, r));
  return r;
}

/** Monte une rune jusqu'au niveau `jusqua` (sans échec) : à +3, +6, +9 et +12, une sous-stat apparaît ou monte. */
export function monter(r: Rune, jusqua: number, rng: Rng): { rune: Rune; paliers: { niveau: number; sous: number; nouvelle: boolean }[] } {
  const rune: Rune = { ...r, sous: r.sous.map((s) => ({ ...s })) };
  const paliers: { niveau: number; sous: number; nouvelle: boolean }[] = [];
  const fin = Math.min(15, jusqua);
  while (rune.niveau < fin) {
    rune.niveau++;
    if (rune.niveau % 3 === 0 && rune.niveau <= 12) {
      if (rune.sous.length < 4) { rune.sous.push(nouvelleSous(rng, rune)); paliers.push({ niveau: rune.niveau, sous: rune.sous.length - 1, nouvelle: true }); }
      else { const i = Math.floor(rng.suivant() * 4); rune.sous[i].valeur += tirage(rng, rune.sous[i].stat, rune.etoiles); rune.sous[i].montees++; paliers.push({ niveau: rune.niveau, sous: i, nouvelle: false }); }
    }
  }
  return { rune, paliers };
}

// ───────────── sur un monstre ─────────────

/** Sets complets portés : nombre de fois chaque set (3 sets de 2 au plus, 1 set de 4 + 1 de 2). */
export function setsActifs(runes: Rune[]): Partial<Record<SetRune, number>> {
  const n: Partial<Record<SetRune, number>> = {};
  for (const r of runes) n[r.set] = (n[r.set] ?? 0) + 1;
  const actifs: Partial<Record<SetRune, number>> = {};
  for (const [s, k] of Object.entries(n) as [SetRune, number][]) { const f = Math.floor(k / SETS[s].pieces); if (f) actifs[s] = f; }
  return actifs;
}

/** Bonus des runes et des sets de stats, ajoutés aux stats de base (les pourcentages portent sur la base, comme SW ✓). */
export function bonusRunes(base: Stats, runes: Rune[]): Stats {
  const b: Stats = { pv: 0, atq: 0, def: 0, vit: 0, tc: 0, dc: 0, pre: 0, res: 0 };
  const ajouter = (s: StatRune, v: number) => {
    switch (s) {
      case 'pv_fixe': b.pv += v; break; case 'pv': b.pv += (base.pv * v) / 100; break;
      case 'atq_fixe': b.atq += v; break; case 'atq': b.atq += (base.atq * v) / 100; break;
      case 'def_fixe': b.def += v; break; case 'def': b.def += (base.def * v) / 100; break;
      default: b[s] += v;
    }
  };
  for (const r of runes) { ajouter(r.principale, valeurPrincipale(r)); for (const s of r.sous) ajouter(s.stat, s.valeur); }
  const sets = setsActifs(runes);
  b.vit += ((sets.xelor ?? 0) * base.vit * 25) / 100;
  b.atq += ((sets.sram ?? 0) * base.atq * 35) / 100;
  b.dc += (sets.iop ?? 0) * 40;
  b.pre += (sets.cra ?? 0) * 20;
  b.res += (sets.pandawa ?? 0) * 20;
  b.pv += ((sets.enutrof ?? 0) * base.pv * 15) / 100;
  return { pv: Math.round(b.pv), atq: Math.round(b.atq), def: Math.round(b.def), vit: Math.round(b.vit), tc: b.tc, dc: b.dc, pre: b.pre, res: b.res };
}

/** Monstre de combat avec ses runes : stats, base gardée pour les pourcentages, sets pour les effets en combat. */
export function avecRunes(m: MonstreCombat, runes: Rune[]): MonstreCombat {
  if (!runes.length) return m;
  const base = m.base ?? m.stats, b = bonusRunes(base, runes);
  const stats = { ...m.stats };
  for (const k of Object.keys(b) as (keyof Stats)[]) stats[k] += b[k];
  return { ...m, base, stats, sets: setsActifs(runes) };
}

/**
 * Runes invisibles des ennemis (choix 9A) ⚠ : rien en Normal (équilibré sans), puis un bonus qui grossit avec la difficulté
 * et le numéro du stage, comme si les monstres portaient des runes.
 */
export function runesEnnemies(m: MonstreCombat, dif: number, numero: number): MonstreCombat {
  if (dif <= 0) return m;
  const k = dif * 0.12 + numero * 0.01 * dif;
  const base = m.base ?? m.stats;
  return {
    ...m, base,
    stats: { ...m.stats, pv: Math.round(m.stats.pv + base.pv * k), atq: Math.round(m.stats.atq + base.atq * k), def: Math.round(m.stats.def + base.def * k),
      vit: Math.round(m.stats.vit + 4 * dif), tc: m.stats.tc + 5 * dif, res: m.stats.res + 5 * dif, pre: m.stats.pre + 5 * dif },
  };
}
