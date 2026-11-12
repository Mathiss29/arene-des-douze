import Phaser from 'phaser';

export const FPS = 30;

/**
 * Crée une animation Phaser par groupe d'images d'une planche : « AnimAttaque0_1_0…n » → clé « <planche>/AnimAttaque0_1 ».
 * Renvoie les noms d'animations trouvés.
 */
export function creerAnimations(scene: Phaser.Scene, cle: string): string[] {
  const groupes = new Map<string, { nom: string; i: number }[]>();
  for (const nom of scene.textures.get(cle).getFrameNames()) {
    const m = /^(.*)_(\d+)$/.exec(nom);
    if (!m) continue;
    if (!groupes.has(m[1])) groupes.set(m[1], []);
    groupes.get(m[1])!.push({ nom, i: Number(m[2]) });
  }
  for (const [anim, images] of groupes) {
    const key = `${cle}/${anim}`;
    if (scene.anims.exists(key)) continue;
    images.sort((a, b) => a.i - b.i);
    scene.anims.create({ key, frames: images.map(({ nom }) => ({ key: cle, frame: nom })), frameRate: FPS });
  }
  return [...groupes.keys()];
}

/** Point d'ancrage (pieds du monstre) lu dans le meta de la planche. */
export function origine(meta: { cell?: number[]; origin?: number[] } | undefined): [number, number] {
  if (!meta?.cell || !meta.origin) return [0.5, 0.85];
  return [meta.origin[0] / meta.cell[0], meta.origin[1] / meta.cell[1]];
}
