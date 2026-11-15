import Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import { peutEvoluer, type Joueur } from '../sim/joueur';
import { MINE, kamasEnMine, recolterMine } from '../sim/mine';
import { prochainStage } from '../sim/stages';
import { aRecevoir, noterMission } from '../sim/missions';
import { cadeaux, distribuer } from '../sim/reception';
import { Particules, type SysData } from './particules';
import { CHIFFRES, H, OR, POLICE, W, bouton, chargerUi, fmt, texte, texturePierreAme } from './ui';

/**
 * Île d'Incarnam, écran d'accueil (maquettes « Île : » et « Incarnam : » 1A 2A 3C 4A 5A 6A 7A 8A 9A).
 * L'île telle quelle, avec ses bâtiments à leur place ; nos bâtiments sont certains des siens.
 * Vivante comme Diablofus : nappes d'eau et de brume qui glissent, eau qui change de couleur, lueurs qui respirent,
 * particules officielles. Images faites hors dépôt (outil ile_vivante.py, d'après le monde exporté par Diablofus) dans public/assets/ile,
 * positions en px de cette image (ile.json, échelle K = 0,3 de la carte).
 *
 * Trois caméras : le ciel (fixe, derrière), l'île (glisser, zoomer), l'interface (fixe, devant).
 */
type Cadre = [number, number, number, number, number];
interface Eau { s: number; x: number; y: number; g: number; ph: number; t?: [number, number, number, number]; ca?: [number, number]; s2?: number }
interface Lumiere { s: number; x: number; y: number; w: number; h: number; b: string; k: number; sol: number; ph: number }
interface Donnees {
  W: number; H: number; x0: number; y0: number; K: number; cadres: Cadre[];
  eaux: Eau[]; lumieres: Lumiere[]; batiments: Record<IdBat, [number, number, number, number]>;
}
type IdBat = 'invoc' | 'amel' | 'bout' | 'mine' | 'temple' | 'gany' | 'zaap';

const NOMS: Record<IdBat, string> = {
  invoc: 'Cercle d\'invocation', amel: 'Cercle d\'amélioration', bout: 'Boutique', mine: 'Mine de kamas',
  temple: 'Temple des Douze', gany: 'Maison de Ganymède', zaap: 'Zaap',
};
const BIENTOT: Partial<Record<IdBat, string>> = {
  bout: 'La Boutique arrive bientôt : son stock changera toutes les heures.',
  temple: 'Le Temple des Douze arrive bientôt : un vœu par jour.',
  gany: 'Ganymède arrive bientôt : ses quêtes pour bien débuter et les missions du jour.',
};
/** Lueurs un peu sous Dofus : en plein jour, sur l'île vue de loin, les halos voilaient tout. */
const LUM = 0.75;
const P = { a0: 0, eauSol: 1, a1: 2, eau: 3, lumSol: 4, partSol: 5, b: 10, lum: 11, partHaut: 12 };

export class IleScene extends Phaser.Scene {
  private joueur!: Joueur;
  private D!: Donnees;
  private kNet = 1;
  private z = 0.6;
  private cam!: Phaser.Cameras.Scene2D.Camera;
  private camUi!: Phaser.Cameras.Scene2D.Camera;
  private monde!: Phaser.GameObjects.Layer;
  private ui!: Phaser.GameObjects.Layer;
  private ciel!: Phaser.GameObjects.Image;
  private eaux: { e: Eau; im: Phaser.GameObjects.Image; im2?: Phaser.GameObjects.Image }[] = [];
  private lumieres: { l: Lumiere; im: Phaser.GameObjects.Image }[] = [];
  private particules!: Particules;
  private etiquettes: { id: IdBat; c: Phaser.GameObjects.Container }[] = [];
  private bulleMine!: Phaser.GameObjects.Container;
  private texteMine!: Phaser.GameObjects.Text;
  private bourse!: Phaser.GameObjects.Text;
  private pierres!: Phaser.GameObjects.Text;
  private avis?: Phaser.GameObjects.Container;
  private t = 0;
  private glisse: { x: number; y: number; sx: number; sy: number; bouge: boolean } | null = null;
  private pince: { d: number; z: number } | null = null;
  private pastilleMissions!: Phaser.GameObjects.Container;

  constructor() { super('ile'); }

  init() { this.joueur = charger(); this.eaux = []; this.lumieres = []; this.etiquettes = []; this.glisse = null; this.pince = null; }

  preload() {
    chargerUi(this, []);
    const d = 'assets/ile/';
    this.load.json('ile', d + 'ile.json');
    for (const n of ['a0', 'a1', 'b', 'ciel', 'vif0']) if (!this.textures.exists('ile_' + n)) this.load.image('ile_' + n, `${d}${n}.webp`);
    this.load.json('ile_particules', d + 'particules.json');
    if (!this.textures.exists('ile_particules')) this.load.atlas('ile_particules', d + 'particules.webp', d + 'particules_atlas.json');
  }

  create() {
    this.D = this.cache.json.get('ile') as Donnees;
    const D = this.D;
    this.kNet = this.scale.width / W;
    texturePierreAme(this);
    this.input.addPointer(1);
    // la mine produit dès la première visite de l'île
    if (this.joueur.mine === undefined) this.joueur = { ...this.joueur, mine: Date.now() };
    // mission « Début de la journée »
    this.joueur = distribuer(noterMission(this.joueur, 'connexion', 1, Date.now()), Date.now());
    sauver(this.joueur);

    // morceaux vivants : un cadre par morceau dans l'atlas vif0
    const vif = this.textures.get('ile_vif0');
    D.cadres.forEach((c, i) => { if (!vif.has(String(i))) vif.add(String(i), 0, c[1], c[2], c[3], c[4]); });

    this.monde = this.add.layer();
    this.ui = this.add.layer().setDepth(10);
    this.ciel = this.add.image(W / 2, H / 2, 'ile_ciel');
    this.ciel.setScale(Math.max(W / this.ciel.width, H / this.ciel.height) * 1.2);

    const m = this.monde;
    m.add(this.add.image(0, 0, 'ile_a0').setOrigin(0).setDepth(P.a0));
    m.add(this.add.image(0, 0, 'ile_a1').setOrigin(0).setDepth(P.a1));
    m.add(this.add.image(0, 0, 'ile_b').setOrigin(0).setDepth(P.b));
    for (const e of D.eaux) {
      const im = this.add.image(e.x, e.y, 'ile_vif0', String(e.s)).setOrigin(0).setDepth(e.g ? P.eauSol : P.eau);
      const im2 = e.ca && e.s2 !== undefined ? this.add.image(e.x, e.y, 'ile_vif0', String(e.s2)).setOrigin(0).setDepth(e.g ? P.eauSol : P.eau).setAlpha(0) : undefined;
      m.add(im); if (im2) m.add(im2);
      this.eaux.push({ e, im, im2 });
    }
    for (const l of D.lumieres) {
      const im = this.add.image(l.x, l.y, 'ile_vif0', String(l.s)).setOrigin(0).setDisplaySize(l.w, l.h)
        .setBlendMode(l.b === 'a' ? Phaser.BlendModes.ADD : Phaser.BlendModes.SCREEN).setDepth(l.sol ? P.lumSol : P.lum);
      m.add(im);
      this.lumieres.push({ l, im });
    }
    this.particules = new Particules(this, this.cache.json.get('ile_particules') as SysData[], 'ile_particules', D.x0, D.y0, D.K, { sol: P.partSol, haut: P.partHaut });

    // caméras : le ciel (principale, cadrée par nettete.ts), l'île, l'interface
    this.cam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ile');
    this.camUi = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, 'ui');
    this.camUi.setZoom(this.kNet).centerOn(W / 2, H / 2);
    this.cameras.main.ignore([this.monde, this.ui]);
    this.cam.ignore(this.ciel); this.cam.ignore(this.ui);
    this.camUi.ignore(this.ciel); this.camUi.ignore(this.monde);
    // zoom mini : l'île couvre l'écran en largeur ; on démarre centré sur le cœur de l'île
    this.cam.setBounds(0, 0, D.W, D.H);
    this.z = Math.max(this.zMin(), 0.62);
    this.cam.setZoom(this.kNet * this.z);
    const a = D.batiments.amel, tp = D.batiments.temple;
    this.cam.centerOn((a[0] + tp[0]) / 2 + 100, (a[1] + tp[1] + tp[3]) / 2);

    this.interface();
    this.controles();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.off('wheel'));
  }

  private zMin() { return Math.max(W / this.D.W, H / this.D.H); }

  // ───────────── interface ─────────────

  private interface() {
    const j = this.joueur, u = this.ui;
    const plaque = (x: number, y: number, t: string, couleur = '#ffffff', ox = 0) =>
      texte(this, x, y, t, 15, couleur, true, ox, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    u.add(plaque(16, 14, 'Incarnam', '#ffe08a'));
    // Réception (maquette « Réception : » 1A, 7B) : sous le titre, avec le nombre de cadeaux
    const rec = plaque(16, 56, 'Réception', '#ffffff').setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('reception'));
    u.add(rec);
    const nbCadeaux = cadeaux(j, Date.now()).length;
    if (nbCadeaux) {
      const px = 16 + rec.width + 2, py = 56;
      u.add(this.add.circle(px, py, 12, 0xe8673f).setStrokeStyle(2, 0xffffff));
      u.add(this.add.text(px, py, String(nbCadeaux), { fontFamily: CHIFFRES, fontSize: '13px', color: '#ffffff' }).setOrigin(0.5));
    }
    this.bourse = plaque(W - 16, 14, '', '#ffe08a', 1);
    this.pierres = plaque(W - 16, 14, `${j.pierresAme} pierre${j.pierresAme > 1 ? 's' : ''} d'âme`, '#d9b3ff', 1);
    u.add([this.bourse, this.pierres]);
    this.majBourse();

    // étiquettes des bâtiments (taille fixe à l'écran, placées sous chaque bâtiment)
    const evo = j.monstres.some((m) => peutEvoluer(j, m.uid));
    const prochain = prochainStage(j);
    for (const id of Object.keys(NOMS) as IdBat[]) {
      const c = this.add.container(0, 0);
      const t = this.add.text(0, 0, NOMS[id], { fontFamily: POLICE, fontSize: '15px', fontStyle: '600', color: BIENTOT[id] ? '#c9cfc4' : '#ffffff' })
        .setOrigin(0.5).setShadow(0, 1, '#000', 3, false, true);
      const fond = this.add.rectangle(0, 0, t.width + 26, t.height + 12, 0x0c1410, 0.86).setStrokeStyle(1.5, BIENTOT[id] ? 0x4a5446 : 0xb08a3a);
      c.add([fond, t]);
      // pastille « ! » : quelque chose à faire là (maquette « Île : » 3)
      const pierres = j.pierresAme > 0 || Object.values(j.pierres).some((n) => n > 0);
      if ((id === 'amel' && evo) || (id === 'zaap' && prochain) || (id === 'invoc' && pierres)) {
        const px = fond.width / 2 - 2, py = -fond.height / 2 - 2;
        c.add(this.add.circle(px, py, 11, 0xe8673f).setStrokeStyle(2, 0xffffff));
        c.add(this.add.text(px, py, '!', { fontFamily: CHIFFRES, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5));
      }
      u.add(c);
      this.etiquettes.push({ id, c });
    }

    // bulle de la mine : les kamas qui attendent (on touche la mine pour les récolter)
    this.bulleMine = this.add.container(0, 0);
    const fondB = this.add.rectangle(0, 0, 120, 34, 0x0c1410, 0.9).setStrokeStyle(2, 0xe3b54c);
    const ic = this.add.image(-38, 0, 'kamas_tas').setDisplaySize(30, 30);
    this.texteMine = this.add.text(-18, 0, '', { fontFamily: CHIFFRES, fontSize: '16px', color: OR }).setOrigin(0, 0.5);
    this.bulleMine.add([fondB, ic, this.texteMine]);
    u.add(this.bulleMine);
    this.majMine();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.majMine() });

    // Combattre : ouvre la carte des combats (comme le Zaap)
    const b = bouton(this, W - 110, H - 46, 180, 56, 'Combattre', true, () => this.ouvrir('zaap'), 20);
    u.add([b.fond, b.t]);
    // Missions du jour (maquette « Missions : » 1A, pastille 9A)
    const bm = bouton(this, W - 300, H - 46, 160, 50, 'Missions', false, () => this.scene.start('missions'), 20);
    bm.t.setFontSize(17);
    this.pastilleMissions = this.add.container(W - 300 + 74, H - 46 - 22, [
      this.add.circle(0, 0, 11, 0xe8673f).setStrokeStyle(2, 0xffffff),
      this.add.text(0, 0, '!', { fontFamily: CHIFFRES, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5),
    ]).setDepth(25);
    u.add([bm.fond, bm.t, this.pastilleMissions]);
    this.majPastilleMissions();
    u.add(texte(this, 16, H - 14, 'Glisse pour te déplacer · molette ou deux doigts pour zoomer · touche un bâtiment', 12, '#e9efe6', false, 0, 1)
      .setBackgroundColor('rgba(8,14,11,0.7)').setPadding(8, 4, 8, 4));
  }

  private majPastilleMissions() { this.pastilleMissions.setVisible(aRecevoir(this.joueur, Date.now())); }

  private majBourse() {
    this.bourse.setText(`${fmt(this.joueur.kamas)} kamas`);
    this.pierres.setX(this.bourse.x - this.bourse.width - 8);
  }

  private majMine() {
    const n = kamasEnMine(this.joueur, Date.now());
    this.bulleMine.setVisible(n > 0);
    this.texteMine.setText(fmt(n)).setColor(n >= MINE.max ? '#ff9b7a' : OR);
    (this.bulleMine.list[0] as Phaser.GameObjects.Rectangle).setSize(this.texteMine.width + 70, 34).setOrigin(0.5);
    (this.bulleMine.list[1] as Phaser.GameObjects.Image).setX(-(this.texteMine.width + 70) / 2 + 20);
    this.texteMine.setX(-(this.texteMine.width + 70) / 2 + 40);
  }

  private recolter() {
    const r = recolterMine(this.joueur, Date.now());
    if (!r.kamas) { this.message(`La mine produit ${fmt(MINE.parHeure)} kamas par heure, ${fmt(MINE.max)} au plus. Reviens plus tard !`); return; }
    this.joueur = noterMission(r.joueur, 'mine', 1, Date.now()); sauver(this.joueur);
    this.majBourse(); this.majMine(); this.majPastilleMissions();
    const p = this.versEcran(this.D.batiments.mine[0] + this.D.batiments.mine[2] / 2, this.D.batiments.mine[1]);
    const t = texte(this, p.x, p.y, `+${fmt(r.kamas)} kamas`, 22, OR, true).setFontFamily(CHIFFRES);
    this.ui.add(t);
    this.tweens.add({ targets: t, y: p.y - 60, alpha: 0, duration: 1400, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  private ouvrir(id: IdBat) {
    if (id === 'mine') return this.recolter();
    if (id === 'amel') return this.scene.start('cercle');
    if (id === 'invoc') return this.scene.start('invocation');
    if (id === 'zaap') return this.scene.start('zaap');
    this.message(BIENTOT[id] ?? NOMS[id]);
  }

  private message(t: string) {
    this.avis?.destroy();
    const tx = this.add.text(0, 0, t, { fontFamily: POLICE, fontSize: '15px', color: '#ffffff', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
    const f = this.add.rectangle(0, 0, tx.width + 36, tx.height + 22, 0x0c1410, 0.92).setStrokeStyle(1.5, 0xb08a3a);
    const c = this.add.container(W / 2, H - 110, [f, tx]);
    this.ui.add(c);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 500, onComplete: () => c.destroy() });
  }

  // ───────────── glisser, zoomer, toucher ─────────────

  private controles() {
    const cam = this.cam;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const a = this.input.pointer1, b = this.input.pointer2;
      if (a.isDown && b.isDown) { this.pince = { d: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), z: this.z }; this.glisse = null; return; }
      this.glisse = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY, bouge: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const a = this.input.pointer1, b = this.input.pointer2;
      if (this.pince && a.isDown && b.isDown) {
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.zoomer(this.pince.z * (d / this.pince.d), (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      const g = this.glisse;
      if (!g || !p.isDown) return;
      if (Math.hypot(p.x - g.x, p.y - g.y) > 8 * this.kNet) g.bouge = true;
      if (g.bouge) cam.setScroll(g.sx - (p.x - g.x) / cam.zoom, g.sy - (p.y - g.y) / cam.zoom);
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.pince) { if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pince = null; return; }
      const g = this.glisse; this.glisse = null;
      if (!g || g.bouge) return;
      if (this.input.hitTestPointer(p).length) return;   // un bouton de l'interface a déjà répondu
      const w = cam.getWorldPoint(p.x, p.y);
      for (const id of Object.keys(NOMS) as IdBat[]) {
        const [x, y, l, h] = this.D.batiments[id];
        if (w.x >= x && w.x <= x + l && w.y >= y && w.y <= y + h) return this.ouvrir(id);
      }
      // l'étiquette compte aussi
      for (const e of this.etiquettes) if (e.c.getBounds().contains(p.x / this.kNet, p.y / this.kNet)) return this.ouvrir(e.id);
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomer(this.z * Math.pow(1.0015, -dy), p.x, p.y));
  }

  /** Zoom autour d'un point de l'écran (px du canevas). */
  private zoomer(z: number, sx: number, sy: number) {
    const cam = this.cam;
    z = Phaser.Math.Clamp(z, this.zMin(), 2.2);
    // le point sous le doigt reste en place : monde = scroll + demi-vue + (écran − demi-vue) / zoom
    const hw = cam.width / 2, hh = cam.height / 2;
    const wx = cam.scrollX + hw + (sx - hw) / cam.zoom, wy = cam.scrollY + hh + (sy - hh) / cam.zoom;
    this.z = z; cam.setZoom(this.kNet * z);
    cam.setScroll(wx - hw - (sx - hw) / cam.zoom, wy - hh - (sy - hh) / cam.zoom);
  }

  /** Point de l'île → point de l'interface (monde 1280 × 720). */
  private versEcran(x: number, y: number) {
    const cam = this.cam;
    return { x: ((x - cam.worldView.x) * cam.zoom) / this.kNet, y: ((y - cam.worldView.y) * cam.zoom) / this.kNet };
  }

  update(_t: number, dms: number) {
    const dt = Math.min(0.1, dms / 1000);
    this.t += dt;
    const t = this.t, D = this.D, cam = this.cam;
    // le ciel glisse un peu avec la vue (comme Diablofus)
    const fx = Phaser.Math.Clamp(cam.midPoint.x / D.W, 0, 1), fy = Phaser.Math.Clamp(cam.midPoint.y / D.H, 0, 1);
    this.ciel.setPosition(W / 2 + (0.5 - fx) * W * 0.18, H / 2 + (0.5 - fy) * H * 0.18);
    // nappes qui glissent et eau qui change de couleur (vitesses de Diablofus)
    for (const { e, im, im2 } of this.eaux) {
      let x = e.x, y = e.y;
      if (e.t) { const a = e.t[2] * Math.sin(t * Math.PI * 2 * Math.min(e.t[3] * 4, 0.15) + e.ph); x += e.t[0] * a * D.K; y -= e.t[1] * a * D.K; }
      im.setPosition(x, y);
      if (im2 && e.ca) im2.setPosition(x, y).setAlpha(e.ca[0] * (0.5 + 0.5 * Math.sin(t * Math.PI * e.ca[1] + e.ph)));
    }
    for (const { l, im } of this.lumieres) im.setAlpha(Math.min(1, LUM * l.k * (1 + 0.18 * Math.sin(t * 1.3 + l.ph))));
    this.particules.update(dt);
    // les particules nées depuis la dernière image rejoignent le calque de l'île (sinon les autres caméras les verraient)
    for (const o of this.children.list) if (o instanceof Phaser.GameObjects.Image && o.texture.key === 'ile_particules') this.monde.add(o);
    // étiquettes et bulle de la mine suivent les bâtiments
    for (const { id, c } of this.etiquettes) {
      const [x, y, l, h] = D.batiments[id], p = this.versEcran(x + l / 2, y + h);
      c.setPosition(p.x, p.y + 4);
    }
    const mi = D.batiments.mine, pm = this.versEcran(mi[0] + mi[2] / 2, mi[1]);
    this.bulleMine.setPosition(pm.x, pm.y - 6);
  }
}
