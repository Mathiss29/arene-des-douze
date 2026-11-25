import Phaser from 'phaser';
import { charger } from './sauvegarde';
import type { Joueur } from '../sim/joueur';
import MONSTRES from '../data/monstres.json';
import { fiche, monstreCombat } from '../sim/fiches';
import type { Element, FicheMonstre } from '../sim/types';
import { COULEUR, NOM_ELEMENT, NOM_TYPE, POLICE, W, H, chargerUi, fmt, hex, panneau, texte, texteLeader } from './ui';
import { VERT, bandeauPierre, carteMonstre, chargerIdentite, decorVivant, etoiles, hexagoneStats } from './identite';

/**
 * Collection de monstres, disposée comme dans Summoners War (vidéo de Mathis du 25/11/2026 ✓) : un élément à la fois, choisi par
 * les cinq gemmes à droite de la grille ; huit colonnes, les plus étoilés d'abord (bouton pour inverser) ; les monstres jamais eus
 * sont visibles mais éteints ; « Chercher » filtre par type et par étoiles. Toucher un monstre montre sa fiche (profil, sorts, leader).
 */
const TOUS = (MONSTRES as FicheMonstre[]).filter((m) => !m.boss);
const ELEMENTS: Element[] = ['feu', 'eau', 'air', 'bonta', 'brakmar'];
const COLS = 8, LIGNES = 5;

export class BestiaireScene extends Phaser.Scene {
  private joueur!: Joueur;
  private element: Element = 'feu';
  private croissant = false;
  private type: string | null = null;
  private etoilesMin = 1;
  private recherche = false;
  private page = 0;
  private choisi: string | null = null;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private decor?: { teinter: (c: number) => void };

  constructor() { super('bestiaire'); }

  init() { this.joueur = charger(); this.page = 0; this.choisi = null; this.calque = []; this.element = 'feu'; this.croissant = false; this.type = null; this.etoilesMin = 1; this.recherche = false; }

  preload() {
    chargerUi(this, []); // portraits : vignettes seulement
    chargerIdentite(this);
  }

  create() {
    this.decor = decorVivant(this, 400);
    bandeauPierre(this, 'Monstres', () => this.scene.start('monstres'));
    texte(this, W / 2, 25, 'Collection', 21, '#eef2e4', true, 0.5, 0.5).setDepth(2001);
    this.dessiner();
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }
  private gs(l: Phaser.GameObjects.GameObject[]) { for (const o of l) this.calque.push(o); }

  private puce(x: number, y: number, w: number, h: number, lib: string, on: boolean, action: () => void, profondeur = 1001) {
    this.g(this.add.graphics().setDepth(profondeur).fillStyle(on ? VERT : 0x161b13).fillRoundedRect(x, y - h / 2, w, h, 7).lineStyle(1.5, on ? 0xf0ff9a : 0x4a5a3c).strokeRoundedRect(x, y - h / 2, w, h, 7));
    this.g(this.add.text(x + w / 2, y, lib, { fontFamily: POLICE, fontSize: '13.5px', fontStyle: '600', color: on ? '#1c2408' : '#dfe8d6' }).setOrigin(0.5).setDepth(profondeur + 1));
    this.g(this.add.zone(x, y - h / 2, w, h).setOrigin(0).setDepth(profondeur + 2).setInteractive({ useHandCursor: true })).on('pointerdown', action);
  }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur, e = this.element, X = 20, L = 800;
    this.decor?.teinter(COULEUR[e]);
    this.g(panneau(this, X, 62, L, 644));
    const vus = TOUS.filter((m) => j.decouverts.includes(m.id)).length;
    this.g(texte(this, X + 30, 98, `Collection de monstres  ${vus} / ${TOUS.length}`, 16, '#ffffff', true, 0, 0.5));
    const filtres = (this.type ? 1 : 0) + (this.etoilesMin > 1 ? 1 : 0);
    this.puce(X + L - 256, 98, 44, 32, this.croissant ? '▲' : '▼', false, () => { this.croissant = !this.croissant; this.page = 0; this.dessiner(); });
    this.puce(X + L - 204, 98, 118, 32, filtres ? `Chercher (${filtres})` : 'Chercher', filtres > 0, () => { this.recherche = true; this.dessiner(); });
    // bandeau de l'élément
    const liste = TOUS.filter((m) => m.element === e && (!this.type || m.type === this.type) && m.etoiles >= this.etoilesMin)
      .sort((a, b) => (b.etoiles - a.etoiles) * (this.croissant ? -1 : 1) || a.famille.localeCompare(b.famille));
    this.g(this.add.rectangle(X + 26, 138, L - 118, 30, 0x000000, 0.5).setOrigin(0, 0.5).setDepth(1000));
    this.g(this.add.circle(X + 44, 138, 7, COULEUR[e]).setStrokeStyle(2, 0x0b100d).setDepth(1001));
    this.g(texte(this, X + 60, 138, NOM_ELEMENT[e], 15, '#ffffff', true, 0, 0.5));
    this.g(texte(this, X + L - 104, 138, `${liste.filter((m) => j.decouverts.includes(m.id)).length} / ${liste.length}`, 13, '#93a89b', true, 1, 0.5));
    // les cinq gemmes d'élément, en colonne à droite
    ELEMENTS.forEach((el, i) => {
      const x = X + L - 52, y = 150 + i * 62, on = el === e;
      this.g(this.add.circle(x, y, on ? 25 : 21, 0x10130d).setStrokeStyle(on ? 3 : 1.5, on ? 0xd8ff5a : 0x6f7862).setDepth(1001));
      this.g(this.add.circle(x, y, on ? 17 : 14, el === 'bonta' ? 0xfff1b8 : COULEUR[el]).setStrokeStyle(1.5, 0x0b100d).setDepth(1002));
      this.g(this.add.circle(x - 5, y - 5, 4, 0xffffff, 0.55).setDepth(1003));
      this.g(this.add.zone(x, y, 54, 54).setDepth(1004).setInteractive({ useHandCursor: true })).on('pointerdown', () => { this.element = el; this.page = 0; this.dessiner(); });
    });
    const parPage = COLS * LIGNES, pages = Math.max(1, Math.ceil(liste.length / parPage));
    this.page = Math.min(this.page, pages - 1);
    if (!liste.length) this.g(texte(this, X + (L - 90) / 2, 400, 'Aucun monstre ne correspond à cette recherche.', 14, '#93a89b', false, 0.5, 0.5));
    liste.slice(this.page * parPage, (this.page + 1) * parPage).forEach((m, k) => {
      const x = X + 70 + (k % COLS) * 86, y = 208 + Math.floor(k / COLS) * 96, vu = j.decouverts.includes(m.id);
      this.gs(carteMonstre(this, { id: m.id, etoiles: m.etoiles }, m.element, x, y, 78, { choisie: this.choisi === m.id, inconnu: !vu, action: () => { this.choisi = m.id; this.dessiner(); } }));
    });
    if (pages > 1) for (let i = 0; i < pages; i++) this.puce(X + (L - 90) / 2 + (i - pages / 2) * 46 + 4, 682, 38, 28, String(i + 1), i === this.page, () => { this.page = i; this.dessiner(); });
    this.fiche();
    if (this.recherche) this.chercher();
  }

  /** « Chercher » : type de monstre et étoiles naturelles. */
  private chercher() {
    const P = 3002, X = 360, Y = 210;
    const fermer = () => { this.recherche = false; this.page = 0; this.dessiner(); };
    this.g(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(3000).setInteractive()).on('pointerdown', fermer);
    this.g(panneau(this, X, Y, 560, 290, 3001));
    this.g(this.add.zone(X, Y, 560, 290).setOrigin(0).setDepth(3001).setInteractive());
    this.g(texte(this, W / 2, Y + 34, 'Chercher un monstre', 18, '#ffffff', true, 0.5, 0.5).setDepth(P));
    this.g(texte(this, X + 34, Y + 92, 'Type', 13, '#93a89b', true, 0, 0.5).setDepth(P));
    ([null, 'attaque', 'defense', 'pv', 'soutien'] as (string | null)[]).forEach((t, i) => this.puce(X + 110 + i * 86, Y + 92, 80, 32, t ? NOM_TYPE[t] : 'Tous', this.type === t, () => { this.type = t; this.dessiner(); }, P));
    this.g(texte(this, X + 34, Y + 144, 'Étoiles', 13, '#93a89b', true, 0, 0.5).setDepth(P));
    for (let n = 1; n <= 5; n++) this.puce(X + 110 + (n - 1) * 86, Y + 144, 80, 32, n === 1 ? 'Toutes' : `${n}★ et +`, this.etoilesMin === n, () => { this.etoilesMin = n; this.dessiner(); }, P);
    this.puce(X + 110, Y + 220, 150, 36, 'Tout remettre', false, () => { this.type = null; this.etoilesMin = 1; this.dessiner(); }, P);
    this.puce(X + 290, Y + 220, 160, 36, 'Chercher', true, fermer, P);
  }

  private fiche() {
    const X = 836, L = 426;
    this.g(panneau(this, X, 62, L, 644));
    const id = this.choisi;
    if (!id) { this.g(texte(this, X + L / 2, 384, 'Touche un monstre.', 15, '#93a89b', false, 0.5, 0.5)); return; }
    const f = fiche(id), vu = this.joueur.decouverts.includes(id);
    const c = monstreCombat(id, 6, 40), st = c.stats;
    this.gs(carteMonstre(this, { id, etoiles: f.etoiles }, f.element, X + 84, 148, 116, { inconnu: !vu }));
    this.g(this.add.circle(X + 160, 104, 7, COULEUR[f.element]).setStrokeStyle(2, 0x0b100d).setDepth(1001));
    this.g(texte(this, X + 174, 104, f.nom, 19, '#ffffff', true, 0, 0.5).setWordWrapWidth(236));
    this.gs(etoiles(this, X + 154, 132, f.etoiles, 16, 0));
    this.g(texte(this, X + 154, 158, `${NOM_ELEMENT[f.element]} · ${NOM_TYPE[f.type]}`, 13, hex(COULEUR[f.element]), true, 0, 0.5));
    this.g(texte(this, X + 154, 180, vu ? `Éveillé : ${f.nomEveil}` : 'Pas encore obtenu', 12, vu ? '#93a89b' : '#d9a35a', vu ? false : true, 0, 0.5));
    // profil à 6★ niveau 40
    this.gs(hexagoneStats(this, X + 96, 290, 50, [st.pv / 14000, st.atq / 950, st.def / 800, (st.vit - 80) / 50, st.tc / 100, st.res / 100], ['PV', 'ATQ', 'DEF', 'VIT', 'CRIT', 'RÉS'], COULEUR[f.element]));
    ([['PV', st.pv], ['ATQ', st.atq], ['DEF', st.def], ['VIT', st.vit]] as const).forEach(([n, v], i) => {
      const y = 250 + i * 24;
      if (i % 2 === 0) this.g(this.add.rectangle(X + 190, y, L - 214, 23, 0x000000, 0.5).setOrigin(0, 0.5).setDepth(1000));
      this.g(texte(this, X + 200, y, n, 14, '#dfe8d6', false, 0, 0.5));
      this.g(texte(this, X + L - 34, y, fmt(Math.round(v)), 14, '#ffffff', true, 1, 0.5));
    });
    this.g(texte(this, X + 200, 350, 'à 6★ niveau 40, sans rune', 11, '#93a89b', false, 0, 0.5));
    let y = 384;
    for (const s of c.sorts) {
      const cle = s.icone ? `sort_${s.icone}` : '';
      if (cle && this.textures.exists(cle)) {
        this.g(this.add.image(X + 48, y + 22, cle).setDisplaySize(44, 44).setDepth(1001));
        this.g(this.add.rectangle(X + 48, y + 22, 46, 46).setStrokeStyle(2, 0x6f7862).setDepth(1002));
      } else if (cle && !this.load.isLoading()) {
        // icône de sort chargée à la demande
        this.load.image(cle, `assets/ui/sorts/${cle}.png`);
        this.load.once(Phaser.Loader.Events.COMPLETE, () => { if (this.choisi === id && this.scene.isActive()) this.dessiner(); });
        this.load.start();
      }
      this.g(texte(this, X + 82, y, `${s.nom}${s.recharge ? `  ·  recharge ${s.recharge}` : ''}`, 14, '#ffffff', true, 0, 0));
      const d = this.g(texte(this, X + 82, y + 20, s.desc ?? '', 12, '#c9cfc4', false, 0, 0).setWordWrapWidth(L - 116));
      y += Math.max(58, 30 + d.height);
    }
    if (c.leader) this.g(texte(this, X + 26, Math.min(y + 6, 676), `♛ Leader : ${texteLeader(c.leader)}`, 13, '#ffe08a', true, 0, 0).setWordWrapWidth(L - 52));
  }
}
