import { sortsDe } from './competences';
import STAGES from '../data/stages.json';
import ZONES_JSON from '../data/zones.json';
import { monstreCombat } from './fiches';
import { ajouterMonstre, donnerXp, type Joueur } from './joueur';
import { changerEnergie, ENERGIE } from './energie';
import { envoyer } from './reception';
import { placesLibres } from './invocation';
import { avecRunes, runesEnnemies, setsActifs, SETS, type EtoilesRune, type SetRune } from './runes';
import { donnerRune } from './inventaire';
import { ajouterPierres } from './invocation';
import { DONJONS, lireCle, NIVEAUX, recompensesDonjon, tirerButinDonjon, vaguesDonjon, type ButinDonjon } from './donjons';
import { NIVEAU_MAX, type Etoiles } from './progression';
import { Rng } from './rng';
import type { MonstreCombat } from './types';

/**
 * Histoire (maquette « Zaap : » 1A…8A) : des zones de 7 stages, le boss au 7ᵉ ✓, en Normal, Difficile et Enfer ✓.
 * La difficulté suivante s'ouvre quand la zone est finie, la zone suivante quand la précédente est finie en Normal ✓.
 * Un stage joué s'écrit « astrub-3 » (Normal), « astrub-3@1 » (Difficile) ou « astrub-3@2 » (Enfer) : c'est sa clé
 * dans les stages finis et les équipes retenues.
 */
export const DIFFICULTES = ['Normal', 'Difficile', 'Enfer'] as const;

interface StageBase {
  id: string;
  nom: string;
  /** Décor (fichier lourd sur le R2). */
  arene: string;
  /** 3 vagues d'ennemis ✓ (SW), la dernière avec le boss au stage 7. */
  vagues: Ennemi[][];
  recompenses: { xp: number; kamas: number; pierreChance: number };
  /** Place du boss dans la dernière vague (stage 7). */
  boss?: number;
}
export interface Ennemi { id: string; etoiles: Etoiles; niveau: number; /** PV multipliés (boss de donjon). */ pvx?: number }
export interface Stage extends StageBase {
  /** Tous les ennemis, vague après vague. */
  ennemis: Ennemi[];
  /** Clé du stage joué (id + difficulté). */
  id: string;
  base: string;
  zone: string;
  /** 1 à 7. */
  numero: number;
  dif: number;
  cout: number;
  /** Donjon (id) : niveau `numero` de ce donjon. */
  donjon?: string;
}
export interface Zone {
  id: string;
  nom: string;
  image: string;
  /** Set de runes de la zone ⚠ (les runes ne sont pas encore là). */
  runes: string;
  stages: string[];
  /** Récompense de la première fois où la zone est finie en Normal ✓ (SW). */
  recompense?: { id: string; etoiles: Etoiles };
  /** Ce que dit Ganymède en entrant. */
  texte?: string;
}

const BASES = STAGES as StageBase[];
export const ZONES = ZONES_JSON as Zone[];
/** Les stages de base (Normal), dans l'ordre de l'histoire. */
export const LISTE_STAGES = BASES;

export const cleStage = (id: string, dif = 0) => (dif ? `${id}@${dif}` : id);

/** Stage joué, d'après sa clé : ennemis et récompenses selon la difficulté (montants ⚠, les nôtres). */
export function stage(cle: string): Stage {
  const dj = lireCle(cle);
  if (dj) {
    const { donjon: d, n } = dj, vagues = vaguesDonjon(d, n);
    return {
      id: cle, base: cle, nom: `${d.nom} · niveau ${n}`, arene: d.arene, vagues, ennemis: vagues.flat(), boss: 0,
      recompenses: recompensesDonjon(n), zone: d.zone, numero: n, dif: 0, cout: NIVEAUX[n - 1].cout, donjon: d.id,
    };
  }
  const [id, d] = cle.split('@');
  const dif = d ? Number(d) : 0;
  const b = BASES.find((x) => x.id === id);
  const z = ZONES.find((x) => x.stages.includes(id));
  if (!b || !z || !(dif >= 0 && dif <= 2)) throw new Error(`Stage inconnu : ${cle}`);
  const vagues = b.vagues.map((v) => v.map((e) => {
    const etoiles = Math.min(6, e.etoiles + dif) as Etoiles;
    return { id: e.id, etoiles, niveau: Math.min(NIVEAU_MAX[etoiles], e.niveau + 10 * dif) };
  }));
  const r = b.recompenses;
  return {
    ...b, id: cle, base: id, zone: z.id, numero: z.stages.indexOf(id) + 1, dif, cout: ENERGIE.cout[dif], vagues, ennemis: vagues.flat(),
    recompenses: { xp: r.xp * (1 + dif), kamas: r.kamas * (1 + dif), pierreChance: r.pierreChance + 5 * dif },
  };
}

export const zone = (id: string) => ZONES.find((z) => z.id === id)!;
const fini = (j: Joueur, id: string, dif: number) => j.stagesFinis.includes(cleStage(id, dif));
export const zoneFinie = (j: Joueur, z: Zone, dif: number) => z.stages.length > 0 && z.stages.every((s) => fini(j, s, dif));
export function zoneOuverte(j: Joueur, z: Zone): boolean {
  const i = ZONES.indexOf(z);
  return z.stages.length > 0 && (i === 0 || zoneFinie(j, ZONES[i - 1], 0));
}
export const difficulteOuverte = (j: Joueur, z: Zone, dif: number) => zoneOuverte(j, z) && (dif === 0 || zoneFinie(j, z, dif - 1));
export const stageOuvert = (j: Joueur, z: Zone, n: number, dif: number) => difficulteOuverte(j, z, dif) && (n === 0 || fini(j, z.stages[n - 1], dif));
export const stagesFinis = (j: Joueur, z: Zone, dif: number) => z.stages.filter((s) => fini(j, s, dif)).length;

/** Le prochain stage pas encore gagné (bouton « Continuer »), ou null si tout est fini. */
export function prochainStage(j: Joueur): string | null {
  for (let dif = 0; dif < 3; dif++) for (const z of ZONES) {
    if (!difficulteOuverte(j, z, dif)) continue;
    const s = z.stages.find((id) => !fini(j, id, dif));
    if (s) return cleStage(s, dif);
  }
  return null;
}
/** Brèche du jour (comme la Faille dimensionnelle de SW ⚠) : quand toutes les zones sont finies en Normal. */
export const brecheOuverte = (j: Joueur) => ZONES.every((z) => zoneFinie(j, z, 0));

/** Les vagues ennemies prêtes pour le combat : la première, puis les suivantes. */
export function vaguesEnnemies(s: Stage): { equipeB: MonstreCombat[]; vaguesSuivantes: MonstreCombat[][] } {
  // runes invisibles : selon la difficulté, ou un cran à partir du niveau 8 du donjon ⚠ (équilibre simulé : le B10 demande une équipe 6★ runée)
  const dif = s.donjon ? (s.numero >= 8 ? 1 : 0) : s.dif;
  const [premiere, ...suite] = s.vagues.map((v) => v.map((e) => {
    const m = runesEnnemies(monstreCombat(e.id, e.etoiles, e.niveau), dif, s.numero);
    return e.pvx ? { ...m, stats: { ...m.stats, pv: Math.round(m.stats.pv * e.pvx) } } : m;
  }));
  return { equipeB: premiere, vaguesSuivantes: suite };
}

/** L'équipe du joueur prête pour le combat. */
export function equipeJoueur(j: Joueur): MonstreCombat[] {
  return j.equipe.map((uid) => {
    const m = j.monstres.find((x) => x.uid === uid)!;
    return avecRunes(monstreCombat(m.id, m.etoiles, m.niveau, sortsDe(m)), (j.runes ?? []).filter((r) => r.porteur === uid));
  });
}

/** Chances d'un monstre qui tombe (SW : quelques % par monstre ✓ ; le nôtre ⚠) et d'énergie (SW ✓ ; montants ⚠). */
export const CHANCE_MONSTRE = 3;
export const CHANCE_ENERGIE = 25;

export interface Butin {
  xp: number;
  kamas: number;
  pierresAme: number;
  /** Première victoire sur ce stage : une pierre d'âme offerte. */
  premiere: boolean;
  energie: number;
  /** Un des ennemis du stage, qui rejoint la collection (étoiles naturelles, niveau 1). */
  monstre?: string;
  /** Récompense de la zone, la première fois qu'elle est finie en Normal. */
  zone?: { id: string; etoiles: Etoiles };
  /** Butin propre aux donjons. */
  donjon?: ButinDonjon;
  /** Rune gagnée (set de la zone) et graine de son tirage. */
  rune?: { etoiles: EtoilesRune; set: SetRune; graine: number };
}

/**
 * Runes des zones (maquette « Runes : » 3C, 4C) ⚠ : chaque zone donne son set (Astrub : Iop) ;
 * Normal 20 % (1 à 3★), Difficile 30 % (2 à 4★), Enfer 40 % (3 à 5★). Les 6★ viendront du donjon.
 */
export const RUNES_ZONE = [{ chance: 20, min: 1 }, { chance: 30, min: 2 }, { chance: 40, min: 3 }];
export const setDeZone = (z: Zone): SetRune | undefined =>
  (Object.keys(SETS) as SetRune[]).find((s) => SETS[s].dieu.toLowerCase() === z.runes?.toLowerCase());

/** Butin d'une victoire, tiré avec sa propre graine (déterministe, rejouable par le serveur). */
export function tirerButin(j: Joueur, s: Stage, graine: number): Butin {
  const rng = new Rng(graine ^ 0x5eed);
  const premiere = !j.stagesFinis.includes(s.id);
  const b: Butin = {
    xp: s.recompenses.xp, kamas: s.recompenses.kamas,
    pierresAme: (rng.chance(s.recompenses.pierreChance) ? 1 : 0) + (premiere ? 1 : 0), premiere, energie: 0,
  };
  const prosp = j.equipe.reduce((n, uid) => n + (setsActifs((j.runes ?? []).filter((r) => r.porteur === uid)).enutrof ?? 0), 0);
  if (s.donjon) {
    // donjon : pas de pierre d'âme d'office ni de monstre ; son propre butin
    b.pierresAme = 0;
    b.kamas = Math.round(b.kamas * (1 + 0.2 * prosp));
    b.donjon = tirerButinDonjon(j, DONJONS.find((d) => d.id === s.donjon)!, s.numero, rng);
    return b;
  }
  if (rng.chance(CHANCE_ENERGIE)) b.energie = 1 + Math.floor(rng.suivant() * 3);
  if (rng.chance(CHANCE_MONSTRE)) b.monstre = s.ennemis[Math.floor(rng.suivant() * s.ennemis.length)].id;
  // set Prospection (Enutrof) : +20 % de kamas par set porté dans l'équipe
  const prospection = j.equipe.reduce((n, uid) => n + (setsActifs((j.runes ?? []).filter((r) => r.porteur === uid)).enutrof ?? 0), 0);
  b.kamas = Math.round(b.kamas * (1 + 0.2 * prospection));
  const z = zone(s.zone);
  const rz = RUNES_ZONE[s.dif], set = setDeZone(z);
  if (set && rng.chance(rz.chance)) b.rune = { etoiles: (rz.min + Math.floor(rng.suivant() * 3)) as EtoilesRune, set, graine: Math.floor(rng.suivant() * 2 ** 31) };
  const finis = new Set([...j.stagesFinis, s.id]);
  if (s.dif === 0 && z.recompense && !j.recompensesZones.includes(z.id) && z.stages.every((x) => finis.has(x))) b.zone = z.recompense;
  return b;
}

/** Applique le butin : XP à l'équipe, kamas, pierres d'âme, énergie, monstres, stage marqué comme fini. */
export function appliquerVictoire(j: Joueur, s: Stage, b: Butin, maintenant: number): { joueur: Joueur; niveaux: Record<number, number> } {
  const { joueur, niveaux } = donnerXp(j, j.equipe, b.xp);
  let r: Joueur = {
    ...joueur,
    kamas: joueur.kamas + b.kamas,
    pierresAme: joueur.pierresAme + b.pierresAme,
    stagesFinis: joueur.stagesFinis.includes(s.id) ? joueur.stagesFinis : [...joueur.stagesFinis, s.id],
  };
  if (b.energie) r = changerEnergie(r, b.energie, maintenant);
  // monstre gagné : dans la collection, ou à la Réception si elle est pleine (maquette « Réception : » 3B, 4A)
  if (b.monstre) r = placesLibres(r) > 0 ? ajouterMonstre(r, b.monstre).joueur : envoyer(r, `butin:${s.id}:${maintenant}`, `Monstre gagné : ${s.id} (collection pleine)`, { monstre: b.monstre }, maintenant);
  if (b.rune) r = donnerRune(r, { etoiles: b.rune.etoiles, set: b.rune.set }, b.rune.graine).joueur;
  const dj = b.donjon;
  if (dj) {
    if (dj.rune) r = donnerRune(r, { etoiles: dj.rune.etoiles, set: dj.rune.set, grade: dj.rune.grade }, dj.rune.graine).joueur;
    if (dj.premiere?.rune) r = donnerRune(r, { etoiles: dj.premiere.rune.etoiles, set: dj.premiere.rune.set, grade: dj.premiere.rune.grade }, dj.premiere.rune.graine).joueur;
    const parfaites = dj.parfaites + (dj.premiere?.parfaite ?? 0);
    if (parfaites) r = ajouterPierres(r, 'parfaite', parfaites);
    r = { ...r, pierresAme: r.pierresAme + dj.pierresAme };
    if (dj.symbole) r = { ...r, symboles: { ...(r.symboles ?? {}), [dj.symbole]: (r.symboles?.[dj.symbole] ?? 0) + 1 } };
  }
  // récompense de zone : envoyée à la Réception
  if (b.zone) r = { ...envoyer(r, `zone:${s.zone}`, `Récompense de zone : ${zone(s.zone).nom}`, { monstre: b.zone.id }, maintenant), recompensesZones: [...r.recompensesZones, s.zone] };
  return { joueur: r, niveaux };
}
