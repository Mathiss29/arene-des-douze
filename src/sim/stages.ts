import STAGES from '../data/stages.json';
import { monstreCombat } from './fiches';
import { donnerXp, type Joueur } from './joueur';
import type { Etoiles } from './progression';
import { Rng } from './rng';
import type { MonstreCombat } from './types';

export interface Stage {
  id: string;
  nom: string;
  /** Décor (fichier lourd sur le R2). */
  arene: string;
  ennemis: { id: string; etoiles: Etoiles; niveau: number }[];
  recompenses: { xp: number; kamas: number; pierreChance: number };
}

export const LISTE_STAGES = STAGES as Stage[];

export function stage(id: string): Stage {
  const s = LISTE_STAGES.find((x) => x.id === id);
  if (!s) throw new Error(`Stage inconnu : ${id}`);
  return s;
}

export function equipeEnnemie(s: Stage): MonstreCombat[] {
  return s.ennemis.map((e) => monstreCombat(e.id, e.etoiles, e.niveau));
}

/** L'équipe du joueur prête pour le combat. */
export function equipeJoueur(j: Joueur): MonstreCombat[] {
  return j.equipe.map((uid) => {
    const m = j.monstres.find((x) => x.uid === uid)!;
    return monstreCombat(m.id, m.etoiles, m.niveau);
  });
}

export interface Butin {
  xp: number;
  kamas: number;
  pierresAme: number;
  /** Première victoire sur ce stage : une pierre d'âme offerte. */
  premiere: boolean;
}

/** Butin d'une victoire, tiré avec sa propre graine (déterministe, rejouable par le serveur). */
export function tirerButin(j: Joueur, s: Stage, graine: number): Butin {
  const rng = new Rng(graine ^ 0x5eed);
  const premiere = !j.stagesFinis.includes(s.id);
  return { xp: s.recompenses.xp, kamas: s.recompenses.kamas, pierresAme: (rng.chance(s.recompenses.pierreChance) ? 1 : 0) + (premiere ? 1 : 0), premiere };
}

/** Applique le butin : XP à chaque monstre de l'équipe, kamas, pierres d'âme, stage marqué comme fini. */
export function appliquerVictoire(j: Joueur, s: Stage, b: Butin): { joueur: Joueur; niveaux: Record<number, number> } {
  const { joueur, niveaux } = donnerXp(j, j.equipe, b.xp);
  return {
    joueur: {
      ...joueur,
      kamas: joueur.kamas + b.kamas,
      pierresAme: joueur.pierresAme + b.pierresAme,
      stagesFinis: joueur.stagesFinis.includes(s.id) ? joueur.stagesFinis : [...joueur.stagesFinis, s.id],
    },
    niveaux,
  };
}
