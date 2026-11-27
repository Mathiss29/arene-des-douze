import Phaser from 'phaser';
import { bandeauPierre, chargerIdentite, decorVivant } from './identite';
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
import { COULEUR, H, NOM_ELEMENT, NOM_TYPE, OR, POLICE, W, bouton, chargerUi, fmt, hex, monstreEnPied, poseNette, portrait, panneau, texte, texteLeader, plaqueRessource } from './ui';

/**
 * Cercle d'invocation (maquette « Invocation : » 1A 2A 3A 4A 5C 6A 7B 8A 9A) : le Summonhenge de SW.
 * Pierres à gauche, cercle au centre ; animation longue (la pierre tombe, la lumière dit les étoiles), bouton « Passer » ;
 * le monstre en grand, étoiles une à une, « Nouveau ! », « Voir » sa fiche ; ×10 en grille.
 */
const COULEUR_PIERRE: Record<Pierre, number> = {
  ame: 0x8fd3ff, parfaite: 0xc58cff, feu: 0xff8a4a, eau: 0x4aa3e8, air: 0x6fcf5a, lumiere: 0xffe08a, legendaire: 0xffc02a, transcendante: 0xff6ad5,
};
const LUMIERE = (e: number) => (e >= 5 ? 0xffd23a : e === 4 ? 0xb47aff : 0x7ab4ff);
const CX = 430, CY = 380;

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
    chargerIdentite(this);
  }

  create() {
    for (const p of ORDRE_PIERRES) this.texturePierre(p);
    // décor de pierre vivant, teinté du bleu du cercle
    decorVivant(this, CX).teinter(0x7ab4ff);
    bandeauPierre(this, 'Incarnam', () => this.etat === 'repos' && this.scene.start('ile'));
    texte(this, W / 2, 25, 'Cercle d\'invocation', 21, '#eef2e4', true, 0.5, 0.5).setDepth(2001);
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

  private vider() { for (const o of this.calque) o.destroy(); this.calque = []; }

  private dessiner() {
    this.vider();
    const j = this.joueur;
    this.garder(plaqueRessource(this, W - 18, 8, 'icone_kama', fmt(j.kamas), '#ffe08a', 1, 2001).c);
    if (this.etat !== 'repos') return;

    // comme le Summonhenge de SW : la collection en haut à gauche, la pierre choisie au-dessus du cercle, la liste des pierres dans une fenêtre à droite
    this.t(20, 70, `Monstres ${j.monstres.length} / ${j.places}`, 14, j.monstres.length >= j.places ? '#ff9b7a' : '#dfe8d6', true, 0, 0, 1000);
    const PX = 866, PL = 394;
    this.garder(panneau(this, PX, 62, PL, 644));
    this.t(PX + PL / 2, 92, 'Pierres d\'invocation', 16, '#ffffff', true, 0.5, 0.5, 1001);
    ORDRE_PIERRES.forEach((p, i) => {
      const y = 142 + i * 64, on = p === this.pierre, n = nombre(j, p);
      const g = this.garder(this.add.graphics().setDepth(1000));
      g.fillStyle(on ? 0x2f3a16 : 0x161b13).fillRoundedRect(PX + 24, y - 28, PL - 48, 56, 8).lineStyle(on ? 2.5 : 1.5, on ? 0xb9e61c : 0x4a5a3c).strokeRoundedRect(PX + 24, y - 28, PL - 48, 56, 8);
      this.garder(this.add.image(PX + 58, y, `pierre_${p}`).setDisplaySize(52, 52).setDepth(1001).setAlpha(n ? 1 : 0.45));
      const ch = PIERRES[p].chances.map(([e]) => e);
      this.t(PX + 90, y - 20, `${PIERRES[p].nom} (${ch[0]}${ch.length > 1 ? `-${ch[ch.length - 1]}` : ''}★)`, 14, n ? '#ffffff' : '#7d8a80', true, 0, 0, 1001);
      this.t(PX + 90, y + 2, PIERRES[p].elements.map((e) => NOM_ELEMENT[e]).join(', '), 11, '#93a89b', false, 0, 0, 1001);
      this.t(PX + PL - 40, y, `${n}`, 18, n ? OR : '#5f6a5c', true, 1, 0.5, 1001);
      this.garder(this.add.zone(PX + 24, y - 30, PL - 48, 60).setOrigin(0).setDepth(1002).setInteractive({ useHandCursor: true })).on('pointerdown', () => { this.pierre = p; this.dessiner(); });
    });
    // fragments de pierre transcendante, comme « Pièces : 160/300 »
    const yf = 142 + ORDRE_PIERRES.length * 64 - 8;
    this.garder(this.add.image(PX + 42, yf, 'icone_fragment').setDisplaySize(30, 30).setDepth(1001));
    this.t(PX + 64, yf, `Fragments transcendants : ${j.fragments} / ${FRAGMENTS_TRANSCENDANCE}`, 12.5, '#ffb6ec', true, 0, 0.5, 1001);
    if (j.fragments >= FRAGMENTS_TRANSCENDANCE) {
      const b = bouton(this, PX + PL / 2, yf + 40, 240, 36, 'Assembler une pierre', false, () => { this.joueur = assemblerTranscendante(this.joueur); sauver(this.joueur); this.pierre = 'transcendante'; this.dessiner(); }, 1001);
      this.garder(b.fond); this.garder(b.t);
    }
    // la pierre choisie, au-dessus du cercle
    this.garder(this.add.image(CX - 86, 92, `pierre_${this.pierre}`).setDisplaySize(56, 56).setDepth(1001));
    this.t(CX - 58, 92, `${PIERRES[this.pierre].nom}  ×${nombre(j, this.pierre)}`, 16, '#ffffff', true, 0, 0.5, 1001);

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
      // la pose nette remplace le sprite de la planche (flou une fois agrandi) ; si elle arrive après, elle prend sa place à la fin de l'apparition
      const tard = () => this.time.delayedCall(520, () => { if (sp.active) { const p = poseNette(this, m.id, sp); if (p) this.garder(p); } });
      const pose = poseNette(this, m.id, sp, tard);
      if (pose) this.garder(pose);
      const acteur = pose ?? sp, kx = acteur.scaleX, ky = acteur.scaleY;
      acteur.setScale(kx * 0.06, ky * 0.06);
      this.tweens.add({ targets: acteur, scaleX: kx, scaleY: ky, duration: 500, ease: 'Back.easeOut' });
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
