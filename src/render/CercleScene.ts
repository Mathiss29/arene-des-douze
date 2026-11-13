import Phaser from 'phaser';
import { fiche, monstreCombat } from '../sim/fiches';
import { apercuNourrir, evoluer, monstre, nourrir, pointsNourriture, trierMonstres, type Joueur, type MonstrePossede } from '../sim/joueur';
import { ajouterXp, COUT_EVOLUTION, NIVEAU_MAX, NOURRITURE_MAX, pointsRequis, XP_NIVEAU, type Etoiles } from '../sim/progression';
import { Rng } from '../sim/rng';
import { LISTE_STAGES, stage } from '../sim/stages';
import { LOOKS } from './looks';
import { distant } from './assetUrl';
import { creerAnimations } from './animations';
import { preparerTextures } from './effets';
import { charger, sauver } from './sauvegarde';
import { bouton, caseSombre, chargerUi, CHIFFRES, COULEUR, fmt, H, monstreEnPied, NOM_TYPE, OR, panneau, portrait, texte, W } from './ui';

/**
 * Cercle d'amélioration (maquette « Évolution : » 1A…9A) : bâtiment de l'île où l'on nourrit (XP) et fait évoluer les monstres.
 * Le monstre choisi au centre, jusqu'à 5 cases de nourriture en arc au-dessus, la collection en bas.
 * Protégés (cadenas) : l'équipe toujours ; les 3★ et plus quand on nourrit (ils servent à l'évolution, avec confirmation).
 */

type Onglet = 'xp' | 'evo';
const PAR_PAGE = 13;
const ETOILE = '★';

export class CercleScene extends Phaser.Scene {
  private joueur!: Joueur;
  private onglet: Onglet = 'evo';
  private cible: number | null = null;
  private nourr: number[] = [];
  private page = 0;
  private alerte = '';
  private occupe = false;
  private calque: { destroy(): void }[] = [];
  private retour = LISTE_STAGES[0].id;
  /** Portraits des cases de nourriture (pour l'animation où ils volent vers le monstre). */
  private casesNourr: Phaser.GameObjects.Sprite[] = [];
  private sujet: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super('cercle');
  }

  init(data: { stage?: string; cible?: number }) {
    this.joueur = charger();
    if (data?.stage) this.retour = data.stage;
    this.cible = data?.cible ?? null;
    this.nourr = [];
    this.alerte = '';
    this.occupe = false;
  }

  preload() {
    const arene = stage(this.retour).arene;
    if (!this.textures.exists(`arene:${arene}`)) this.load.image(`arene:${arene}`, distant(arene));
    chargerUi(this, this.joueur.monstres.map((m) => m.id));
  }

  create() {
    this.calque = [];
    preparerTextures(this);
    const s = W / 2300;
    this.add.image(-520 * s, -600 * s, `arene:${stage(this.retour).arene}`).setOrigin(0).setScale(s);
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.72).setDepth(1);
    for (const id of new Set(this.joueur.monstres.map((m) => m.id))) creerAnimations(this, LOOKS[id].atlas);
    this.dessiner();
  }

  // ───────────── outils ─────────────

  private g<T extends { destroy(): void }>(o: T): T {
    this.calque.push(o);
    return o;
  }

  private t(x: number, y: number, s: string, taille = 14, couleur = '#e9efe6', gras = false, ox = 0.5, oy = 0) {
    return this.g(texte(this, x, y, s, taille, couleur, gras, ox, oy));
  }

  private etoiles = (n: number) => ETOILE.repeat(n);
  private cibleM = () => (this.cible === null ? null : monstre(this.joueur, this.cible));

  /** Cadenas : l'équipe, et les 3★ et plus quand on nourrit. */
  private verrou(m: MonstrePossede): string | null {
    if (this.joueur.equipe.includes(m.uid)) return 'Monstre de ton équipe : retire-le de l\'équipe pour le donner.';
    if (this.onglet === 'xp' && m.etoiles >= 3) return 'Les 3★ et plus sont gardés pour l\'évolution.';
    return null;
  }

  private positionCase(i: number) {
    const a = Math.PI * (1 - (i + 0.5) / NOURRITURE_MAX);
    return { x: 640 + Math.cos(a) * 228, y: 262 - Math.sin(a) * 112 };
  }

  // ───────────── actions ─────────────

  private changerOnglet(o: Onglet) {
    if (this.occupe) return;
    this.onglet = o;
    this.nourr = [];
    this.alerte = '';
    this.dessiner();
  }

  private clicCollection(m: MonstrePossede) {
    if (this.occupe) return;
    const c = this.cibleM();
    if (!c) { this.cible = m.uid; this.nourr = []; this.alerte = ''; this.dessiner(); return; }
    const i = this.nourr.indexOf(m.uid);
    if (i >= 0) { this.nourr.splice(i, 1); this.alerte = ''; this.dessiner(); return; }
    const v = this.verrou(m);
    if (v) { this.alerte = v; this.dessiner(); return; }
    if (this.onglet === 'evo') {
      if (c.etoiles >= 6) { this.alerte = 'Déjà 6★ : il ne peut plus évoluer.'; this.dessiner(); return; }
      if (m.etoiles > c.etoiles) { this.alerte = `La nourriture doit avoir ${c.etoiles}★ ou moins.`; this.dessiner(); return; }
      if (pointsNourriture(this.joueur, this.nourr) >= pointsRequis(c.etoiles as 1 | 2 | 3 | 4 | 5)) { this.alerte = 'Il y a déjà assez de points.'; this.dessiner(); return; }
    }
    if (this.nourr.length >= NOURRITURE_MAX) { this.alerte = `${NOURRITURE_MAX} monstres au plus.`; this.dessiner(); return; }
    this.nourr.push(m.uid);
    this.alerte = '';
    this.dessiner();
  }

  private pret(): boolean {
    const c = this.cibleM();
    if (!c || !this.nourr.length) return false;
    if (this.onglet === 'xp') return this.joueur.kamas >= apercuNourrir(this.joueur, this.nourr).kamas;
    if (c.etoiles >= 6) return false;
    const e = c.etoiles as 1 | 2 | 3 | 4 | 5;
    return pointsNourriture(this.joueur, this.nourr) >= pointsRequis(e) && this.joueur.kamas >= COUT_EVOLUTION[e];
  }

  private valider() {
    if (this.occupe || !this.pret()) return;
    const rares = this.nourr.filter((u) => monstre(this.joueur, u).etoiles >= 3);
    if (rares.length) this.confirmer(() => this.lancer());
    else this.lancer();
  }

  /** Confirmation quand la nourriture compte un 3★ ou plus (choix 8A). */
  private confirmer(ok: () => void) {
    const objets: { destroy(): void }[] = [];
    const D = 6000;
    const fermer = () => objets.forEach((o) => o.destroy());
    objets.push(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(D).setInteractive());
    objets.push(panneau(this, 390, 230, 500, 230, D + 1).lineStyle(2, 0xe3b54c).strokeRoundedRect(390, 230, 500, 230, 14));
    const c = this.cibleM()!;
    objets.push(texte(this, 640, 252, `${this.onglet === 'xp' ? 'Nourrir' : 'Faire évoluer'} ${fiche(c.id).nom} ?`, 20, '#ffe08a', true).setDepth(D + 2));
    objets.push(texte(this, 640, 292, 'Ces monstres disparaîtront :', 14, '#cfdccf').setDepth(D + 2));
    objets.push(texte(this, 640, 316, this.nourr.map((u) => { const m = monstre(this.joueur, u); return `${fiche(m.id).nom} ${this.etoiles(m.etoiles)}`; }).join(', '), 14, '#ffffff', true)
      .setWordWrapWidth(440).setAlign('center').setDepth(D + 2));
    const a = bouton(this, 560, 410, 150, 44, 'Annuler', false, fermer, D + 2);
    const b = bouton(this, 730, 410, 170, 48, 'Confirmer', true, () => { fermer(); ok(); }, D + 2);
    objets.push(a.fond, a.t, b.fond, b.t);
  }

  /** Les monstres donnés volent vers le monstre choisi, puis l'évolution ou le gain d'XP. */
  private lancer() {
    this.occupe = true;
    this.alerte = '';
    for (const o of this.calque) if (o instanceof Phaser.GameObjects.Text && (o.getData('nourr') || o.getData('titre') || o.getData('alerte'))) this.tweens.add({ targets: o, alpha: 0, duration: 250 });
    const sujet = this.sujet!;
    const cx = sujet.x, cy = sujet.y - 60;
    this.casesNourr.forEach((p, i) => {
      p.clearMask();
      this.tweens.add({ targets: p, x: cx, y: cy, scale: p.scale * 0.2, alpha: 0, duration: 480, delay: i * 70, ease: 'Cubic.easeIn' });
    });
    this.time.delayedCall(560 + this.casesNourr.length * 70, () => (this.onglet === 'evo' ? this.animerEvolution(cx, cy) : this.animerNourrir(cx, cy)));
  }

  private eclats(x: number, y: number, couleurs: number[], n: number) {
    const p = this.add.particles(x, y, 'fx:etincelle', { speed: { min: 80, max: 260 }, lifespan: 800, scale: { start: 0.6, end: 0 }, tint: couleurs, blendMode: 'ADD', emitting: false }).setDepth(3000);
    p.explode(n);
    this.time.delayedCall(1000, () => p.destroy());
  }

  /** Choix 7A : les étoiles s'allument une à une, puis un éclair. */
  private animerEvolution(cx: number, cy: number) {
    const c = this.cibleM()!;
    this.joueur = evoluer(this.joueur, c.uid, this.nourr);
    sauver(this.joueur);
    const total = c.etoiles + 1;
    const y = 412, larg = 26;
    const etoiles: Phaser.GameObjects.Text[] = [];
    this.calque.filter((o) => o instanceof Phaser.GameObjects.Text && (o as Phaser.GameObjects.Text).getData('etoiles')).forEach((o) => (o as Phaser.GameObjects.Text).setVisible(false));
    for (let i = 0; i < total; i++) {
      this.time.delayedCall(i * 260, () => {
        const s = this.add.text(640 + (i - (total - 1) / 2) * larg, y, ETOILE, { fontFamily: 'Lexend', fontSize: '28px', color: '#ffcf4a', resolution: 2 })
          .setOrigin(0.5).setStroke('#5a3a00', 4).setDepth(3001).setScale(0);
        etoiles.push(s);
        this.tweens.add({ targets: s, scale: 1, angle: { from: -90, to: 0 }, duration: 320, ease: 'Back.easeOut' });
        this.eclats(s.x, s.y, [0xffcf4a, 0xffffff], 10);
      });
    }
    this.time.delayedCall(total * 260 + 200, () => {
      this.cameras.main.flash(450, 255, 246, 200);
      this.eclats(cx, cy, [0xfff6c8, COULEUR[fiche(c.id).element], 0xffffff], 40);
      const nom = fiche(c.id).nom;
      const ban = this.add.text(640, 236, `${nom} passe à ${this.etoiles(total)} !`, { fontFamily: CHIFFRES, fontSize: '30px', color: '#ffcf4a', resolution: 2 })
        .setOrigin(0.5).setStroke('#3a2400', 6).setDepth(3002).setAlpha(0);
      this.tweens.add({ targets: ban, alpha: 1, y: 226, duration: 300 });
      this.tweens.add({ targets: ban, alpha: 0, delay: 1800, duration: 400, onComplete: () => ban.destroy() });
      this.time.delayedCall(700, () => {
        etoiles.forEach((s) => s.destroy());
        this.nourr = [];
        this.occupe = false;
        this.dessiner();
      });
    });
  }

  private animerNourrir(cx: number, cy: number) {
    const c = this.cibleM()!;
    const r = nourrir(this.joueur, c.uid, this.nourr, new Rng(Date.now()));
    this.joueur = r.joueur;
    sauver(this.joueur);
    this.eclats(cx, cy, [0x7ee07a, 0xffffff], 24);
    const lignes = [`+${fmt(r.xp)} XP`];
    if (r.bonus) lignes.push('Bonus ×1,5 !');
    if (r.niveaux > 0) lignes.push(r.niveaux > 1 ? `+${r.niveaux} NIVEAUX !` : 'NIVEAU SUPÉRIEUR !');
    lignes.forEach((l, i) => {
      const t = this.add.text(cx, cy - 40 - i * 30, l, { fontFamily: CHIFFRES, fontSize: i === 0 ? '24px' : '20px', color: i === 0 ? '#ffffff' : l.startsWith('Bonus') ? '#ffcf4a' : '#7ee07a', resolution: 2 })
        .setOrigin(0.5).setStroke('#10380e', 5).setDepth(3002).setScale(0.4);
      this.tweens.add({ targets: t, scale: 1, y: t.y - 16, duration: 380, delay: i * 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, delay: 1500 + i * 200, duration: 400, onComplete: () => t.destroy() });
    });
    if (r.niveaux > 0) this.cameras.main.flash(300, 200, 255, 200);
    this.time.delayedCall(700, () => { this.nourr = []; this.occupe = false; this.dessiner(); });
  }

  // ───────────── écran ─────────────

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    this.casesNourr = [];
    this.sujet = null;
    const j = this.joueur;
    const c = this.cibleM();
    const xp = this.onglet === 'xp';

    // En-tête
    const ret = this.t(16, 14, '‹ Préparation', 15, '#ffe08a', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => !this.occupe && this.scene.start('preparation', { stage: this.retour }));
    this.t(ret.x + ret.width + 10, 14, `Cercle d'amélioration · ${xp ? 'Nourrir' : 'Évoluer'}`, 15, '#ffffff', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    this.t(W - 16, 14, `${fmt(j.kamas)} kamas`, 15, '#ffe08a', true, 1, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    let ox = 640 - 95;
    for (const [o, nom] of [['xp', 'Nourrir'], ['evo', 'Évoluer']] as [Onglet, string][]) {
      const actif = this.onglet === o;
      const b = this.t(ox, 15, nom, 14, actif ? '#1d1405' : '#cfdccf', true, 0, 0).setBackgroundColor(actif ? '#e3b54c' : 'rgba(42,58,50,0.95)').setPadding(18, 7, 18, 7).setShadow(0, 0, '#000', 0);
      b.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.changerOnglet(o));
      ox += b.width + 8;
    }

    // Zone principale
    this.g(panneau(this, 20, 62, 1240, 448));
    if (!c) {
      this.t(640, 250, 'Choisis dans ta collection le monstre à améliorer.', 20, '#ffe08a', true);
      this.t(640, 284, xp ? 'Nourrir : il gagne l\'XP des monstres que tu lui donnes (jusqu\'à 5).' : 'Évoluer : il gagne une étoile et garde son niveau.', 14, '#9fb3a6');
    } else this.zoneCible(c, xp);

    // Bouton principal
    if (c) {
      const pret = this.pret();
      const cout = xp ? apercuNourrir(j, this.nourr).kamas : c.etoiles < 6 ? COUT_EVOLUTION[c.etoiles as 1 | 2 | 3 | 4 | 5] : 0;
      const b = bouton(this, 640, 545, 300, 54, `${xp ? 'Nourrir' : 'Évoluer'}  ·  ${fmt(cout)} kamas`, true, () => this.valider());
      this.g(b.fond); this.g(b.t);
      if (!pret || this.occupe) b.griser();
      if (!xp && c.etoiles < 6 && j.kamas < cout) this.alerte ||= `Il manque ${fmt(cout - j.kamas)} kamas.`;
    }
    if (this.alerte) this.t(640, 488, this.alerte, 13, '#ff8a7a', true).setBackgroundColor('rgba(0,0,0,0.6)').setPadding(10, 4, 10, 4).setData('alerte', true);

    this.collection(c);
  }

  private zoneCible(c: MonstrePossede, xp: boolean) {
    const j = this.joueur;
    const f = fiche(c.id);
    const e = c.etoiles as Etoiles;

    // Cases de nourriture en arc
    const req = e < 6 ? pointsRequis(e as 1 | 2 | 3 | 4 | 5) : 0;
    this.t(640, 78, xp ? `NOURRITURE · JUSQU'À ${NOURRITURE_MAX} MONSTRES` : `NOURRITURE · ${req} POINT${req > 1 ? 'S' : ''}, MONSTRES ${e}★ OU MOINS`, 12, OR, true).setData('titre', true);
    for (let i = 0; i < NOURRITURE_MAX; i++) {
      const { x, y } = this.positionCase(i);
      const uid = this.nourr[i];
      const cs = caseSombre(this, x, y, 78);
      this.g(cs.g); this.g(cs.zone);
      if (uid === undefined) { this.t(x, y, '+', 26, '#5d6f62', false, 0.5, 0.5); continue; }
      const m = monstre(j, uid);
      const p = portrait(this, m.id, x, y, 74, false);
      this.g(p.masque); this.g(p.sp);
      this.casesNourr.push(p.sp);
      this.t(x - 35, y - 39, this.etoiles(m.etoiles), 10, '#ffcf4a', false, 0).setDepth(1003).setData('nourr', true);
      this.t(x + 34, y + 37, String(m.niveau), 12, '#ffffff', true, 1, 1).setDepth(1003).setData('nourr', true);
      cs.zone.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.clicCollection(m));
    }

    // Monstre choisi
    this.g(this.add.ellipse(640, 380, 190, 52, COULEUR[f.element], 0.2).setStrokeStyle(3, COULEUR[f.element]).setDepth(999));
    this.sujet = this.g(monstreEnPied(this, c.id, 640, 380, 1.35).setDepth(1001));
    this.t(640, 396, this.etoiles(c.etoiles), 24, '#ffcf4a').setData('etoiles', true);
    this.t(640, 428, `${f.nom}`, 16, '#ffffff', true);
    this.t(640, 450, `Niv. ${c.niveau} / ${NIVEAU_MAX[e]} · ${NOM_TYPE[f.type]}`, 12, '#9fb3a6');
    const ch = this.t(150, 470, '↺ Changer de monstre', 12, '#cfdccf', true).setBackgroundColor('rgba(42,58,50,0.95)').setPadding(10, 5, 10, 5);
    ch.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (this.occupe) return; this.cible = null; this.nourr = []; this.alerte = ''; this.dessiner(); });

    // À droite : points ou XP, stats avant → après
    const sx = 935, sy = 196;
    if (xp) {
      const ap = apercuNourrir(j, this.nourr);
      const apres = ajouterXp(e, c.niveau, c.xp, ap.xp);
      const part = (n: number, x: number) => (n >= NIVEAU_MAX[e] ? 1 : x / XP_NIVEAU[e][n - 1]);
      this.t(sx, sy, 'XP REÇUE', 12, OR, true, 0);
      this.t(sx, sy + 22, this.nourr.length ? `+${fmt(ap.xp)} XP` : 'Choisis des monstres à donner', 18, '#ffffff', true, 0);
      this.t(sx, sy + 50, '20 % de chances de recevoir ×1,5', 11, '#9fb3a6', false, 0);
      const gb = this.g(this.add.graphics().setDepth(1001));
      gb.fillStyle(0x000000, 0.65).fillRoundedRect(sx, sy + 78, 300, 14, 6)
        .fillStyle(0x3d8cff).fillRoundedRect(sx, sy + 78, Math.max(4, 300 * part(apres.niveau, apres.xp)), 14, 6);
      if (this.nourr.length) this.t(sx, sy + 100, `Niv. ${c.niveau}  →  `, 15, '#cfdccf', false, 0);
      if (this.nourr.length) this.t(sx + 82, sy + 100, apres.niveau >= NIVEAU_MAX[e] ? `Niv. ${apres.niveau} (max)` : `Niv. ${apres.niveau}`, 15, apres.niveau > c.niveau ? '#7ee07a' : '#ffffff', true, 0);
      if (c.niveau >= NIVEAU_MAX[e]) this.t(sx, sy + 130, 'Déjà au niveau max : fais-le évoluer pour aller plus loin.', 11, '#ffcf4a', false, 0).setWordWrapWidth(310);
      return;
    }
    if (e >= 6) { this.t(sx, sy + 40, 'Déjà 6★ : niveau d\'évolution maximal.', 14, '#ffcf4a', true, 0); return; }
    const pts = pointsNourriture(j, this.nourr);
    this.t(sx, sy, `POINTS DE NOURRITURE`, 12, OR, true, 0);
    this.t(sx + 300, sy - 2, `${pts} / ${req}`, 16, pts >= req ? '#7ee07a' : '#ffffff', true, 1);
    const gb = this.g(this.add.graphics().setDepth(1001));
    gb.fillStyle(0x000000, 0.65).fillRoundedRect(sx, sy + 24, 300, 14, 6)
      .fillStyle(pts >= req ? 0x7ee07a : 0xe3b54c).fillRoundedRect(sx, sy + 24, Math.max(4, 300 * Math.min(1, pts / req)), 14, 6);
    this.t(sx, sy + 44, '1★ = 1 · 2★ = 2 · 3★ = 6 · 4★ = 24 · 5★ = 120', 11, '#9fb3a6', false, 0);
    // Stats : maintenant → après l'évolution (même niveau) → au nouveau niveau max
    const e2 = (e + 1) as Etoiles;
    const s0 = monstreCombat(c.id, e, c.niveau).stats, s1 = monstreCombat(c.id, e2, c.niveau).stats, s2 = monstreCombat(c.id, e2, NIVEAU_MAX[e2]).stats;
    const y0 = sy + 78;
    this.t(sx + 135, y0, `${e}★ niv. ${c.niveau}`, 10, '#9fb3a6', false, 1);
    this.t(sx + 225, y0, `${e2}★ niv. ${c.niveau}`, 10, '#9fb3a6', false, 1);
    this.t(sx + 310, y0, `${e2}★ niv. ${NIVEAU_MAX[e2]}`, 10, '#9fb3a6', false, 1);
    (['pv', 'atq', 'def'] as const).forEach((k, i) => {
      const y = y0 + 20 + i * 24;
      this.t(sx, y, { pv: 'PV', atq: 'Attaque', def: 'Défense' }[k], 13, '#9fb3a6', false, 0);
      this.t(sx + 135, y, fmt(s0[k]), 13, '#ffffff', true, 1);
      this.t(sx + 225, y, fmt(s1[k]), 13, '#7ee07a', true, 1);
      this.t(sx + 310, y, fmt(s2[k]), 13, '#7ee07a', true, 1);
    });
    this.t(sx, y0 + 96, 'Il garde son niveau : ses stats montent tout de suite.', 11, '#9fb3a6', false, 0);
  }

  private collection(c: MonstrePossede | null) {
    const j = this.joueur;
    this.g(panneau(this, 20, 584, 1240, 128));
    const liste = trierMonstres(j.monstres, 'etoiles').filter((m) => m.uid !== c?.uid);
    this.t(38, 596, c ? `MA COLLECTION · touche un monstre pour le donner` : 'MA COLLECTION · touche le monstre à améliorer', 12, OR, true, 0);
    const pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
    this.page = Math.min(this.page, pages - 1);
    liste.slice(this.page * PAR_PAGE, (this.page + 1) * PAR_PAGE).forEach((m, i) => {
      const x = 74 + i * 88, y = 662;
      const cs = caseSombre(this, x, y, 76);
      this.g(cs.g); this.g(cs.zone);
      const p = portrait(this, m.id, x, y, 72, false);
      this.g(p.masque); this.g(p.sp);
      const pris = this.nourr.includes(m.uid);
      const verrou = c ? this.verrou(m) : null;
      const interdit = c && this.onglet === 'evo' && m.etoiles > c.etoiles;
      if (pris || interdit) p.sp.setTint(pris ? 0x555555 : 0x3a3a3a);
      this.g(this.add.circle(x + 28, y - 28, 6, COULEUR[fiche(m.id).element]).setStrokeStyle(1.5, 0x000000).setDepth(1002));
      this.t(x - 34, y - 38, this.etoiles(m.etoiles), 10, '#ffcf4a', false, 0).setDepth(1003);
      const max = m.niveau >= NIVEAU_MAX[m.etoiles as Etoiles];
      this.t(x + 33, y + 36, max ? 'MAX' : String(m.niveau), max ? 11 : 12, max ? '#ffcf4a' : '#ffffff', true, 1, 1).setDepth(1003);
      if (pris) this.t(x, y, '✓', 28, '#7ee07a', true, 0.5, 0.5).setDepth(1004);
      if (verrou) {
        this.g(this.add.circle(x - 25, y + 25, 10, 0x1d2420).setStrokeStyle(1.5, 0x9fb3a6).setDepth(1003));
        this.t(x - 25, y + 25, '🔒', 10, '#ffffff', false, 0.5, 0.5).setDepth(1004);
      }
      cs.zone.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.clicCollection(m));
    });
    if (pages > 1) {
      const fl = (x: number, s: string, ok: boolean, f: () => void) => {
        const b = this.t(x, 596, s, 14, ok ? '#ffe08a' : '#4d5d53', true, 0.5, 0);
        if (ok) b.setInteractive({ useHandCursor: true }).on('pointerdown', f);
      };
      fl(1150, '◀', this.page > 0, () => { this.page--; this.dessiner(); });
      this.t(1190, 597, `${this.page + 1}/${pages}`, 12, '#cfdccf', true, 0.5, 0);
      fl(1230, '▶', this.page < pages - 1, () => { this.page++; this.dessiner(); });
    }
  }
}
