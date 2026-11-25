import Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import { basculerVerrou, verrouille, type Joueur, type MonstrePossede } from '../sim/joueur';
import { fiche, monstreCombat } from '../sim/fiches';
import { NIVEAU_MAX, XP_NIVEAU } from '../sim/progression';
import { SETS, avecRunes, setsActifs, type SetRune } from '../sim/runes';
import { runesDe } from '../sim/inventaire';
import type { Element, Stats } from '../sim/types';
import { LOOKS } from './looks';
import { creerAnimations } from './animations';
import { VERT, bandeauPierre, carteMonstre, chargerIdentite, decorVivant, eclatEntree, emblemeGrave, etoiles, hexagoneStats, pastille, runeMedaillon } from './identite';
import {
  COULEUR, H, NOM_ELEMENT, NOM_TYPE, OR, POLICE, W, bouton, chargerPuis, chargerUi, fmt, hex, monstreEnPied, panneau, poseNette, texte, texteLeader,
} from './ui';

/**
 * Écran « Monstres », organisé comme celui de Summoners War (planche n° 3 de la DA, 3 bis A) : compteur en haut, vue grille
 * (toute la collection en cartes au fond de la couleur de l'élément) ou vue détail (le monstre animé en grand, la collection
 * en bande en bas) ; à droite, onglets en colonne (Info, Sorts, Runes, Éveil plus tard) et la fiche.
 */
type Tri = 'etoiles' | 'niveau' | 'element';
const NOM_TRI: Record<Tri, string> = { etoiles: 'étoiles', niveau: 'niveau', element: 'élément' };
const ORDRE: Element[] = ['feu', 'eau', 'air', 'bonta', 'brakmar'];
const CLE_VUS = 'arene-des-douze:monstres-vus';
const COLS = 8, LIGNES = 7, PAS = 85, TAILLE = 80;

export class MonstresScene extends Phaser.Scene {
  private joueur!: Joueur;
  private vue: 'grille' | 'detail' = 'grille';
  private onglet: 'info' | 'sorts' | 'runes' = 'info';
  private tri: Tri = 'etoiles';
  private uid = 0;
  private page = 0;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;
  private decor?: { teinter: (c: number) => void };
  /** Sens d'arrivée du prochain monstre affiché en grand (1 : par la droite, -1 : par la gauche, 0 : sans entrée). */
  private entree = 1;
  /** Monstres déjà regardés (les autres portent l'étiquette « Nouveau »). */
  private vus = new Set<number>();

  constructor() { super('monstres'); }

  init(data: { uid?: number; vue?: 'grille' | 'detail' }) {
    this.joueur = charger();
    this.uid = data?.uid ?? this.joueur.equipe[0] ?? this.joueur.monstres[0].uid;
    this.vue = data?.vue ?? 'grille';
    this.onglet = 'info'; this.page = 0; this.calque = []; this.entree = 1;
    // « Nouveau » : la première fois, toute la collection est considérée comme déjà vue
    try {
      const v = localStorage.getItem(CLE_VUS);
      this.vus = new Set(v ? (JSON.parse(v) as number[]) : this.joueur.monstres.map((m) => m.uid));
    } catch { this.vus = new Set(this.joueur.monstres.map((m) => m.uid)); }
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
    // vue détail : glisser à gauche ou à droite sur le monstre pour passer au voisin
    let depart: number | null = null;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { depart = this.vue === 'detail' && p.worldX < 700 && p.worldY > 60 && p.worldY < 600 ? p.worldX : null; });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (depart === null) return;
      const d = p.worldX - depart; depart = null;
      if (Math.abs(d) < 60) return;
      const l = this.tries(), v = l[l.findIndex((x) => x.uid === this.uid) + (d < 0 ? 1 : -1)];
      if (v) { this.uid = v.uid; this.entree = d < 0 ? 1 : -1; this.dessiner(); }
    });
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
    for (const o of carteMonstre(this, m, fiche(m.id).element, x, y, t, {
      choisie: m.uid === this.uid, equipe: this.joueur.equipe.includes(m.uid), verrou: verrouille(this.joueur, m.uid), nouveau: !this.vus.has(m.uid), action,
    })) this.g(o);
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
    if (!this.vus.has(this.uid)) { this.vus.add(this.uid); try { localStorage.setItem(CLE_VUS, JSON.stringify([...this.vus])); } catch { /* stockage indisponible */ } }
    this.fiche();
  }

  private grille(l: MonstrePossede[]) {
    const parPage = COLS * LIGNES, pages = Math.max(1, Math.ceil(l.length / parPage));
    this.page = Math.min(this.page, pages - 1);
    l.slice(this.page * parPage, (this.page + 1) * parPage).forEach((m, k) => {
      const x = 62 + (k % COLS) * PAS, y = 108 + Math.floor(k / COLS) * PAS;
      this.carte(m, x, y, TAILLE, () => { if (this.uid === m.uid) this.vue = 'detail'; this.uid = m.uid; this.onglet = 'info'; this.entree = 1; this.dessiner(); });
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
    for (const o of emblemeGrave(this, f.element, 350, 300, 400)) this.g(o);
    this.g(this.add.ellipse(350, 486, 300, 56, 0x000000, 0.5).setDepth(1000));
    const entree = this.entree; this.entree = 0;
    const idx = l.findIndex((x) => x.uid === this.uid);
    if (!this.textures.exists(atlas)) {
      this.g(texte(this, 350, 300, 'Chargement…', 15, '#93a89b', false, 0.5, 0.5));
      chargerPuis(this, [m.id], () => { creerAnimations(this, atlas); if (this.vue === 'detail' && this.uid === m.uid) { this.entree = entree || 1; this.dessiner(); } });
    } else {
      creerAnimations(this, atlas);
      // environ 300 px de haut, sans agrandir une planche au-delà de ×1,5 (pour rester net)
      const sp = this.g(monstreEnPied(this, m.id, 350, 470, 1).setDepth(1001));
      const gr = Math.min(300 / (sp.frame.cutHeight * Math.abs(sp.scaleY)), 1.5 / Math.abs(sp.scaleY));
      sp.setScale(sp.scaleX * gr, sp.scaleY * gr);
      // la pose nette (rendue en grand) remplace le sprite de la planche, flou une fois agrandi ; le sprite ne sert qu'aux attaques
      const pose = poseNette(this, m.id, sp, () => { if (this.vue === 'detail' && this.uid === m.uid && this.scene.isActive()) { this.entree = 0; this.dessiner(); } });
      if (pose) this.g(pose);
      const acteur: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image = pose ?? sp;
      // au repos la planche n'a qu'une image : une respiration légère donne vie au monstre
      const ex = acteur.scaleX, ey = acteur.scaleY, x0 = acteur.x;
      const respirer = () => { if (acteur.active) this.tweens.add({ targets: acteur, scaleX: ex * 1.015, scaleY: ey * 0.975, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); };
      if (entree) {
        // entrée en scène : il arrive du côté d'où l'on vient, avec un rebond et un éclat de son élément
        acteur.setX(x0 + entree * 380).setAlpha(0).setScale(ex * 0.8, ey * 0.8);
        this.tweens.add({ targets: acteur, x: x0, alpha: 1, scaleX: ex, scaleY: ey, duration: 480, ease: 'Back.easeOut', onComplete: respirer });
        this.time.delayedCall(140, () => { if (acteur.active) eclatEntree(this, 350, 380, COULEUR[f.element]); });
      } else respirer();
      const attaques = [0, 1, 2, 3].map((n) => `${atlas}/AnimAttaque${n}_1`).filter((n) => this.anims.exists(n));
      let k = 0;
      acteur.setInteractive({ useHandCursor: true }).on('pointerup', (p: Phaser.Input.Pointer) => {
        if (!attaques.length || !sp.active || Math.abs(p.upX - p.downX) > 20 || (pose && !pose.visible)) return;
        // l'attaque se joue sur la planche animée, puis la pose nette revient
        if (pose) { pose.setVisible(false); sp.setVisible(true).setAlpha(1); }
        sp.play(attaques[k++ % attaques.length]).once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
          if (!sp.active) return;
          sp.play(`${atlas}/AnimStatique_1`);
          if (pose?.active) { sp.setVisible(false); pose.setVisible(true); }
        });
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
    l.slice(debut, debut + N).forEach((x, k) => { const sel = x.uid === this.uid; this.carte(x, 96 + k * 80, sel ? 658 : 668, sel ? 86 : 70, () => { this.entree = l.indexOf(x) >= idx ? 1 : -1; this.uid = x.uid; this.dessiner(); }); });
    if (debut > 0) { const b = bouton(this, 30, 664, 36, 60, '‹', false, () => { this.uid = l[Math.max(0, i - N)].uid; this.entree = -1; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
    if (debut + N < l.length) { const b = bouton(this, 1042, 664, 36, 60, '›', false, () => { this.uid = l[Math.min(l.length - 1, i + N)].uid; this.entree = 1; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
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
      ['Runes', this.onglet === 'runes', () => { this.onglet = 'runes'; this.dessiner(); }, true],
      ['Éveil', false, () => this.message('L\'éveil des monstres arrive dans une prochaine version.'), false],
    ];
    onglets.forEach(([nom, sel, action, actif], i) => {
      const b = bouton(this, sel ? 782 : 786, 110 + i * 58, sel ? 136 : 128, 48, nom, sel, action);
      if (!sel) b.t.setFontSize(17).setColor(actif ? '#c9d6bf' : '#5f6a5c');
      if (!actif) b.fond.setAlpha(0.5);
      this.g(b.fond); this.g(b.t);
    });
    const X = 866, Y = 76, L = 392, HT = this.vue === 'grille' ? 540 : 516;
    this.g(panneau(this, X, Y, L, HT));
    this.g(this.add.circle(X + 30, Y + 34, 8, COULEUR[f.element]).setStrokeStyle(2, 0x0b100d).setDepth(1001));
    this.g(texte(this, X + 46, Y + 34, f.nom, 20, '#ffffff', true, 0, 0.5));
    for (const e of etoiles(this, X + L - 24, Y + 34, m.etoiles, 19, 1)) this.g(e);
    // XP et « + » vers le Cercle d'amélioration
    const max = NIVEAU_MAX[m.etoiles as keyof typeof NIVEAU_MAX], plein = m.niveau >= max;
    this.g(texte(this, X + 24, Y + 70, 'XP', 13, '#93a89b', false, 0, 0.5));
    this.g(this.add.rectangle(X + 54, Y + 70, L - 184, 14, 0x0e1511).setOrigin(0, 0.5).setStrokeStyle(1.5, 0x4a5a3c).setDepth(1001));
    const besoin = plein ? 0 : XP_NIVEAU[m.etoiles as keyof typeof XP_NIVEAU][m.niveau - 1], part = plein ? 1 : Math.min(1, m.xp / besoin);
    if (part > 0) this.g(this.add.rectangle(X + 55, Y + 70, (L - 186) * part, 11, VERT).setOrigin(0, 0.5).setDepth(1002));
    this.g(texte(this, X + 54 + (L - 184) / 2, Y + 70, plein ? 'MAX' : `${fmt(m.xp)} / ${fmt(besoin)}`, 11, '#ffffff', true, 0.5, 0.5).setDepth(1003));
    const plus = bouton(this, X + L - 46, Y + 70, 40, 32, '+', false, () => this.scene.start('cercle', { cible: m.uid }));
    plus.t.setFontSize(20).setColor('#c6f02e'); this.g(plus.fond); this.g(plus.t);

    // cadenas : un monstre verrouillé ne peut pas servir de nourriture
    const ferme = verrouille(j, m.uid);
    const cad = pastille(this, X + L - 96, Y + 70, ferme ? 'ico_cadenas' : 'ico_cadenas_ouvert', 30, 1003);
    for (const o of cad) this.g(o);
    (cad[0] as Phaser.GameObjects.Arc).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.joueur = basculerVerrou(this.joueur, m.uid); sauver(this.joueur);
      this.message(ferme ? 'Cadenas retiré.' : 'Monstre verrouillé : il ne peut plus servir de nourriture.'); this.dessiner();
    });

    if (this.onglet === 'info') {
      const runes = runesDe(j, m.uid), base = monstreCombat(m.id, m.etoiles, m.niveau), avec = avecRunes(base, runes), st = avec.stats;
      // hexagone : le profil du monstre d'un coup d'œil (runes comprises)
      for (const o of hexagoneStats(this, X + 86, Y + 196, 52, [st.pv / 14000, st.atq / 950, st.def / 800, (st.vit - 80) / 50, st.tc / 100, st.res / 100],
        ['PV', 'ATQ', 'DEF', 'VIT', 'CRIT', 'RÉS'], COULEUR[f.element])) this.g(o);
      const lignes: [string, string, number][] = [
        ['Niveau', `${m.niveau} / ${max}`, 0],
        ...((['pv', 'atq', 'def', 'vit', 'tc', 'dc', 'res', 'pre'] as (keyof Stats)[]).map((k): [string, string, number] => {
          const pc = k === 'tc' || k === 'dc' || k === 'res' || k === 'pre';
          const nom = { pv: 'PV', atq: 'ATQ', def: 'DEF', vit: 'VIT', tc: 'Tx crit.', dc: 'Dég. crit.', res: 'Résist.', pre: 'Précision' }[k];
          return [nom, `${fmt(Math.round(base.stats[k]))}${pc ? ' %' : ''}`, Math.round(avec.stats[k] - base.stats[k])];
        })),
      ];
      const XS = X + 172, LS = L - 172 - 20;
      lignes.forEach(([nom, val, bonus], i) => {
        const y = Y + 108 + i * 22;
        if (i % 2 === 0) this.g(this.add.rectangle(XS, y, LS, 21, 0x000000, 0.5).setOrigin(0, 0.5).setDepth(1000));
        this.g(texte(this, XS + 8, y, nom, 13.5, '#dfe8d6', false, 0, 0.5));
        this.g(texte(this, XS + LS - 56, y, val, 13.5, '#ffffff', true, 1, 0.5));
        if (bonus) this.g(texte(this, XS + LS - 6, y, `+${fmt(bonus)}`, 12.5, '#7fd05a', true, 1, 0.5));
      });
      const yb = Y + 312;
      this.g(texte(this, X + 24, yb, `${NOM_ELEMENT[f.element]} · ${NOM_TYPE[f.type]}`, 13, hex(COULEUR[f.element]), true, 0, 0.5));
      const lead = monstreCombat(m.id).leader;
      if (lead) this.g(texte(this, X + L - 24, yb, `♛ ${texteLeader(lead)}`, 12, '#ffe08a', true, 1, 0.5));
      // résumé des runes, comme dans SW : les six emplacements, les sets actifs et leur effet
      const yr = Y + 330, hr = HT - 330 - 22;
      this.g(this.add.rectangle(X + 20, yr, L - 40, hr, 0x000000, 0.5).setOrigin(0).setStrokeStyle(1.5, 0x4a5a3c).setDepth(1000));
      const actifs = Object.entries(setsActifs(runes)) as [SetRune, number][];
      this.g(texte(this, X + 32, yr + 16, 'Runes', 12.5, '#93a89b', true, 0, 0.5));
      this.g(texte(this, X + L - 32, yr + 16, actifs.length ? actifs.map(([s2, n]) => `${SETS[s2].nom}${n > 1 ? ` ×${n}` : ''}`).join(' · ') : runes.length ? 'Aucun set complet' : 'Aucune rune', 12.5, '#ffe08a', true, 1, 0.5));
      for (let e = 1; e <= 6; e++) {
        const r = runes.find((x) => x.emplacement === e) ?? null;
        for (const o of runeMedaillon(this, r, X + 54 + (e - 1) * 57, yr + 58, 54, { numero: e, profondeur: 1001 })) this.g(o);
      }
      const effets = actifs.map(([s2]) => `${SETS[s2].nom} : ${SETS[s2].effet}`).join('\n') || 'Touche « Runes » pour équiper ce monstre.';
      this.g(texte(this, X + 32, yr + 92, effets, 11.5, '#dfe8d6', false, 0, 0).setWordWrapWidth(L - 64).setLineSpacing(1));
      const zr = this.g(this.add.zone(X + 20, yr, L - 40, hr).setOrigin(0).setDepth(1010).setInteractive({ useHandCursor: true }));
      zr.on('pointerdown', () => this.scene.start('monstre', { uid: m.uid, retour }));
    } else if (this.onglet === 'runes') {
      // comme l'onglet Rune de SW : la roue des six places, l'effet de set, « Gérer », puis mes runes par set
      const portees = runesDe(j, m.uid), cx = X + 118, cy = Y + 196, gerer = (set?: SetRune) => this.scene.start('monstre', { uid: m.uid, retour: { scene: 'monstres', data: { uid: m.uid, vue: this.vue } }, set });
      const gr = this.g(this.add.graphics().setDepth(1000));
      gr.lineStyle(5, 0x0b0d0a, 0.9).strokeCircle(cx, cy, 76).lineStyle(1.5, VERT, 0.45).strokeCircle(cx, cy, 76);
      for (let e = 1; e <= 6; e++) {
        const a = ((e - 1) * Math.PI) / 3;
        for (const o of runeMedaillon(this, portees.find((x) => x.emplacement === e) ?? null, cx + Math.sin(a) * 76, cy - Math.cos(a) * 76, 62, { numero: e, profondeur: 1001 })) this.g(o);
      }
      this.g(this.add.zone(cx, cy, 220, 220).setDepth(1012).setInteractive({ useHandCursor: true })).on('pointerdown', () => gerer());
      const actifs = Object.keys(setsActifs(portees)) as SetRune[];
      this.g(texte(this, X + L - 24, Y + 110, 'Effet de set', 13, '#93a89b', true, 1, 0.5));
      this.g(texte(this, X + L - 24, Y + 132, actifs.length ? actifs.map((s2) => SETS[s2].nom).join('\n') : 'Aucun', 15, actifs.length ? '#ffe08a' : '#5f6a5c', true, 1, 0).setAlign('right'));
      this.g(texte(this, X + L - 24, Y + 190, actifs.map((s2) => SETS[s2].effet).join('\n'), 11, '#dfe8d6', false, 1, 0).setAlign('right').setWordWrapWidth(150));
      const tous = j.runes ?? [];
      this.g(this.add.rectangle(X + 20, Y + 300, L - 40, 1.5, 0x4a5a3c).setOrigin(0).setDepth(1000));
      this.g(texte(this, X + 24, Y + 322, `Runes  ${tous.length}`, 14, '#ffffff', true, 0, 0.5));
      const bg = bouton(this, X + L - 84, Y + 322, 120, 36, 'Gérer', true, () => gerer()); bg.t.setFontSize(16); this.g(bg.fond); this.g(bg.t);
      // les sets que je possède, du plus fourni au moins fourni : toucher un set ouvre « Gérer » sur ce set
      const parSet = (Object.keys(SETS) as SetRune[]).map((s2) => [s2, tous.filter((r) => r.set === s2).length] as const).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
      const lignes = HT > 520 ? 3 : 2;
      parSet.slice(0, lignes * 5).forEach(([s2, n], i) => {
        const x = X + 56 + (i % 5) * 70, y = Y + 376 + Math.floor(i / 5) * 62;
        this.g(this.add.graphics().setDepth(1000).fillStyle(0x161b13).fillRoundedRect(x - 31, y - 26, 62, 56, 7).lineStyle(1.5, 0x4a5a3c).strokeRoundedRect(x - 31, y - 26, 62, 56, 7));
        if (this.textures.exists('symboles')) this.g(this.add.image(x, y - 6, 'symboles', s2).setDisplaySize(30, 30).setDepth(1001));
        this.g(texte(this, x, y + 20, SETS[s2].nom, 9.5, '#dfe8d6', false, 0.5, 0.5));
        this.g(this.add.circle(x + 24, y - 20, 10, 0xb3261e).setStrokeStyle(1.2, 0xffffff).setDepth(1002)); this.g(texte(this, x + 24, y - 20, String(n), 10, '#ffffff', true, 0.5, 0.5).setDepth(1003));
        this.g(this.add.zone(x, y, 62, 56).setDepth(1012).setInteractive({ useHandCursor: true })).on('pointerdown', () => gerer(s2));
      });
      if (!parSet.length) this.g(texte(this, X + L / 2, Y + 400, 'Aucune rune pour l\'instant. Elles tombent dans les zones,\nles coffres des missions et les donjons.', 12.5, '#93a89b', false, 0.5, 0.5).setAlign('center'));
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
