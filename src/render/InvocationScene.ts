import Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import type { Joueur } from '../sim/joueur';
import {
  FRAGMENTS_TRANSCENDANCE, ORDRE_PIERRES, PIERRES, assemblerTranscendante, invoquer, nombre, refus,
  type Invoque, type Pierre,
} from '../sim/invocation';
import { fiche, monstreCombat } from '../sim/fiches';
import { noterMission } from '../sim/missions';
import { LOOKS } from './looks';
import { creerAnimations } from './animations';
import { COULEUR, H, NOM_ELEMENT, NOM_TYPE, OR, POLICE, W, bouton, chargerUi, fmt, hex, monstreEnPied, portrait, texte, texteLeader } from './ui';

/**
 * Cercle d'invocation (maquette « Invocation : » 1A 2A 3A 4A 5C 6A 7B 8A 9A) : le Summonhenge de SW.
 * Pierres à gauche, cercle au centre ; animation longue (la pierre tombe, la lumière dit les étoiles), bouton « Passer » ;
 * le monstre en grand, étoiles une à une, « Nouveau ! », « Voir » sa fiche ; ×10 en grille.
 */
const COULEUR_PIERRE: Record<Pierre, number> = {
  ame: 0x8fd3ff, parfaite: 0xc58cff, feu: 0xff8a4a, eau: 0x4aa3e8, air: 0x6fcf5a, lumiere: 0xffe08a, legendaire: 0xffc02a, transcendante: 0xff6ad5,
};
const LUMIERE = (e: number) => (e >= 5 ? 0xffd23a : e === 4 ? 0xb47aff : 0x7ab4ff);
const CX = 770, CY = 380;

export class InvocationScene extends Phaser.Scene {
  private joueur!: Joueur;
  private pierre: Pierre = 'ame';
  private calque: Phaser.GameObjects.GameObject[] = [];
  private anneaux: Phaser.GameObjects.Graphics[] = [];
  private vitesse = 1;
  private etat: 'repos' | 'anim' | 'resultat' = 'repos';
  private avis?: Phaser.GameObjects.Container;
  private passer?: () => void;

  constructor() { super('invocation'); }

  init() { this.joueur = charger(); this.etat = 'repos'; this.vitesse = 1; this.anneaux = []; this.calque = []; }

  preload() {
    chargerUi(this, []);
    if (!this.textures.exists('zaap_incarnam')) this.load.image('zaap_incarnam', 'assets/zaap/incarnam.webp');
  }

  create() {
    for (const p of ORDRE_PIERRES) this.texturePierre(p);
    const fond = this.add.image(W / 2, H / 2, 'zaap_incarnam').setTint(0x50586a);
    fond.setScale(Math.max(W / fond.width, H / fond.height));
    this.add.rectangle(W / 2, H / 2, W, H, 0x050812, 0.35);
    // le cercle : trois anneaux et des runes qui tournent
    const r = [220, 175, 120];
    r.forEach((rr, i) => {
      const g = this.add.graphics({ x: CX, y: CY }).setDepth(5);
      g.lineStyle(i === 1 ? 2 : 3, 0xa0c8ff, 0.6).strokeCircle(0, 0, rr);
      if (i === 0) for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2; g.lineBetween(Math.cos(a) * (rr - 14), Math.sin(a) * (rr - 14), Math.cos(a) * (rr - 4), Math.sin(a) * (rr - 4)); }
      if (i === 1) for (let k = 0; k < 36; k += 2) { const a = (k / 36) * Math.PI * 2, b = ((k + 1) / 36) * Math.PI * 2; g.beginPath(); g.arc(0, 0, rr, a, b); g.strokePath(); }
      this.anneaux.push(g);
    });
    this.add.ellipse(CX, CY, 440, 440, 0x7ab4ff, 0.06).setDepth(4);
    this.dessiner();
  }

  update(_t: number, dms: number) {
    const d = dms / 1000;
    this.anneaux.forEach((g, i) => { g.rotation += d * this.vitesse * (i === 1 ? -0.35 : 0.22 + i * 0.25); });
  }

  // ───────────── écran au repos ─────────────

  private garder<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }
  private t(x: number, y: number, s: string, taille = 14, couleur = '#e9efe6', gras = false, ox = 0.5, oy = 0, prof = 1000) {
    return this.garder(texte(this, x, y, s, taille, couleur, gras, ox, oy).setDepth(prof));
  }
  private plaque(x: number, y: number, s: string, couleur = '#ffffff', ox = 0) {
    return this.t(x, y, s, 15, couleur, true, ox, 0).setBackgroundColor('rgba(8,14,11,0.86)').setPadding(12, 7, 12, 7);
  }

  private vider() { for (const o of this.calque) o.destroy(); this.calque = []; }

  private dessiner() {
    this.vider();
    const j = this.joueur;
    const ret = this.plaque(16, 14, '‹ Incarnam', '#ffe08a');
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.etat === 'repos' && this.scene.start('ile'));
    this.plaque(W / 2, 14, 'Cercle d\'invocation', '#ffffff', 0.5);
    this.plaque(W - 16, 14, `${fmt(j.kamas)} kamas`, '#ffe08a', 1);
    if (this.etat !== 'repos') return;

    // pierres, en colonne à gauche (1A)
    const visibles = ORDRE_PIERRES.filter((p) => p === 'ame' || p === 'parfaite' || nombre(j, p) > 0);
    visibles.forEach((p, i) => {
      const y = 92 + i * 62, on = p === this.pierre, n = nombre(j, p);
      const r = this.garder(this.add.rectangle(170, y, 300, 54, on ? 0x1d2a20 : 0x0c1410, 0.92).setStrokeStyle(1.5, on ? 0xe3b54c : 0x3c5045).setDepth(900));
      this.garder(this.add.image(46, y, `pierre_${p}`).setDisplaySize(38, 38).setDepth(901).setAlpha(n ? 1 : 0.4));
      this.t(74, y - 18, PIERRES[p].nom, 14, n ? '#ffffff' : '#7d8a80', true, 0, 0, 901);
      const ch = PIERRES[p].chances.map(([e]) => e);
      this.t(74, y + 2, `${ch[0]}${ch.length > 1 ? `-${ch[ch.length - 1]}` : ''}★ · ${PIERRES[p].elements.map((e) => NOM_ELEMENT[e]).join(', ')}`, 11, '#9fb3a6', false, 0, 0, 901);
      this.t(306, y - 10, `${n}`, 18, OR, true, 1, 0, 901);
      r.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.pierre = p; this.dessiner(); });
    });
    // fragments de pierre transcendante
    const yf = 92 + visibles.length * 62 + 6;
    this.t(26, yf, `Fragments transcendants : ${j.fragments} / ${FRAGMENTS_TRANSCENDANCE}`, 12, '#ffb6ec', true, 0, 0, 901);
    if (j.fragments >= FRAGMENTS_TRANSCENDANCE) {
      const b = bouton(this, 170, yf + 40, 240, 36, 'Assembler une pierre', false, () => { this.joueur = assemblerTranscendante(this.joueur); sauver(this.joueur); this.pierre = 'transcendante'; this.dessiner(); }, 1001);
      this.garder(b.fond); this.garder(b.t);
    }

    // chances de la pierre choisie, sous le cercle
    const p = this.pierre;
    this.t(CX, CY + 224, PIERRES[p].chances.map(([e, c]) => `${e}★ ${String(c).replace('.', ',')} %`).join('   ·   '), 13, '#c9cfc4', false, 0.5, 0, 1000);

    // boutons Invoquer ×1 et ×10 (4A), coût en kamas (9A)
    const essai = (n: number) => {
      const r = refus(this.joueur, p, n);
      if (r === 'pierres') return this.message(nombre(this.joueur, p) ? `Il te faut ${n} ${PIERRES[p].nom.toLowerCase()}s.` : `Tu n'as pas de ${PIERRES[p].nom.toLowerCase()}.`);
      if (r === 'kamas') return this.message(`Il te faut ${fmt(PIERRES[p].cout * n)} kamas.`);
      if (r === 'places') return this.message('Ta collection est pleine : sers-toi de monstres au Cercle d\'amélioration (nourrir ou évoluer).');
      this.lancer(n);
    };
    const b1 = bouton(this, CX - 120, H - 62, 220, 58, `Invoquer`, true, () => essai(1), 1001);
    const b10 = bouton(this, CX + 120, H - 62, 220, 58, `Invoquer ×10`, true, () => essai(10), 1001);
    for (const b of [b1, b10]) { this.garder(b.fond); this.garder(b.t); b.t.setY(b.t.y - 7); }
    this.t(CX - 120, H - 52, `${fmt(PIERRES[p].cout)} kamas`, 11, '#eaffd0', false, 0.5, 0, 1003);
    this.t(CX + 120, H - 52, `${fmt(PIERRES[p].cout * 10)} kamas`, 11, '#eaffd0', false, 0.5, 0, 1003);
    if (refus(j, p, 1)) b1.griser();
    if (refus(j, p, 10)) b10.griser();

    // collection
    this.t(W - 20, H - 60, `Collection : ${j.monstres.length} / ${j.places}`, 13, j.monstres.length >= j.places ? '#ff9b7a' : '#c9cfc4', true, 1, 0, 1000);
  }

  private message(s: string) {
    this.avis?.destroy();
    const tx = this.add.text(0, 0, s, { fontFamily: POLICE, fontSize: '15px', color: '#ffffff', wordWrap: { width: 520 }, align: 'center' }).setOrigin(0.5);
    const f = this.add.rectangle(0, 0, tx.width + 36, tx.height + 22, 0x0c1410, 0.94).setStrokeStyle(1.5, 0xb08a3a);
    const c = this.add.container(CX, H - 150, [f, tx]).setDepth(5000);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2400, duration: 500, onComplete: () => c.destroy() });
  }

  private texturePierre(p: Pierre) {
    const cle = `pierre_${p}`;
    if (this.textures.exists(cle)) return;
    const t = this.textures.createCanvas(cle, 64, 64)!;
    const c = t.context, col = hex(COULEUR_PIERRE[p]);
    const g = c.createLinearGradient(10, 6, 54, 60);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, col); g.addColorStop(1, '#141018');
    c.fillStyle = g; c.beginPath();
    c.moveTo(32, 4); c.lineTo(60, 26); c.lineTo(48, 60); c.lineTo(16, 60); c.lineTo(4, 26); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(32, 4); c.lineTo(44, 26); c.lineTo(20, 26); c.closePath(); c.fill();
    t.refresh();
  }

  // ───────────── animation (2A) ─────────────

  private lancer(n: number) {
    const r = invoquer(this.joueur, this.pierre, n, Date.now() & 0x7fffffff);
    this.joueur = noterMission(r.joueur, 'invoquer', n, Date.now());
    sauver(this.joueur);
    this.etat = 'anim';
    this.dessiner();
    // planches des monstres invoqués, chargées pendant l'animation
    const ids = [...new Set(r.invoques.map((m) => m.id))];
    let pret = false;
    const finChargement = () => { for (const id of ids) creerAnimations(this, LOOKS[id].atlas); pret = true; };
    chargerUi(this, ids);
    if (this.load.list.size) { this.load.once(Phaser.Loader.Events.COMPLETE, finChargement); this.load.start(); } else finChargement();

    const meilleur = Math.max(...r.invoques.map((m) => m.etoiles)), lum = LUMIERE(meilleur);
    const objets: Phaser.GameObjects.GameObject[] = [];
    const gemme = this.add.image(170, 92, `pierre_${this.pierre}`).setDisplaySize(44, 44).setDepth(3000);
    objets.push(gemme);
    this.tweens.add({ targets: gemme, x: CX, y: CY - 260, duration: 450, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: gemme, y: CY, scale: gemme.scale * 1.6, duration: 600, delay: 500, ease: 'Cubic.easeIn' });
    this.tweens.addCounter({ from: 1, to: 9, duration: 1200, delay: 400, onUpdate: (tw) => { this.vitesse = tw.getValue(); } });
    // colonne de lumière dont la couleur dit les étoiles
    const pilier = this.add.rectangle(CX, CY, 150, 10, lum, 0.55).setOrigin(0.5, 1).setDepth(2900).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const halo = this.add.circle(CX, CY, 60, lum, 0.5).setDepth(2899).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    objets.push(pilier, halo);
    this.tweens.add({ targets: pilier, alpha: 1, height: 700, displayHeight: 700, duration: 900, delay: 1100, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: halo, alpha: 1, scale: meilleur >= 5 ? 5 : 3.5, duration: 900, delay: 1100, onStart: () => gemme.setVisible(false) });
    const eclat = this.add.rectangle(W / 2, H / 2, W, H, lum, 0).setDepth(4000);
    objets.push(eclat);
    const duree = meilleur >= 5 ? 2900 : 2200;
    this.tweens.add({ targets: eclat, fillAlpha: 0.85, duration: 220, delay: duree - 300, yoyo: true });
    let fini = false;
    const montrer = () => {
      if (fini) return; fini = true;
      this.passer = undefined;
      const go = () => { for (const o of objets) o.destroy(); this.vitesse = 1; this.etat = 'resultat'; this.resultat(r.invoques); };
      if (pret) go(); else this.load.once(Phaser.Loader.Events.COMPLETE, () => this.time.delayedCall(0, go));
    };
    this.time.delayedCall(duree, montrer);
    this.passer = montrer;
    const p = bouton(this, W - 100, H - 44, 150, 44, 'Passer ▸▸', false, () => this.passer?.(), 4100);
    this.garder(p.fond); this.garder(p.t);
  }

  // ───────────── résultat (3A) ─────────────

  private resultat(inv: Invoque[]) {
    this.dessiner();
    if (inv.length === 1) {
      const m = inv[0], f = fiche(m.id), lum = LUMIERE(m.etoiles);
      this.garder(this.add.circle(CX, CY - 20, 150, lum, 0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(1500));
      const sp = this.garder(monstreEnPied(this, m.id, CX, CY + 70, 1.7).setDepth(1600));
      sp.setScale(0.1 * Math.sign(sp.scaleX), 0.1);
      const k = LOOKS[m.id].echelle * 1.7;
      this.tweens.add({ targets: sp, scaleX: k, scaleY: k, duration: 500, ease: 'Back.easeOut' });
      // étoiles qui s'allument une à une
      const y = CY + 110;
      for (let i = 0; i < m.etoiles; i++) {
        const e = this.t(CX + (i - (m.etoiles - 1) / 2) * 34, y, '★', 32, '#3a3a3a', true, 0.5, 0, 1700).setStroke('#000', 3);
        this.time.delayedCall(350 + i * 220, () => { e.setColor('#ffd23a'); this.tweens.add({ targets: e, scale: { from: 1.6, to: 1 }, duration: 250 }); });
      }
      this.t(CX, y + 46, f.nom, 24, '#ffffff', true, 0.5, 0, 1700);
      this.t(CX, y + 80, `${NOM_ELEMENT[f.element]} · ${NOM_TYPE[f.type]}`, 14, hex(COULEUR[f.element]), true, 0.5, 0, 1700);
      if (m.nouveau) this.t(CX + 150, y + 48, 'Nouveau !', 13, '#ffffff', true, 0, 0, 1701).setBackgroundColor('#e8673f').setPadding(8, 3, 8, 3);
      const voir = bouton(this, CX + 260, H - 62, 120, 50, 'Voir', false, () => this.fiche(m.id), 1001);
      this.garder(voir.fond); this.garder(voir.t);
    } else {
      inv.forEach((m, i) => {
        const x = CX - 2 * 120 + (i % 5) * 120, y = CY - 130 + Math.floor(i / 5) * 190, f = fiche(m.id);
        const bord = m.etoiles >= 5 ? 0xffd23a : m.etoiles === 4 ? 0xb47aff : 0x6f9fd8;
        const c = this.garder(this.add.rectangle(x, y + 30, 108, 172, 0x0c1410, 0.94).setStrokeStyle(2.5, bord).setDepth(1500).setAlpha(0));
        const sp = portrait(this, m.id, x, y, 84, true, false, 1501);
        this.garder(sp.sp); this.calque.push(sp.masque); sp.sp.setAlpha(0);
        const st = this.t(x, y + 48, '★'.repeat(m.etoiles), 15, '#ffd23a', true, 0.5, 0, 1501).setAlpha(0);
        const nm = this.t(x, y + 70, f.nom, 11, '#ffffff', true, 0.5, 0, 1501).setWordWrapWidth(100).setAlign('center').setAlpha(0);
        const objs: Phaser.GameObjects.GameObject[] = [c, sp.sp, st, nm];
        if (m.nouveau) objs.push(this.t(x, y - 52, 'Nouveau !', 10, '#ffffff', true, 0.5, 0, 1502).setBackgroundColor('#e8673f').setPadding(5, 2, 5, 2).setAlpha(0));
        if (m.etoiles >= 4) objs.push(this.garder(this.add.circle(x, y, 56, bord, 0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(1499).setAlpha(0)));
        this.tweens.add({ targets: objs, alpha: 1, duration: 300, delay: i * 120 });
      });
    }
    const enc = bouton(this, CX - 80, H - 62, 180, 50, 'Encore', true, () => { this.etat = 'repos'; this.dessiner(); }, 1001);
    this.garder(enc.fond); this.garder(enc.t);
  }

  /** Fiche rapide du monstre qu'on vient d'avoir : sorts et leader. */
  private fiche(id: string) {
    const f = fiche(id), mc = monstreCombat(id);
    const objs: Phaser.GameObjects.GameObject[] = [];
    const fermer = () => objs.forEach((o) => o.destroy());
    objs.push(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(6000).setInteractive().on('pointerdown', fermer));
    objs.push(this.add.rectangle(W / 2, H / 2, 640, 460, 0x0c1410, 0.98).setStrokeStyle(2, 0xb08a3a).setDepth(6001));
    objs.push(texte(this, W / 2, 150, `${f.nom}  ${'★'.repeat(f.etoiles)}`, 22, '#ffffff', true).setDepth(6002));
    objs.push(texte(this, W / 2, 184, `${NOM_ELEMENT[f.element]} · ${NOM_TYPE[f.type]}`, 14, hex(COULEUR[f.element]), true).setDepth(6002));
    let y = 220;
    for (const s of mc.sorts) {
      objs.push(texte(this, 340, y, `${s.nom}${s.recharge ? `  (recharge ${s.recharge})` : ''}`, 15, OR, true, 0, 0).setDepth(6002));
      objs.push(texte(this, 340, y + 22, s.desc ?? '', 13, '#c9cfc4', false, 0, 0).setWordWrapWidth(600).setDepth(6002));
      y += 72;
    }
    if (mc.leader) objs.push(texte(this, 340, y + 4, `Leader : ${texteLeader(mc.leader)}`, 14, '#8fd3ff', true, 0, 0).setDepth(6002));
    objs.push(texte(this, W / 2, H / 2 + 206, 'Touche pour fermer', 12, '#9fb3a6').setDepth(6002));
  }
}
