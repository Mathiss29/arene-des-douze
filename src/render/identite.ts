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
  if (!scene.textures.exists('symboles')) scene.load.atlas('symboles', 'assets/ui/symboles.webp', 'assets/ui/symboles.json');
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
  options: { choisie?: boolean; equipe?: boolean; verrou?: boolean; nouveau?: boolean; action?: () => void } = {}): Phaser.GameObjects.GameObject[] {
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
  if (m.etoiles >= 5) o.push(...reflet(scene, x, y, t, (x * 7 + y * 3) % 1800));
  if (options.equipe) o.push(...pastille(scene, x - t / 2 + 4, y + t / 2 - 4, 'ico_epee', Math.max(16, t * 0.25)));
  if (options.verrou) o.push(...pastille(scene, x + t / 2 - 3, y - t / 2 + 3, 'ico_cadenas', Math.max(16, t * 0.25)));
  if (options.nouveau) o.push(...etiquetteNouveau(scene, x, y - t / 2 - 2));
  if (options.action) o.push(scene.add.zone(x, y, t, t).setDepth(1005).setInteractive({ useHandCursor: true }).on('pointerdown', options.action));
  return o;
}

/** Rangée d'étoiles dessinées. `ancrage` : 0 = part de x vers la droite, 0.5 = centrée sur x, 1 = finit à x. */
export function etoiles(scene: Phaser.Scene, x: number, y: number, n: number, taille: number, ancrage = 0.5, profondeur = 1003): Phaser.GameObjects.Image[] {
  textures(scene);
  const pas = taille * 0.95, x0 = x - (n - 1) * pas * ancrage + (0.5 - ancrage) * taille;
  return Array.from({ length: n }, (_, i) => scene.add.image(x0 + i * pas, y, 'etoile').setDisplaySize(taille, taille).setDepth(profondeur));
}

// ───────────── runes : médaillons de pierre (planche n° 7, C) avec les vrais symboles des classes de Dofus 3 ─────────────

/** Couleurs de grade, celles de SW : Commune, Magique, Rare, Héroïque, Légendaire. */
export const COULEUR_GRADE = [0xb9c4bd, 0x7fd05a, 0x4aa3e6, 0xb47aff, 0xffb23a];
const sommet = (i: number, r: number): [number, number] => [Math.sin((i * Math.PI) / 3) * r, -Math.cos((i * Math.PI) / 3) * r];

function texturesRunes(scene: Phaser.Scene) {
  if (scene.textures.exists('rune_cadre')) return;
  const T = 224, hexa = (c: CanvasRenderingContext2D, r: number) => {
    c.beginPath(); for (let i = 0; i < 6; i++) { const [x, y] = sommet(i, r); c.lineTo(T / 2 + x, T / 2 + y); } c.closePath();
  };
  const cadre = (cle: string, haut: string, bas: string) => {
    const t = scene.textures.createCanvas(cle, T, T)!, c = t.getContext();
    const g = c.createLinearGradient(0, 0, 0, T); g.addColorStop(0, haut); g.addColorStop(1, bas);
    c.lineJoin = 'round'; hexa(c, 104); c.fillStyle = g; c.fill(); c.lineWidth = 6; c.strokeStyle = '#10130d'; c.stroke();
    hexa(c, 95); c.lineWidth = 2.5; c.strokeStyle = 'rgba(160,172,140,.6)'; c.stroke();
    hexa(c, 79); c.fillStyle = '#12160f'; c.fill(); c.lineWidth = 5; c.strokeStyle = '#10130d'; c.stroke();
    t.refresh();
  };
  cadre('rune_cadre', '#687160', '#2b3026'); cadre('rune_vide', '#3a4133', '#1c2018');
  COULEUR_GRADE.forEach((col, k) => {
    const t = scene.textures.createCanvas(`rune_coeur_${k}`, T, T)!, c = t.getContext(), cc = Phaser.Display.Color.IntegerToColor(col);
    const mel = (v: number, p: number) => `rgb(${[cc.red, cc.green, cc.blue].map((x) => Math.round(x + (v - x) * p)).join(',')})`;
    const g = c.createRadialGradient(T / 2, T / 2, 4, T / 2, T / 2, 84);
    g.addColorStop(0, mel(255, 0.45)); g.addColorStop(0.6, mel(255, 0)); g.addColorStop(1, mel(16, 0.45));
    c.lineJoin = 'round'; hexa(c, 77); c.fillStyle = g; c.fill();
    t.refresh();
  });
  const f = scene.textures.createCanvas('rune_fleche', 32, 32)!, cf = f.getContext();
  cf.beginPath(); cf.moveTo(16, 3); cf.lineTo(29, 26); cf.lineTo(3, 26); cf.closePath(); cf.lineJoin = 'round';
  cf.fillStyle = '#d8ff5a'; cf.fill(); cf.lineWidth = 4; cf.strokeStyle = '#10130d'; cf.stroke(); f.refresh();
}

/**
 * Rune en médaillon : cadre de pierre, cœur de la couleur du grade, symbole de la classe du set, étoiles, niveau,
 * et une flèche verte sur le sommet de son emplacement (1 en haut, puis dans le sens des aiguilles d'une montre).
 * Sans rune : emplacement vide avec son numéro.
 */
export function runeMedaillon(scene: Phaser.Scene, r: { set: string; grade: number; emplacement: number; etoiles: number; niveau: number } | null,
  x: number, y: number, t: number, options: { choisie?: boolean; numero?: number; profondeur?: number; sansDetails?: boolean } = {}): Phaser.GameObjects.GameObject[] {
  textures(scene); texturesRunes(scene);
  const p = options.profondeur ?? 1000, o: Phaser.GameObjects.GameObject[] = [], u = t / 224;
  if (options.choisie) o.push(scene.add.circle(x, y, t * 0.52, VERT, 0.3).setStrokeStyle(3, 0xd8ff5a).setDepth(p - 1));
  if (!r) {
    o.push(scene.add.image(x, y, 'rune_vide').setDisplaySize(t, t).setAlpha(0.85).setDepth(p));
    if (options.numero) o.push(scene.add.text(x, y, String(options.numero), { fontFamily: POLICE, fontSize: `${Math.round(t * 0.3)}px`, fontStyle: '600', color: '#6f7a6c' }).setOrigin(0.5).setDepth(p + 1));
    return o;
  }
  o.push(scene.add.image(x, y, 'rune_cadre').setDisplaySize(t, t).setDepth(p), scene.add.image(x, y, `rune_coeur_${r.grade}`).setDisplaySize(t, t).setDepth(p + 1));
  const [fx, fy] = sommet(r.emplacement - 1, 100 * u);
  o.push(scene.add.image(x + fx, y + fy, 'rune_fleche').setDisplaySize(t * 0.17, t * 0.17).setAngle((r.emplacement - 1) * 60).setDepth(p + 4));
  if (scene.textures.exists('symboles')) {
    const s = t * 0.52;
    o.push(scene.add.image(x + 1, y + s * 0.1 + 2, 'symboles', r.set).setDisplaySize(s, s).setTintFill(0x10130d).setAlpha(0.55).setDepth(p + 2),
      scene.add.image(x, y + s * 0.1, 'symboles', r.set).setDisplaySize(s, s).setDepth(p + 3));
  }
  if (options.sansDetails) return o;
  const te = Math.min(t * 0.15, (t * 0.62) / r.etoiles / 0.95);
  o.push(scene.add.rectangle(x, y - t * 0.3, r.etoiles * te * 0.95 + 6, te + 4, 0x10130d, 0.86).setDepth(p + 4), ...etoiles(scene, x, y - t * 0.3, r.etoiles, te, 0.5, p + 5));
  const taille = Math.max(9, Math.round(t * 0.17)), n = scene.add.text(0, 0, `+${r.niveau}`, { fontFamily: POLICE, fontSize: `${taille}px`, fontStyle: '600', color: '#ffffff' }).setOrigin(0.5).setDepth(p + 6);
  const lp = n.width + 8, hp = taille + 4, px = x + t * 0.24, py = y + t * 0.34;
  n.setPosition(px, py);
  o.push(scene.add.graphics().setDepth(p + 5).fillStyle(0x10130d, 0.94).fillRoundedRect(px - lp / 2, py - hp / 2, lp, hp, 4).lineStyle(1, 0x6f7862).strokeRoundedRect(px - lp / 2, py - hp / 2, lp, hp, 4), n);
  return o;
}

// ───────────── vue détail : emblème de l'élément gravé dans la pierre, éclat d'entrée, reflet, pastilles, hexagone ─────────────

const EMBLEMES: Record<Element, string[]> = {
  feu: ['M50 4C60 30 86 40 81 69C78 88 63 97 50 97C37 97 22 88 19 69C17 50 31 46 35 28C41 38 44 44 48 46C45 30 46 18 50 4Z', 'M50 52C56 62 66 66 63 78C61 86 55 90 50 90C45 90 39 86 37 78C36 70 44 66 50 52Z'],
  eau: ['M50 4C50 4 19 45 19 66A31 31 0 0 0 81 66C81 45 50 4 50 4Z', 'M34 66A16 16 0 0 0 50 82L50 76A10 10 0 0 1 40 66Z'],
  air: ['M12 88C10 42 44 10 90 10C92 56 60 90 12 88Z', 'M12 88L62 38L64 40L14 90Z'],
  brakmar: ['M64 6A45 45 0 1 0 94 70A36 36 0 1 1 64 6Z', 'M70 30L73 38L81 39L75 45L77 53L70 49L63 53L65 45L59 39L67 38Z'],
  bonta: ['M50 28A22 22 0 1 0 50.01 28Z', ...[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const r = (a * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), q = (d: number, w: number) => `${(50 + c * d - s * w).toFixed(1)} ${(50 + s * d + c * w).toFixed(1)}`;
    return `M${q(30, -4)}L${q(46, 0)}L${q(30, 4)}Z`;
  })],
};

/** Grand emblème de l'élément taillé dans le mur derrière le monstre : creux sombre, liseré clair, lueur qui pulse. */
export function emblemeGrave(scene: Phaser.Scene, element: Element, x: number, y: number, taille: number, profondeur = 6): Phaser.GameObjects.GameObject[] {
  const T = 400;
  for (const mode of ['creux', 'lueur'] as const) {
    const cle = `embleme_${mode}_${element}`;
    if (scene.textures.exists(cle)) continue;
    const t = scene.textures.createCanvas(cle, T, T)!, c = t.getContext();
    c.save(); c.translate(20, 20); c.scale(3.6, 3.6); c.lineJoin = 'round';
    EMBLEMES[element].forEach((d, i) => {
      const p = new Path2D(d);
      if (mode === 'creux') {
        c.save(); c.translate(0.5, 0.7); c.strokeStyle = 'rgba(150,162,130,.35)'; c.lineWidth = 2.6; c.stroke(p); c.restore();
        c.fillStyle = i ? 'rgba(11,13,10,.5)' : 'rgba(11,13,10,.42)'; c.fill(p); c.strokeStyle = '#0b0d0a'; c.lineWidth = 2.4; c.stroke(p);
      } else { c.fillStyle = i ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.16)'; c.fill(p); c.strokeStyle = '#ffffff'; c.lineWidth = 1.1; c.stroke(p); }
    });
    c.restore(); t.refresh();
  }
  const col = element === 'bonta' ? 0xffe9a0 : COULEUR[element];
  const anneau = scene.add.graphics({ x, y }).setDepth(profondeur);
  anneau.lineStyle(9, 0x0b0d0a, 0.22).strokeCircle(0, 0, taille * 0.6).lineStyle(2, 0x0b0d0a, 0.9).strokeCircle(0, 0, taille * 0.58).lineStyle(1, 0x8d977c, 0.3).strokeCircle(0, 0, taille * 0.585);
  const tirets = scene.add.graphics({ x, y }).setDepth(profondeur).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 48; i++) tirets.lineStyle(1.6, col, 0.5).beginPath().arc(0, 0, taille * 0.555, (i * Math.PI) / 24, (i * Math.PI) / 24 + 0.07).strokePath();
  scene.tweens.add({ targets: tirets, angle: 360, duration: 60000, repeat: -1 });
  const creux = scene.add.image(x, y, `embleme_creux_${element}`).setDisplaySize(taille, taille).setDepth(profondeur);
  const lueur = scene.add.image(x, y, `embleme_lueur_${element}`).setDisplaySize(taille, taille).setTint(col).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(profondeur + 1);
  scene.tweens.add({ targets: lueur, alpha: 1, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return [anneau, tirets, creux, lueur];
}

/** Éclat de l'élément à l'entrée en scène d'un monstre : flash, onde et étincelles (se détruit tout seul). */
export function eclatEntree(scene: Phaser.Scene, x: number, y: number, couleur: number, profondeur = 1002) {
  textures(scene);
  const flash = scene.add.image(x, y, 'luciole').setDisplaySize(140, 140).setTint(melange(couleur, 0xffffff, 0.3)).setBlendMode(Phaser.BlendModes.ADD).setDepth(profondeur);
  scene.tweens.add({ targets: flash, scale: flash.scale * 4, alpha: 0, duration: 480, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
  const onde = scene.add.circle(x, y, 30).setStrokeStyle(5, couleur).setBlendMode(Phaser.BlendModes.ADD).setDepth(profondeur);
  scene.tweens.add({ targets: onde, scale: 7, alpha: 0, duration: 650, ease: 'Quad.easeOut', onComplete: () => onde.destroy() });
  const e = scene.add.particles(x, y, 'luciole', { speed: { min: 160, max: 420 }, lifespan: { min: 450, max: 850 }, scale: { start: 0.7, end: 0 }, gravityY: 160, tint: melange(couleur, 0xffffff, 0.2), blendMode: 'ADD', emitting: false }).setDepth(profondeur);
  e.explode(22);
  scene.time.delayedCall(1000, () => e.destroy());
}

/** Reflet holographique qui balaie une carte 5★ ou 6★ de temps en temps. */
export function reflet(scene: Phaser.Scene, x: number, y: number, t: number, retard = 0, profondeur = 1002): Phaser.GameObjects.GameObject[] {
  if (!scene.textures.exists('reflet')) {
    const tx = scene.textures.createCanvas('reflet', 128, 128)!, c = tx.getContext(), g = c.createLinearGradient(0, 0, 128, 0);
    for (const [p, col] of [[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,122,217,.35)'], [0.5, 'rgba(255,255,255,.9)'], [0.66, 'rgba(122,217,255,.4)'], [0.82, 'rgba(184,255,122,.25)'], [1, 'rgba(255,255,255,0)']] as const) g.addColorStop(p, col);
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); tx.refresh();
  }
  const i = t * 0.84, m = scene.make.graphics({}, false).fillRect(x - i / 2, y - i / 2, i, i);
  const b = scene.add.image(x - t, y, 'reflet').setDisplaySize(t * 0.5, t * 1.8).setAngle(22).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8).setDepth(profondeur);
  b.setMask(m.createGeometryMask());
  scene.tweens.add({ targets: b, x: x + t, duration: 900, delay: retard, repeatDelay: 2200, repeat: -1, ease: 'Sine.easeInOut' });
  return [b, m];
}

/** Petites icônes dessinées : épée (équipe) et cadenas (monstre verrouillé). */
function texturesPastilles(scene: Phaser.Scene) {
  if (scene.textures.exists('ico_epee')) return;
  const ico = (cle: string, dessin: (c: CanvasRenderingContext2D) => void) => { const t = scene.textures.createCanvas(cle, 48, 48)!, c = t.getContext(); c.scale(2, 2); c.lineJoin = 'round'; dessin(c); t.refresh(); };
  ico('ico_epee', (c) => { const p = new Path2D('M4 20l3-1 11-11V4h-4L3 15l1 2-2 2 2 2 2-2z'); c.fillStyle = '#d8ff5a'; c.fill(p); c.strokeStyle = '#10130d'; c.lineWidth = 1.6; c.stroke(p); });
  ico('ico_cadenas', (c) => {
    c.strokeStyle = '#e9edf0'; c.lineWidth = 2.4; c.stroke(new Path2D('M8 10.5V8a4 4 0 0 1 8 0v2.5'));
    c.beginPath(); c.roundRect(5, 10.5, 14, 10, 2.5); c.fillStyle = '#ffd24a'; c.fill(); c.strokeStyle = '#5a3a08'; c.lineWidth = 1.6; c.stroke();
  });
  ico('ico_cadenas_ouvert', (c) => {
    c.strokeStyle = '#8d977c'; c.lineWidth = 2.4; c.stroke(new Path2D('M8 10.5V8a4 4 0 0 1 7.5-2'));
    c.beginPath(); c.roundRect(5, 10.5, 14, 10, 2.5); c.fillStyle = '#4a5240'; c.fill(); c.strokeStyle = '#10130d'; c.lineWidth = 1.6; c.stroke();
  });
}

/** Pastille ronde sombre avec une icône (`ico_epee`, `ico_cadenas`, `ico_cadenas_ouvert`). */
export function pastille(scene: Phaser.Scene, x: number, y: number, icone: string, taille = 20, profondeur = 1006): Phaser.GameObjects.GameObject[] {
  texturesPastilles(scene);
  return [scene.add.circle(x, y, taille / 2, 0x10130d).setStrokeStyle(1.5, 0x6f7862).setDepth(profondeur), scene.add.image(x, y, icone).setDisplaySize(taille * 0.68, taille * 0.68).setDepth(profondeur + 1)];
}

/** Étiquette « Nouveau ! » orange, qui bat doucement. */
export function etiquetteNouveau(scene: Phaser.Scene, x: number, y: number, profondeur = 1007): Phaser.GameObjects.GameObject[] {
  const t = scene.add.text(x, y, 'Nouveau', { fontFamily: POLICE, fontSize: '10.5px', fontStyle: '600', color: '#ffffff' }).setOrigin(0.5).setDepth(profondeur + 1).setAngle(-4);
  const f = scene.add.rectangle(x, y, t.width + 10, 15, 0xee5a22).setStrokeStyle(1.5, 0x10130d).setDepth(profondeur).setAngle(-4);
  scene.tweens.add({ targets: [t, f], scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return [f, t];
}

/** Hexagone de stats (profil du monstre) : `valeurs` de 0 à 1, dans l'ordre des `noms`, à partir du haut. */
export function hexagoneStats(scene: Phaser.Scene, x: number, y: number, rayon: number, valeurs: number[], noms: string[], couleur: number, profondeur = 1001): Phaser.GameObjects.GameObject[] {
  const g = scene.add.graphics({ x, y }).setDepth(profondeur), pts = (k: number | number[]) => [0, 1, 2, 3, 4, 5].map((i) => { const [px, py] = sommet(i, rayon * (typeof k === 'number' ? k : k[i])); return new Phaser.Math.Vector2(px, py); });
  g.fillStyle(0x000000, 0.5).fillPoints(pts(1), true);
  for (const k of [1, 0.66, 0.33]) g.lineStyle(1, 0x4a5a3c).strokePoints(pts(k), true);
  for (const p of pts(1)) g.lineStyle(0.8, 0x4a5a3c).lineBetween(0, 0, p.x, p.y);
  const forme = scene.add.graphics({ x, y }).setDepth(profondeur + 1), v = valeurs.map((n) => Phaser.Math.Clamp(n, 0.1, 1));
  // la forme grandit depuis le centre
  const etat = { k: 0 };
  const tracer = () => { forme.clear().fillStyle(couleur, 0.42).fillPoints(pts(v.map((n) => n * etat.k)), true).lineStyle(2, couleur).strokePoints(pts(v.map((n) => n * etat.k)), true); };
  scene.tweens.add({ targets: etat, k: 1, duration: 450, ease: 'Back.easeOut', onUpdate: tracer });
  tracer();
  const o: Phaser.GameObjects.GameObject[] = [g, forme];
  noms.forEach((n, i) => { const [px, py] = sommet(i, rayon + 11); o.push(scene.add.text(x + px, y + py, n, { fontFamily: POLICE, fontSize: '10px', fontStyle: '600', color: '#c9d6bf' }).setOrigin(0.5).setDepth(profondeur + 1)); });
  return o;
}
