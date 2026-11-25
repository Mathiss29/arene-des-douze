import Phaser from 'phaser';
import { charger } from './sauvegarde';
import type { Joueur, MonstrePossede } from '../sim/joueur';
import { fiche, monstreCombat } from '../sim/fiches';
import { NIVEAU_MAX, XP_NIVEAU } from '../sim/progression';
import { avecRunes } from '../sim/runes';
import { runesDe } from '../sim/inventaire';
import type { Element, Stats } from '../sim/types';
import { LOOKS } from './looks';
import { creerAnimations } from './animations';
import { VERT, bandeauPierre, carteMonstre, chargerIdentite, decorVivant, etoiles } from './identite';
import {
  COULEUR, H, NOM_ELEMENT, NOM_TYPE, OR, POLICE, W, bouton, chargerPuis, chargerUi, fmt, hex, monstreEnPied, panneau, texte, texteLeader,
} from './ui';

/**
 * Écran « Monstres », organisé comme celui de Summoners War (planche n° 3 de la DA, 3 bis A) : compteur en haut, vue grille
 * (toute la collection en cartes au fond de la couleur de l'élément) ou vue détail (le monstre animé en grand, la collection
 * en bande en bas) ; à droite, onglets en colonne (Info, Sorts, Runes, Éveil plus tard) et la fiche.
 */
type Tri = 'etoiles' | 'niveau' | 'element';
const NOM_TRI: Record<Tri, string> = { etoiles: 'étoiles', niveau: 'niveau', element: 'élément' };
const ORDRE: Element[] = ['feu', 'eau', 'air', 'bonta', 'brakmar'];
const COLS = 8, LIGNES = 7, PAS = 85, TAILLE = 80;

export class MonstresScene extends Phaser.Scene {
  private joueur!: Joueur;
  private vue: 'grille' | 'detail' = 'grille';
  private onglet: 'info' | 'sorts' = 'info';
  private tri: Tri = 'etoiles';
  private uid = 0;
  private page = 0;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;
  private decor?: { teinter: (c: number) => void };

  constructor() { super('monstres'); }

  init(data: { uid?: number; vue?: 'grille' | 'detail' }) {
    this.joueur = charger();
    this.uid = data?.uid ?? this.joueur.equipe[0] ?? this.joueur.monstres[0].uid;
    this.vue = data?.vue ?? 'grille';
    this.onglet = 'info'; this.page = 0; this.calque = [];
  }

  preload() {
    chargerUi(this, []);
    chargerIdentite(this);
    for (const m of this.joueur.monstres) for (const s of monstreCombat(m.id).sorts) {
      if (s.icone && !this.textures.exists(`sort_${s.icone}`)) this.load.image(`sort_${s.icone}`, `assets/ui/sorts/sort_${s.icone}.png`);
    }
  }

  create() {
    // identité « Pierre et émeraude » : fond de pierre, décor vivant de la couleur de l'élément du monstre choisi
    this.decor = decorVivant(this, 350);
    bandeauPierre(this, 'Incarnam', () => this.scene.start('ile'));
    this.dessiner();
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }

  private tries(): MonstrePossede[] {
    const l = [...this.joueur.monstres];
    const el = (m: MonstrePossede) => ORDRE.indexOf(fiche(m.id).element);
    if (this.tri === 'etoiles') l.sort((a, b) => b.etoiles - a.etoiles || b.niveau - a.niveau || el(a) - el(b));
    else if (this.tri === 'niveau') l.sort((a, b) => b.niveau - a.niveau || b.etoiles - a.etoiles);
    else l.sort((a, b) => el(a) - el(b) || b.etoiles - a.etoiles || b.niveau - a.niveau);
    return l;
  }

  private carte(m: MonstrePossede, x: number, y: number, t: number, action: () => void) {
    for (const o of carteMonstre(this, m, fiche(m.id).element, x, y, t, { choisie: m.uid === this.uid, equipe: this.joueur.equipe.includes(m.uid), action })) this.g(o);
  }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur, l = this.tries();
    if (!l.some((m) => m.uid === this.uid)) this.uid = l[0].uid;
    this.decor?.teinter(COULEUR[fiche(j.monstres.find((m) => m.uid === this.uid)!.id).element]);
    this.g(texte(this, W / 2, 25, `Monstres  ${j.monstres.length} / ${j.places}`, 21, '#eef2e4', true, 0.5, 0.5).setDepth(2001));
    (['detail', 'grille'] as const).forEach((v, i) => {
      const b = bouton(this, W - 110 + i * 60, 25, 50, 34, v === 'detail' ? '▣' : '▦', false, () => { this.vue = v; this.dessiner(); }, 2001);
      if (this.vue === v) b.t.setColor('#c6f02e');
      this.g(b.fond); this.g(b.t);
    });
    if (this.vue === 'grille') this.grille(l); else this.detail(l);
    this.fiche();
  }

  private grille(l: MonstrePossede[]) {
    const parPage = COLS * LIGNES, pages = Math.max(1, Math.ceil(l.length / parPage));
    this.page = Math.min(this.page, pages - 1);
    l.slice(this.page * parPage, (this.page + 1) * parPage).forEach((m, k) => {
      const x = 62 + (k % COLS) * PAS, y = 108 + Math.floor(k / COLS) * PAS;
      this.carte(m, x, y, TAILLE, () => { if (this.uid === m.uid) this.vue = 'detail'; this.uid = m.uid; this.onglet = 'info'; this.dessiner(); });
    });
    if (pages > 1) {
      this.g(texte(this, 356, 692, `${this.page + 1} / ${pages}`, 14, '#c9cfc4', false, 0.5, 0.5));
      if (this.page > 0) { const b = bouton(this, 286, 692, 54, 30, '‹', false, () => { this.page--; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
      if (this.page < pages - 1) { const b = bouton(this, 426, 692, 54, 30, '›', false, () => { this.page++; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
    }
    const tri = bouton(this, 950, 664, 180, 42, `Tri : ${NOM_TRI[this.tri]} ▲`, false, () => {
      this.tri = this.tri === 'etoiles' ? 'niveau' : this.tri === 'niveau' ? 'element' : 'etoiles'; this.page = 0; this.dessiner();
    });
    this.g(tri.fond); this.g(tri.t);
    const be = bouton(this, 1150, 664, 170, 48, 'Bestiaire', true, () => this.scene.start('bestiaire'));
    this.g(be.fond); this.g(be.t);
  }

  private detail(l: MonstrePossede[]) {
    const m = l.find((x) => x.uid === this.uid)!, f = fiche(m.id), atlas = LOOKS[m.id].atlas;
    // le monstre en grand, animé (sa vraie planche, chargée à la demande) ; le toucher lui fait jouer une attaque
    this.g(this.add.ellipse(350, 486, 300, 56, 0x000000, 0.5).setDepth(1000));
    if (!this.textures.exists(atlas)) {
      this.g(texte(this, 350, 300, 'Chargement…', 15, '#93a89b', false, 0.5, 0.5));
      chargerPuis(this, [m.id], () => { creerAnimations(this, atlas); if (this.vue === 'detail' && this.uid === m.uid) this.dessiner(); });
    } else {
      creerAnimations(this, atlas);
      // environ 300 px de haut, sans agrandir une planche au-delà de ×1,5 (pour rester net)
      const sp = this.g(monstreEnPied(this, m.id, 350, 470, 1).setDepth(1001));
      const gr = Math.min(300 / (sp.frame.cutHeight * Math.abs(sp.scaleY)), 1.5 / Math.abs(sp.scaleY));
      sp.setScale(sp.scaleX * gr, sp.scaleY * gr);
      // au repos la planche n'a qu'une image : une respiration légère donne vie au monstre
      const ex = sp.scaleX, ey = sp.scaleY;
      this.tweens.add({ targets: sp, scaleX: ex * 1.015, scaleY: ey * 0.975, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const attaques = [0, 1, 2, 3].map((n) => `${atlas}/AnimAttaque${n}_1`).filter((n) => this.anims.exists(n));
      let k = 0;
      sp.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (!attaques.length || !sp.active) return;
        sp.play(attaques[k++ % attaques.length]).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { if (sp.active) sp.play(`${atlas}/AnimStatique_1`); });
      });
    }
    { const pl = bouton(this, 350, 528, 440, 46, '', false, () => undefined, 1002); pl.fond.disableInteractive(); this.g(pl.fond); this.g(pl.t); }
    this.g(this.add.circle(160, 528, 7, COULEUR[f.element]).setStrokeStyle(2, 0x0b100d).setDepth(1003));
    this.g(texte(this, 176, 528, `Niv. ${m.niveau}  ${f.nom}`, 20, '#ffffff', true, 0, 0.5).setDepth(1003));
    for (const e of etoiles(this, 552, 528, m.etoiles, 20, 1, 1004)) this.g(e);
    // bande de la collection
    this.g(this.add.rectangle(0, 610, W, 110, 0x10130d, 0.82).setOrigin(0).setDepth(990));
    this.g(this.add.rectangle(0, 610, W, 1.5, 0x7a846c).setOrigin(0).setDepth(991));
    const i = l.findIndex((x) => x.uid === this.uid), N = 12, debut = Math.max(0, Math.min(l.length - N, i - Math.floor(N / 2)));
    l.slice(debut, debut + N).forEach((x, k) => this.carte(x, 96 + k * 80, 666, 74, () => { this.uid = x.uid; this.dessiner(); }));
    if (debut > 0) { const b = bouton(this, 30, 664, 36, 60, '‹', false, () => { this.uid = l[Math.max(0, i - N)].uid; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
    if (debut + N < l.length) { const b = bouton(this, 1042, 664, 36, 60, '›', false, () => { this.uid = l[Math.min(l.length - 1, i + N)].uid; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
    const be = bouton(this, 1168, 664, 160, 48, 'Bestiaire', true, () => this.scene.start('bestiaire'));
    this.g(be.fond); this.g(be.t);
  }

  /** Onglets en colonne et fiche du monstre choisi, à droite dans les deux vues. */
  private fiche() {
    const j = this.joueur, m = j.monstres.find((x) => x.uid === this.uid)!, f = fiche(m.id);
    const retour = { scene: 'monstres', data: { uid: m.uid, vue: this.vue } };
    const onglets: [string, boolean, () => void, boolean][] = [
      ['Info', this.onglet === 'info', () => { this.onglet = 'info'; this.dessiner(); }, true],
      ['Sorts', this.onglet === 'sorts', () => { this.onglet = 'sorts'; this.dessiner(); }, true],
      ['Runes', false, () => this.scene.start('monstre', { uid: m.uid, retour }), true],
      ['Éveil', false, () => this.message('L\'éveil des monstres arrive dans une prochaine version.'), false],
    ];
    onglets.forEach(([nom, sel, action, actif], i) => {
      const b = bouton(this, sel ? 782 : 786, 110 + i * 58, sel ? 136 : 128, 48, nom, sel, action);
      if (!sel) b.t.setFontSize(17).setColor(actif ? '#c9d6bf' : '#5f6a5c');
      if (!actif) b.fond.setAlpha(0.5);
      this.g(b.fond); this.g(b.t);
    });
    const X = 866, Y = 76, L = 392, HT = this.vue === 'grille' ? 540 : 500;
    this.g(panneau(this, X, Y, L, HT));
    this.g(this.add.circle(X + 30, Y + 34, 8, COULEUR[f.element]).setStrokeStyle(2, 0x0b100d).setDepth(1001));
    this.g(texte(this, X + 46, Y + 34, f.nom, 20, '#ffffff', true, 0, 0.5));
    for (const e of etoiles(this, X + L - 24, Y + 34, m.etoiles, 19, 1)) this.g(e);
    // XP et « + » vers le Cercle d'amélioration
    const max = NIVEAU_MAX[m.etoiles as keyof typeof NIVEAU_MAX], plein = m.niveau >= max;
    this.g(texte(this, X + 24, Y + 70, 'XP', 13, '#93a89b', false, 0, 0.5));
    this.g(this.add.rectangle(X + 54, Y + 70, L - 140, 14, 0x0e1511).setOrigin(0, 0.5).setStrokeStyle(1.5, 0x4a5a3c).setDepth(1001));
    const besoin = plein ? 0 : XP_NIVEAU[m.etoiles as keyof typeof XP_NIVEAU][m.niveau - 1], part = plein ? 1 : Math.min(1, m.xp / besoin);
    if (part > 0) this.g(this.add.rectangle(X + 55, Y + 70, (L - 142) * part, 11, VERT).setOrigin(0, 0.5).setDepth(1002));
    this.g(texte(this, X + 54 + (L - 140) / 2, Y + 70, plein ? 'MAX' : `${fmt(m.xp)} / ${fmt(besoin)}`, 11, '#ffffff', true, 0.5, 0.5).setDepth(1003));
    const plus = bouton(this, X + L - 46, Y + 70, 40, 32, '+', false, () => this.scene.start('cercle', { cible: m.uid }));
    plus.t.setFontSize(20).setColor('#c6f02e'); this.g(plus.fond); this.g(plus.t);

    if (this.onglet === 'info') {
      const base = monstreCombat(m.id, m.etoiles, m.niveau), avec = avecRunes(base, runesDe(j, m.uid));
      const lignes: [string, string, number][] = [
        ['Niveau', `${m.niveau} / ${max}`, 0],
        ...((['pv', 'atq', 'def', 'vit', 'tc', 'dc', 'res', 'pre'] as (keyof Stats)[]).map((k): [string, string, number] => {
          const pc = k === 'tc' || k === 'dc' || k === 'res' || k === 'pre';
          const nom = { pv: 'PV', atq: 'ATQ', def: 'DEF', vit: 'VIT', tc: 'Taux crit.', dc: 'Dégâts crit.', res: 'Résistance', pre: 'Précision' }[k];
          return [nom, `${fmt(Math.round(base.stats[k]))}${pc ? ' %' : ''}`, Math.round(avec.stats[k] - base.stats[k])];
        })),
      ];
      lignes.forEach(([nom, val, bonus], i) => {
        const y = Y + 112 + i * 34;
        if (i % 2 === 0) this.g(this.add.rectangle(X + 16, y, L - 32, 30, 0x000000, 0.5).setOrigin(0, 0.5).setDepth(1000));
        this.g(texte(this, X + 28, y, nom, 16, '#dfe8d6', false, 0, 0.5));
        this.g(texte(this, X + L - (bonus ? 100 : 28), y, val, 16, '#ffffff', true, 1, 0.5));
        if (bonus) this.g(texte(this, X + L - 28, y, `+${fmt(bonus)}`, 15, '#7fd05a', true, 1, 0.5));
      });
      const yb = Y + 112 + lignes.length * 34 + 8;
      this.g(texte(this, X + 28, yb, `${NOM_ELEMENT[f.element]} · ${NOM_TYPE[f.type]}`, 14, hex(COULEUR[f.element]), true, 0, 0.5));
      const lead = monstreCombat(m.id).leader;
      if (lead) this.g(texte(this, X + 28, yb + 26, `♛ Leader : ${texteLeader(lead)}`, 13, '#ffe08a', true, 0, 0.5).setWordWrapWidth(L - 56));
    } else {
      let y = Y + 104;
      for (const s of monstreCombat(m.id, m.etoiles, m.niveau).sorts) {
        if (s.icone && this.textures.exists(`sort_${s.icone}`)) {
          this.g(this.add.image(X + 50, y + 26, `sort_${s.icone}`).setDisplaySize(52, 52).setDepth(1001));
          this.g(this.add.rectangle(X + 50, y + 26, 54, 54).setStrokeStyle(2, 0x6f7862).setDepth(1002));
        }
        this.g(texte(this, X + 88, y + 2, `${s.nom}${s.recharge ? `  ·  recharge ${s.recharge}` : ''}`, 16, '#ffffff', true, 0, 0));
        const d = this.g(texte(this, X + 88, y + 26, s.desc ?? '', 13, '#c9cfc4', false, 0, 0).setWordWrapWidth(L - 116));
        y += Math.max(70, 40 + d.height);
      }
    }
    void OR; void H; void hex;
  }

  private message(s: string) {
    this.avis?.destroy();
    const tx = this.add.text(0, 0, s, { fontFamily: POLICE, fontSize: '15px', color: '#ffffff', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
    const f = this.add.rectangle(0, 0, tx.width + 36, tx.height + 22, 0x0c1410, 0.95).setStrokeStyle(1.5, 0xb08a3a);
    const c = this.add.container(W / 2, 80, [f, tx]).setDepth(5000);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2400, duration: 500, onComplete: () => c.destroy() });
  }
}
