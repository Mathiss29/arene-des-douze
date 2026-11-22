import Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import type { Joueur } from '../sim/joueur';
import {
  CHOIX_5, DEFIS, PALIERS, avancement, coffreRecu, defiFini, defiRecu, nbQuetes, nbRecues, palierFini, palierOuvert, peutRecevoirQuete,
  queteRecue, recevoirCoffre, recevoirDefi, recevoirQuete, type Palier, type Quete,
} from '../sim/chemin';
import { fiche } from '../sim/fiches';
import { H, OR, POLICE, W, bouton, chargerUi, panneau, portrait, texte, texteContenu } from './ui';

/**
 * Chemin de l'invocateur (maquette « Chemin : » 1A…10A) : onglets Progression (Novice, Intermédiaire, Avancé) et Défis,
 * cartes de quêtes avec « Recevoir », « Y aller » ou « Terminé », coffre de fin de palier, Ganymède qui explique la quête choisie.
 */
const PAR_PAGE = 8;

export class CheminScene extends Phaser.Scene {
  private joueur!: Joueur;
  private onglet: 'progression' | 'defis' = 'progression';
  private palier = 0;
  private page = 0;
  private choisie: Quete | null = null;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;

  constructor() { super('chemin'); }

  init() {
    this.joueur = charger(); this.calque = []; this.page = 0; this.choisie = null; this.onglet = 'progression';
    // le premier palier pas fini
    const i = PALIERS.findIndex((p) => !palierFini(this.joueur, p) || !coffreRecu(this.joueur, p));
    this.palier = i < 0 ? PALIERS.length - 1 : i;
  }

  preload() {
    chargerUi(this, []); // portraits : vignettes seulement
    if (!this.textures.exists('pnj_ganymede')) this.load.image('pnj_ganymede', 'assets/ui/pnj_ganymede.webp');
    if (!this.textures.exists('zaap_incarnam')) this.load.image('zaap_incarnam', 'assets/zaap/incarnam.webp');
  }

  create() {
    const fond = this.add.image(W / 2, H / 2, 'zaap_incarnam').setTint(0x5a6450);
    fond.setScale(Math.max(W / fond.width, H / fond.height));
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.45);
    const ret = texte(this, 16, 14, '‹ Incarnam', 15, '#ffe08a', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ile'));
    texte(this, ret.x + ret.width + 10, 14, 'Chemin de l\'invocateur', 15, '#ffffff', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    this.dessiner();
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }

  private faire(f: (j: Joueur) => Joueur, msg?: string) {
    try { this.joueur = f(this.joueur); sauver(this.joueur); if (msg) this.message(msg); } catch (e) { this.message((e as Error).message); }
    this.dessiner();
  }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur;

    // Ganymède et l'avancement
    this.g(panneau(this, 20, 60, 300, 640));
    this.g(this.add.image(170, 170, 'pnj_ganymede').setDisplaySize(150, 142).setDepth(1001));
    const q = this.choisie;
    const bulle = q ? (q.desc || q.titre) : 'Suis le chemin : chaque quête t\'apprend quelque chose et te rapporte de quoi devenir plus fort.';
    this.g(texte(this, 40, 254, 'Ganymède', 14, OR, true, 0, 0));
    this.g(texte(this, 40, 278, bulle, 13, '#e9efe6', false, 0, 0).setWordWrapWidth(260));
    const n = nbRecues(j), tot = nbQuetes();
    this.g(texte(this, 40, 610, `${n} / ${tot} quêtes`, 14, '#ffffff', true, 0, 0));
    this.g(this.add.rectangle(40, 640, 260, 10, 0x1c2823).setOrigin(0, 0.5).setStrokeStyle(1, 0x4e5e52).setDepth(1000));
    this.g(this.add.rectangle(40, 640, (260 * n) / tot, 10, 0x7fd05a).setOrigin(0, 0.5).setDepth(1001));

    // onglets
    this.g(panneau(this, 340, 60, 920, 640));
    [['progression', 'Progression'], ['defis', 'Défis']].forEach(([o, nom], i) => {
      const actif = this.onglet === o;
      const t = this.g(texte(this, 360 + i * 150, 76, nom, 15, actif ? '#1d1405' : '#cfdccf', true, 0, 0).setBackgroundColor(actif ? '#e3b54c' : 'rgba(42,58,50,0.95)').setPadding(18, 7, 18, 7).setShadow(0, 0, '#000', 0));
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.onglet = o as 'progression' | 'defis'; this.page = 0; this.choisie = null; this.dessiner(); });
    });
    if (this.onglet === 'progression') this.progression(); else this.defis();
  }

  private progression() {
    const j = this.joueur;
    PALIERS.forEach((p, i) => {
      const actif = i === this.palier, ouvert = palierOuvert(j, p);
      const t = this.g(texte(this, 700 + i * 170, 80, `${ouvert ? '' : '🔒 '}${p.nom}`, 14, actif ? '#ffe08a' : ouvert ? '#cfdccf' : '#6f7a6c', true, 0, 0)
        .setBackgroundColor(actif ? 'rgba(80,64,20,0.95)' : 'rgba(20,30,25,0.9)').setPadding(12, 6, 12, 6));
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.palier = i; this.page = 0; this.choisie = null; this.dessiner(); });
    });
    const p = PALIERS[this.palier];
    const ouvert = palierOuvert(j, p);
    // coffre du palier
    const faites = p.quetes.filter((q) => queteRecue(j, q)).length;
    this.g(texte(this, 360, 130, `${p.nom} · ${faites} / ${p.quetes.length}`, 14, '#ffffff', true, 0, 0.5));
    this.g(this.add.rectangle(560, 130, 380, 10, 0x1c2823).setOrigin(0, 0.5).setStrokeStyle(1, 0x4e5e52).setDepth(1000));
    this.g(this.add.rectangle(560, 130, (380 * faites) / p.quetes.length, 10, 0xe3b54c).setOrigin(0, 0.5).setDepth(1001));
    this.g(texte(this, 960, 130, `Coffre : ${texteContenu(p.coffre)}`, 12, '#d9b3ff', false, 0, 0.5));
    if (palierFini(j, p) && !coffreRecu(j, p)) {
      const b = bouton(this, 1190, 130, 110, 30, 'Ouvrir', true, () => this.faire((k) => recevoirCoffre(k, p.id, Date.now()), `Coffre du palier ${p.nom} : ${texteContenu(p.coffre)}`));
      b.t.setFontSize(13); this.g(b.fond); this.g(b.t);
    } else if (coffreRecu(j, p)) this.g(texte(this, 1240, 130, 'Ouvert', 12, '#7fd05a', true, 1, 0.5));
    if (!ouvert) this.g(texte(this, 800, 400, `Termine le palier ${PALIERS[this.palier - 1].nom} pour ouvrir celui-ci.`, 16, '#ffe08a', true, 0.5, 0.5));
    this.liste(p.quetes, ouvert, p);
  }

  private liste(quetes: Quete[], ouvert: boolean, p?: Palier) {
    const j = this.joueur;
    const pages = Math.max(1, Math.ceil(quetes.length / PAR_PAGE));
    this.page = Math.min(this.page, pages - 1);
    quetes.slice(this.page * PAR_PAGE, (this.page + 1) * PAR_PAGE).forEach((q, k) => {
      const y = 182 + k * 58, recue = queteRecue(j, q), prete = peutRecevoirQuete(j, q), a = avancement(j, q.condition);
      const sel = this.choisie === q;
      const f = this.g(this.add.rectangle(360, y, 880, 50, sel ? 0x2c3a2a : k % 2 ? 0x16211c : 0x1a2620).setOrigin(0, 0.5).setStrokeStyle(sel ? 2 : 0, 0xe3b54c).setDepth(1000));
      f.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.choisie = q; this.dessiner(); });
      const c = !ouvert ? '#6f7a6c' : recue ? '#8a9488' : '#ffffff';
      this.g(texte(this, 378, y - 10, q.titre, 15, c, false, 0, 0.5));
      this.g(texte(this, 378, y + 12, texteContenu(q.recompense), 12, ouvert ? '#d9b3ff' : '#5f6a5c', false, 0, 0.5));
      if (a.objectif > 1) this.g(texte(this, 990, y, `${a.fait} / ${a.objectif}`, 13, '#c9cfc4', false, 1, 0.5));
      if (!ouvert) return;
      if (recue) this.g(texte(this, 1160, y, 'Terminé', 13, '#7fd05a', true, 0.5, 0.5));
      else if (prete) {
        const b = bouton(this, 1160, y, 130, 34, 'Recevoir', true, () => {
          if (q.recompense.choix5) return this.choix5(q);
          this.faire((k2) => recevoirQuete(k2, q.id, Date.now()), `Reçu : ${texteContenu(q.recompense)}`);
        });
        b.t.setFontSize(14); this.g(b.fond); this.g(b.t);
      } else {
        const b = bouton(this, 1160, y, 130, 34, 'Y aller', false, () => this.scene.start(q.ecran));
        this.g(b.fond); this.g(b.t);
      }
    });
    if (pages > 1) {
      this.g(texte(this, 800, 668, `${this.page + 1} / ${pages}`, 13, '#c9cfc4', false, 0.5, 0.5));
      if (this.page > 0) { const b = bouton(this, 720, 668, 60, 30, '‹', false, () => { this.page--; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
      if (this.page < pages - 1) { const b = bouton(this, 880, 668, 60, 30, '›', false, () => { this.page++; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
    }
    void p;
  }

  private defis() {
    const j = this.joueur;
    DEFIS.forEach((d, i) => {
      const x = 360 + (i % 2) * 450, y = 124 + Math.floor(i / 2) * 290;
      this.g(this.add.rectangle(x, y, 430, 276, 0x16211c).setOrigin(0).setStrokeStyle(1.5, 0x4e5e52).setDepth(1000));
      this.g(texte(this, x + 16, y + 12, d.nom, 16, '#ffffff', true, 0, 0));
      this.g(texte(this, x + 16, y + 38, `Au bout : ${texteContenu(d.recompense)}`, 12, '#d9b3ff', false, 0, 0).setWordWrapWidth(300));
      if (d.recompense.monstre) { const p = portrait(this, d.recompense.monstre, x + 390, y + 34, 50, true); this.g(p.sp); this.g(p.masque); }
      d.etapes.forEach((q, k) => {
        const yy = y + 80 + k * 32, recue = queteRecue(j, q), prete = peutRecevoirQuete(j, q);
        this.g(texte(this, x + 16, yy, `${recue ? '✓' : prete ? '!' : '·'} ${q.titre}`, 13, recue ? '#7fd05a' : prete ? '#ffe08a' : '#c9cfc4', recue || prete, 0, 0.5));
        this.g(texte(this, x + 280, yy, texteContenu(q.recompense), 11, '#93a89b', false, 0, 0.5));
        if (prete) {
          const b = bouton(this, x + 400, yy, 44, 24, '✓', true, () => this.faire((k2) => recevoirQuete(k2, q.id, Date.now()), `Reçu : ${texteContenu(q.recompense)}`));
          b.t.setFontSize(12); this.g(b.fond); this.g(b.t);
        }
      });
      if (defiRecu(j, d)) this.g(texte(this, x + 215, y + 256, 'Défi terminé !', 14, '#7fd05a', true, 0.5, 0.5));
      else if (defiFini(j, d)) {
        const b = bouton(this, x + 215, y + 254, 220, 32, 'Recevoir la récompense', true, () => this.faire((k2) => recevoirDefi(k2, d.id, Date.now()), `Défi ${d.nom} : ${texteContenu(d.recompense)} !`));
        b.t.setFontSize(13); this.g(b.fond); this.g(b.t);
      }
    });
  }

  /** 5★ au choix (finir Astrub en Enfer). */
  private choix5(q: Quete) {
    const calque: Phaser.GameObjects.GameObject[] = [];
    const k = <T extends Phaser.GameObjects.GameObject>(o: T): T => { calque.push(o); return o; };
    const fermer = () => calque.forEach((o) => o.destroy());
    k(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setDepth(4000).setInteractive());
    k(panneau(this, 240, 150, 800, 420, 4001));
    k(texte(this, W / 2, 172, 'Choisis ton monstre 5★', 22, '#ffffff', true, 0.5, 0).setDepth(4002));
    CHOIX_5.forEach((id, i) => {
      const x = 330 + (i % 5) * 155, y = 280 + Math.floor(i / 5) * 140;
      const p = portrait(this, id, x, y, 96, true, false, 4003);
      k(p.sp); k(p.masque);
      k(texte(this, x, y + 58, fiche(id).nom, 12, '#ffffff', true, 0.5, 0).setDepth(4003));
      const z = k(this.add.zone(x, y, 110, 110).setDepth(4004).setInteractive({ useHandCursor: true }));
      z.on('pointerdown', () => { fermer(); this.faire((j) => recevoirQuete(j, q.id, Date.now(), id), `${fiche(id).nom} te rejoint !`); });
    });
    const b = bouton(this, W / 2, 540, 140, 36, 'Plus tard', false, fermer, 4003);
    k(b.fond); k(b.t);
  }

  private message(s: string) {
    this.avis?.destroy();
    const tx = this.add.text(0, 0, s, { fontFamily: POLICE, fontSize: '15px', color: '#ffffff', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
    const f = this.add.rectangle(0, 0, tx.width + 36, tx.height + 22, 0x0c1410, 0.95).setStrokeStyle(1.5, 0xb08a3a);
    const c = this.add.container(W / 2, 40, [f, tx]).setDepth(5000);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2400, duration: 500, onComplete: () => c.destroy() });
  }
}
