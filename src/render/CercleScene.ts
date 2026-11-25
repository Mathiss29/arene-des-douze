import Phaser from 'phaser';
import { fiche, monstreCombat } from '../sim/fiches';
import { apercuNourrir, evoluer, monstre, nourrir, pointsNourriture, trierMonstres, type Joueur, type MonstrePossede } from '../sim/joueur';
import { ajouterXp, COUT_EVOLUTION, NIVEAU_MAX, NOURRITURE_MAX, pointsRequis, XP_NIVEAU, type Etoiles } from '../sim/progression';
import { Rng } from '../sim/rng';
import { competencesAuMax, memeFamille, niveauxDe } from '../sim/competences';
import { noterMission } from '../sim/missions';
import { LOOKS } from './looks';
import { creerAnimations } from './animations';
import { preparerTextures } from './effets';
import { charger, sauver } from './sauvegarde';
import { bouton, caseSombre, chargerPuis, chargerUi, CHIFFRES, COULEUR, fmt, H, monstreEnPied, NOM_TYPE, OR, panneau, portrait, poseNette, POLICE, texte, W } from './ui';
import { VERT, bandeauPierre, carteMonstre, chargerIdentite, decorVivant, etoiles as etoilesDessinees } from './identite';

/**
 * Stèle d'amélioration, disposée comme dans Summoners War (vidéo de Mathis du 25/11/2026 ✓, règles de la maquette « Évolution : » 1A…9A) :
 * trois onglets en colonne à gauche (Amélioration, Évoluer, Éveil), le monstre choisi au centre avec sa jauge, la nourriture dans une
 * rangée de cases (« + » ouvre la fenêtre « Sélectionner le monstre », « Sélection auto » la remplit), la collection en grille à droite.
 * Protégés (cadenas) : l'équipe toujours ; les 3★ et plus quand on nourrit (ils servent à l'évolution, avec confirmation).
 */

type Onglet = 'xp' | 'evo';
const PAR_PAGE = 20;
/** Centre de la zone du monstre choisi. */
const CX = 510;
const ETOILE = '★';

export class CercleScene extends Phaser.Scene {
  private joueur!: Joueur;
  private onglet: Onglet = 'evo';
  private cible: number | null = null;
  private nourr: number[] = [];
  private page = 0;
  private alerte = '';
  private occupe = false;
  private calque: { destroy(): void }[] = [];
  private choixNourr = false;
  private pageNourr = 0;
  private triCroissant = true;
  private decor?: { teinter: (c: number) => void };
  /** Portraits des cases de nourriture (pour l'animation où ils volent vers le monstre). */
  private casesNourr: Phaser.GameObjects.Sprite[] = [];
  private sujet: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super('cercle');
  }

  init(data: { stage?: string; cible?: number }) {
    this.joueur = charger();
    this.cible = data?.cible ?? null;
    this.nourr = [];
    this.alerte = '';
    this.occupe = false;
    this.choixNourr = false; this.pageNourr = 0; this.page = 0;
  }

  preload() {
    // portraits en vignettes ; la planche du monstre choisi est chargée quand on le choisit
    chargerUi(this, []);
    chargerIdentite(this);
  }

  create() {
    this.calque = [];
    preparerTextures(this);
    this.decor = decorVivant(this, CX);
    bandeauPierre(this, 'Incarnam', () => !this.occupe && this.scene.start('ile'));
    texte(this, W / 2, 25, 'Stèle d\'amélioration', 21, '#eef2e4', true, 0.5, 0.5).setDepth(2001);
    for (const id of new Set(this.joueur.monstres.map((m) => m.id))) creerAnimations(this, LOOKS[id].atlas);
    this.dessiner();
  }

  // ───────────── outils ─────────────

  private g<T extends { destroy(): void }>(o: T): T {
    this.calque.push(o);
    return o;
  }

  private t(x: number, y: number, s: string, taille = 14, couleur = '#e9efe6', gras = false, ox = 0.5, oy = 0) {
    return this.g(texte(this, x, y, s, taille, couleur, gras, ox, oy));
  }

  private etoiles = (n: number) => ETOILE.repeat(n);
  private cibleM = () => (this.cible === null ? null : monstre(this.joueur, this.cible));

  /** Cadenas : l'équipe, et les 3★ et plus quand on nourrit. */
  private verrou(m: MonstrePossede): string | null {
    if (this.joueur.equipe.includes(m.uid)) return 'Monstre de ton équipe : retire-le de l\'équipe pour le donner.';
    if ((this.joueur.verrous ?? []).includes(m.uid)) return 'Monstre verrouillé : retire son cadenas dans l\'écran Monstres pour le donner.';
    // les 3★ et plus sont gardés pour l'évolution, sauf ceux de la même famille : ils montent une compétence
    const c = this.cibleM();
    if (this.onglet === 'xp' && m.etoiles >= 3 && !(c && memeFamille(m.id, c.id) && !competencesAuMax(c))) return 'Les 3★ et plus sont gardés pour l\'évolution.';
    return null;
  }

  private positionCase(i: number) {
    return { x: CX + (i - (NOURRITURE_MAX - 1) / 2) * 84, y: 574 };
  }

  // ───────────── actions ─────────────

  private changerOnglet(o: Onglet) {
    if (this.occupe) return;
    this.onglet = o;
    this.nourr = [];
    this.alerte = '';
    this.dessiner();
  }

  /** Grille de droite : choisir le monstre à améliorer. */
  private choisirCible(m: MonstrePossede) {
    if (this.occupe) return;
    this.cible = this.cible === m.uid ? null : m.uid; this.nourr = []; this.alerte = ''; this.dessiner();
  }

  /** Pourquoi ce monstre ne peut pas être donné (ou null s'il le peut). */
  private refus(m: MonstrePossede): string | null {
    const c = this.cibleM();
    if (!c) return 'Choisis d\'abord le monstre à améliorer.';
    const v = this.verrou(m);
    if (v) return v;
    if (this.onglet === 'evo') {
      if (c.etoiles >= 6) return 'Déjà 6★ : il ne peut plus évoluer.';
      if (m.etoiles > c.etoiles) return `La nourriture doit avoir ${c.etoiles}★ ou moins.`;
    }
    return null;
  }

  /** Fenêtre de nourriture ou case de nourriture : donner ou reprendre un monstre. */
  private clicCollection(m: MonstrePossede) {
    if (this.occupe) return;
    const c = this.cibleM();
    if (!c) return;
    const i = this.nourr.indexOf(m.uid);
    if (i >= 0) { this.nourr.splice(i, 1); this.alerte = ''; this.dessiner(); return; }
    const r = this.refus(m);
    if (r) { this.alerte = r; this.dessiner(); return; }
    if (this.onglet === 'evo' && pointsNourriture(this.joueur, this.nourr) >= pointsRequis(c.etoiles as 1 | 2 | 3 | 4 | 5)) { this.alerte = 'Il y a déjà assez de points.'; this.dessiner(); return; }
    if (this.nourr.length >= NOURRITURE_MAX) { this.alerte = `${NOURRITURE_MAX} monstres au plus.`; this.dessiner(); return; }
    this.nourr.push(m.uid);
    this.alerte = '';
    this.dessiner();
  }

  /** « Sélection auto » : les monstres les moins étoilés et les moins montés d'abord, sans toucher aux protégés. */
  private selectionAuto() {
    const c = this.cibleM();
    if (this.occupe || !c) return;
    const dispo = this.joueur.monstres.filter((m) => m.uid !== c.uid && !this.refus(m)).sort((a, b) => a.etoiles - b.etoiles || a.niveau - b.niveau);
    this.nourr = [];
    if (this.onglet === 'xp') this.nourr = dispo.slice(0, NOURRITURE_MAX).map((m) => m.uid);
    else if (c.etoiles < 6) {
      // évolution : les plus étoilés permis d'abord, pour atteindre les points avec 5 monstres au plus
      const req = pointsRequis(c.etoiles as 1 | 2 | 3 | 4 | 5);
      for (const m of [...dispo].reverse()) { if (this.nourr.length >= NOURRITURE_MAX || pointsNourriture(this.joueur, this.nourr) >= req) break; this.nourr.push(m.uid); }
    }
    this.alerte = this.nourr.length ? '' : 'Aucun monstre à donner pour l\'instant.';
    this.dessiner();
  }

  private pret(): boolean {
    const c = this.cibleM();
    if (!c || !this.nourr.length) return false;
    // au niveau max, l'XP serait perdue : on ne laisse pas payer pour rien
    // … sauf si la nourriture est de sa famille et qu'une compétence peut encore monter
    const competence = !competencesAuMax(c) && this.nourr.some((u) => memeFamille(monstre(this.joueur, u).id, c.id));
    if (this.onglet === 'xp') return (c.niveau < NIVEAU_MAX[c.etoiles as Etoiles] || competence) && this.joueur.kamas >= apercuNourrir(this.joueur, this.nourr).kamas;
    if (c.etoiles >= 6) return false;
    const e = c.etoiles as 1 | 2 | 3 | 4 | 5;
    return pointsNourriture(this.joueur, this.nourr) >= pointsRequis(e) && this.joueur.kamas >= COUT_EVOLUTION[e];
  }

  private valider() {
    if (this.occupe || !this.pret()) return;
    const rares = this.nourr.filter((u) => monstre(this.joueur, u).etoiles >= 3);
    if (rares.length) this.confirmer(() => this.lancer());
    else this.lancer();
  }

  /** Confirmation quand la nourriture compte un 3★ ou plus (choix 8A). */
  private confirmer(ok: () => void) {
    const objets: { destroy(): void }[] = [];
    const D = 6000;
    const fermer = () => objets.forEach((o) => o.destroy());
    objets.push(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7).setDepth(D).setInteractive());
    objets.push(panneau(this, 390, 230, 500, 230, D + 1));
    const c = this.cibleM()!;
    objets.push(texte(this, 640, 252, `${this.onglet === 'xp' ? 'Nourrir' : 'Faire évoluer'} ${fiche(c.id).nom} ?`, 20, '#ffe08a', true).setDepth(D + 2));
    objets.push(texte(this, 640, 292, 'Ces monstres disparaîtront :', 14, '#cfdccf').setDepth(D + 2));
    objets.push(texte(this, 640, 316, this.nourr.map((u) => { const m = monstre(this.joueur, u); return `${fiche(m.id).nom} ${this.etoiles(m.etoiles)}`; }).join(', '), 14, '#ffffff', true)
      .setWordWrapWidth(440).setAlign('center').setDepth(D + 2));
    const a = bouton(this, 560, 410, 150, 44, 'Annuler', false, fermer, D + 2);
    const b = bouton(this, 730, 410, 170, 48, 'Confirmer', true, () => { fermer(); ok(); }, D + 2);
    objets.push(a.fond, a.t, b.fond, b.t);
  }

  /** Les monstres donnés volent vers le monstre choisi, puis l'évolution ou le gain d'XP. */
  private lancer() {
    this.occupe = true;
    this.alerte = '';
    for (const o of this.calque) if (o instanceof Phaser.GameObjects.Text && (o.getData('nourr') || o.getData('titre') || o.getData('alerte'))) this.tweens.add({ targets: o, alpha: 0, duration: 250 });
    const sujet = this.sujet!;
    const cx = sujet.x, cy = sujet.y - 60;
    this.choixNourr = false;
    this.casesNourr.forEach((p, i) => {
      p.clearMask();
      this.tweens.add({ targets: p, x: cx, y: cy, scale: p.scale * 0.2, alpha: 0, duration: 480, delay: i * 70, ease: 'Cubic.easeIn' });
    });
    this.time.delayedCall(560 + this.casesNourr.length * 70, () => (this.onglet === 'evo' ? this.animerEvolution(cx, cy) : this.animerNourrir(cx, cy)));
  }

  private eclats(x: number, y: number, couleurs: number[], n: number) {
    const p = this.add.particles(x, y, 'fx:etincelle', { speed: { min: 80, max: 260 }, lifespan: 800, scale: { start: 0.6, end: 0 }, tint: couleurs, blendMode: 'ADD', emitting: false }).setDepth(3000);
    p.explode(n);
    this.time.delayedCall(1000, () => p.destroy());
  }

  /** Choix 7A : les étoiles s'allument une à une, puis un éclair. */
  private animerEvolution(cx: number, cy: number) {
    const c = this.cibleM()!;
    const avant = niveauxDe(c);
    this.joueur = noterMission(evoluer(this.joueur, c.uid, this.nourr, new Rng(Date.now())), 'ameliorer', 1, Date.now());
    const gagnes = niveauxDe(monstre(this.joueur, c.uid)).reduce((n, v, i) => n + v - avant[i], 0);
    sauver(this.joueur);
    const total = c.etoiles + 1;
    const y = 452, larg = 26;
    const etoiles: Phaser.GameObjects.Text[] = [];
    this.calque.filter((o) => o instanceof Phaser.GameObjects.Image && o.getData('etoiles')).forEach((o) => (o as Phaser.GameObjects.Image).setVisible(false));
    for (let i = 0; i < total; i++) {
      this.time.delayedCall(i * 260, () => {
        const s = this.add.text(CX + (i - (total - 1) / 2) * larg, y, ETOILE, { fontFamily: 'Lexend', fontSize: '28px', color: '#ffcf4a', resolution: 2 })
          .setOrigin(0.5).setStroke('#5a3a00', 4).setDepth(3001).setScale(0);
        etoiles.push(s);
        this.tweens.add({ targets: s, scale: 1, angle: { from: -90, to: 0 }, duration: 320, ease: 'Back.easeOut' });
        this.eclats(s.x, s.y, [0xffcf4a, 0xffffff], 10);
      });
    }
    this.time.delayedCall(total * 260 + 200, () => {
      this.cameras.main.flash(450, 255, 246, 200);
      this.eclats(cx, cy, [0xfff6c8, COULEUR[fiche(c.id).element], 0xffffff], 40);
      const nom = fiche(c.id).nom;
      const ban = this.add.text(CX, 186, `${nom} passe à ${this.etoiles(total)} !${gagnes ? `\nCompétence +${gagnes}` : ''}`, { fontFamily: CHIFFRES, fontSize: '30px', color: '#ffcf4a', resolution: 2 })
        .setOrigin(0.5).setStroke('#3a2400', 6).setDepth(3002).setAlpha(0);
      this.tweens.add({ targets: ban, alpha: 1, y: 176, duration: 300 });
      this.tweens.add({ targets: ban, alpha: 0, delay: 1800, duration: 400, onComplete: () => ban.destroy() });
      this.time.delayedCall(700, () => {
        etoiles.forEach((s) => s.destroy());
        this.nourr = [];
        this.occupe = false;
        this.dessiner();
      });
    });
  }

  private animerNourrir(cx: number, cy: number) {
    const c = this.cibleM()!;
    const r = nourrir(this.joueur, c.uid, this.nourr, new Rng(Date.now()));
    this.joueur = noterMission(r.joueur, 'ameliorer', 1, Date.now());
    sauver(this.joueur);
    this.eclats(cx, cy, [0x7ee07a, 0xffffff], 24);
    const lignes = [`+${fmt(r.xp)} XP`];
    if (r.bonus) lignes.push('Bonus ×1,5 !');
    if (r.niveaux > 0) lignes.push(r.niveaux > 1 ? `+${r.niveaux} NIVEAUX !` : 'NIVEAU SUPÉRIEUR !');
    const sorts = monstreCombat(c.id).sorts;
    for (const i of r.competences) lignes.push(`Compétence +1 : ${sorts[i].nom}`);
    lignes.forEach((l, i) => {
      const t = this.add.text(cx, cy - 40 - i * 30, l, { fontFamily: CHIFFRES, fontSize: i === 0 ? '24px' : '20px', color: i === 0 ? '#ffffff' : l.startsWith('Bonus') ? '#ffcf4a' : '#7ee07a', resolution: 2 })
        .setOrigin(0.5).setStroke('#10380e', 5).setDepth(3002).setScale(0.4);
      this.tweens.add({ targets: t, scale: 1, y: t.y - 16, duration: 380, delay: i * 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, alpha: 0, delay: 1500 + i * 200, duration: 400, onComplete: () => t.destroy() });
    });
    if (r.niveaux > 0) this.cameras.main.flash(300, 200, 255, 200);
    this.time.delayedCall(700, () => { this.nourr = []; this.occupe = false; this.dessiner(); });
  }

  // ───────────── écran ─────────────

  private puce(x: number, y: number, w: number, h: number, lib: string, on: boolean, action: () => void, profondeur = 1001, taille = 13) {
    this.g(this.add.graphics().setDepth(profondeur).fillStyle(on ? VERT : 0x161b13).fillRoundedRect(x, y - h / 2, w, h, 7).lineStyle(1.5, on ? 0xf0ff9a : 0x4a5a3c).strokeRoundedRect(x, y - h / 2, w, h, 7));
    this.g(this.add.text(x + w / 2, y, lib, { fontFamily: POLICE, fontSize: `${taille}px`, fontStyle: '600', color: on ? '#1c2408' : '#dfe8d6' }).setOrigin(0.5).setDepth(profondeur + 1));
    this.g(this.add.zone(x, y - h / 2, w, h).setOrigin(0).setDepth(profondeur + 2).setInteractive({ useHandCursor: true })).on('pointerdown', () => { if (!this.occupe) action(); });
  }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    this.casesNourr = [];
    this.sujet = null;
    const j = this.joueur;
    const c = this.cibleM();
    const xp = this.onglet === 'xp';
    this.decor?.teinter(c ? COULEUR[fiche(c.id).element] : VERT);
    this.t(W - 18, 25, `${fmt(j.kamas)} kamas`, 15, '#ffe08a', true, 1, 0.5).setDepth(2001);

    // les trois onglets en colonne, comme dans SW
    ([['xp', 'Amélioration'], ['evo', 'Évoluer']] as [Onglet, string][]).forEach(([o, nom], i) => {
      const actif = this.onglet === o;
      const b = bouton(this, actif ? 100 : 96, 96 + i * 58, actif ? 160 : 152, 48, nom, actif, () => this.changerOnglet(o));
      b.t.setFontSize(actif ? 17 : 16); if (!actif) b.t.setColor('#c9d6bf');
      this.g(b.fond); this.g(b.t);
    });
    const ev = bouton(this, 96, 212, 152, 48, 'Éveil', false, () => { this.alerte = 'L\'éveil des monstres arrive dans une prochaine version.'; this.dessiner(); });
    ev.t.setFontSize(16).setColor('#5f6a5c'); ev.fond.setAlpha(0.5); this.g(ev.fond); this.g(ev.t);

    if (!c) {
      this.t(CX, 300, 'Choisis à droite le monstre à améliorer.', 20, '#ffe08a', true);
      this.t(CX, 334, xp ? 'Amélioration : il gagne l\'XP des monstres que tu lui donnes (jusqu\'à 5).' : 'Évoluer : il gagne une étoile et garde son niveau.', 14, '#9fb3a6');
    } else this.zoneCible(c, xp);

    // bouton principal, avec son coût
    if (c) {
      const pret = this.pret();
      const cout = xp ? apercuNourrir(j, this.nourr).kamas : c.etoiles < 6 ? COUT_EVOLUTION[c.etoiles as 1 | 2 | 3 | 4 | 5] : 0;
      const b = bouton(this, CX, 660, 300, 54, `${xp ? 'Amélioration' : 'Évoluer'}  ·  ${fmt(cout)} kamas`, true, () => this.valider());
      this.g(b.fond); this.g(b.t);
      if (!pret || this.occupe) b.griser();
      if (!xp && c.etoiles < 6 && j.kamas < cout) this.alerte ||= `Il manque ${fmt(cout - j.kamas)} kamas.`;
    }
    if (this.alerte) this.t(CX, 506, this.alerte, 13, '#ff8a7a', true).setBackgroundColor('rgba(0,0,0,0.7)').setPadding(10, 4, 10, 4).setDepth(1500).setData('alerte', true);

    this.collection(c);
    if (this.choixNourr && c) this.fenetreNourriture(c);
  }

  private zoneCible(c: MonstrePossede, xp: boolean) {
    const j = this.joueur;
    const f = fiche(c.id);
    const e = c.etoiles as Etoiles;
    const req = e < 6 ? pointsRequis(e as 1 | 2 | 3 | 4 | 5) : 0;

    // en tête : nom, étoiles, puis la jauge (XP ou points de nourriture)
    this.g(this.add.circle(CX - 150, 84, 7, COULEUR[f.element]).setStrokeStyle(2, 0x0b100d).setDepth(1001));
    this.t(CX - 136, 84, f.nom, 19, '#ffffff', true, 0, 0.5);
    for (const o of etoilesDessinees(this, CX + 160, 84, c.etoiles, 17, 1)) { this.g(o); (o as Phaser.GameObjects.Image).setData('etoiles', true); }
    const gx = CX - 160, gw = 320, gy = 132;
    const jauge = (part: number, couleur: number, lib: string) => {
      const gb = this.g(this.add.graphics().setDepth(1001));
      gb.fillStyle(0x0b0d0a).fillRoundedRect(gx, gy - 9, gw, 18, 5).lineStyle(1.5, 0x4a5a3c).strokeRoundedRect(gx, gy - 9, gw, 18, 5);
      if (part > 0) gb.fillStyle(couleur).fillRoundedRect(gx + 2, gy - 7, Math.max(4, (gw - 4) * Math.min(1, part)), 14, 4);
      this.t(CX, gy, lib, 12, '#ffffff', true, 0.5, 0.5).setDepth(1002);
    };
    if (xp) {
      const ap = apercuNourrir(j, this.nourr);
      const apres = ajouterXp(e, c.niveau, c.xp, ap.xp);
      const part = (n: number, x: number) => (n >= NIVEAU_MAX[e] ? 1 : x / XP_NIVEAU[e][n - 1]);
      this.t(gx, 110, `Niv. ${c.niveau}  ▸`, 15, '#dfe8d6', true, 0, 0.5);
      this.t(gx + 78, 110, apres.niveau >= NIVEAU_MAX[e] ? `${apres.niveau} (max)` : String(apres.niveau), 15, apres.niveau > c.niveau ? '#7ee07a' : '#ffffff', true, 0, 0.5);
      this.t(gx + gw, 110, this.nourr.length ? `+${fmt(ap.xp)} XP` : `${NOM_TYPE[f.type]}`, 13, this.nourr.length ? '#7ee07a' : '#93a89b', true, 1, 0.5);
      jauge(part(apres.niveau, apres.xp), VERT, `${Math.round(part(apres.niveau, apres.xp) * 1000) / 10} %`);
      this.t(CX, 156, c.niveau >= NIVEAU_MAX[e] ? 'Niveau max : fais-le évoluer, ou donne-lui un monstre de sa famille pour monter une compétence.' : '20 % de chances de recevoir ×1,5', 11, c.niveau >= NIVEAU_MAX[e] ? '#ffcf4a' : '#93a89b', false, 0.5, 0.5);
    } else if (e >= 6) {
      this.t(CX, 126, 'Déjà 6★ : niveau d\'évolution maximal.', 15, '#ffcf4a', true, 0.5, 0.5);
    } else {
      const pts = pointsNourriture(j, this.nourr);
      for (const o of etoilesDessinees(this, CX - 22, 110, e, 15, 1)) this.g(o);
      this.t(CX, 110, '▸', 15, '#dfe8d6', true, 0.5, 0.5);
      for (const o of etoilesDessinees(this, CX + 22, 110, e + 1, 15, 0)) this.g(o);
      jauge(pts / req, pts >= req ? 0x7ee07a : 0xe3b54c, `${pts} / ${req} points`);
      this.t(CX, 156, `Nourriture ${e}★ ou moins  ·  1★ = 1 · 2★ = 2 · 3★ = 6 · 4★ = 24 · 5★ = 120`, 11, '#93a89b', false, 0.5, 0.5);
      // à gauche, sous les onglets : ses stats maintenant, après l'évolution, puis au nouveau niveau max
      const e2 = (e + 1) as Etoiles, sx = 24, y0 = 296;
      const s0 = monstreCombat(c.id, e, c.niveau).stats, s1 = monstreCombat(c.id, e2, c.niveau).stats, s2 = monstreCombat(c.id, e2, NIVEAU_MAX[e2]).stats;
      this.g(this.add.rectangle(sx - 6, y0 - 14, 286, 150, 0x000000, 0.45).setOrigin(0).setStrokeStyle(1.5, 0x4a5a3c).setDepth(900));
      this.t(sx + 122, y0, `${e}★ niv. ${c.niveau}`, 10, '#93a89b', false, 1, 0.5);
      this.t(sx + 196, y0, `${e2}★ niv. ${c.niveau}`, 10, '#93a89b', false, 1, 0.5);
      this.t(sx + 270, y0, `${e2}★ niv. ${NIVEAU_MAX[e2]}`, 10, '#93a89b', false, 1, 0.5);
      (['pv', 'atq', 'def'] as const).forEach((k, i) => {
        const y = y0 + 26 + i * 26;
        this.t(sx, y, { pv: 'PV', atq: 'ATQ', def: 'DEF' }[k], 13, '#dfe8d6', false, 0, 0.5);
        this.t(sx + 122, y, fmt(s0[k]), 13, '#ffffff', true, 1, 0.5);
        this.t(sx + 196, y, fmt(s1[k]), 13, '#7ee07a', true, 1, 0.5);
        this.t(sx + 270, y, fmt(s2[k]), 13, '#7ee07a', true, 1, 0.5);
      });
      this.t(sx, y0 + 112, 'Il garde son niveau : ses stats\nmontent tout de suite.', 11, '#93a89b', false, 0, 0.5);
    }

    // le monstre choisi
    this.g(this.add.ellipse(CX, 440, 230, 50, 0x000000, 0.5).setDepth(999));
    if (!this.textures.exists(LOOKS[c.id].atlas)) chargerPuis(this, [c.id], () => { creerAnimations(this, LOOKS[c.id].atlas); if (this.cible === c.uid) this.dessiner(); });
    const sp = this.g(monstreEnPied(this, c.id, CX, 432, 1).setDepth(1001));
    // environ 230 px de haut, sans agrandir une planche au-delà de ×1,5 (pour rester net)
    const gr = Math.min(230 / (sp.frame.cutHeight * Math.abs(sp.scaleY)), 1.5 / Math.abs(sp.scaleY));
    sp.setScale(sp.scaleX * gr, sp.scaleY * gr);
    this.sujet = sp;
    const pose = poseNette(this, c.id, sp, () => { if (this.cible === c.uid && !this.occupe && this.scene.isActive()) this.dessiner(); });
    if (pose) this.g(pose);
    const ru = bouton(this, 96, 470, 152, 40, 'Runes', false, () => { if (!this.occupe) this.scene.start('monstre', { uid: c.uid, retour: { scene: 'cercle', data: { cible: c.uid } } }); });
    ru.t.setFontSize(14); this.g(ru.fond); this.g(ru.t);

    // la nourriture : cinq cases en rangée (« + » ouvre le choix), et « Sélection auto »
    this.puce(CX + 112, 516, 138, 30, 'Sélection auto', false, () => this.selectionAuto());
    this.t(CX - 210, 516, xp ? `Nourriture ${this.nourr.length} / ${NOURRITURE_MAX}` : `Nourriture ${this.nourr.length} / ${NOURRITURE_MAX}`, 13, OR, true, 0, 0.5).setData('titre', true);
    for (let i = 0; i < NOURRITURE_MAX; i++) {
      const { x, y } = this.positionCase(i);
      const uid = this.nourr[i];
      const cs = caseSombre(this, x, y, 74);
      this.g(cs.g); this.g(cs.zone);
      if (uid === undefined) {
        this.t(x, y, '+', 28, '#c6f02e', true, 0.5, 0.5);
        cs.zone.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.occupe) { this.choixNourr = true; this.pageNourr = 0; this.dessiner(); } });
        continue;
      }
      const m = monstre(j, uid);
      const p = portrait(this, m.id, x, y, 70, false);
      this.g(p.masque); this.g(p.sp);
      this.casesNourr.push(p.sp);
      this.t(x - 33, y - 37, this.etoiles(m.etoiles), 10, '#ffcf4a', false, 0).setDepth(1003).setData('nourr', true);
      this.t(x + 32, y + 35, String(m.niveau), 12, '#ffffff', true, 1, 1).setDepth(1003).setData('nourr', true);
      cs.zone.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.clicCollection(m));
    }
  }

  /** À droite : la collection en grille de quatre colonnes ; toucher un monstre le choisit pour l'améliorer. */
  private collection(c: MonstrePossede | null) {
    const j = this.joueur, X = 846, L = 414;
    this.g(panneau(this, X, 62, L, 644));
    const liste = trierMonstres(j.monstres, 'etoiles');
    this.t(X + L / 2, 92, 'Collection', 16, '#ffffff', true, 0.5, 0.5);
    const pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
    this.page = Math.min(this.page, pages - 1);
    liste.slice(this.page * PAR_PAGE, (this.page + 1) * PAR_PAGE).forEach((m, i) => {
      const x = X + 66 + (i % 4) * 94, y = 160 + Math.floor(i / 4) * 100, choisi = m.uid === c?.uid;
      for (const o of carteMonstre(this, m, fiche(m.id).element, x, y, 86, { choisie: choisi, equipe: j.equipe.includes(m.uid), verrou: (j.verrous ?? []).includes(m.uid), action: () => this.choisirCible(m) })) this.g(o);
      if (choisi) this.t(x + 26, y - 26, '✔', 22, '#d8ff5a', true, 0.5, 0.5).setDepth(1010);
      if (this.nourr.includes(m.uid)) { this.g(this.add.rectangle(x, y, 78, 78, 0x0b0d0a, 0.65).setDepth(1008)); this.t(x, y, 'donné', 12, '#ffcf4a', true, 0.5, 0.5).setDepth(1009); }
    });
    if (pages > 1) {
      this.t(X + L / 2, 682, `${this.page + 1} / ${pages}`, 13, '#c9cfc4', true, 0.5, 0.5);
      if (this.page > 0) this.puce(X + L / 2 - 80, 682, 40, 28, '‹', false, () => { this.page--; this.dessiner(); }, 1001, 16);
      if (this.page < pages - 1) this.puce(X + L / 2 + 40, 682, 40, 28, '›', false, () => { this.page++; this.dessiner(); }, 1001, 16);
    }
  }

  /** « Sélectionner le monstre » : la nourriture possible en grille de huit colonnes, tri par étoiles, coche sur les monstres donnés. */
  private fenetreNourriture(c: MonstrePossede) {
    const j = this.joueur, P = 3002, X = 250, Y = 96, L = 780, HT = 540;
    const fermer = () => { if (!this.occupe) { this.choixNourr = false; this.dessiner(); } };
    this.g(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(3000).setInteractive()).on('pointerdown', fermer);
    this.g(panneau(this, X, Y, L, HT, 3001));
    this.g(this.add.zone(X, Y, L, HT).setOrigin(0).setDepth(3001).setInteractive());
    this.t(X + L / 2, Y + 32, 'Sélectionner le monstre', 18, '#ffffff', true, 0.5, 0.5).setDepth(P);
    this.t(X + L - 30, Y + 30, '✕', 20, '#dfe8d6', true, 0.5, 0.5).setDepth(P + 2).setInteractive({ useHandCursor: true }).on('pointerdown', fermer);
    const xp = this.onglet === 'xp';
    const req = !xp && c.etoiles < 6 ? pointsRequis(c.etoiles as 1 | 2 | 3 | 4 | 5) : 0;
    this.t(X + 34, Y + 74, xp ? `Nourriture ${this.nourr.length} / ${NOURRITURE_MAX}  ·  +${fmt(apercuNourrir(j, this.nourr).xp)} XP` : `Points ${pointsNourriture(j, this.nourr)} / ${req}  ·  ${this.nourr.length} / ${NOURRITURE_MAX} monstres`, 14, OR, true, 0, 0.5).setDepth(P);
    this.puce(X + L - 330, Y + 74, 130, 30, this.triCroissant ? 'Étoiles min. ▾' : 'Étoiles max. ▾', false, () => { this.triCroissant = !this.triCroissant; this.pageNourr = 0; this.dessiner(); }, P);
    this.puce(X + L - 192, Y + 74, 160, 30, 'Sélection auto', false, () => this.selectionAuto(), P);
    const liste = j.monstres.filter((m) => m.uid !== c.uid).sort((a, b) => (a.etoiles - b.etoiles || a.niveau - b.niveau) * (this.triCroissant ? 1 : -1));
    const parPage = 32, pages = Math.max(1, Math.ceil(liste.length / parPage));
    this.pageNourr = Math.min(this.pageNourr, pages - 1);
    liste.slice(this.pageNourr * parPage, (this.pageNourr + 1) * parPage).forEach((m, i) => {
      const x = X + 68 + (i % 8) * 92, y = Y + 148 + Math.floor(i / 8) * 92, pris = this.nourr.includes(m.uid), refus = pris ? null : this.refus(m);
      for (const o of carteMonstre(this, m, fiche(m.id).element, x, y, 80, { choisie: pris, equipe: j.equipe.includes(m.uid), verrou: (j.verrous ?? []).includes(m.uid) })) { this.g(o); (o as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(((o as unknown as { depth: number }).depth ?? 1000) + 2100); }
      if (refus) this.g(this.add.rectangle(x, y, 72, 72, 0x0b0d0a, 0.62).setDepth(3120));
      if (pris) this.t(x + 24, y - 24, '✔', 20, '#d8ff5a', true, 0.5, 0.5).setDepth(3122);
      // même famille : le donner monte une compétence
      if (!refus && memeFamille(m.id, c.id) && !competencesAuMax(c)) this.t(x, y + 46, 'Compétence +1', 9.5, '#ffe08a', true, 0.5, 0.5).setDepth(3122);
      this.g(this.add.zone(x, y, 80, 80).setDepth(3125).setInteractive({ useHandCursor: true })).on('pointerdown', () => this.clicCollection(m));
    });
    if (this.alerte) this.t(X + L / 2, Y + HT - 86, this.alerte, 13, '#ff8a7a', true, 0.5, 0.5).setDepth(3130).setBackgroundColor('rgba(0,0,0,0.75)').setPadding(10, 4, 10, 4);
    if (pages > 1) {
      this.t(X + 110, Y + HT - 44, `${this.pageNourr + 1} / ${pages}`, 13, '#c9cfc4', true, 0.5, 0.5).setDepth(P);
      if (this.pageNourr > 0) this.puce(X + 34, Y + HT - 44, 40, 28, '‹', false, () => { this.pageNourr--; this.dessiner(); }, P, 16);
      if (this.pageNourr < pages - 1) this.puce(X + 146, Y + HT - 44, 40, 28, '›', false, () => { this.pageNourr++; this.dessiner(); }, P, 16);
    }
    const ok = bouton(this, X + L / 2, Y + HT - 44, 180, 42, 'OK', true, fermer, P + 1); this.g(ok.fond); this.g(ok.t);
  }
}
