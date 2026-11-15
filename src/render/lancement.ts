import type Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import { changerEnergie, energie } from '../sim/energie';
import { stage } from '../sim/stages';
import { noterMission } from '../sim/missions';

/** Lance un combat d'histoire : l'énergie est payée au départ (comme SW). Renvoie false s'il n'y en a pas assez. */
export function lancerCombat(scene: Phaser.Scene, cle: string): boolean {
  const j = charger(), s = stage(cle), now = Date.now();
  if (energie(j, now) < s.cout) return false;
  let k = changerEnergie(j, -s.cout, now);
  k = noterMission(noterMission(k, 'energie1', s.cout, now), 'energie2', s.cout, now);
  sauver(k);
  scene.scene.start('combat', { stage: cle });
  return true;
}
