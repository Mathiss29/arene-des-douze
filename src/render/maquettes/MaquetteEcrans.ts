import Phaser from 'phaser';
import MONSTRES from '../../data/monstres.json';
import type { FicheMonstre, Element } from '../../sim/types';
import { avantage } from '../../sim/types';
import { LOOKS } from '../looks';
import { atlasPlanche, distant, dossierPlanches } from '../assetUrl';
import { creerAnimations, origine } from '../animations';
import { preparerTextures } from '../effets';
import { creerPanneau, type Question } from './panneau';

/**
 * Maquette « Écrans : » jouable dans le jeu (#maquette-ecrans) : préparation d'équipe puis récompenses.
 * Clic sur un monstre de la collection : il rejoint l'équipe ; clic sur un monstre de l'équipe : il en sort.
 */

const W = 1280;
const H = 720;
const POLICE = 'Lexend, sans-serif';
const CHIFFRES = 'Rowdies, Lexend, sans-serif';
const OR = '#e3b54c';
const COULEUR: Record<Element, number> = { feu: 0xe8673f, air: 0x69d391, eau: 0x4aa3e6, bonta: 0xf4e8a8, brakmar: 0xa965de };
const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const FICHES = new Map((MONSTRES as FicheMonstre[]).map((m) => [m.id, m]));

interface Possede { id: string; niveau: number }
const COLLECTION: Possede[] = [
  { id: 'piou_vert', niveau: 4 }, { id: 'kwak_de_flamme', niveau: 3 }, { id: 'piou_bleu', niveau: 4 }, { id: 'piou_rouge', niveau: 4 },
  { id: 'scarafeuille_bleu', niveau: 1 }, { id: 'piou_jaune', niveau: 1 }, { id: 'kwak_de_glace', niveau: 1 }, { id: 'piou_violet', niveau: 2 },
];
const ENNEMIS: Possede[] = [{ id: 'scarafeuille_vert', niveau: 5 }, { id: 'piou_violet', niveau: 5 }, { id: 'piou_rouge', niveau: 5 }, { id: 'piou_jaune', niveau: 4 }];
const LEADERS: Record<string, string> = { piou_vert: '+10 % de Vitesse (général)', scarafeuille_blanc: '+18 % de Résistance (général)', kwak_de_vent: '+19 % de taux critique (Donjons)' };
/** Gains d'XP de l'exemple : avancement dans le niveau avant et après (1 = un niveau entier). */
const GAINS: Record<string, number> = { piou_vert: 0.62, kwak_de_flamme: 0.48, piou_bleu: 0.62, piou_rouge: 0.62, scarafeuille_bleu: 1.05, piou_jaune: 1.3, kwak_de_glace: 1.05, piou_violet: 0.9 };

const QUESTIONS: Question[] = [
  { titre: 'Préparation : disposition', options: [{ id: 'A', texte: 'Équipe sur socles + collection en bas' }, { id: 'B', texte: 'Panneaux collection / équipe' }] },
  { titre: 'Aperçu des ennemis', options: [{ id: 'A', texte: 'Petits portraits' }, { id: 'B', texte: 'Bloc avec nom, niveau, élément' }] },
  { titre: 'Bilan d\'éléments', aide: '« ▲ 2 avantages · ▼ 1 désavantage » face aux ennemis.', options: [{ id: 'A', texte: 'Affiché' }, { id: 'B', texte: 'Pas affiché (comme SW)' }] },
  { titre: 'Collection', options: [{ id: 'A', texte: 'Cases (portrait, étoiles, niveau)' }, { id: 'B', texte: 'Cartes avec le nom' }] },
  { titre: 'Choix du leader', aide: 'B : clique sur la couronne d\'un monstre de l\'équipe.', options: [{ id: 'A', texte: 'Le premier de l\'équipe (SW)' }, { id: 'B', texte: 'Couronne à cliquer' }] },
  { titre: 'Bouton Combattre', options: [{ id: 'A', texte: 'En bas à droite' }, { id: 'B', texte: 'Sous l\'équipe' }] },
  { titre: 'Récompenses : disposition', options: [{ id: 'A', texte: 'Monstres sur socles + barres d\'XP (SW)' }, { id: 'B', texte: 'Panneau compact' }] },
  { titre: 'Remplissage de l\'XP', options: [{ id: 'A', texte: 'Un monstre après l\'autre' }, { id: 'B', texte: 'Tous ensemble' }, { id: 'C', texte: 'Instantané' }] },
  { titre: 'Butin', options: [{ id: 'A', texte: 'Cases avec icônes' }, { id: 'B', texte: 'Texte simple' }] },
  { titre: 'Boutons après victoire', aide: 'B ajoute « Répéter » : le combat se relance tout seul en auto.', options: [{ id: 'A', texte: 'Préparation · Rejouer · Stage suivant' }, { id: 'B', texte: 'Les mêmes + Répéter' }] },
];

export class MaquetteEcrans extends Phaser.Scene {
  private choix: string[] = QUESTIONS.map(() => 'A');
  private ecran: 'prep' | 'recomp' = 'prep';
  private equipe: string[] = ['piou_vert', 'kwak_de_flamme', 'piou_bleu', 'piou_rouge'];
  private leader = 0;
  private calque: { destroy(): void }[] = [];

  constructor() {
    super('maquette-ecrans');
  }

  preload() {
    const t = this.add.text(W / 2, H / 2, 'Chargement…', { fontFamily: POLICE, fontSize: '18px', color: '#e9efe6' }).setOrigin(0.5);
    this.load.once('complete', () => t.destroy());
    this.load.image('arene:maquette', distant('mondes/astrub/sol_arene_scarafeuilles.webp'));
    for (const id of new Set([...COLLECTION, ...ENNEMIS].map((m) => m.id))) {
      const a = LOOKS[id].atlas;
      this.load.multiatlas(a, atlasPlanche(a), dossierPlanches);
      this.load.json(`${a}:meta`, atlasPlanche(a));
    }
    for (const f of ['kamas_tas', 'background_levelup_banner', 'slot_dark_background_empty', 'slot_dark_background_full', 'btn_green_normal', 'btn_green_over']) this.load.image(f, `assets/ui/${f}.png`);
  }

  create() {
    preparerTextures(this);
    // Pierre d'âme (provisoire) : gemme violette dessinée par le jeu
    if (!this.textures.exists('pierre_ame')) {
      const t = this.textures.createCanvas('pierre_ame', 64, 64)!;
      const c = t.context, g = c.createRadialGradient(24, 22, 2, 32, 32, 28);
      g.addColorStop(0, '#f6e2ff'); g.addColorStop(0.45, '#a45ad8'); g.addColorStop(1, '#3a145a');
      c.fillStyle = g; c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2); c.fill();
      t.refresh();
    }
    const s = W / 2300;
    this.add.image(-520 * s, -600 * s, 'arene:maquette').setOrigin(0).setScale(s);
    for (const m of [...COLLECTION, ...ENNEMIS]) creerAnimations(this, LOOKS[m.id].atlas);
    creerPanneau('Écrans', 'Préparation d\'équipe puis récompenses. Clique sur un monstre de la collection pour l\'ajouter, sur un monstre de l\'équipe pour le retirer.', this.questions(), (c) => {
      this.choix = c;
      if (this.sys.isActive()) this.dessiner();
    });
    this.dessiner();
  }

  private questions(): Question[] {
    return QUESTIONS.map((q, i) => {
      if (i === 0) return { ...q, action: { texte: 'Écran de préparation', faire: () => { this.ecran = 'prep'; this.dessiner(); } } };
      if (i === 6) return { ...q, action: { texte: 'Écran des récompenses', faire: () => { this.ecran = 'recomp'; this.dessiner(); } } };
      if (i === 7) return { ...q, action: { texte: 'Rejouer l\'animation', faire: () => { this.ecran = 'recomp'; this.dessiner(); } } };
      return q;
    });
  }

  // ───────────── outils de dessin ─────────────

  private g<T extends { destroy(): void }>(o: T): T {
    this.calque.push(o);
    return o;
  }

  private texte(x: number, y: number, t: string, taille = 14, couleur = '#e9efe6', gras = false, ox = 0.5, oy = 0) {
    return this.g(this.add.text(x, y, t, { fontFamily: POLICE, fontSize: `${taille}px`, fontStyle: gras ? '600' : 'normal', color: couleur })
      .setOrigin(ox, oy).setShadow(0, 1, '#000', 3, false, true).setDepth(1000));
  }

  private panneau(x: number, y: number, w: number, h: number) {
    return this.g(this.add.graphics().setDepth(900)
      .fillStyle(0x0f1814, 0.94).fillRoundedRect(x, y, w, h, 14).lineStyle(2, 0x5d6f52).strokeRoundedRect(x, y, w, h, 14));
  }

  private bouton(x: number, y: number, w: number, h: number, texte: string, vert: boolean, action: () => void) {
    const fond = vert
      ? this.g(this.add.nineslice(x, y, 'btn_green_normal', undefined, w, h, 12, 12, 10, 10).setDepth(1001))
      : this.g(this.add.rectangle(x, y, w, h, 0x2a3a32).setStrokeStyle(1.5, 0x5d6f52).setDepth(1001));
    const t = this.g(this.add.text(x, y, texte, { fontFamily: POLICE, fontSize: vert ? '19px' : '14px', fontStyle: '600', color: '#ffffff' })
      .setOrigin(0.5).setShadow(0, 2, '#1f4a12', 2, false, true).setDepth(1002));
    fond.setInteractive({ useHandCursor: true }).on('pointerdown', action);
    if (vert) fond.on('pointerover', () => (fond as Phaser.GameObjects.NineSlice).setTexture('btn_green_over')).on('pointerout', () => (fond as Phaser.GameObjects.NineSlice).setTexture('btn_green_normal'));
    return t;
  }

  /** Monstre en pied, pieds en (x, y). */
  private monstre(id: string, x: number, y: number, zoom = 1, miroir = false) {
    const look = LOOKS[id];
    const meta = (this.cache.json.get(`${look.atlas}:meta`) as { meta?: { cell?: number[]; origin?: number[] } } | undefined)?.meta;
    const [ox, oy] = origine(meta);
    const k = look.echelle * zoom;
    return this.g(this.add.sprite(x, y, look.atlas, 'AnimStatique_1_0').setOrigin(ox, oy).setScale(miroir ? -k : k, k).setDepth(y));
  }

  /** Portrait recadré dans un cercle (rond) ou un carré. */
  private portrait(id: string, x: number, y: number, taille: number, rond = true, miroir = false) {
    const sp = this.g(this.add.sprite(x, y, LOOKS[id].atlas, 'AnimStatique_1_0').setDepth(1001));
    const f = sp.frame;
    const k = (taille * 1.1) / Math.max(f.cutWidth, f.cutHeight);
    sp.setOrigin((f.x + f.cutWidth / 2) / f.realWidth, (f.y + f.cutHeight * 0.47) / f.realHeight).setScale(miroir ? -k : k, k);
    const m = this.g(this.make.graphics({}, false));
    if (rond) m.fillCircle(x, y, taille / 2 - 2); else m.fillRect(x - taille / 2 + 3, y - taille / 2 + 3, taille - 6, taille - 6);
    sp.setMask(m.createGeometryMask());
    return sp;
  }

  private nom = (id: string) => FICHES.get(id)!.nom;
  private etoiles = (id: string) => '★'.repeat(FICHES.get(id)!.etoiles);
  private niveau = (id: string) => COLLECTION.find((m) => m.id === id)?.niveau ?? 1;

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    this.tweens.killAll();
    this.g(this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, this.ecran === 'prep' && this.choix[0] === 'B' ? 0.6 : 0.3).setDepth(1));
    if (this.ecran === 'prep') this.preparation(); else this.recompenses();
  }

  // ───────────── préparation ─────────────

  private ajouter(id: string) {
    if (this.equipe.includes(id) || this.equipe.length >= 4) return;
    this.equipe.push(id);
    this.dessiner();
  }

  private retirer(id: string) {
    const i = this.equipe.indexOf(id);
    if (i < 0) return;
    this.equipe.splice(i, 1);
    if (this.leader >= this.equipe.length) this.leader = 0;
    else if (i < this.leader) this.leader--;
    this.dessiner();
  }

  private idLeader() {
    return this.choix[4] === 'A' ? this.equipe[0] : this.equipe[this.leader];
  }

  private preparation() {
    const [dispo, apercu, bilan, collection, , bouton] = this.choix;
    this.texte(16, 14, 'Astrub · Salle des Scarafeuilles · Normal', 15, '#ffe08a', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    if (dispo === 'A') {
      // Équipe sur ses socles
      const xs = [250, 470, 690, 910];
      xs.forEach((x, i) => {
        const id = this.equipe[i], y = 380;
        const leader = !!id && id === this.idLeader();
        this.g(this.add.ellipse(x, y, 140, 44, leader ? 0xffcf4a : 0x000000, leader ? 0.3 : 0.4).setStrokeStyle(4, leader ? 0xffcf4a : 0x7c8f73).setDepth(y - 1));
        if (!id) { this.texte(x, y - 30, 'Emplacement libre', 13, '#9fb3a6'); return; }
        const sp = this.monstre(id, x, y, 1.15);
        sp.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.retirer(id));
        this.texte(x, y + 26, `${leader ? '♛ ' : ''}${this.nom(id)}`, 14, '#ffffff', true);
        this.texte(x, y + 46, `${this.etoiles(id)}  Niv. ${this.niveau(id)}`, 12, '#ffcf4a');
        if (this.choix[4] === 'B' && !leader) this.texte(x + 60, y - 10, '♛', 22, '#9fb3a6').setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.leader = i; this.dessiner(); });
      });
      const l = this.idLeader();
      if (l) this.texte(140, 466, `♛ Leader : ${this.nom(l)} · ${LEADERS[l] ?? 'pas de skill de leader'}`, 13, '#ffe08a', true, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(10, 6, 10, 6);
      if (bilan === 'A') this.bilan(700, 466, 0);
      this.apercuEnnemis(apercu, W - 16, 12, 1);
      // Collection en bas
      this.g(this.add.rectangle(W / 2, H - 76, W, 152, 0x0a110e, 0.92).setStrokeStyle(2, 0x5d6f52).setDepth(950));
      this.texte(20, H - 144, `MES MONSTRES (${COLLECTION.length})`, 12, OR, true, 0);
      if (collection === 'A') COLLECTION.forEach((m, i) => this.caseMonstre(m.id, 58 + i * 82, H - 62));
      else COLLECTION.forEach((m, i) => this.carteMonstre(m.id, 20 + (i % 4) * 230, H - 120 + Math.floor(i / 4) * 56, 220));
      if (bouton === 'A') this.bouton(W - 120, H - 190, 200, 54, '⚔ Combattre', true, () => { this.ecran = 'recomp'; this.dessiner(); });
      else this.bouton(580, 520, 200, 50, '⚔ Combattre', true, () => { this.ecran = 'recomp'; this.dessiner(); });
    } else {
      this.panneau(20, 60, 600, 640);
      this.texte(38, 76, `MES MONSTRES (${COLLECTION.length})`, 12, OR, true, 0);
      if (collection === 'A') COLLECTION.forEach((m, i) => this.caseMonstre(m.id, 76 + (i % 6) * 90, 140 + Math.floor(i / 6) * 90));
      else COLLECTION.forEach((m, i) => this.carteMonstre(m.id, 38 + (i % 2) * 286, 104 + Math.floor(i / 2) * 66, 276));
      this.panneau(640, 60, 620, 640);
      this.texte(658, 76, 'ENNEMIS · VAGUE 1', 12, OR, true, 0);
      this.apercuEnnemis(apercu, 658, 100, 0);
      const y0 = apercu === 'A' ? 190 : 250;
      this.texte(658, y0, `MON ÉQUIPE (${this.equipe.length} / 4)`, 12, OR, true, 0);
      for (let i = 0; i < 4; i++) {
        const id = this.equipe[i], y = y0 + 26 + i * 70;
        if (!id) { this.g(this.add.rectangle(950, y + 30, 584, 60, 0x000000, 0.25).setStrokeStyle(1.5, 0x3c5045).setDepth(1000)); this.texte(950, y + 22, 'Emplacement libre', 13, '#7d9184'); continue; }
        const leader = id === this.idLeader();
        this.carteMonstre(id, 658, y, 584, leader, () => this.retirer(id));
        if (this.choix[4] === 'B' || leader) this.texte(1225, y + 30, '♛', 22, leader ? '#ffcf4a' : '#5d6f52', false, 0.5, 0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.leader = i; this.dessiner(); });
      }
      const yb = y0 + 26 + 4 * 70 + 6;
      const l = this.idLeader();
      if (l) this.texte(658, yb, `♛ Leader : ${this.nom(l)} · ${LEADERS[l] ?? 'pas de skill de leader'}`, 13, '#ffe08a', true, 0);
      if (bilan === 'A') this.bilan(658, yb + 26, 0);
      if (bouton === 'A') this.bouton(1140, 660, 200, 52, '⚔ Combattre', true, () => { this.ecran = 'recomp'; this.dessiner(); });
      else this.bouton(950, y0 - 8, 180, 40, '⚔ Combattre', true, () => { this.ecran = 'recomp'; this.dessiner(); });
    }
  }

  private caseMonstre(id: string, x: number, y: number) {
    const pris = this.equipe.includes(id);
    const fond = this.g(this.add.image(x, y, 'slot_dark_background_full').setDisplaySize(76, 76).setDepth(1000));
    const p = this.portrait(id, x, y, 72, false);
    const el = FICHES.get(id)!.element;
    this.g(this.add.circle(x + 28, y - 28, 6, COULEUR[el]).setStrokeStyle(1.5, 0x000000).setDepth(1002));
    this.texte(x - 34, y - 38, this.etoiles(id), 10, '#ffcf4a', false, 0);
    this.texte(x + 33, y + 36, String(this.niveau(id)), 12, '#ffffff', true, 1, 1);
    if (pris) {
      p.setTint(0x555555);
      this.texte(x, y, '✓', 30, '#7ee07a', true, 0.5, 0.5);
    }
    fond.setInteractive({ useHandCursor: true }).on('pointerdown', () => (pris ? this.retirer(id) : this.ajouter(id)));
  }

  private carteMonstre(id: string, x: number, y: number, w: number, sel = false, clic?: () => void) {
    const pris = !clic && this.equipe.includes(id);
    const fond = this.g(this.add.rectangle(x + w / 2, y + 30, w, 60, 0x000000, 0.35).setStrokeStyle(1.5, sel ? 0xffcf4a : 0x3c5045).setDepth(1000));
    this.g(this.add.circle(x + 30, y + 30, 26, 0x22322b).setDepth(1000));
    const p = this.portrait(id, x + 30, y + 30, 52);
    const f = FICHES.get(id)!;
    this.texte(x + 66, y + 12, f.nom, 13, '#ffffff', true, 0);
    this.texte(x + 66, y + 32, `${this.etoiles(id)} · Niv. ${this.niveau(id)} · ${f.type === 'pv' ? 'PV' : f.type[0].toUpperCase() + f.type.slice(1)}`, 11, '#9fb3a6', false, 0);
    this.g(this.add.circle(x + w - 18, y + 14, 5, COULEUR[f.element]).setDepth(1001));
    if (pris) { p.setAlpha(0.4); fond.setAlpha(0.5); }
    fond.setInteractive({ useHandCursor: true }).on('pointerdown', clic ?? (() => (pris ? this.retirer(id) : this.ajouter(id))));
  }

  private apercuEnnemis(style: string, x: number, y: number, alignDroite: number) {
    if (style === 'A') {
      const n = ENNEMIS.length, w = n * 66;
      const x0 = alignDroite ? x - w : x;
      if (alignDroite) this.texte(x, y, 'ENNEMIS', 12, OR, true, 1);
      ENNEMIS.forEach((m, i) => {
        const cx = x0 + 33 + i * 66, cy = y + (alignDroite ? 50 : 40);
        this.g(this.add.circle(cx, cy, 29, 0x22322b).setStrokeStyle(2.5, 0xff6a50).setDepth(1000));
        this.portrait(m.id, cx, cy, 58, true, true);
        this.texte(cx, cy + 20, String(m.niveau), 11, '#ffffff', true);
      });
    } else {
      const x0 = alignDroite ? x - 4 * 150 : x;
      if (alignDroite) {
        this.g(this.add.rectangle(x0 + 300 - 8, y + 66, 616, 120, 0x0a110e, 0.88).setStrokeStyle(1.5, 0x5d6f52).setDepth(950));
        this.texte(x0, y + 8, 'ENNEMIS · VAGUE 1', 12, OR, true, 0);
      }
      ENNEMIS.forEach((m, i) => {
        const cx = x0 + 40 + i * 150, cy = y + (alignDroite ? 66 : 54);
        this.g(this.add.circle(cx, cy, 32, 0x22322b).setStrokeStyle(2.5, 0xff6a50).setDepth(1000));
        this.portrait(m.id, cx, cy, 64, true, true);
        const f = FICHES.get(m.id)!;
        this.texte(cx + 38, cy - 24, f.nom, 12, '#ffffff', true, 0).setWordWrapWidth(100);
        this.texte(cx + 38, cy + 14, `Niv. ${m.niveau}`, 11, hex(COULEUR[f.element]), true, 0);
      });
    }
  }

  private bilan(x: number, y: number, ox: number) {
    let plus = 0, moins = 0;
    for (const a of this.equipe) for (const e of ENNEMIS) {
      const v = avantage(FICHES.get(a)!.element, FICHES.get(e.id)!.element);
      if (v > 0) plus++; else if (v < 0) moins++;
    }
    this.texte(x, y, `▲ ${plus} avantage${plus > 1 ? 's' : ''} · ▼ ${moins} désavantage${moins > 1 ? 's' : ''} face aux ennemis`, 13, '#8dff8d', true, ox)
      .setBackgroundColor('rgba(8,14,11,0.85)').setPadding(10, 6, 10, 6);
  }

  // ───────────── récompenses ─────────────

  private recompenses() {
    const [, , , , , , dispo, remplissage, butin, boutons] = this.choix;
    const lignes = this.equipe.map((id) => ({ id, niv: this.niveau(id), depart: 0.2 + (this.niveau(id) % 3) * 0.15, gain: GAINS[id] ?? 0.6 }));
    let barres: { maj: (v: number) => void; ligne: (typeof lignes)[number] }[] = [];

    if (dispo === 'A') {
      const ban = this.g(this.add.image(W / 2, 92, 'background_levelup_banner').setDisplaySize(560, 127).setDepth(1000));
      this.g(this.add.text(W / 2, 80, 'Victoire !', { fontFamily: CHIFFRES, fontSize: '50px', color: '#ffffff' }).setOrigin(0.5).setStroke('#5a2a00', 8).setDepth(1001));
      this.tweens.add({ targets: ban, scaleX: { from: ban.scaleX * 0.6, to: ban.scaleX }, duration: 350, ease: 'Back.easeOut' });
      const xs = [250, 470, 690, 910].slice(0, lignes.length);
      barres = lignes.map((l, i) => {
        const x = xs[i], y = 360;
        this.g(this.add.ellipse(x, y, 130, 40, 0x000000, 0.45).setDepth(y - 1));
        this.monstre(l.id, x, y, 1.15);
        this.texte(x, y + 24, this.nom(l.id), 14, '#ffffff', true);
        const niv = this.texte(x, y + 44, `Niv. ${l.niv} · +700 XP`, 12, '#cfdccf');
        const gr = this.g(this.add.graphics().setDepth(1000));
        return { ligne: l, maj: this.barreXp(gr, niv, l, x - 80, y + 66, 160, x, y - 120) };
      });
    } else {
      this.panneau(340, 40, 600, 560);
      this.g(this.add.text(W / 2, 86, 'Victoire !', { fontFamily: CHIFFRES, fontSize: '46px', color: '#ffd23f' }).setOrigin(0.5).setStroke('#5a2a00', 6).setDepth(1001));
      this.texte(W / 2, 120, 'Astrub · Salle des Scarafeuilles · 44 tours', 13, '#9fb3a6');
      barres = lignes.map((l, i) => {
        const y = 150 + i * 70;
        this.g(this.add.rectangle(W / 2, y + 30, 548, 60, 0x000000, 0.35).setStrokeStyle(1.5, 0x3c5045).setDepth(1000));
        this.g(this.add.circle(392, y + 30, 26, 0x22322b).setDepth(1000));
        this.portrait(l.id, 392, y + 30, 52);
        this.texte(428, y + 8, `${this.nom(l.id)}  ${this.etoiles(l.id)}`, 13, '#ffffff', true, 0);
        const niv = this.texte(900, y + 22, `Niv. ${l.niv}`, 13, '#ffffff', true, 1);
        const gr = this.g(this.add.graphics().setDepth(1001));
        return { ligne: l, maj: this.barreXp(gr, niv, l, 428, y + 36, 330, 840, y + 10) };
      });
    }

    // Remplissage des barres d'XP
    const duree = 1100;
    barres.forEach((b, i) => {
      if (remplissage === 'C') { b.maj(1); return; }
      const o = { v: 0 };
      this.tweens.add({ targets: o, v: 1, duration: duree, delay: 500 + (remplissage === 'A' ? i * (duree + 150) : 0), ease: 'Sine.easeInOut', onUpdate: () => b.maj(o.v) });
    });

    // Butin
    const yb = dispo === 'A' ? 520 : 440;
    if (dispo === 'A') this.panneau(250, yb - 14, 780, 82);
    if (butin === 'A') {
      this.texte(dispo === 'A' ? 270 : 370, yb - 4, 'BUTIN', 11, OR, true, 0);
      const x0 = dispo === 'A' ? 420 : 450;
      for (const [k, [cle, n, label]] of ([['kamas_tas', '+350', 'kamas'], ['pierre_ame', '+1', 'pierre d\'âme (première victoire)']] as const).entries()) {
        const x = x0 + k * (dispo === 'A' ? 240 : 190);
        this.g(this.add.image(x, yb + 30, 'slot_dark_background_full').setDisplaySize(60, 60).setDepth(1000));
        this.g(this.add.image(x, yb + 30, cle).setDisplaySize(44, 44).setDepth(1001));
        this.texte(x + 40, yb + 14, n, 20, '#ffffff', true, 0);
        this.texte(x + 40, yb + 40, label, 12, '#cfdccf', false, 0);
      }
    } else {
      this.texte(W / 2, yb + 18, '+350 kamas   ·   +1 pierre d\'âme (première victoire)', 17, '#ffe08a', true);
    }

    // Boutons
    const yB = dispo === 'A' ? 660 : 560;
    const liste = ['Préparation', '↻ Rejouer', 'Stage suivant ▸', ...(boutons === 'B' ? ['⟳ Répéter ×10'] : [])];
    const serre = liste.length > 3;
    const largeurs = liste.map((t) => (t.startsWith('Stage') ? (serre ? 170 : 190) : serre ? 128 : 150));
    const ecart = serre ? 10 : 14;
    let x = W / 2 - (largeurs.reduce((a, b) => a + b, 0) + (liste.length - 1) * ecart) / 2;
    liste.forEach((t, i) => {
      const w = largeurs[i];
      this.bouton(x + w / 2, yB, w, 44, t, t.startsWith('Stage'), () => { if (t === 'Préparation') { this.ecran = 'prep'; this.dessiner(); } else if (t !== 'Stage suivant ▸') this.dessiner(); });
      x += w + ecart;
    });
  }

  /** Barre d'XP : v de 0 à 1 parcourt le gain ; passe au niveau suivant (avec annonce) quand elle déborde. */
  private barreXp(gr: Phaser.GameObjects.Graphics, niv: Phaser.GameObjects.Text, l: { id: string; niv: number; depart: number; gain: number }, x: number, y: number, w: number, ax: number, ay: number) {
    let annonce = false;
    const maj = (v: number) => {
      const total = l.depart + l.gain * v;
      const monte = Math.floor(total);
      const part = total - monte;
      gr.clear().fillStyle(0x000000, 0.65).fillRoundedRect(x - 1, y - 1, w + 2, 12, 5).fillStyle(0x3d8cff).fillRoundedRect(x, y, Math.max(2, w * part), 10, 4);
      niv.setText(niv.text.replace(/Niv\. \d+/, `Niv. ${l.niv + monte}`));
      if (monte > 0) {
        niv.setColor('#7ee07a');
        if (!annonce) {
          annonce = true;
          const t = this.g(this.add.text(ax, ay, 'NIVEAU SUPÉRIEUR !', { fontFamily: CHIFFRES, fontSize: '20px', color: '#7ee07a' }).setOrigin(0.5).setStroke('#10380e', 5).setDepth(1100));
          this.tweens.add({ targets: t, y: ay - 18, scale: { from: 0.4, to: 1 }, duration: 380, ease: 'Back.easeOut' });
          const etincelles = this.g(this.add.particles(ax, ay + 40, 'fx:etincelle', { speed: { min: 60, max: 180 }, lifespan: 700, scale: { start: 0.5, end: 0 }, tint: [0xb6ffb0, 0xffffff], blendMode: 'ADD', emitting: false }).setDepth(1100));
          etincelles.explode(24);
        }
      }
    };
    maj(0);
    return maj;
  }
}
