import Phaser from 'phaser';
import { H, W } from './ui';

/**
 * Netteté : le jeu est pensé en 1280 × 720, mais on le dessine à la taille réelle de l'écran (pixels physiques compris),
 * sinon le navigateur agrandit une petite image et tout devient flou.
 * Le canevas fait 1280·K × 720·K ; chaque caméra zoome de K sur le monde 1280 × 720 ; les textes sont rendus à la résolution K.
 */

/** Facteur K, d'après la place disponible dans l'élément #jeu et la densité de pixels de l'écran. */
export function facteurNettete(parent: HTMLElement): number {
  const dpr = window.devicePixelRatio || 1;
  const largeur = (parent.clientWidth || window.innerWidth) * dpr;
  const hauteur = (parent.clientHeight || window.innerHeight) * dpr;
  const k = Math.min(largeur / W, hauteur / H);
  // Par quarts, entre 1 et 3 (au-delà, la mémoire graphique coûte cher pour un gain invisible)
  return Math.min(3, Math.max(1, Math.ceil(k * 4) / 4));
}

/** Les textes sont dessinés à la résolution K (sauf s'ils précisent la leur). */
export function textesNets(k: number) {
  const usine = Phaser.GameObjects.GameObjectFactory.prototype as unknown as {
    text: (x: number, y: number, t: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) => Phaser.GameObjects.Text;
  };
  const origine = usine.text;
  usine.text = function (this: Phaser.GameObjects.GameObjectFactory, x, y, t, style) {
    return origine.call(this, x, y, t, { resolution: k, ...style });
  };
}

/** Chaque scène voit le monde 1280 × 720, agrandi K fois dans le canevas. */
export function camerasNettes(jeu: Phaser.Game, k: number) {
  const cadrer = (s: Phaser.Scene) => s.cameras?.main?.setZoom(k).centerOn(W / 2, H / 2);
  const brancher = () => {
    for (const s of jeu.scene.getScenes(false)) {
      s.sys.events.on(Phaser.Scenes.Events.START, () => cadrer(s));
      cadrer(s);
    }
  };
  // Les scènes n'existent qu'une fois le jeu prêt (textures de base chargées)
  if (jeu.scene.getScenes(false).length) brancher(); else jeu.events.once(Phaser.Core.Events.READY, brancher);
}
