/**
 * Missions du jour (maquette « Missions : » 1A 2B 3A 4B 5A 6B 7A 8C 9A, 15 nov. 2026).
 * ✓ SW 9.3.9 (vidéo de Mathis) : chaque mission donne +15 ou +20 points, 100 points sur 180 suffisent,
 * coffres à 20 / 40 / 60 / 80 / 100 points, 2 morceaux de transcendance au dernier ; missions toujours les mêmes.
 * Remise à zéro à heure fixe pour tout le monde : 6 h, heure de Paris (choix 4B). Contenus des coffres : les nôtres ⚠.
 * Pur : le temps est passé en argument (ms).
 */
import type { Joueur } from './joueur';
import { changerEnergie } from './energie';
import { ajouterPierres } from './invocation';

export type IdMission = 'connexion' | 'invoquer' | 'ameliorer' | 'mine' | 'histoire' | 'energie1' | 'energie2' | 'donjon' | 'rune' | 'arene';

export interface Mission {
  id: IdMission;
  nom: string;
  objectif: number;
  points: number;
  /** Contenu pas encore dans le jeu : mission grisée (choix 6B). */
  bientot?: string;
  /** Écran où aller (« Y aller »). */
  ecran?: 'invocation' | 'cercle' | 'ile' | 'zaap';
}

/** Comme SW : 4 missions à +15, 6 à +20, 180 points en tout. */
export const MISSIONS: Mission[] = [
  { id: 'connexion', nom: 'Début de la journée', objectif: 1, points: 15, ecran: 'ile' },
  { id: 'invoquer', nom: 'Invoquer 3 monstres', objectif: 3, points: 15, ecran: 'invocation' },
  { id: 'ameliorer', nom: 'Améliorer ou faire évoluer un monstre', objectif: 1, points: 15, ecran: 'cercle' },
  { id: 'mine', nom: 'Récolter la mine de kamas', objectif: 1, points: 15, ecran: 'ile' },
  { id: 'histoire', nom: 'Gagner 10 combats d\'histoire', objectif: 10, points: 20, ecran: 'zaap' },
  { id: 'energie1', nom: 'Dépenser 60 points d\'énergie', objectif: 60, points: 20, ecran: 'zaap' },
  { id: 'energie2', nom: 'Dépenser 120 points d\'énergie', objectif: 120, points: 20, ecran: 'zaap' },
  { id: 'donjon', nom: 'Finir 10 fois le Donjon des Bouftous', objectif: 10, points: 20, bientot: 'Le Donjon des Bouftous arrive bientôt.' },
  { id: 'rune', nom: 'Améliorer une rune', objectif: 1, points: 20, bientot: 'Les runes arrivent bientôt.' },
  { id: 'arene', nom: 'Livrer 5 combats au Kolizéum', objectif: 5, points: 20, bientot: 'Le Kolizéum arrive plus tard.' },
];

export interface Coffre { points: number; kamas?: number; pierresAme?: number; parfaites?: number; energie?: number; fragments?: number }

/** Coffres (choix 5A) ⚠. Ogrines au dernier coffre quand elles existeront (SW : 30 cristaux). */
export const COFFRES: Coffre[] = [
  { points: 20, kamas: 5_000, pierresAme: 3 },
  { points: 40, kamas: 5_000, pierresAme: 5 },
  { points: 60, kamas: 10_000 },
  { points: 80, energie: 20, parfaites: 1 },
  { points: 100, kamas: 10_000, fragments: 2 },
];

export const HEURE_REMISE = 6;

export interface EtatMissions { jour: string; compte: Record<string, number>; recues: string[]; coffres: number[] }

const FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Jour des missions : la date à Paris, qui change à 6 h (heure de Paris, été comme hiver). */
export const jourMissions = (maintenant: number) => FORMAT.format(new Date(maintenant - HEURE_REMISE * 3_600_000));

/** Temps (ms) avant la prochaine remise à zéro. */
export function avantRemise(maintenant: number): number {
  const j = jourMissions(maintenant);
  let a = maintenant, b = maintenant + 26 * 3_600_000;
  while (b - a > 1_000) { const m = Math.floor((a + b) / 2); if (jourMissions(m) === j) a = m; else b = m; }
  return b - maintenant;
}

/** État du jour (vide si le jour a changé). */
export function etatMissions(j: Joueur, maintenant: number): EtatMissions {
  const jour = jourMissions(maintenant);
  return j.missions?.jour === jour ? j.missions : { jour, compte: {}, recues: [], coffres: [] };
}

const mission = (id: string) => MISSIONS.find((m) => m.id === id) ?? { objectif: Infinity, points: 0 };
export const compte = (e: EtatMissions, id: IdMission) => Math.min(mission(id).objectif, e.compte[id] ?? 0);
export const finie = (e: EtatMissions, id: IdMission) => compte(e, id) >= mission(id).objectif;
export const points = (e: EtatMissions) => e.recues.reduce((s, id) => s + mission(id).points, 0);

/** Fait avancer une mission (sans effet si elle est déjà finie). */
export function noterMission(j: Joueur, id: IdMission, n: number, maintenant: number): Joueur {
  const e = etatMissions(j, maintenant);
  if (n <= 0 || finie(e, id)) return e === j.missions ? j : { ...j, missions: e };
  return { ...j, missions: { ...e, compte: { ...e.compte, [id]: Math.min(mission(id).objectif, (e.compte[id] ?? 0) + n) } } };
}

export const peutRecevoir = (e: EtatMissions, id: IdMission) => finie(e, id) && !e.recues.includes(id);

/** Reçoit les points d'une mission finie. */
export function recevoirMission(j: Joueur, id: IdMission, maintenant: number): Joueur {
  const e = etatMissions(j, maintenant);
  if (!peutRecevoir(e, id)) throw new Error(`Mission ${id} pas finie ou déjà reçue`);
  return { ...j, missions: { ...e, recues: [...e.recues, id] } };
}

/** « Tout recevoir » (choix 8C) : toutes les missions finies. */
export function recevoirTout(j: Joueur, maintenant: number): Joueur {
  const e = etatMissions(j, maintenant);
  const ids = MISSIONS.filter((m) => peutRecevoir(e, m.id)).map((m) => m.id);
  return { ...j, missions: { ...e, recues: [...e.recues, ...ids] } };
}

export const coffreOuvrable = (e: EtatMissions, i: number) => points(e) >= COFFRES[i].points && !e.coffres.includes(i);

/** Ouvre un coffre (choix 7A : on le touche quand il brille). */
export function ouvrirCoffre(j: Joueur, i: number, maintenant: number): Joueur {
  const e = etatMissions(j, maintenant);
  if (!COFFRES[i] || !coffreOuvrable(e, i)) throw new Error(`Coffre ${i} fermé`);
  const c = COFFRES[i];
  let r: Joueur = { ...j, kamas: j.kamas + (c.kamas ?? 0), pierresAme: j.pierresAme + (c.pierresAme ?? 0), fragments: j.fragments + (c.fragments ?? 0), missions: { ...e, coffres: [...e.coffres, i] } };
  if (c.parfaites) r = ajouterPierres(r, 'parfaite', c.parfaites);
  if (c.energie) r = changerEnergie(r, c.energie, maintenant);
  return r;
}

/** Pastille « ! » sur le bouton Missions (choix 9A). */
export function aRecevoir(j: Joueur, maintenant: number): boolean {
  const e = etatMissions(j, maintenant);
  return MISSIONS.some((m) => peutRecevoir(e, m.id)) || COFFRES.some((_, i) => coffreOuvrable(e, i));
}
