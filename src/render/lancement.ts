import type Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import { changerEnergie, energie } from '../sim/energie';
import { stage } from '../sim/stages';
import { noterMission } from '../sim/missions';

/**
 * Combats à répétition (maquette « Donjons : » 5C, comme SW) : jusqu'à 30 combats en auto, arrêt après le combat en cours,
 * butin cumulé et historique, vitesse ×1/×2/×3 gardée. S'arrête aussi sur une défaite ou faute d'énergie.
 */
export interface Repetition {
  total: number;
  fait: number;
  arret: boolean;
  /** Une ligne par combat : victoire, tours. */
  historique: { victoire: boolean; tours: number }[];
  /** Butin cumulé : kamas, XP, pierres, énergie, runes (étoiles), symboles, monstres. */
  cumul: { kamas: number; pierresAme: number; parfaites: number; energie: number; runes: Record<number, number>; symboles: number; monstres: number };
}
export const nouvelleRepetition = (total: number): Repetition => ({
  total, fait: 0, arret: false, historique: [], cumul: { kamas: 0, pierresAme: 0, parfaites: 0, energie: 0, runes: {}, symboles: 0, monstres: 0 },
});

/** Lance un combat : l'énergie est payée au départ (comme SW). Renvoie false s'il n'y en a pas assez. */
export function lancerCombat(scene: Phaser.Scene, cle: string, repetition?: Repetition): boolean {
  const j = charger(), s = stage(cle), now = Date.now();
  if (energie(j, now) < s.cout) return false;
  let k = changerEnergie(j, -s.cout, now);
  k = noterMission(noterMission(k, 'energie1', s.cout, now), 'energie2', s.cout, now);
  sauver(k);
  scene.scene.start('combat', { stage: cle, repetition });
  return true;
}
