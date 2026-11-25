import Phaser from 'phaser';
import { charger } from './sauvegarde';
import type { Joueur } from '../sim/joueur';
import MONSTRES from '../data/monstres.json';
import { fiche, monstreCombat } from '../sim/fiches';
import type { Element, FicheMonstre } from '../sim/types';
import { COULEUR, NOM_ELEMENT, NOM_TYPE, W, chargerUi, hex, panneau, texte, texteLeader } from './ui';
import { VERT, bandeauPierre, carteMonstre, chargerIdentite, decorVivant, etoiles, hexagoneStats } from './identite';

/**
 * Bestiaire (maquette « Invocation : » idées) : tous les monstres invocables, en ombre tant qu'on ne les a jamais eus,
 * rangés par étoiles naturelles puis par famille ; toucher un monstre découvert montre sa fiche (profil, sorts, leader).
 * Habillage « Pierre et émeraude », cartes en médaillon comme dans l'écran Monstres.
 */
const TOUS = (MONSTRES as FicheMonstre[]).filter((m) => !m.boss).sort((a, b) => a.etoiles - b.etoiles || a.famille.localeCompare(b.famille) || ordre(a.element) - ordre(b.element));
function ordre(e: Element) { return ['feu', 'eau', 'air', 'bonta', 'brakmar'].indexOf(e); }
const COLS = 7, PAR_PAGE = 35;

export class BestiaireScene extends Phaser.Scene {
  private joueur!: Joueur;
  private page = 0;
  private choisi: string | null = null;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private decor?: { teinter: (c: number) => void };

  constructor() { super('bestiaire'); }

  init() { this.joueur = charger(); this.page = 0; this.choisi = null; this.calque = []; }

  preload() {
    chargerUi(this, []); // portraits : vignettes seulement
    chargerIdentite(this);
  }

  create() {
    this.decor = decorVivant(this, 400);
    bandeauPierre(this, 'Monstres', () => this.scene.start('monstres'));
    const vus = TOUS.filter((m) => this.joueur.decouverts.includes(m.id)).length;
    texte(this, W / 2, 25, `Bestiaire  ${vus} / ${TOUS.length}`, 21, '#eef2e4', true, 0.5, 0.5).setDepth(2001);
    this.dessiner();
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }
  private gs(l: Phaser.GameObjects.GameObject[]) { for (const o of l) this.calque.push(o); }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur;
    this.decor?.teinter(this.choisi && j.decouverts.includes(this.choisi) ? COULEUR[fiche(this.choisi).element] : VERT);
    this.g(panneau(this, 20, 62, 790, 644));
    const pages = Math.ceil(TOUS.length / PAR_PAGE);
    TOUS.slice(this.page * PAR_PAGE, (this.page + 1) * PAR_PAGE).forEach((m, k) => {
      const x = 92 + (k % COLS) * 107, y = 124 + Math.floor(k / COLS) * 114, vu = j.decouverts.includes(m.id);
      this.gs(carteMonstre(this, { id: m.id, etoiles: m.etoiles }, m.element, x, y, 82, { choisie: this.choisi === m.id, inconnu: !vu, action: () => { this.choisi = m.id; this.dessiner(); } }));
      this.g(texte(this, x, y + 53, vu ? m.nom : '???', 10.5, vu ? '#ffffff' : '#5f6a5c', false, 0.5, 0.5));
    });
    if (pages > 1) for (let i = 0; i < pages; i++) {
      const x = 415 + (i - (pages - 1) / 2) * 46, on = i === this.page;
      this.g(this.add.graphics().setDepth(1001).fillStyle(on ? VERT : 0x161b13).fillRoundedRect(x - 19, 668, 38, 28, 7).lineStyle(1.5, on ? 0xf0ff9a : 0x4a5a3c).strokeRoundedRect(x - 19, 668, 38, 28, 7));
      this.g(texte(this, x, 682, String(i + 1), 14, on ? '#1c2408' : '#dfe8d6', true, 0.5, 0.5).setShadow(0, 0, '#000', 0).setDepth(1002));
      this.g(this.add.zone(x, 682, 38, 28).setDepth(1003).setInteractive({ useHandCursor: true })).on('pointerdown', () => { this.page = i; this.dessiner(); });
    }
    this.fiche();
  }

  private fiche() {
    const X = 826, L = 436;
    this.g(panneau(this, X, 62, L, 644));
    const id = this.choisi;
    if (!id) { this.g(texte(this, X + L / 2, 384, 'Touche un monstre.', 15, '#93a89b', false, 0.5, 0.5)); return; }
    const f = fiche(id);
    if (!this.joueur.decouverts.includes(id)) {
      this.gs(carteMonstre(this, { id, etoiles: f.etoiles }, f.element, X + L / 2, 250, 130, { inconnu: true }));
      this.g(texte(this, X + L / 2, 350, '???', 26, '#5f6a5c', true, 0.5, 0.5));
      this.g(texte(this, X + L / 2, 392, `Un monstre ${f.etoiles}★ ${NOM_ELEMENT[f.element]} que tu n'as pas encore eu.`, 14, '#93a89b', false, 0.5, 0.5).setWordWrapWidth(380).setAlign('center'));
      return;
    }
    const c = monstreCombat(id), st = c.stats;
    this.gs(carteMonstre(this, { id, etoiles: f.etoiles }, f.element, X + 84, 148, 116));
    this.g(this.add.circle(X + 160, 104, 7, COULEUR[f.element]).setStrokeStyle(2, 0x0b100d).setDepth(1001));
    this.g(texte(this, X + 174, 104, f.nom, 19, '#ffffff', true, 0, 0.5).setWordWrapWidth(240));
    this.gs(etoiles(this, X + 154, 132, f.etoiles, 16, 0));
    this.g(texte(this, X + 154, 158, `${NOM_ELEMENT[f.element]} · ${NOM_TYPE[f.type]}`, 13, hex(COULEUR[f.element]), true, 0, 0.5));
    this.g(texte(this, X + 154, 180, `Éveillé : ${f.nomEveil}`, 12, '#93a89b', false, 0, 0.5));
    // profil à 6★ niveau 40
    this.gs(hexagoneStats(this, X + 96, 290, 50, [st.pv / 14000, st.atq / 950, st.def / 800, (st.vit - 80) / 50, st.tc / 100, st.res / 100], ['PV', 'ATQ', 'DEF', 'VIT', 'CRIT', 'RÉS'], COULEUR[f.element]));
    ([['PV', st.pv], ['ATQ', st.atq], ['DEF', st.def], ['VIT', st.vit]] as const).forEach(([n, v], i) => {
      const y = 250 + i * 24;
      if (i % 2 === 0) this.g(this.add.rectangle(X + 190, y, L - 214, 23, 0x000000, 0.5).setOrigin(0, 0.5).setDepth(1000));
      this.g(texte(this, X + 200, y, n, 14, '#dfe8d6', false, 0, 0.5));
      this.g(texte(this, X + L - 34, y, String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), 14, '#ffffff', true, 1, 0.5));
    });
    this.g(texte(this, X + 200, 350, 'à 6★ niveau 40', 11, '#93a89b', false, 0, 0.5));
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
