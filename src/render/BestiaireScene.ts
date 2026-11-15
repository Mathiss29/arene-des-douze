import Phaser from 'phaser';
import { charger } from './sauvegarde';
import type { Joueur } from '../sim/joueur';
import MONSTRES from '../data/monstres.json';
import { fiche, monstreCombat } from '../sim/fiches';
import type { Element, FicheMonstre } from '../sim/types';
import { COULEUR, H, NOM_ELEMENT, NOM_TYPE, OR, W, chargerUi, panneau, portrait, texte, texteLeader } from './ui';

/**
 * Bestiaire (maquette « Invocation : » idées) : tous les monstres invocables, en ombre tant qu'on ne les a jamais eus,
 * rangés par étoiles naturelles puis par famille ; toucher un monstre découvert montre sa fiche (sorts, leader).
 */
const TOUS = (MONSTRES as FicheMonstre[]).filter((m) => !m.boss).sort((a, b) => a.etoiles - b.etoiles || a.famille.localeCompare(b.famille) || ordre(a.element) - ordre(b.element));
function ordre(e: Element) { return ['feu', 'eau', 'air', 'bonta', 'brakmar'].indexOf(e); }
const PAR_PAGE = 30;

export class BestiaireScene extends Phaser.Scene {
  private joueur!: Joueur;
  private page = 0;
  private choisi: string | null = null;
  private calque: Phaser.GameObjects.GameObject[] = [];

  constructor() { super('bestiaire'); }

  init() { this.joueur = charger(); this.page = 0; this.choisi = null; this.calque = []; }

  preload() {
    chargerUi(this, TOUS.map((m) => m.id));
    if (!this.textures.exists('zaap_incarnam')) this.load.image('zaap_incarnam', 'assets/zaap/incarnam.webp');
  }

  create() {
    const fond = this.add.image(W / 2, H / 2, 'zaap_incarnam').setTint(0x5a6450);
    fond.setScale(Math.max(W / fond.width, H / fond.height));
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.45);
    const ret = texte(this, 16, 14, '‹ Incarnam', 15, '#ffe08a', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ile'));
    const vus = TOUS.filter((m) => this.joueur.decouverts.includes(m.id)).length;
    texte(this, ret.x + ret.width + 10, 14, `Bestiaire · ${vus} / ${TOUS.length}`, 15, '#ffffff', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    this.dessiner();
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur;
    this.g(panneau(this, 20, 60, 760, 640));
    const pages = Math.ceil(TOUS.length / PAR_PAGE);
    TOUS.slice(this.page * PAR_PAGE, (this.page + 1) * PAR_PAGE).forEach((m, k) => {
      const x = 80 + (k % 6) * 120, y = 120 + Math.floor(k / 6) * 112, vu = j.decouverts.includes(m.id);
      this.g(this.add.circle(x, y, 42, 0x0b1210).setStrokeStyle(this.choisi === m.id ? 3 : 1.5, vu ? COULEUR[m.element] : 0x3c4840).setDepth(1000));
      const p = portrait(this, m.id, x, y, 80, true);
      if (!vu) p.sp.setTintFill(0x101814);
      this.g(p.sp); this.g(p.masque);
      this.g(texte(this, x, y + 46, vu ? m.nom : '???', 11, vu ? '#ffffff' : '#5f6a5c', false, 0.5, 0));
      this.g(texte(this, x - 40, y - 46, '★'.repeat(m.etoiles), 10, '#ffcf4a', false, 0, 0));
      const z = this.g(this.add.zone(x, y, 100, 100).setDepth(1002).setInteractive({ useHandCursor: true }));
      z.on('pointerdown', () => { this.choisi = m.id; this.dessiner(); });
    });
    if (pages > 1) for (let i = 0; i < pages; i++) {
      const t = this.g(texte(this, 340 + i * 50, 676, String(i + 1), 14, i === this.page ? '#1d1405' : '#cfdccf', true, 0.5, 0.5).setBackgroundColor(i === this.page ? '#e3b54c' : 'rgba(42,58,50,0.95)').setPadding(12, 5, 12, 5));
      t.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.page = i; this.dessiner(); });
    }
    this.fiche();
  }

  private fiche() {
    this.g(panneau(this, 800, 60, 460, 640));
    const id = this.choisi;
    if (!id) { this.g(texte(this, 1030, 380, 'Touche un monstre.', 15, '#93a89b', false, 0.5, 0.5)); return; }
    const f = fiche(id);
    if (!this.joueur.decouverts.includes(id)) {
      this.g(texte(this, 1030, 340, '???', 30, '#5f6a5c', true, 0.5, 0.5));
      this.g(texte(this, 1030, 390, `Un monstre ${f.etoiles}★ ${NOM_ELEMENT[f.element]} que tu n'as pas encore eu.`, 14, '#93a89b', false, 0.5, 0.5).setWordWrapWidth(400).setAlign('center'));
      return;
    }
    const c = monstreCombat(id);
    const p = portrait(this, id, 1030, 160, 140, true);
    this.g(p.sp); this.g(p.masque);
    this.g(texte(this, 1030, 240, f.nom, 20, '#ffffff', true, 0.5, 0));
    this.g(texte(this, 1030, 270, `${'★'.repeat(f.etoiles)} · ${NOM_ELEMENT[f.element]} · ${NOM_TYPE[f.type]} · éveillé : ${f.nomEveil}`, 12, OR, false, 0.5, 0));
    let y = 306;
    for (const s of c.sorts) {
      this.g(texte(this, 824, y, `${s.nom}${s.recharge ? ` (recharge ${s.recharge})` : ''}`, 14, '#ffffff', true, 0, 0));
      const d = this.g(texte(this, 824, y + 20, s.desc ?? '', 12, '#c9cfc4', false, 0, 0).setWordWrapWidth(410));
      y += 30 + d.height;
    }
    if (c.leader) this.g(texte(this, 824, y + 6, `Leader : ${texteLeader(c.leader)}`, 13, '#ffe08a', true, 0, 0).setWordWrapWidth(410));
  }
}
