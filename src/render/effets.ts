import Phaser from 'phaser';

/**
 * Effets visuels maison, entièrement générés par le jeu (particules, halos, ondes, runes) : aucune image à charger.
 * Chaque élément a sa matière : braises (Feu), bulles et ondes (Eau), feuilles en tourbillon (Air),
 * étincelles et rayons dorés (Bonta), fumée et éclats violets (Brâkmar).
 */

export type Element = 'feu' | 'air' | 'eau' | 'bonta' | 'brakmar';

export const TEINTES: Record<Element, { clair: number; vif: number; sombre: number }> = {
  feu: { clair: 0xffe08a, vif: 0xff7a2a, sombre: 0xc8321c },
  eau: { clair: 0xd8f4ff, vif: 0x55b8ff, sombre: 0x1f6fd0 },
  air: { clair: 0xe2ffd0, vif: 0x7ee07a, sombre: 0x2f9e54 },
  bonta: { clair: 0xfffbe0, vif: 0xffd86b, sombre: 0xe0a21c },
  brakmar: { clair: 0xe6c4ff, vif: 0xa965de, sombre: 0x3b1460 },
};

export interface Effet {
  detruire(): void;
}

export interface Corps {
  /** Pieds du monstre. */
  x: number;
  y: number;
  /** Taille visible du monstre (px à l'écran). */
  largeur: number;
  hauteur: number;
}

// ───────────── textures générées ─────────────

function texture(scene: Phaser.Scene, cle: string, taille: number, dessin: (c: CanvasRenderingContext2D, s: number) => void) {
  if (scene.textures.exists(cle)) return;
  const t = scene.textures.createCanvas(cle, taille, taille)!;
  dessin(t.context, taille);
  t.refresh();
}

export function preparerTextures(scene: Phaser.Scene) {
  texture(scene, 'fx:doux', 64, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
  });
  texture(scene, 'fx:etincelle', 48, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, 0, m, m, m * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, s, s);
    c.fillStyle = 'rgba(255,255,255,0.95)';
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      c.beginPath();
      c.moveTo(m - dx * m, m - dy * m); c.lineTo(m + dy * 2.2, m + dx * 2.2); c.lineTo(m + dx * m, m + dy * m); c.lineTo(m - dy * 2.2, m - dx * 2.2);
      c.closePath(); c.fill();
    }
  });
  texture(scene, 'fx:feuille', 32, (c, s) => {
    c.translate(s / 2, s / 2); c.rotate(-0.6);
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath(); c.ellipse(0, 0, s * 0.42, s * 0.18, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-s * 0.4, 0); c.lineTo(s * 0.4, 0); c.stroke();
  });
  texture(scene, 'fx:bulle', 32, (c, s) => {
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2;
    c.beginPath(); c.arc(s / 2, s / 2, s * 0.38, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.25)'; c.fill();
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.beginPath(); c.arc(s * 0.38, s * 0.36, s * 0.08, 0, Math.PI * 2); c.fill();
  });
  texture(scene, 'fx:fumee', 96, (c, s) => {
    for (let i = 0; i < 6; i++) {
      const x = s * (0.3 + 0.4 * Math.sin(i * 2.1) * 0.5 + 0.2), y = s * (0.5 + 0.18 * Math.cos(i * 1.7)), r = s * (0.22 + 0.06 * (i % 3));
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }
  });
  texture(scene, 'fx:rayon', 64, (c, s) => {
    const g = c.createLinearGradient(0, s, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(s * 0.42, s); c.lineTo(s * 0.58, s); c.lineTo(s * 0.7, 0); c.lineTo(s * 0.3, 0); c.closePath(); c.fill();
  });
}

// ───────────── aides ─────────────

class Groupe implements Effet {
  objets: { destroy(): void }[] = [];
  majs: ((dt: number, t: number) => void)[] = [];
  private t = 0;
  private ecoute: (time: number, dt: number) => void;
  constructor(private scene: Phaser.Scene) {
    this.ecoute = (_time, dt) => { this.t += dt / 1000; for (const m of this.majs) m(dt / 1000, this.t); };
    scene.events.on('update', this.ecoute);
  }
  garder<T extends { destroy(): void }>(o: T): T { this.objets.push(o); return o; }
  detruire() {
    this.scene.events.off('update', this.ecoute);
    for (const o of this.objets) o.destroy();
    this.objets = [];
  }
}

const centre = (c: Corps) => c.y - c.hauteur * 0.45;

type Zone = Phaser.Types.GameObjects.Particles.EmitZoneData;
/** Zone d'émission : au hasard dans une forme, ou sur son bord (les types de Phaser ne reconnaissent pas les formes Geom). */
const auHasard = (source: Phaser.Geom.Ellipse | Phaser.Geom.Circle) => ({ type: 'random', source }) as unknown as Zone;
const surLeBord = (source: Phaser.Geom.Ellipse | Phaser.Geom.Circle, quantity: number) => ({ type: 'edge', source, quantity }) as unknown as Zone;

/** Lueur douce et pulsante (sous le monstre ou autour de lui). */
function lueur(scene: Phaser.Scene, g: Groupe, x: number, y: number, rx: number, ry: number, couleur: number, alpha: number, profondeur: number) {
  const l = g.garder(scene.add.image(x, y, 'fx:doux').setTint(couleur).setBlendMode(Phaser.BlendModes.ADD)
    .setDisplaySize(rx * 2, ry * 2).setAlpha(alpha).setDepth(profondeur));
  const t = scene.tweens.add({ targets: l, alpha: alpha * 0.55, scaleX: l.scaleX * 1.08, scaleY: l.scaleY * 1.08, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  g.garder({ destroy: () => t.remove() });
  return l;
}

// ───────────── aura d'élément (particules) ─────────────

/**
 * Aura permanente d'un monstre éveillé. `densite` : 0,5 discrète, 1 normale, 1,8 spectaculaire.
 * Les particules devant le monstre sont au-dessus de lui, celles de derrière en dessous.
 */
export function auraElement(scene: Phaser.Scene, el: Element, c: Corps, densite: number): Effet {
  preparerTextures(scene);
  const g = new Groupe(scene);
  const T = TEINTES[el];
  const w = c.largeur, h = c.hauteur, cy = centre(c);
  const freq = (base: number) => Math.max(12, base / densite);
  const devant = c.y + 2, derriere = c.y - 2;
  const zone = (rx: number, ry: number, oy = 0) => auHasard(new Phaser.Geom.Ellipse(0, oy, rx * 2, ry * 2));

  lueur(scene, g, c.x, c.y, w * 0.75, w * 0.26, T.vif, 0.8, derriere - 1);
  lueur(scene, g, c.x, cy, w * 0.7, h * 0.6, T.vif, 0.18 * densite, derriere - 1);

  if (el === 'feu') {
    for (const [prof, a] of [[derriere, 0.8], [devant, 0.9]] as const) {
      g.garder(scene.add.particles(c.x, c.y - h * 0.15, 'fx:doux', {
        emitZone: zone(w * 0.32, h * 0.18), lifespan: { min: 700, max: 1300 }, speedY: { min: -110, max: -55 }, speedX: { min: -14, max: 14 },
        scale: { start: 0.6 * Math.sqrt(w / 120), end: 0 }, alpha: { start: a, end: 0 }, tint: [T.clair, T.vif, T.vif, T.sombre],
        blendMode: 'ADD', frequency: freq(45),
      }).setDepth(prof));
    }
    g.garder(scene.add.particles(c.x, c.y - h * 0.2, 'fx:etincelle', {
      emitZone: zone(w * 0.35, h * 0.25), lifespan: 900, speedY: { min: -160, max: -90 }, speedX: { min: -40, max: 40 },
      scale: { start: 0.5, end: 0 }, tint: T.clair, blendMode: 'ADD', frequency: freq(150),
    }).setDepth(devant));
  }

  if (el === 'eau') {
    // Ondes au sol
    for (let i = 0; i < 3; i++) {
      const o = g.garder(scene.add.ellipse(c.x, c.y, 10, 4).setStrokeStyle(3, T.clair, 1).setFillStyle().setDepth(derriere).setBlendMode(Phaser.BlendModes.ADD));
      const tw = scene.tweens.add({ targets: o, width: w * 1.3, height: w * 0.42, alpha: { from: 0.9, to: 0 }, duration: 2400, delay: i * 800, repeat: -1, ease: 'Sine.easeOut' });
      g.garder({ destroy: () => tw.remove() });
    }
    for (const prof of [derriere, devant]) {
      g.garder(scene.add.particles(c.x, c.y - h * 0.1, 'fx:bulle', {
        emitZone: zone(w * 0.36, h * 0.2), lifespan: { min: 1400, max: 2200 }, speedY: { min: -60, max: -30 }, speedX: { min: -8, max: 8 },
        scale: { min: 0.45, max: 0.95 }, alpha: { start: 1, end: 0 }, tint: [T.clair, T.vif], frequency: freq(120),
      }).setDepth(prof));
    }
    g.garder(scene.add.particles(c.x, cy, 'fx:doux', {
      emitZone: zone(w * 0.4, h * 0.35), lifespan: 1200, speed: 6, scale: { start: 0.25, end: 0 }, alpha: { start: 0.6, end: 0 },
      tint: T.vif, blendMode: 'ADD', frequency: freq(160),
    }).setDepth(devant));
  }

  if (el === 'air') {
    // Feuilles en orbite autour du monstre (devant puis derrière)
    const n = Math.round(10 * densite);
    const feuilles = Array.from({ length: n }, (_, i) => ({
      s: g.garder(scene.add.image(c.x, c.y, 'fx:feuille').setTint(i % 3 ? T.vif : T.clair).setScale(0.85 + (i % 3) * 0.2)),
      a: (i / n) * Math.PI * 2, haut: 0.15 + ((i * 37) % 70) / 100, v: 1.6 + (i % 4) * 0.25,
    }));
    g.majs.push((dt, t) => {
      for (const f of feuilles) {
        f.a += f.v * dt;
        const sin = Math.sin(f.a);
        f.s.setPosition(c.x + Math.cos(f.a) * w * 0.62, c.y - h * f.haut + sin * w * 0.16 + Math.sin(t * 2 + f.a) * 4);
        f.s.setRotation(f.a * 1.7).setDepth(sin > 0 ? devant : derriere).setAlpha(0.65 + 0.35 * sin);
      }
    });
    g.garder(scene.add.particles(c.x, c.y - h * 0.3, 'fx:doux', {
      emitZone: zone(w * 0.5, h * 0.3), lifespan: 900, speedX: { min: 60, max: 120 }, speedY: { min: -20, max: 0 },
      scaleX: { start: 0.9, end: 0 }, scaleY: 0.1, alpha: { start: 0.75, end: 0 }, tint: T.clair, blendMode: 'ADD', frequency: freq(110),
    }).setDepth(devant));
  }

  if (el === 'bonta') {
    // Rayons de lumière qui tournent lentement derrière le monstre
    const rayons = Array.from({ length: 6 }, (_, i) => g.garder(scene.add.image(c.x, cy, 'fx:rayon').setOrigin(0.5, 1).setTint(T.vif)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDisplaySize(w * 0.4, h * 1.1).setRotation((i / 6) * Math.PI * 2).setDepth(derriere - 1)));
    g.majs.push((_dt, t) => rayons.forEach((r, i) => r.setRotation((i / 6) * Math.PI * 2 + t * 0.3).setAlpha(0.22 + 0.13 * Math.sin(t * 2 + i))));
    g.garder(scene.add.particles(c.x, cy, 'fx:etincelle', {
      emitZone: zone(w * 0.5, h * 0.45), lifespan: { min: 600, max: 1100 }, speed: 4,
      scale: { start: 0, end: 0.7, ease: 'Sine.easeOut' }, alpha: { start: 1, end: 0 }, tint: [T.clair, T.vif], blendMode: 'ADD', frequency: freq(60),
    }).setDepth(devant));
  }

  if (el === 'brakmar') {
    for (const [prof, a] of [[derriere, 0.75], [devant, 0.5]] as const) {
      g.garder(scene.add.particles(c.x, c.y - h * 0.05, 'fx:fumee', {
        emitZone: zone(w * 0.38, h * 0.12), lifespan: { min: 1500, max: 2300 }, speedY: { min: -45, max: -20 }, speedX: { min: -10, max: 10 },
        scale: { start: 0.35 * (w / 120), end: 0.8 * (w / 120) }, alpha: { start: a, end: 0 }, rotate: { min: 0, max: 360 },
        tint: [T.sombre, T.vif, 0x1a0a2a], frequency: freq(170),
      }).setDepth(prof));
    }
    g.garder(scene.add.particles(c.x, cy, 'fx:etincelle', {
      emitZone: zone(w * 0.45, h * 0.4), lifespan: 700, speed: { min: 10, max: 40 },
      scale: { start: 0.55, end: 0 }, alpha: { start: 1, end: 0 }, tint: T.clair, blendMode: 'ADD', frequency: freq(110),
    }).setDepth(devant));
  }
  return g;
}

// ───────────── cercle runique au sol ─────────────

export function cercleRunique(scene: Phaser.Scene, el: Element, c: Corps, densite: number): Effet {
  preparerTextures(scene);
  const g = new Groupe(scene);
  const T = TEINTES[el];
  const rx = c.largeur * 0.72, ry = rx * 0.32;
  lueur(scene, g, c.x, c.y, rx * 1.1, ry * 1.2, T.vif, 0.45, c.y - 4);
  const gr = g.garder(scene.add.graphics().setDepth(c.y - 3).setBlendMode(Phaser.BlendModes.ADD));
  const runes = 12;
  g.majs.push((_dt, t) => {
    gr.clear();
    const a0 = t * 0.5;
    gr.lineStyle(2.5, T.vif, 0.9).strokeEllipse(c.x, c.y, rx * 2, ry * 2);
    gr.lineStyle(1.5, T.clair, 0.7).strokeEllipse(c.x, c.y, rx * 1.55, ry * 1.55);
    // Petits losanges qui tournent entre les deux cercles, et un hexagramme au centre
    for (let i = 0; i < runes; i++) {
      const a = a0 + (i / runes) * Math.PI * 2, r = 0.88;
      const x = c.x + Math.cos(a) * rx * r, y = c.y + Math.sin(a) * ry * r, s = 4 + (i % 3);
      gr.fillStyle(i % 3 ? T.vif : T.clair, 0.95).fillPoints([{ x, y: y - s * 0.7 }, { x: x + s, y }, { x, y: y + s * 0.7 }, { x: x - s, y }], true);
    }
    for (const sens of [0, Math.PI]) {
      const pts = [0, 1, 2].map((k) => {
        const a = -a0 * 0.6 + sens + (k / 3) * Math.PI * 2;
        return { x: c.x + Math.cos(a) * rx * 0.7, y: c.y + Math.sin(a) * ry * 0.7 };
      });
      gr.lineStyle(1.5, T.clair, 0.6).strokePoints(pts, true);
    }
  });
  // Quelques éclats qui montent du cercle
  g.garder(scene.add.particles(c.x, c.y, 'fx:etincelle', {
    emitZone: surLeBord(new Phaser.Geom.Ellipse(0, 0, rx * 2, ry * 2), 24),
    lifespan: 900, speedY: { min: -90, max: -40 }, scale: { start: 0.35, end: 0 }, alpha: { start: 1, end: 0 },
    tint: [T.clair, T.vif], blendMode: 'ADD', frequency: Math.max(20, 110 / densite),
  }).setDepth(c.y + 2));
  return g;
}

// ───────────── halo lumineux ─────────────

export function halo(scene: Phaser.Scene, el: Element, sprite: Phaser.GameObjects.Sprite, densite: number): Effet {
  const glow = sprite.preFX?.addGlow(TEINTES[el].vif, 3 * densite, 0, false, 0.1, 12);
  if (!glow) return { detruire: () => undefined };
  const t = scene.tweens.add({ targets: glow, outerStrength: 7 * densite, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  return { detruire: () => { t.remove(); sprite.preFX?.remove(glow); } };
}

// ───────────── moment de l'éveil ─────────────

export type StyleEveil = 'explosion' | 'pilier' | 'tourbillon';

/**
 * Transformation : l'énergie se rassemble, le monstre devient blanc, éclair, il change de forme (`changer`),
 * puis onde de choc et gerbe de particules. Durée ~2 s.
 */
export function eveil(scene: Phaser.Scene, el: Element, c: Corps, sprite: () => Phaser.GameObjects.Sprite | undefined, style: StyleEveil, changer: () => void) {
  preparerTextures(scene);
  const T = TEINTES[el];
  const cy = centre(c);
  const prof = 2500;
  const temp: { destroy(): void }[] = [];
  const garder = <O extends { destroy(): void }>(o: O) => { temp.push(o); return o; };

  // 1. L'énergie arrive
  if (style === 'explosion') {
    const e = garder(scene.add.particles(c.x, cy, 'fx:doux', {
      emitZone: surLeBord(new Phaser.Geom.Circle(0, 0, c.largeur * 1.2), 40),
      moveToX: c.x, moveToY: cy, lifespan: 700, scale: { start: 0.45, end: 0.1 }, alpha: { start: 0.2, end: 1 },
      tint: [T.clair, T.vif], blendMode: 'ADD', frequency: 14,
    }).setDepth(prof));
    scene.time.delayedCall(900, () => e.stop());
  } else if (style === 'pilier') {
    const p = garder(scene.add.image(c.x, c.y + 6, 'fx:rayon').setOrigin(0.5, 1).setTint(T.clair).setBlendMode(Phaser.BlendModes.ADD)
      .setDisplaySize(c.largeur * 0.15, 900).setAlpha(0).setDepth(prof));
    scene.tweens.add({ targets: p, alpha: 1, displayWidth: c.largeur * 1.3, duration: 900, ease: 'Cubic.easeIn' });
    scene.tweens.add({ targets: p, alpha: 0, delay: 1250, duration: 700 });
  } else {
    const n = 26;
    const pts = Array.from({ length: n }, (_, i) => garder(scene.add.image(c.x, c.y, 'fx:etincelle').setTint(i % 2 ? T.vif : T.clair)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(prof)));
    const debut = scene.time.now;
    const maj = () => {
      const u = (scene.time.now - debut) / 1000;
      pts.forEach((s, i) => {
        const a = u * 7 + (i / n) * Math.PI * 2, r = c.largeur * (0.8 - Math.min(0.7, u * 0.6)), hh = (i / n) * c.hauteur * 1.3 * Math.min(1, u);
        s.setPosition(c.x + Math.cos(a) * r, c.y - hh + Math.sin(a) * r * 0.3).setScale(0.5);
      });
    };
    scene.events.on('update', maj);
    garder({ destroy: () => scene.events.off('update', maj) });
  }

  // 2. Le monstre blanchit et gonfle
  const sp0 = sprite();
  if (sp0) {
    const sx = sp0.scaleX, sy = sp0.scaleY;
    scene.time.delayedCall(450, () => {
      sp0.setTintFill(0xffffff);
      scene.tweens.add({ targets: sp0, scaleX: sx * 1.12, scaleY: sy * 1.12, duration: 550, ease: 'Sine.easeIn' });
    });
  }

  // 3. Éclair, changement de forme, onde de choc et gerbe
  scene.time.delayedCall(1050, () => {
    for (const o of temp) o.destroy();
    scene.cameras.main.flash(180, 255, 255, 255);
    changer();
    const sp = sprite();
    if (sp) {
      sp.setTintFill(0xffffff);
      scene.time.delayedCall(160, () => sp.clearTint());
    }
    const flash = scene.add.image(c.x, cy, 'fx:doux').setTint(T.clair).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(c.largeur * 1.6, c.largeur * 1.6).setDepth(prof);
    scene.tweens.add({ targets: flash, alpha: 0, scale: flash.scale * 2.2, duration: 500, onComplete: () => flash.destroy() });
    for (const [k, d] of [[1.6, 0], [2.2, 120]] as const) {
      const onde = scene.add.ellipse(c.x, c.y, 20, 8).setStrokeStyle(4, T.vif, 1).setFillStyle().setDepth(prof).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: onde, width: c.largeur * k * 1.8, height: c.largeur * k * 0.55, alpha: 0, delay: d, duration: 700, ease: 'Cubic.easeOut', onComplete: () => onde.destroy() });
    }
    const gerbe = scene.add.particles(c.x, cy, 'fx:etincelle', {
      speed: { min: 120, max: 320 }, lifespan: 800, scale: { start: 0.6, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: 220,
      tint: [T.clair, T.vif, 0xffffff], blendMode: 'ADD', emitting: false,
    }).setDepth(prof);
    gerbe.explode(50);
    scene.time.delayedCall(1200, () => gerbe.destroy());
  });
}
