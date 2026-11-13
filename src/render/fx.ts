import Phaser from 'phaser';
import FX from '../data/fx.json';
import { distant } from './assetUrl';

/**
 * Effets officiels de Dofus 3 (planches de sorts de Diablofus : tools/extraction/spell_fx.py).
 * Atlas JSON dans public/assets/fx, images WebP sur le R2 (fx/fx_<id>.webp).
 */
interface DefFx { anim: string; images: number; fps: number; origine: [number, number] }
const DEFS = FX as unknown as Record<string, DefFx>;

/** Même rapport effet / monstre que dans Diablofus (effets à 0,82, monstres à leur échelle de planche). */
export const ECHELLE_FX = 0.82;

export const cleFx = (id: string) => `fx_${id}`;

export function chargerFx(scene: Phaser.Scene, ids: string[]) {
  for (const id of ids) {
    if (scene.textures.exists(cleFx(id))) continue;
    scene.load.atlas(cleFx(id), distant(`fx/fx_${id}.webp`), `assets/fx/fx_${id}.json`);
  }
}

/**
 * Crée les animations d'un effet : « <cle> » jouée une fois, et « <cle>:boucle » qui va et vient entre ses images
 * pleines (sans les images vides du début et de la fin), pour une aura permanente.
 */
export function creerAnimsFx(scene: Phaser.Scene, id: string) {
  const cle = cleFx(id), d = DEFS[id];
  if (scene.anims.exists(cle)) return;
  const tex = scene.textures.get(cle);
  const noms = Array.from({ length: d.images }, (_, i) => `${d.anim}_${i}`).filter((n) => tex.has(n));
  scene.anims.create({ key: cle, frames: noms.map((frame) => ({ key: cle, frame })), frameRate: d.fps });
  const aire = noms.map((n) => tex.get(n).cutWidth * tex.get(n).cutHeight), max = Math.max(...aire);
  const pleines = noms.filter((_, i) => aire[i] >= max * 0.35);
  scene.anims.create({ key: `${cle}:boucle`, frames: pleines.map((frame) => ({ key: cle, frame })), frameRate: d.fps, yoyo: true, repeat: -1 });
}

/** Pose un effet, pieds en (x, y). `boucle` : aura permanente ; sinon joué une fois puis détruit. */
export function poserFx(scene: Phaser.Scene, id: string, x: number, y: number, echelle: number, boucle: boolean) {
  creerAnimsFx(scene, id);
  const d = DEFS[id];
  const s = scene.add.sprite(x, y, cleFx(id)).setOrigin(d.origine[0], d.origine[1]).setScale(ECHELLE_FX * echelle);
  s.play(boucle ? `${cleFx(id)}:boucle` : cleFx(id));
  if (!boucle) s.once('animationcomplete', () => s.destroy());
  return s;
}

export const dureeFx = (id: string) => DEFS[id].images / DEFS[id].fps;
