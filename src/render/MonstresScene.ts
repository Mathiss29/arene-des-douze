import Phaser from 'phaser';
import { charger } from './sauvegarde';
import type { Joueur, MonstrePossede } from '../sim/joueur';
import { fiche, monstreCombat } from '../sim/fiches';
import { NIVEAU_MAX } from '../sim/progression';
import { avecRunes } from '../sim/runes';
import { runesDe } from '../sim/inventaire';
import type { Element, Stats } from '../sim/types';
import { LOOKS } from './looks';
import { creerAnimations } from './animations';
import {
  COULEUR, H, NOM_ELEMENT, NOM_TYPE, OR, POLICE, W, bouton, boutonOr, chargerPuis, chargerUi, fmt, hex, monstreEnPied, panneau, portrait, texte, texteLeader,
} from './ui';

/**
 * Écran « Monstres », organisé comme celui de Summoners War (planche n° 3 de la DA, 3 bis A) : compteur en haut, vue grille
 * (toute la collection en cartes au fond de la couleur de l'élément) ou vue détail (le monstre animé en grand, la collection
 * en bande en bas) ; à droite, onglets en colonne (Info, Sorts, Runes, Éveil plus tard) et la fiche.
 */
type Tri = 'etoiles' | 'niveau' | 'element';
const NOM_TRI: Record<Tri, string> = { etoiles: 'étoiles', niveau: 'niveau', element: 'élément' };
const ORDRE: Element[] = ['feu', 'eau', 'air', 'bonta', 'brakmar'];
const COLS = 8, LIGNES = 7, PAS = 84, TAILLE = 76;

export class MonstresScene extends Phaser.Scene {
  private joueur!: Joueur;
  private vue: 'grille' | 'detail' = 'grille';
  private onglet: 'info' | 'sorts' = 'info';
  private tri: Tri = 'etoiles';
  private uid = 0;
  private page = 0;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;

  constructor() { super('monstres'); }

  init(data: { uid?: number; vue?: 'grille' | 'detail' }) {
    this.joueur = charger();
    this.uid = data?.uid ?? this.joueur.equipe[0] ?? this.joueur.monstres[0].uid;
    this.vue = data?.vue ?? 'grille';
    this.onglet = 'info'; this.page = 0; this.calque = [];
  }

  preload() {
    chargerUi(this, []);
    for (const m of this.joueur.monstres) for (const s of monstreCombat(m.id).sorts) {
      if (s.icone && !this.textures.exists(`sort_${s.icone}`)) this.load.image(`sort_${s.icone}`, `assets/ui/sorts/sort_${s.icone}.png`);
    }
  }

  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x1c2a20);
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.25);
    for (const e of ORDRE) this.fondCarte(e);
    // bandeau du haut
    this.add.rectangle(0, 0, W, 48, 0x0e1511, 0.96).setOrigin(0).setDepth(2000);
    this.add.rectangle(0, 48, W, 2, 0xd9b35a).setOrigin(0).setDepth(2000);
    const ret = texte(this, 18, 24, '‹ Incarnam', 17, '#ffe08a', true, 0, 0.5).setDepth(2001);
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ile'));
    this.dessiner();
  }

  /** Fond d'une carte : dégradé rond de la couleur de l'élément (texture faite une fois). */
  private fondCarte(e: Element) {
    const cle = `carte_${e}`;
    if (this.textures.exists(cle)) return;
    const t = this.textures.createCanvas(cle, 96, 96)!, c = t.getContext();
    const col = hex(COULEUR[e]);
    const g = c.createRadialGradient(48, 58, 4, 48, 58, 62);
    g.addColorStop(0, col); g.addColorStop(0.55, col + '88'); g.addColorStop(1, '#141d18');
    c.fillStyle = '#141d18'; c.fillRect(0, 0, 96, 96);
    c.fillStyle = g; c.fillRect(0, 0, 96, 96);
    t.refresh();
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

  /** Carte carrée : fond de l'élément, portrait, étoiles en haut, niveau en bas à droite. */
  private carte(m: MonstrePossede, x: number, y: number, t: number, action: () => void) {
    const f = fiche(m.id), sel = m.uid === this.uid;
    this.g(this.add.image(x, y, `carte_${f.element}`).setDisplaySize(t, t).setDepth(1000));
    const p = portrait(this, m.id, x, y + 2, t - 4, false, false, 1001);
    this.g(p.sp); this.g(p.masque);
    this.g(this.add.rectangle(x, y, t, t).setStrokeStyle(sel ? 4 : 2.5, sel ? 0xfff6c8 : 0x5a4a2a).setDepth(1002));
    this.g(texte(this, x - t / 2 + 3, y - t / 2 - 2, '★'.repeat(m.etoiles), Math.round(t * 0.17), '#ffcf4a', false, 0, 0).setDepth(1003).setShadow(0, 1, '#000', 3, false, true));
    this.g(texte(this, x + t / 2 - 4, y + t / 2 - 1, String(m.niveau), Math.round(t * 0.2), '#ffffff', true, 1, 1).setDepth(1003).setShadow(0, 1, '#000', 4, false, true));
    if (this.joueur.equipe.includes(m.uid)) this.g(texte(this, x - t / 2 + 4, y + t / 2 - 1, '⚔', Math.round(t * 0.17), '#b8f5a0', false, 0, 1).setDepth(1003));
    const z = this.g(this.add.zone(x, y, t, t).setDepth(1004).setInteractive({ useHandCursor: true }));
    z.on('pointerdown', action);
  }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur, l = this.tries();
    if (!l.some((m) => m.uid === this.uid)) this.uid = l[0].uid;
    this.g(texte(this, W / 2, 24, `◆ Monstres ${j.monstres.length} / ${j.places} ◆`, 20, '#ffe9b0', true, 0.5, 0.5).setDepth(2001));
    (['detail', 'grille'] as const).forEach((v, i) => {
      const b = bouton(this, W - 110 + i * 60, 24, 50, 34, v === 'detail' ? '▣' : '▦', false, () => { this.vue = v; this.dessiner(); }, 2001);
      if (this.vue === v) b.t.setColor('#ffe08a');
      this.g(b.fond); this.g(b.t);
    });
    if (this.vue === 'grille') this.grille(l); else this.detail(l);
    this.fiche();
  }

  private grille(l: MonstrePossede[]) {
    const parPage = COLS * LIGNES, pages = Math.max(1, Math.ceil(l.length / parPage));
    this.page = Math.min(this.page, pages - 1);
    l.slice(this.page * parPage, (this.page + 1) * parPage).forEach((m, k) => {
      const x = 62 + (k % COLS) * PAS, y = 104 + Math.floor(k / COLS) * PAS;
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
    const be = boutonOr(this, 1150, 664, 170, 48, 'Bestiaire', () => this.scene.start('bestiaire'));
    this.g(be.fond); this.g(be.t);
  }

  private detail(l: MonstrePossede[]) {
    const m = l.find((x) => x.uid === this.uid)!, f = fiche(m.id), atlas = LOOKS[m.id].atlas;
    // le monstre en grand, animé (sa vraie planche, chargée à la demande) ; le toucher lui fait jouer une attaque
    this.g(this.add.ellipse(350, 470, 300, 60, 0x000000, 0.35).setDepth(1000));
    if (!this.textures.exists(atlas)) {
      this.g(texte(this, 350, 300, 'Chargement…', 15, '#93a89b', false, 0.5, 0.5));
      chargerPuis(this, [m.id], () => { creerAnimations(this, atlas); if (this.vue === 'detail' && this.uid === m.uid) this.dessiner(); });
    } else {
      creerAnimations(this, atlas);
      // environ 300 px de haut, sans agrandir une planche au-delà de ×1,5 (pour rester net)
      const sp = this.g(monstreEnPied(this, m.id, 350, 470, 1).setDepth(1001));
      const gr = Math.min(300 / (sp.frame.cutHeight * Math.abs(sp.scaleY)), 1.5 / Math.abs(sp.scaleY));
      sp.setScale(sp.scaleX * gr, sp.scaleY * gr);
      const attaques = [0, 1, 2, 3].map((n) => `${atlas}/AnimAttaque${n}_1`).filter((n) => this.anims.exists(n));
      let k = 0;
      sp.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (!attaques.length || !sp.active) return;
        sp.play(attaques[k++ % attaques.length]).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => { if (sp.active) sp.play(`${atlas}/AnimStatique_1`); });
      });
    }
    this.g(this.add.rectangle(350, 528, 430, 42, 0x0e1511, 0.85).setDepth(1002));
    this.g(this.add.circle(160, 528, 7, COULEUR[f.element]).setStrokeStyle(2, 0x0b100d).setDepth(1003));
    this.g(texte(this, 176, 528, `Niv. ${m.niveau}  ${f.nom}`, 20, '#ffffff', true, 0, 0.5).setDepth(1003));
    this.g(texte(this, 548, 528, '★'.repeat(m.etoiles), 18, '#ffcf4a', false, 1, 0.5).setDepth(1003));
    // bande de la collection
    this.g(this.add.rectangle(0, 606, W, 114, 0x0e1511, 0.94).setOrigin(0).setDepth(990));
    this.g(this.add.rectangle(0, 606, W, 2, 0xd9b35a).setOrigin(0).setDepth(991));
    const i = l.findIndex((x) => x.uid === this.uid), N = 12, debut = Math.max(0, Math.min(l.length - N, i - Math.floor(N / 2)));
    l.slice(debut, debut + N).forEach((x, k) => this.carte(x, 96 + k * 80, 664, 68, () => { this.uid = x.uid; this.dessiner(); }));
    if (debut > 0) { const b = bouton(this, 30, 664, 36, 60, '‹', false, () => { this.uid = l[Math.max(0, i - N)].uid; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
    if (debut + N < l.length) { const b = bouton(this, 1042, 664, 36, 60, '›', false, () => { this.uid = l[Math.min(l.length - 1, i + N)].uid; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
    const be = boutonOr(this, 1168, 664, 160, 48, 'Bestiaire', () => this.scene.start('bestiaire'));
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
      const b = sel ? boutonOr(this, 786, 110 + i * 58, 128, 48, nom, action) : bouton(this, 786, 110 + i * 58, 128, 48, nom, false, action);
      if (!sel) b.t.setFontSize(17).setColor(actif ? '#c9d6bf' : '#5f6a5c');
      if (!actif) b.fond.setAlpha(0.5);
      this.g(b.fond); this.g(b.t);
    });
    const X = 866, Y = 76, L = 392, HT = this.vue === 'grille' ? 540 : 500;
    this.g(panneau(this, X, Y, L, HT));
    this.g(this.add.rectangle(X, Y, L, HT).setOrigin(0).setStrokeStyle(3, 0xe6c15f).setDepth(901));
    this.g(this.add.circle(X + 30, Y + 34, 8, COULEUR[f.element]).setStrokeStyle(2, 0x0b100d).setDepth(1001));
    this.g(texte(this, X + 46, Y + 34, f.nom, 20, '#ffffff', true, 0, 0.5));
    this.g(texte(this, X + L - 24, Y + 34, '★'.repeat(m.etoiles), 18, '#ffcf4a', false, 1, 0.5));
    // XP et « + » vers le Cercle d'amélioration
    const max = NIVEAU_MAX[m.etoiles as keyof typeof NIVEAU_MAX], plein = m.niveau >= max;
    this.g(texte(this, X + 24, Y + 70, 'XP', 13, '#93a89b', false, 0, 0.5));
    this.g(this.add.rectangle(X + 54, Y + 70, L - 140, 14, 0x0e1511).setOrigin(0, 0.5).setStrokeStyle(1.5, 0x4a5a3c).setDepth(1001));
    if (plein) this.g(texte(this, X + 54 + (L - 140) / 2, Y + 70, 'MAX', 12, '#b9e61c', true, 0.5, 0.5).setDepth(1003));
    const plus = bouton(this, X + L - 46, Y + 70, 40, 32, '+', false, () => this.scene.start('cercle', { cible: m.uid }));
    plus.t.setFontSize(20).setColor('#ffe08a'); this.g(plus.fond); this.g(plus.t);

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
        if (i % 2 === 0) this.g(this.add.rectangle(X + 16, y, L - 32, 30, 0x0e1511, 0.6).setOrigin(0, 0.5).setDepth(1000));
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
          this.g(this.add.rectangle(X + 50, y + 26, 54, 54).setStrokeStyle(2.5, 0xd9b35a).setDepth(1002));
        }
        this.g(texte(this, X + 88, y + 2, `${s.nom}${s.recharge ? `  ·  recharge ${s.recharge}` : ''}`, 16, '#ffffff', true, 0, 0));
        const d = this.g(texte(this, X + 88, y + 26, s.desc ?? '', 13, '#c9cfc4', false, 0, 0).setWordWrapWidth(L - 116));
        y += Math.max(70, 40 + d.height);
      }
    }
    void OR; void H;
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
