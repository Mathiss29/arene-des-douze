import Phaser from 'phaser';
import { monstreCombat, fiche } from '../sim/fiches';
import { auNiveauMax, definirEquipe, equipePourStage, monstre, peutEvoluer, TAILLE_EQUIPE, trierMonstres, type Joueur, type MonstrePossede, type Tri } from '../sim/joueur';
import { NIVEAU_MAX, pointsRequis, type Etoiles } from '../sim/progression';
import { LISTE_STAGES, stage, type Stage } from '../sim/stages';
import { ELEMENTS, type Element, type Stats } from '../sim/types';
import { LOOKS } from './looks';
import { distant } from './assetUrl';
import { creerAnimations } from './animations';
import { charger, sauver } from './sauvegarde';
import { bouton, caseSombre, chargerUi, COULEUR, fmt, H, hex, monstreEnPied, NOM_ELEMENT, NOM_TYPE, nomStat, OR, panneau, portrait, texte, texteLeader, W } from './ui';

/**
 * Préparation d'équipe (maquette « Écrans : » 1B 2B 3B 4A 5A 6A) : collection à gauche, ennemis et équipe à droite.
 * Clic sur un monstre : il rejoint ou quitte l'équipe ; appui long ou clic droit : sa fiche. Le premier de l'équipe est le leader (SW).
 * L'équipe est retenue pour chaque stage, comme dans SW.
 */

const PAR_PAGE = 30;
const APPUI_LONG = 450;
const NOMS_TRI: Record<Tri, string> = { etoiles: 'Étoiles', niveau: 'Niveau', element: 'Élément' };

export class PreparationScene extends Phaser.Scene {
  private joueur!: Joueur;
  private stage!: Stage;
  private equipe: number[] = [];
  private tri: Tri = 'etoiles';
  private filtre: Element | null = null;
  private page = 0;
  private calque: { destroy(): void }[] = [];
  private calqueFiche: { destroy(): void }[] = [];

  constructor() {
    super('preparation');
  }

  init(data: { stage?: string }) {
    this.joueur = charger();
    this.stage = stage(data?.stage ?? LISTE_STAGES[0].id);
    this.equipe = equipePourStage(this.joueur, this.stage.id);
    this.page = 0;
  }

  preload() {
    const t = this.add.text(W / 2, H / 2, 'Chargement…', { fontFamily: 'Lexend, sans-serif', fontSize: '18px', color: '#e9efe6' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => t.setText(`Chargement… ${Math.round(p * 100)} %`));
    this.load.once('complete', () => t.destroy());
    const cle = `arene:${this.stage.arene}`;
    if (!this.textures.exists(cle)) this.load.image(cle, distant(this.stage.arene));
    const ids = [...this.joueur.monstres.map((m) => m.id), ...this.stage.ennemis.map((e) => e.id)];
    chargerUi(this, ids);
    for (const id of new Set(this.joueur.monstres.map((m) => m.id))) {
      for (const s of monstreCombat(id).sorts) if (s.icone && !this.textures.exists(`sort_${s.icone}`)) this.load.image(`sort_${s.icone}`, `assets/ui/sorts/sort_${s.icone}.png`);
    }
  }

  create() {
    this.calque = [];
    this.calqueFiche = [];
    this.input.mouse?.disableContextMenu();
    this.cameras.main.setBackgroundColor('#0b120e');
    const s = W / 2300;
    this.add.image(-520 * s, -600 * s, `arene:${this.stage.arene}`).setOrigin(0).setScale(s);
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.6).setDepth(1);
    for (const id of new Set([...this.joueur.monstres.map((m) => m.id), ...this.stage.ennemis.map((e) => e.id)])) creerAnimations(this, LOOKS[id].atlas);
    this.dessiner();
  }

  // ───────────── outils ─────────────

  private g<T extends { destroy(): void }>(o: T): T {
    this.calque.push(o);
    return o;
  }

  private t(...a: Parameters<typeof texte> extends [unknown, ...infer R] ? R : never) {
    return this.g(texte(this, ...a));
  }

  private portrait(id: string, x: number, y: number, taille: number, rond = true, miroir = false) {
    const p = portrait(this, id, x, y, taille, rond, miroir);
    this.g(p.masque);
    return this.g(p.sp);
  }

  /**
   * Clic court : action ; appui long ou clic droit : fiche du monstre.
   * L'appui long se mesure en temps réel (et non au temps du jeu, qui ralentit quand les images par seconde chutent).
   */
  private cliquable(o: Phaser.GameObjects.GameObject, clic: () => void, voir: () => void) {
    let debut = 0;
    let minuteur: ReturnType<typeof setTimeout> | undefined;
    let annule = true;
    const arreter = () => { clearTimeout(minuteur); minuteur = undefined; };
    o.setInteractive({ useHandCursor: true });
    o.on('pointerdown', (p: Phaser.Input.Pointer) => {
      arreter();
      if (p.rightButtonDown()) { annule = true; voir(); return; }
      annule = false;
      debut = performance.now();
      minuteur = setTimeout(() => { if (!annule && this.sys.isActive()) { annule = true; voir(); } }, APPUI_LONG);
    });
    o.on('pointerup', () => {
      arreter();
      if (annule) return;
      annule = true;
      if (performance.now() - debut >= APPUI_LONG) voir(); else clic();
    });
    o.on('pointerout', () => { arreter(); annule = true; });
    o.once('destroy', arreter);
  }

  private etoiles = (n: number) => '★'.repeat(n);

  // ───────────── équipe ─────────────

  private basculer(uid: number) {
    const i = this.equipe.indexOf(uid);
    if (i >= 0) this.equipe.splice(i, 1);
    else if (this.equipe.length < TAILLE_EQUIPE) this.equipe.push(uid);
    else return;
    this.dessiner();
  }

  private combattre() {
    if (!this.equipe.length) return;
    this.joueur = definirEquipe(this.joueur, this.equipe, this.stage.id);
    sauver(this.joueur);
    this.scene.start('combat', { stage: this.stage.id });
  }

  // ───────────── écran ─────────────

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur;

    this.t(16, 14, `Astrub · ${this.stage.nom} · Normal`, 15, '#ffe08a', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    // En attendant l'île : accès direct au Cercle d'amélioration
    const cercle = this.t(W / 2, 14, '⚗ Cercle d\'amélioration', 14, '#1d1405', true, 0.5, 0).setBackgroundColor('#e3b54c').setPadding(14, 7, 14, 7).setShadow(0, 0, '#000', 0);
    cercle.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('cercle', { stage: this.stage.id }));
    this.t(W - 16, 14, `${fmt(j.kamas)} kamas  ·  ${j.pierresAme} pierre${j.pierresAme > 1 ? 's' : ''} d'âme`, 14, '#ffe08a', true, 1, 0)
      .setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);

    this.collection();
    this.cote();
  }

  private collection() {
    const j = this.joueur;
    this.g(panneau(this, 20, 60, 600, 640));
    this.t(38, 78, `MES MONSTRES (${j.monstres.length})`, 12, OR, true, 0);

    // Tri
    let x = 602;
    for (const tri of (['element', 'niveau', 'etoiles'] as Tri[])) {
      const actif = tri === this.tri;
      const b = this.t(x, 72, NOMS_TRI[tri], 12, actif ? '#1d1405' : '#cfdccf', true, 1, 0)
        .setBackgroundColor(actif ? '#e3b54c' : 'rgba(42,58,50,0.9)').setPadding(10, 5, 10, 5).setShadow(0, 0, '#000', 0);
      b.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.tri = tri; this.page = 0; this.dessiner(); });
      x -= b.width + 8;
    }
    this.t(x, 77, 'Tri', 12, '#9fb3a6', false, 1, 0);

    // Filtre par élément
    const presents = ELEMENTS.filter((e) => j.monstres.some((m) => fiche(m.id).element === e));
    const tous = this.t(38, 112, 'Tous', 12, this.filtre === null ? '#1d1405' : '#cfdccf', true, 0, 0)
      .setBackgroundColor(this.filtre === null ? '#e3b54c' : 'rgba(42,58,50,0.9)').setPadding(10, 5, 10, 5).setShadow(0, 0, '#000', 0);
    tous.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.filtre = null; this.page = 0; this.dessiner(); });
    let fx = 38 + tous.width + 10;
    for (const e of ELEMENTS) {
      const actif = this.filtre === e, dispo = presents.includes(e);
      const fond = this.g(this.add.rectangle(fx + 44, 124, 88, 26, actif ? 0x3a4c42 : 0x1b2722).setStrokeStyle(actif ? 2 : 1, actif ? COULEUR[e] : 0x3c5045).setDepth(1000));
      this.g(this.add.circle(fx + 14, 124, 6, COULEUR[e]).setDepth(1001).setAlpha(dispo ? 1 : 0.35));
      this.t(fx + 26, 116, NOM_ELEMENT[e], 12, dispo ? '#e9efe6' : '#5d6f62', true, 0, 0);
      if (dispo) fond.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.filtre = actif ? null : e; this.page = 0; this.dessiner(); });
      fx += 96;
    }

    // Cases
    const liste = trierMonstres(j.monstres, this.tri).filter((m) => !this.filtre || fiche(m.id).element === this.filtre);
    const pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
    this.page = Math.min(this.page, pages - 1);
    liste.slice(this.page * PAR_PAGE, (this.page + 1) * PAR_PAGE).forEach((m, i) => this.caseMonstre(m, 76 + (i % 6) * 93, 198 + Math.floor(i / 6) * 92));
    if (!liste.length) this.t(320, 300, 'Aucun monstre de cet élément.', 14, '#9fb3a6');
    if (pages > 1) {
      const pg = (dx: number, s: string, ok: boolean, f: () => void) => {
        const b = this.t(320 + dx, 668, s, 16, ok ? '#ffe08a' : '#4d5d53', true, 0.5, 0.5);
        if (ok) b.setInteractive({ useHandCursor: true }).on('pointerdown', f);
      };
      pg(-60, '◀', this.page > 0, () => { this.page--; this.dessiner(); });
      this.t(320, 668, `${this.page + 1} / ${pages}`, 13, '#cfdccf', true, 0.5, 0.5);
      pg(60, '▶', this.page < pages - 1, () => { this.page++; this.dessiner(); });
    }
    this.t(38, 680, 'Clic : ajouter / retirer  ·  Appui long ou clic droit : fiche', 11, '#7d9184', false, 0, 0);
  }

  private caseMonstre(m: MonstrePossede, x: number, y: number) {
    const pris = this.equipe.includes(m.uid);
    const c = caseSombre(this, x, y, 78);
    this.g(c.g);
    const fond = this.g(c.zone);
    const p = this.portrait(m.id, x, y, 74, false);
    this.g(this.add.circle(x + 29, y - 29, 6, COULEUR[fiche(m.id).element]).setStrokeStyle(1.5, 0x000000).setDepth(1002));
    this.t(x - 35, y - 39, this.etoiles(m.etoiles), 10, '#ffcf4a', false, 0).setDepth(1003);
    const max = auNiveauMax(m);
    this.t(x + 34, y + 37, max ? 'MAX' : String(m.niveau), max ? 11 : 12, max ? '#ffcf4a' : '#ffffff', true, 1, 1).setDepth(1003);
    if (peutEvoluer(this.joueur, m.uid)) {
      this.g(this.add.circle(x - 26, y + 26, 10, 0x2f8f3a).setStrokeStyle(1.5, 0xb6ffb0).setDepth(1003));
      this.t(x - 26, y + 26, '▲', 11, '#ffffff', true, 0.5, 0.5).setDepth(1004);
    }
    if (pris) {
      p.setTint(0x555555);
      this.t(x, y, '✓', 30, '#7ee07a', true, 0.5, 0.5).setDepth(1004);
    }
    this.cliquable(fond, () => this.basculer(m.uid), () => this.ouvrirFiche(m));
  }

  /** Côté droit : ennemis de la vague, équipe, leader, bouton Combattre. */
  private cote() {
    this.g(panneau(this, 640, 60, 620, 640));
    this.t(658, 78, 'ENNEMIS · VAGUE 1', 12, OR, true, 0);
    this.stage.ennemis.forEach((e, i) => {
      const cx = 698 + i * 150, cy = 150;
      const f = fiche(e.id);
      this.g(this.add.circle(cx, cy, 32, 0x22322b).setStrokeStyle(2.5, 0xff6a50).setDepth(1000));
      this.portrait(e.id, cx, cy, 64, true, true);
      this.t(cx + 38, cy - 24, f.nom, 12, '#ffffff', true, 0).setWordWrapWidth(100);
      this.t(cx + 38, cy + 14, `${this.etoiles(e.etoiles)} Niv. ${e.niveau}`, 11, hex(COULEUR[f.element]), true, 0);
    });

    const y0 = 236;
    this.t(658, y0, `MON ÉQUIPE (${this.equipe.length} / ${TAILLE_EQUIPE})`, 12, OR, true, 0);
    for (let i = 0; i < TAILLE_EQUIPE; i++) {
      const uid = this.equipe[i], y = y0 + 26 + i * 72;
      if (uid === undefined) {
        this.g(this.add.rectangle(950, y + 31, 584, 62, 0x000000, 0.25).setStrokeStyle(1.5, 0x3c5045).setDepth(1000));
        this.t(950, y + 22, 'Emplacement libre', 13, '#7d9184');
        continue;
      }
      const m = monstre(this.joueur, uid);
      const f = fiche(m.id);
      const leader = i === 0;
      const fond = this.g(this.add.rectangle(950, y + 31, 584, 62, 0x000000, 0.35).setStrokeStyle(leader ? 2.5 : 1.5, leader ? 0xffcf4a : 0x3c5045).setDepth(1000));
      this.g(this.add.circle(688, y + 31, 26, 0x22322b).setDepth(1000));
      this.portrait(m.id, 688, y + 31, 52);
      this.t(724, y + 12, `${leader ? '♛ ' : ''}${f.nom}`, 14, leader ? '#ffe08a' : '#ffffff', true, 0);
      const max = auNiveauMax(m) ? ' (max)' : '';
      this.t(724, y + 34, `${this.etoiles(m.etoiles)} · Niv. ${m.niveau}${max} · ${NOM_TYPE[f.type]}`, 11, '#9fb3a6', false, 0);
      this.g(this.add.circle(1224, y + 16, 6, COULEUR[f.element]).setStrokeStyle(1.5, 0x000000).setDepth(1001));
      this.t(1224, y + 44, 'Retirer', 11, '#9fb3a6', false, 1, 0.5);
      this.cliquable(fond, () => this.basculer(uid), () => this.ouvrirFiche(m));
    }

    const yb = y0 + 26 + TAILLE_EQUIPE * 72 + 8;
    const chef = this.equipe.length ? monstre(this.joueur, this.equipe[0]) : null;
    const lead = chef ? monstreCombat(chef.id).leader : undefined;
    this.t(658, yb, chef ? `♛ Leader : ${fiche(chef.id).nom} · ${lead ? texteLeader(lead) : 'pas de skill de leader'}` : '♛ Le premier monstre de l\'équipe est le leader.', 13, '#ffe08a', true, 0);
    if (chef) this.t(658, yb + 24, 'Le premier monstre de l\'équipe est le leader : retire-le pour changer.', 11, '#7d9184', false, 0);

    const b = bouton(this, 1140, 660, 200, 54, '⚔ Combattre', true, () => this.combattre());
    this.g(b.fond); this.g(b.t);
    if (!this.equipe.length) b.griser();
  }

  // ───────────── fiche détaillée ─────────────

  private fermerFiche() {
    for (const o of this.calqueFiche) o.destroy();
    this.calqueFiche = [];
  }

  private ouvrirFiche(m: MonstrePossede) {
    this.fermerFiche();
    const k = <T extends { destroy(): void }>(o: T): T => { this.calqueFiche.push(o); return o; };
    const D = 5000;
    const tx = (x: number, y: number, s: string, taille = 14, couleur = '#e9efe6', gras = false, ox = 0, oy = 0) => k(texte(this, x, y, s, taille, couleur, gras, ox, oy).setDepth(D + 2));
    const f = fiche(m.id);
    const c = monstreCombat(m.id, m.etoiles as Etoiles, m.niveau);

    k(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(D).setInteractive().on('pointerdown', () => this.fermerFiche()));
    const X = 200, Y = 70, L = 880, HT = 580;
    k(panneau(this, X, Y, L, HT, D + 1));
    k(this.add.zone(X + L / 2, Y + HT / 2, L, HT).setDepth(D + 1).setInteractive());
    const fermer = tx(X + L - 20, Y + 14, '✕', 22, '#cfdccf', true, 1, 0);
    fermer.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.fermerFiche());

    // Portrait en pied
    k(this.add.ellipse(X + 170, Y + 360, 170, 50, COULEUR[f.element], 0.18).setStrokeStyle(3, COULEUR[f.element]).setDepth(D + 1));
    k(monstreEnPied(this, m.id, X + 170, Y + 360, 1.5).setDepth(D + 2));
    tx(X + 170, Y + 26, f.nom, 22, '#ffe08a', true, 0.5);
    tx(X + 170, Y + 58, this.etoiles(m.etoiles), 18, '#ffcf4a', false, 0.5);
    tx(X + 170, Y + 400, `Niv. ${m.niveau} / ${NIVEAU_MAX[m.etoiles as Etoiles]}`, 15, '#ffffff', true, 0.5);
    tx(X + 170, Y + 424, `${NOM_ELEMENT[f.element]} · ${NOM_TYPE[f.type]}`, 13, hex(COULEUR[f.element]), true, 0.5);
    if (peutEvoluer(this.joueur, m.uid)) tx(X + 170, Y + 452, '▲ Prêt à évoluer', 13, '#7ee07a', true, 0.5);
    else if (m.etoiles < 6) tx(X + 170, Y + 452, `Pour évoluer : ${pointsRequis(m.etoiles as 1 | 2 | 3 | 4 | 5)} point${m.etoiles > 1 ? 's' : ''} de nourriture hors équipe (1★ = 1, 2★ = 2, 3★ = 6)`, 11, '#9fb3a6', false, 0.5).setWordWrapWidth(300).setAlign('center');

    // Stats
    const sx = X + 350;
    tx(sx, Y + 26, 'STATS', 12, OR, true);
    const pct = new Set<keyof Stats>(['tc', 'dc', 'pre', 'res']);
    (['pv', 'atq', 'def', 'vit', 'tc', 'dc', 'res', 'pre'] as (keyof Stats)[]).forEach((s, i) => {
      const cx = sx + (i % 2) * 250, cy = Y + 52 + Math.floor(i / 2) * 26;
      tx(cx, cy, nomStat(s), 13, '#9fb3a6');
      tx(cx + 220, cy, `${fmt(c.stats[s])}${pct.has(s) ? ' %' : ''}`, 13, '#ffffff', true, 1);
    });

    // Leader
    let y = Y + 168;
    tx(sx, y, 'SKILL DE LEADER', 12, OR, true);
    tx(sx, y + 20, c.leader ? texteLeader(c.leader) : 'Aucun', 13, c.leader ? '#ffe08a' : '#7d9184', true);
    y += 56;

    // Sorts
    tx(sx, y, 'SORTS', 12, OR, true);
    y += 22;
    for (const s of c.sorts) {
      if (s.icone && this.textures.exists(`sort_${s.icone}`)) k(this.add.image(sx + 22, y + 22, `sort_${s.icone}`).setDisplaySize(44, 44).setDepth(D + 2));
      const rec = s.passif ? 'Passif' : s.recharge ? `Recharge : ${s.recharge} tours` : 'Sort de base';
      tx(sx + 56, y, s.nom, 13, '#ffffff', true);
      tx(sx + 56 + 6 + (k(this.add.text(0, 0, s.nom, { fontFamily: 'Lexend, sans-serif', fontSize: '13px', fontStyle: '600' }).setVisible(false)).width), y + 1, `· ${rec}`, 11, '#9fb3a6');
      const d = tx(sx + 56, y + 20, s.desc ?? '', 12, '#cfdccf').setWordWrapWidth(L - (sx - X) - 90).setLineSpacing(2);
      y += Math.max(54, d.height + 30);
    }
    tx(X + 20, Y + HT - 30, 'Touche en dehors de la fiche pour la fermer.', 11, '#7d9184');
  }
}
