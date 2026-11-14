import type Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import { changerEnergie, energie } from '../sim/energie';
import { stage } from '../sim/stages';

/** Lance un combat d'histoire : l'énergie est payée au départ (comme SW). Renvoie false s'il n'y en a pas assez. */
export function lancerCombat(scene: Phaser.Scene, cle: string): boolean {
  const j = charger(), s = stage(cle), now = Date.now();
  if (energie(j, now) < s.cout) return false;
  sauver(changerEnergie(j, -s.cout, now));
  scene.scene.start('combat', { stage: cle });
  return true;
}
