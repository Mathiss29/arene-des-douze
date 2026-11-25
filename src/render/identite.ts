import Phaser from 'phaser';
import type { Element } from '../sim/types';
import { COULEUR, H, POLICE, W, hex, portrait } from './ui';

/**
 * Identité « Pierre et émeraude » (planches n° 4 à 6 de la DA, choix de Mathis) : pierre sombre de Dofus 3, vert Dofus,
 * décor vivant (rayons, brume, lucioles de la couleur de l'élément) et cartes de monstre en médaillon de pierre.
 * Fait pour servir à tous les écrans ; le premier à l'utiliser est l'écran Monstres.
 */
export const VERT = 0xb9e61c;

export function chargerIdentite(scene: Phaser.Scene) {
  if (!scene.textures.exists('fond_pierre')) scene.load.image('fond_pierre', 'assets/ui/fond_pierre.webp');
}

/** Dégradé de fond d'un élément (centre, bord). La Lumière est un blanc qui rayonne vers l'or (planche n° 6, A). */
function teintes(e: Element): [string, string, string] {
  if (e === 'bonta') return ['#ffffff', '#fff3c0', '#f3c64a'];
  const c = Phaser.Display.Color.IntegerToColor(COULEUR[e]);
  const mel = (vers: number, p: number) => `rgb(${[c.red, c.green, c.blue].map((v, i) => Math.round(v + ((i === 0 ? vers : i === 1 ? vers + 3 : vers - 3) - v) * p)).join(',')})`;
  return [mel(255, 0.3), hex(COULEUR[e]), mel(16, 0.42)];
}

function rond(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
}

/** Textures dessinées une fois : médaillon de chaque élément, étoile, luciole, brume, ombre des bords. */
function textures(scene: Phaser.Scene) {
  if (scene.textures.exists('etoile')) return;
  const T = 240;
  for (const e of Object.keys(COULEUR) as Element[]) {
    const t = scene.textures.createCanvas(`medaillon_${e}`, T, T)!, c = t.getContext();
    // cadre de pierre
    let g: CanvasGradient = c.createLinearGradient(0, 0, 0, T);
    g.addColorStop(0, '#687160'); g.addColorStop(1, '#2b3026');
    rond(c, 2, 2, T - 4, T - 4, 30); c.fillStyle = g; c.fill();
    c.lineWidth = 3; c.strokeStyle = '#10130d'; c.stroke();
    rond(c, 6, 6, T - 12, T - 12, 26); c.lineWidth = 3; c.strokeStyle = 'rgba(160,172,140,.55)'; c.stroke();
    // fond de l'élément
    const [clair, vif, sombre] = teintes(e);
    g = c.createRadialGradient(T / 2, T * 0.6, 6, T / 2, T * 0.6, T * 0.62);
    g.addColorStop(0, clair); g.addColorStop(0.45, vif); g.addColorStop(1, sombre);
    c.save(); rond(c, 18, 18, T - 36, T - 36, 16); c.clip();
    c.fillStyle = g; c.fillRect(0, 0, T, T);
    c.fillStyle = 'rgba(16,19,13,.86)'; c.fillRect(0, 0, T, 18 + 46);   // bandeau des étoiles
    c.restore();
    rond(c, 18, 18, T - 36, T - 36, 16); c.lineWidth = 5; c.strokeStyle = '#10130d'; c.stroke();
    t.refresh();
  }
  // étoile dessinée (plus nette et mieux cadrée qu'un caractère)
  const s = scene.textures.createCanvas('etoile', 64, 64)!, cs = s.getContext();
  cs.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 12.5 : 27;
    cs.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
  }
  cs.closePath(); cs.lineJoin = 'round'; cs.lineWidth = 6; cs.strokeStyle = '#5a3a08'; cs.stroke();
  const ge = cs.createLinearGradient(0, 6, 0, 60); ge.addColorStop(0, '#ffe98a'); ge.addColorStop(1, '#ffbf2e');
  cs.fillStyle = ge; cs.fill(); s.refresh();
  // luciole et brume : halos doux, blancs (teintés ensuite)
  const halo = (cle: string, w: number, h: number, a: number) => {
    const t = scene.textures.createCanvas(cle, w, h)!, c = t.getContext();
    c.save(); c.scale(1, h / w);
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.35, `rgba(255,255,255,${a * 0.45})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w); c.restore(); t.refresh();
  };
  halo('luciole', 32, 32, 1); halo('brume', 512, 128, 0.5);
  const b = scene.textures.createCanvas('bords_sombres', 320, 180)!, cb = b.getContext();
  const gb = cb.createRadialGradient(160, 100, 40, 160, 90, 190);
  gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(0,0,0,.72)');
  cb.fillStyle = gb; cb.fillRect(0, 0, 320, 180); b.refresh();
}

const melange = (a: number, b: number, p: number) => {
  const x = Phaser.Display.Color.IntegerToColor(a), y = Phaser.Display.Color.IntegerToColor(b);
  return Phaser.Display.Color.GetColor(x.red + (y.red - x.red) * p, x.green + (y.green - x.green) * p, x.blue + (y.blue - x.blue) * p);
};

/**
 * Fond de pierre et décor vivant : rayons de lumière qui balancent, brume qui glisse, lucioles qui montent.
 * `teinter(couleur)` donne aux rayons et aux lucioles la couleur de l'élément du monstre choisi.
 */
export function decorVivant(scene: Phaser.Scene, cx = W / 2) {
  textures(scene);
  if (scene.textures.exists('fond_pierre')) scene.add.image(W / 2, H / 2, 'fond_pierre').setDisplaySize(W, H).setDepth(0);
  else scene.add.rectangle(W / 2, H / 2, W, H, 0x1c2118).setDepth(0);
  const lueur = scene.add.image(cx, H * 0.62, 'brume').setDisplaySize(1100, 700).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
  const rayons = scene.add.graphics({ x: cx, y: -140 }).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
  const dessinerRayons = (c: number) => {
    rayons.clear();
    for (const [a, l, alpha] of [[-0.42, 0.07, 0.07], [-0.16, 0.1, 0.05], [0.1, 0.06, 0.08], [0.36, 0.11, 0.05]] as const) {
      rayons.fillStyle(c, alpha).fillTriangle(0, 0, Math.sin(a - l) * 1100, Math.cos(a - l) * 1100, Math.sin(a + l) * 1100, Math.cos(a + l) * 1100);
    }
  };
  scene.tweens.add({ targets: rayons, angle: { from: -5, to: 5 }, alpha: { from: 0.65, to: 1 }, duration: 9000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const brumes = [[300, 26000, 0.16], [430, 18000, 0.13], [560, 32000, 0.1]].map(([y, d, a], i) => {
    const b = scene.add.image(-200 + i * 300, y, 'brume').setDisplaySize(1500, 190).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
    scene.tweens.add({ targets: b, x: b.x + 900, duration: d, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return b;
  });
  const lucioles = scene.add.particles(0, 0, 'luciole', {
    x: { min: 0, max: W }, y: H + 12, lifespan: { min: 8000, max: 15000 }, speedY: { min: -75, max: -38 }, speedX: { min: -10, max: 10 },
    scale: { min: 0.25, max: 0.65 }, alpha: { start: 1, end: 0, ease: 'Quad.easeIn' }, frequency: 260, blendMode: 'ADD', advance: 12000, tint: VERT,
  }).setDepth(4);
  scene.add.image(W / 2, H / 2, 'bords_sombres').setDisplaySize(W, H).setDepth(5);
  const teinter = (couleur: number) => {
    const c = melange(VERT, couleur, 0.75);
    dessinerRayons(melange(0xd8ff7a, couleur, 0.6));
    lueur.setTint(c); for (const b of brumes) b.setTint(melange(0xcfe6b0, couleur, 0.35));
    const cl = melange(couleur, 0xffffff, 0.15);
    lucioles.setParticleTint(cl);
    lucioles.forEachAlive((p) => { p.tint = cl; }, null);
  };
  teinter(VERT);
  return { teinter };
}

/** Bandeau de pierre en haut de l'écran, avec le lien de retour. */
export function bandeauPierre(scene: Phaser.Scene, retour: string, action: () => void) {
  const g = scene.add.graphics().setDepth(2000);
  g.fillGradientStyle(0x3d4438, 0x3d4438, 0x22261f, 0x22261f, 1).fillRect(0, 0, W, 50);
  g.fillStyle(0x7a846c, 0.7).fillRect(0, 0, W, 1.5).fillStyle(0x0b0d0a).fillRect(0, 50, W, 2.5).fillStyle(VERT, 0.55).fillRect(0, 52.5, W, 1);
  const r = scene.add.text(18, 25, `‹ ${retour}`, { fontFamily: POLICE, fontSize: '17px', fontStyle: '600', color: '#c6f02e' }).setOrigin(0, 0.5).setDepth(2001);
  r.setInteractive({ useHandCursor: true }).on('pointerdown', action);
}

/**
 * Carte de monstre « médaillon de pierre » : cadre de pierre, fond de la couleur de l'élément, étoiles dessinées sur leur
 * bandeau en haut, monstre entier dessous, niveau dans une plaque en bas à droite. Renvoie les objets (à détruire avec le calque).
 */
export function carteMonstre(scene: Phaser.Scene, m: { id: string; etoiles: number; niveau: number }, element: Element, x: number, y: number, t: number,
  options: { choisie?: boolean; equipe?: boolean; action?: () => void } = {}): Phaser.GameObjects.GameObject[] {
  textures(scene);
  const o: Phaser.GameObjects.GameObject[] = [], u = t / 240;
  if (options.choisie) o.push(scene.add.rectangle(x, y, t + 6, t + 6, VERT, 0.35).setStrokeStyle(3, 0xd8ff5a).setDepth(999));
  o.push(scene.add.image(x, y, `medaillon_${element}`).setDisplaySize(t, t).setDepth(1000));
  // le monstre occupe la zone sous le bandeau des étoiles
  const zone = t - 36 * u - 46 * u, cy = y - t / 2 + 64 * u + zone / 2;
  const p = portrait(scene, m.id, x, cy, zone * 1.12, false, false, 1001);
  o.push(p.sp, p.masque);
  const pas = Math.min(30 * u, (t - 52 * u) / m.etoiles), te = 30 * u;
  for (let i = 0; i < m.etoiles; i++) o.push(scene.add.image(x + (i - (m.etoiles - 1) / 2) * pas, y - t / 2 + 41 * u, 'etoile').setDisplaySize(te, te).setDepth(1003));
  const taille = Math.round(t * 0.17), n = scene.add.text(0, 0, String(m.niveau), { fontFamily: POLICE, fontSize: `${taille}px`, fontStyle: '600', color: '#ffffff' }).setOrigin(0.5).setDepth(1004);
  const lp = Math.max(n.width + 9, t * 0.3), hp = taille + 5, px = x + t / 2 - 10 * u - lp / 2, py = y + t / 2 - 10 * u - hp / 2;
  n.setPosition(px, py);
  o.push(scene.add.graphics().setDepth(1003).fillStyle(0x10130d, 0.92).fillRoundedRect(px - lp / 2, py - hp / 2, lp, hp, 5).lineStyle(1.2, 0x6f7862).strokeRoundedRect(px - lp / 2, py - hp / 2, lp, hp, 5), n);
  if (options.equipe) o.push(scene.add.text(x - t / 2 + 24 * u, y + t / 2 - 22 * u, '⚔', { fontFamily: POLICE, fontSize: `${Math.round(t * 0.16)}px`, color: '#d8ff5a' }).setOrigin(0, 1).setShadow(0, 1, '#000', 3, false, true).setDepth(1004));
  if (options.action) o.push(scene.add.zone(x, y, t, t).setDepth(1005).setInteractive({ useHandCursor: true }).on('pointerdown', options.action));
  return o;
}

/** Rangée d'étoiles dessinées. `ancrage` : 0 = part de x vers la droite, 0.5 = centrée sur x, 1 = finit à x. */
export function etoiles(scene: Phaser.Scene, x: number, y: number, n: number, taille: number, ancrage = 0.5, profondeur = 1003): Phaser.GameObjects.Image[] {
  textures(scene);
  const pas = taille * 0.95, x0 = x - (n - 1) * pas * ancrage + (0.5 - ancrage) * taille;
  return Array.from({ length: n }, (_, i) => scene.add.image(x0 + i * pas, y, 'etoile').setDisplaySize(taille, taille).setDepth(profondeur));
}
