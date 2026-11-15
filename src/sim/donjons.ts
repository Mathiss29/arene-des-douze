/**
 * Donjons (maquette « Donjons : » 1C 2B 3C 4C 5C 6C 7A 8A, 15 nov. 2026), comme les donjons de Cairos de SW.
 * Trois donjons, chacun ouvert par une zone de l'histoire finie en Normal (3C) : Bouftous (Astrub), Dragon Cochon (Madrestam),
 * Cimetière (Bastion). 10 niveaux, chacun ouvert en finissant le précédent.
 * ✓ SW (Castel du Géant, lu dans le jeu) : boss 3★ niv. 12 au B1 jusqu'à 5★ niv. 65 au B10 ; énergie 5 → 8 ; 3 vagues, boss à la fin.
 * Butin (6C) : runes des sets du donjon (plus d'étoiles en montant, 6★ Rare à Légendaire en haut ✓), kamas, peu de pierres d'âme
 * et de pierres parfaites (choix de Mathis), symbole du donjon (pour fabriquer plus tard). Premier passage : une récompense (7A).
 * Taux et montants ⚠ (les nôtres). Ne dépend pas de stages.ts (stages.ts s'en sert pour les clés « donjon:… »).
 */
import DONJONS_JSON from '../data/donjons.json';
import ZONES_JSON from '../data/zones.json';
import STAGES_JSON from '../data/stages.json';
import type { Joueur } from './joueur';
import type { Etoiles } from './progression';
import { Rng } from './rng';
import type { EtoilesRune, Rune, SetRune } from './runes';

export interface Donjon {
  id: string;
  nom: string;
  /** Zone de l'histoire à finir en Normal pour l'ouvrir. */
  zone: string;
  arene: string;
  sets: SetRune[];
  symbole: string;
  /** Boss (id de monstre) ; absent tant que le donjon n'est pas prêt. */
  boss?: string;
  troupeau?: string[];
  texte: string;
}
export const DONJONS = DONJONS_JSON as Donjon[];
export const NB_NIVEAUX = 10;

/** Étoiles du boss et énergie ✓ (SW, Castel du Géant) ; niveaux du boss ⚠ : ceux de SW (12 → 65) adoucis au début pour notre équilibre (8 → 65). */
export const NIVEAUX: { etoiles: Etoiles; niveau: number; cout: number }[] = [
  { etoiles: 3, niveau: 8, cout: 5 }, { etoiles: 3, niveau: 12, cout: 5 }, { etoiles: 3, niveau: 16, cout: 6 }, { etoiles: 4, niveau: 22, cout: 6 },
  { etoiles: 4, niveau: 28, cout: 7 }, { etoiles: 4, niveau: 34, cout: 7 }, { etoiles: 4, niveau: 40, cout: 7 }, { etoiles: 5, niveau: 48, cout: 8 },
  { etoiles: 5, niveau: 56, cout: 8 }, { etoiles: 5, niveau: 65, cout: 8 },
];
/** Étoiles des runes par niveau ⚠ ; du niveau 8 au 10, grade Rare à Légendaire ✓ (SW : « Rune 6★ Rare~Légendaire »). */
export const RUNES_NIVEAU: [number, number][] = [[1, 2], [1, 3], [2, 3], [2, 4], [3, 4], [3, 5], [4, 5], [5, 6], [5, 6], [6, 6]];
/** PV du boss multipliés ⚠ (les boss de Cairos tiennent longtemps). */
export const PV_BOSS = 1.5;
/** Chances ⚠ : rune, pierre d'âme, pierre parfaite (à partir du niveau 6), symbole (à partir du niveau 3). Pierres rares (choix de Mathis). */
export const CHANCES = { rune: 75, pierreAme: 8, parfaite: 1, symbole: 25 };

export const cleDonjon = (id: string, n: number) => `donjon:${id}-${n}`;
export function lireCle(cle: string): { donjon: Donjon; n: number } | null {
  const m = /^donjon:([a-z_]+)-(\d+)$/.exec(cle);
  const d = m && DONJONS.find((x) => x.id === m[1]);
  const n = m ? Number(m[2]) : 0;
  return d && n >= 1 && n <= NB_NIVEAUX ? { donjon: d, n } : null;
}

const ZONES = ZONES_JSON as { id: string; nom: string; stages: string[] }[];
const STAGES = STAGES_JSON as { id: string }[];
export const nomZone = (id: string) => ZONES.find((z) => z.id === id)?.nom ?? id;

/** Ouvert quand sa zone est finie en Normal et que son boss existe (3C). */
export function donjonOuvert(j: Joueur, d: Donjon): boolean {
  const z = ZONES.find((x) => x.id === d.zone);
  return !!d.boss && !!z && z.stages.length > 0 && z.stages.every((s) => STAGES.some((x) => x.id === s) && j.stagesFinis.includes(s));
}
export const niveauFini = (j: Joueur, d: Donjon, n: number) => j.stagesFinis.includes(cleDonjon(d.id, n));
export const niveauOuvert = (j: Joueur, d: Donjon, n: number) => donjonOuvert(j, d) && (n === 1 || niveauFini(j, d, n - 1));
export const niveauxFinis = (j: Joueur, d: Donjon) => Array.from({ length: NB_NIVEAUX }, (_, i) => i + 1).filter((n) => niveauFini(j, d, n)).length;

export interface EnnemiDonjon { id: string; etoiles: Etoiles; niveau: number; pvx?: number }

/** Les 3 vagues d'un niveau : le troupeau (une ou deux étoiles de moins), puis le boss seul, très gros (4C). */
export function vaguesDonjon(d: Donjon, n: number): EnnemiDonjon[][] {
  const b = NIVEAUX[n - 1], t = d.troupeau ?? [];
  const e1 = Math.max(1, b.etoiles - 2) as Etoiles, e2 = Math.max(1, b.etoiles - 1) as Etoiles;
  const pris = (k: number, l: number) => Array.from({ length: l }, (_, i) => t[(n + k + i) % t.length]);
  return [
    pris(0, 3).map((id) => ({ id, etoiles: e1, niveau: Math.max(1, b.niveau - 3) })),
    pris(3, n <= 3 ? 3 : 4).map((id) => ({ id, etoiles: n <= 3 ? e1 : e2, niveau: Math.max(1, b.niveau - 2) })),
    [{ id: d.boss!, etoiles: b.etoiles, niveau: b.niveau, pvx: n <= 3 ? 1 : PV_BOSS }],
  ];
}

export const recompensesDonjon = (n: number) => ({ xp: 500 + 220 * n, kamas: 400 + 150 * n, pierreChance: 0 });

export interface ButinDonjon {
  rune?: { etoiles: EtoilesRune; set: SetRune; grade?: Rune['grade']; graine: number };
  pierresAme: number;
  parfaites: number;
  symbole?: string;
  /** Récompense du premier passage (7A) : une belle rune (niveaux 1 à 5) ou une pierre parfaite (6 à 10). */
  premiere?: { rune?: { etoiles: EtoilesRune; set: SetRune; grade: Rune['grade']; graine: number }; parfaite?: number };
}

export function tirerButinDonjon(j: Joueur, d: Donjon, n: number, rng: Rng): ButinDonjon {
  const [min, max] = RUNES_NIVEAU[n - 1];
  const set = () => d.sets[Math.floor(rng.suivant() * d.sets.length)];
  const haut = n >= 8;
  const b: ButinDonjon = { pierresAme: 0, parfaites: 0 };
  if (rng.chance(CHANCES.rune)) {
    const etoiles = (min + Math.floor(rng.suivant() * (max - min + 1))) as EtoilesRune;
    b.rune = { etoiles, set: set(), graine: Math.floor(rng.suivant() * 2 ** 31), ...(haut ? { grade: (2 + Math.floor(rng.suivant() * 3)) as Rune['grade'] } : {}) };
  }
  if (rng.chance(CHANCES.pierreAme)) b.pierresAme = 1;
  if (n >= 6 && rng.chance(CHANCES.parfaite)) b.parfaites = 1;
  if (n >= 3 && rng.chance(CHANCES.symbole)) b.symbole = d.symbole;
  if (!niveauFini(j, d, n)) {
    b.premiere = n <= 5
      ? { rune: { etoiles: Math.min(6, max + 1) as EtoilesRune, set: set(), grade: 3, graine: Math.floor(rng.suivant() * 2 ** 31) } }
      : { parfaite: 1 };
  }
  return b;
}
