import Phaser from 'phaser';
import { Combat, type Evenement, type Unite } from '../sim/combat';
import { choisirAction } from '../sim/ia';
import { monstreCombat } from '../sim/fiches';
import { monstre, type Joueur } from '../sim/joueur';
import { appliquerVictoire, cleStage, DIFFICULTES, vaguesEnnemies, equipeJoueur, LISTE_STAGES, stage, stageOuvert, tirerButin, zone, type Stage } from '../sim/stages';
import { lancerCombat, type Repetition } from './lancement';
import { energie } from '../sim/energie';
import { DONJONS, NB_NIVEAUX, cleDonjon, niveauOuvert } from '../sim/donjons';
import { noterMission } from '../sim/missions';
import { SETS } from '../sim/runes';
import { fiche } from '../sim/fiches';
import { charger, sauver } from './sauvegarde';
import { NIVEAU_MAX, XP_NIVEAU, type Etoiles } from '../sim/progression';
import { avantage, estBonus, type Element, type Sort, type TypeEffet } from '../sim/types';
import { LOOKS, teinter } from './looks';
import { distant } from './assetUrl';
import { creerAnimations, FPS, origine } from './animations';
import { preparerTextures } from './effets';
import { bouton, caseSombre, chargerUi, monstreEnPied, OR, panneau, portrait, texte, texturePierreAme } from './ui';

/**
 * Étape 3 de l'alpha : scène de combat (maquette « Combat : » 1B 2B 3A 4B 5A).
 * Diagonale à la Dofus, jauge sous chaque monstre + frise d'initiative, sorts ronds en bas à droite, arène de la zone.
 * La scène lit le combat (src/sim) et rejoue ses événements ; elle ne modifie jamais la partie elle-même.
 */

const W = 1280;
const H = 720;
const ZOOM = 0.85;
const POLICE = 'Lexend, sans-serif';
const POLICE_CHIFFRES = 'Rowdies, Lexend, sans-serif';

const COULEUR: Record<Element, number> = { feu: 0xe8673f, air: 0x69d391, eau: 0x4aa3e6, bonta: 0xf4e8a8, brakmar: 0xa965de };

const NOM_EFFET: Record<TypeEffet, string> = {
  atq_hausse: 'Attaque +', def_hausse: 'Défense +', vit_hausse: 'Vitesse +', tc_hausse: 'Critique +', bouclier: 'Bouclier', immunite: 'Immunité',
  atq_baisse: 'Attaque −', def_baisse: 'Défense −', lenteur: 'Lenteur', etourdi: 'Étourdi', poison: 'Dégâts continus',
};
const COURT_EFFET: Record<TypeEffet, string> = {
  atq_hausse: 'ATQ↑', def_hausse: 'DÉF↑', vit_hausse: 'VIT↑', tc_hausse: 'CRI↑', bouclier: 'BOU', immunite: 'IMM',
  atq_baisse: 'ATQ↓', def_baisse: 'DÉF↓', lenteur: 'VIT↓', etourdi: 'ÉTO', poison: 'POI',
};

/** Stage joué par défaut (tant que la carte de l'histoire n'existe pas). */
const STAGE = LISTE_STAGES[0].id;
/** Pieds des monstres : alliés en bas à gauche, ennemis en haut à droite. */
const PLACES = {
  // Formation en losange, sans chevauchement : le leader devant, les plus petits sur les côtés
  A: [[380, 500], [190, 465], [530, 430], [330, 370]],
  B: [[900, 225], [1070, 265], [750, 290], [950, 355]],
} as const;


interface Vue {
  u: Unite;
  x: number;
  y: number;
  /** Haut du monstre au repos (pour placer flèches et chiffres). */
  haut: number;
  echelle: number;
  sprite: Phaser.GameObjects.Sprite;
  socle: Phaser.GameObjects.Ellipse;
  barres: Phaser.GameObjects.Graphics;
  niveau: Phaser.GameObjects.Text;
  effets: Phaser.GameObjects.Text;
  /** Zone de clic : le corps du monstre et ses barres (pas toute l'image, souvent très grande). */
  zone: Phaser.GameObjects.Zone;
  pvAffiche: number;
}

export class CombatScene extends Phaser.Scene {
  private combat!: Combat;
  private joueur!: Joueur;
  private stage!: Stage;
  private graine = 0;
  private vues = new Map<number, Vue>();
  private auto = false;
  /** Vitesse du combat : ×1, ×2 ou ×3 (comme dans SW). Gardée d'un combat à l'autre. */
  private vitesseJeu = 1;
  private occupe = false;
  private sortChoisi = 0;
  private survol: Vue | null = null;
  /** Ennemi désigné (réticule rouge), comme dans SW : visé par le sort relancé, et par le mode auto. */
  private cibleFocus: number | null = null;
  private reticule!: Phaser.GameObjects.Graphics;

  private boutonsSorts: { cercle: Phaser.GameObjects.Graphics; icone: Phaser.GameObjects.Image; voile: Phaser.GameObjects.Graphics; cd: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];
  private bulle!: Phaser.GameObjects.Container;
  private bulleFond!: Phaser.GameObjects.Graphics;
  private bulleTexte!: Phaser.GameObjects.Text;
  private bulleNom!: Phaser.GameObjects.Text;
  private bulleConsigne!: Phaser.GameObjects.Text;
  private flecheCible!: Phaser.GameObjects.Text;
  private tags: Phaser.GameObjects.Text[] = [];
  private frise: { cadre: Phaser.GameObjects.Graphics; portrait: Phaser.GameObjects.Sprite; r: number; x: number }[] = [];
  private boutonAuto!: Phaser.GameObjects.Text;
  private boutonRapide!: Phaser.GameObjects.Text;

  private stageId = STAGE;

  constructor() {
    super('combat');
  }

  private repetition?: Repetition;

  init(data: { stage?: string; repetition?: Repetition }) {
    if (data?.stage) this.stageId = data.stage;
    this.repetition = data?.repetition;
  }

  preload() {
    const barre = this.add.text(W / 2, H / 2, 'Chargement…', { fontFamily: POLICE, fontSize: '18px', color: '#e9efe6' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => barre.setText(`Chargement… ${Math.round(p * 100)} %`));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.error('Fichier introuvable :', f.key, f.url));
    this.load.once('complete', () => barre.destroy());
    this.joueur = charger();
    this.stage = stage(this.stageId);
    if (!this.textures.exists(`arene:${this.stage.arene}`)) this.load.image(`arene:${this.stage.arene}`, distant(this.stage.arene));
    const ennemis = this.stage.ennemis.map((e) => e.id);
    // renforts des boss (donjons) : leurs planches aussi
    const renforts = ennemis.flatMap((id) => monstreCombat(id).sorts.flatMap((s) => s.invoque?.ids ?? []));
    const ids = [...new Set([...this.joueur.equipe.map((u) => monstre(this.joueur, u).id), ...ennemis, ...renforts])];
    const rec = zone(this.stage.zone).recompense;
    chargerUi(this, rec ? [...ids, rec.id] : ids);
    for (const id of ids) {
      for (const s of monstreCombat(id).sorts) if (s.icone && !this.textures.exists(`sort_${s.icone}`)) this.load.image(`sort_${s.icone}`, `assets/ui/sorts/sort_${s.icone}.png`);
    }
  }

  create() {
    this.vues.clear();
    this.cibleFocus = null;
    this.boutonsSorts = [];
    this.frise = [];
    this.tags = [];
    this.occupe = false;

    // Arène : la salle des Scarafeuilles (recadrée sur la zone de combat)
    this.cameras.main.setBackgroundColor('#0b120e');
    const s = W / 2300;
    this.add.image(-520 * s, -600 * s, `arene:${this.stage.arene}`).setOrigin(0).setScale(s);

    this.graine = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
    this.combat = new Combat({
      equipeA: equipeJoueur(this.joueur),
      ...vaguesEnnemies(this.stage),
      graine: this.graine,
      mode: this.stage.donjon ? 'donjon' : 'histoire',
    });
    for (const u of this.combat.unites) this.creerVue(u);
    this.creerInterface();
    if (this.repetition) this.interfaceRepetition();
    this.combat.drainEvenements();
    this.time.delayedCall(400, () => this.suivant());
  }

  // ───────────── construction ─────────────

  private creerVue(u: Unite) {
    const look = LOOKS[u.monstre.id];
    creerAnimations(this, look.atlas);
    const meta = (this.cache.json.get(`${look.atlas}:meta`) as { meta?: { cell?: number[]; origin?: number[] } } | undefined)?.meta;
    const [ox, oy] = origine(meta);
    const [x, y] = PLACES[u.camp][u.place];
    // le boss du stage 7 est plus grand, avec sa barre de vie en haut (idée 10 de « Zaap : »)
    const boss = this.estBoss(u);
    const echelle = look.echelle * ZOOM * (boss ? 1.35 : 1);
    const sens = u.camp === 'A' ? 1 : -1;

    const socle = this.add.ellipse(x, y, boss ? 130 : 96, boss ? 40 : 30, boss ? 0x5a0f08 : 0x000000, 0.35).setDepth(y - 1);
    const sprite = this.add.sprite(x, y, look.atlas).setOrigin(ox, oy).setScale(echelle * sens, echelle).setDepth(y);
    teinter(sprite, u.monstre.id);
    sprite.play(`${look.atlas}/AnimStatique_1`);
    const f = sprite.frame;
    const haut = y - (oy * f.realHeight - f.y) * echelle;

    const barres = this.add.graphics().setDepth(2000);
    const niveau = this.add.text(x - 30, y + 12, '', { fontFamily: POLICE, fontSize: '11px', fontStyle: '600', color: '#ffffff' })
      .setShadow(0, 1, '#000', 3, false, true).setDepth(2001);
    const effets = this.add.text(x, y + 44, '', { fontFamily: POLICE, fontSize: '10px', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 3, y: 1 } })
      .setOrigin(0.5, 0).setDepth(2001);

    const largeur = Math.max(80, Math.min(170, f.cutWidth * echelle));
    const zone = this.add.zone(x, (haut + y + 52) / 2, largeur, y + 52 - haut).setDepth(y + 0.5).setInteractive({ useHandCursor: true });
    const vue: Vue = { u, x, y, haut, echelle, sprite, socle, barres, niveau, effets, zone, pvAffiche: u.pv };
    this.vues.set(u.uid, vue);

    zone.on('pointerover', () => { this.survol = vue; this.majCibles(); });
    zone.on('pointerout', () => { if (this.survol === vue) this.survol = null; this.majCibles(); });
    zone.on('pointerdown', () => this.clicCible(vue));
    this.majVue(vue);
  }

  private creerInterface() {
    // Frise d'initiative (haut, au centre) : l'acteur puis les 7 prochains tours
    const n = 8;
    const fond = this.add.graphics().setDepth(3000);
    const larg = 64 + (n - 1) * 54 + 24;
    fond.fillStyle(0x08100c, 0.8).fillRoundedRect(W / 2 - larg / 2, 8, larg, 70, 35).lineStyle(1.5, 0xc9a24a).strokeRoundedRect(W / 2 - larg / 2, 8, larg, 70, 35);
    let x = W / 2 - larg / 2 + 12;
    for (let i = 0; i < n; i++) {
      const r = i === 0 ? 30 : 23;
      const cx = x + r;
      const cadre = this.add.graphics().setDepth(3001);
      const portrait = this.add.sprite(cx, 43, '__DEFAULT').setDepth(3002);
      const masque = this.make.graphics({}, false).fillCircle(cx, 43, r - 2);
      portrait.setMask(masque.createGeometryMask());
      this.frise.push({ cadre, portrait, r, x: cx });
      x += 2 * r + 8;
    }

    // Boutons Auto et ×2 (haut droite)
    const bouton = (bx: number, texte: string, action: () => void) => this.add.text(bx, 22, texte, {
      fontFamily: POLICE, fontSize: '14px', fontStyle: '600', color: '#ffffff', backgroundColor: 'rgba(10,20,15,0.8)', padding: { x: 12, y: 7 },
    }).setOrigin(1, 0).setDepth(3000).setInteractive({ useHandCursor: true }).on('pointerdown', action);
    this.boutonRapide = bouton(W - 14, '×1', () => { this.vitesseJeu = (this.vitesseJeu % 3) + 1; this.majBoutons(); });
    this.boutonAuto = bouton(W - 70, 'Auto', () => {
      this.auto = !this.auto;
      this.majBoutons();
      if (this.auto && !this.occupe && this.combat.acteur?.camp === 'A') this.jouerIA();
      this.majSorts();
    });
    this.titre = this.add.text(14, 22, '', {
      fontFamily: POLICE, fontSize: '13px', fontStyle: '600', color: '#ffe08a', backgroundColor: 'rgba(10,20,15,0.8)', padding: { x: 12, y: 7 },
    }).setDepth(3000);
    this.majTitre();
    this.majBoutons();

    // Sorts : 3 boutons ronds en bas à droite + bulle de description
    for (let i = 0; i < 3; i++) {
      const cx = W - 64 - (2 - i) * 100, cy = H - 64;
      const cercle = this.add.graphics().setDepth(3000);
      const icone = this.add.image(cx, cy, '__DEFAULT').setDisplaySize(80, 80).setDepth(3001);
      const voile = this.add.graphics().setDepth(3002);
      voile.fillStyle(0x000000, 0.62).fillCircle(cx, cy, 40);
      const cd = this.add.text(cx, cy, '', { fontFamily: POLICE_CHIFFRES, fontSize: '32px', color: '#ffe08a' }).setOrigin(0.5).setDepth(3003);
      const zone = this.add.zone(cx, cy, 88, 88).setInteractive({ useHandCursor: true }).setDepth(3004);
      zone.on('pointerdown', () => this.clicSort(i));
      this.boutonsSorts.push({ cercle, icone, voile, cd, zone });
    }
    this.bulleFond = this.add.graphics();
    this.bulleTexte = this.add.text(14, 10, '', { fontFamily: POLICE, fontSize: '13px', color: '#e9efe6', wordWrap: { width: 318 }, lineSpacing: 3 });
    this.bulleNom = this.add.text(14, 10, '', { fontFamily: POLICE, fontSize: '15px', fontStyle: '600', color: '#ffe08a' });
    this.bulleTexte.setY(32);
    this.bulleConsigne = this.add.text(14, 0, '', { fontFamily: POLICE, fontSize: '12px', fontStyle: '600', color: '#ffcf4a', wordWrap: { width: 318 } });
    this.bulle = this.add.container(W - 64 - 2 * 100 - 56 - 346, H - 100, [this.bulleFond, this.bulleNom, this.bulleTexte, this.bulleConsigne]).setDepth(3000);

    this.reticule = this.add.graphics();
    this.tweens.add({ targets: this.reticule, alpha: 0.45, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.flecheCible = this.add.text(0, 0, '▼', { fontFamily: POLICE, fontSize: '30px', color: '#ff4d3d' }).setOrigin(0.5, 1)
      .setShadow(0, 0, '#000', 6, false, true).setDepth(2500).setVisible(false);
    this.tweens.add({ targets: this.flecheCible, scaleY: 0.8, scaleX: 1.12, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.majSorts();
  }

  // ───────────── déroulement ─────────────

  private get v() {
    return this.vitesseJeu;
  }

  private attendre(ms: number) {
    return new Promise<void>((ok) => this.time.delayedCall(ms / this.v, ok));
  }

  /** Tour suivant : jauges, effets de début de tour, puis l'IA ou le joueur. */
  private async suivant() {
    if (!this.scene.isActive()) return;
    const u = this.combat.prochainTour();
    await this.animer(this.combat.drainEvenements());
    if (!u) return;
    this.majFrise();
    this.majSorts();
    if (u.camp === 'B' || this.auto) {
      await this.attendre(350);
      this.jouerIA();
    } else {
      const dispo = this.combat.sortsDisponibles(u);
      this.sortChoisi = dispo.includes(this.sortChoisi) ? this.sortChoisi : dispo[0];
      this.majSorts();
      this.majCibles();
    }
  }

  private jouerIA() {
    if (this.occupe || !this.combat.acteur) return;
    const allie = this.combat.acteur.camp === 'A';
    const { sort, cible } = choisirAction(this.combat, allie ? this.focus()?.u.uid : undefined);
    this.jouerAction(sort, cible);
  }

  private async jouerAction(sort: number, cible?: number) {
    this.occupe = true;
    this.majSorts();
    this.majCibles();
    this.combat.jouer(sort, cible);
    await this.animer(this.combat.drainEvenements());
    this.occupe = false;
    if (!this.combat.fini) this.suivant();
  }

  // ───────────── choix du joueur ─────────────

  private get tourJoueur(): boolean {
    const u = this.combat.acteur;
    return !this.occupe && !this.auto && !this.combat.fini && !!u && u.camp === 'A';
  }

  /** Ennemi désigné ; s'il est tombé, on en choisit un autre comme l'IA (avantage d'élément, puis le plus blessé). */
  private focus(): Vue | null {
    const ennemis = this.combat.vivants('B');
    if (!ennemis.length) return null;
    if (this.cibleFocus === null || !this.combat.unite(this.cibleFocus).vivant) {
      const ref = this.combat.acteur?.camp === 'A' ? this.combat.acteur : this.combat.vivants('A')[0];
      const score = (x: Unite) => x.pv / x.stats.pv - (ref ? 0.3 * avantage(ref.element, x.element) : 0);
      this.cibleFocus = ennemis.reduce((m, x) => (score(x) < score(m) ? x : m)).uid;
    }
    return this.vues.get(this.cibleFocus)!;
  }

  /** Allié visé par défaut par un sort sur un seul allié : le plus blessé. */
  private allieParDefaut(): Vue | null {
    const allies = this.combat.vivants('A');
    return allies.length ? this.vues.get(allies.reduce((m, x) => (x.pv / x.stats.pv < m.pv / m.stats.pv ? x : m)).uid)! : null;
  }

  private sortCourant(): Sort | null {
    return this.tourJoueur ? this.combat.acteur!.monstre.sorts[this.sortChoisi] ?? null : null;
  }

  /** Clic sur un sort : le choisir ; recliquer sur le sort déjà choisi le lance (sur la cible désignée). */
  private clicSort(i: number) {
    const u = this.combat.acteur;
    if (!this.tourJoueur || !this.combat.sortsDisponibles(u!).includes(i)) return;
    if (i !== this.sortChoisi) {
      this.sortChoisi = i;
      this.majSorts();
      this.majCibles();
      return;
    }
    const s = u!.monstre.sorts[i];
    if (s.cible === 'ennemi') this.lancer(this.focus());
    else if (s.cible === 'allie') this.lancer(this.allieParDefaut());
    else this.lancer(null);
  }

  /** Cibles possibles du sort choisi : tous les ennemis (ou alliés) pour un sort de groupe, comme dans SW. */
  private ciblesPossibles(): Vue[] {
    const s = this.sortCourant();
    if (!s) return [];
    const u = this.combat.acteur!;
    if (s.cible === 'soi') return [this.vues.get(u.uid)!];
    const camp = s.cible === 'ennemi' || s.cible === 'ennemis' ? 'B' : 'A';
    return this.combat.vivants(camp).map((x) => this.vues.get(x.uid)!);
  }

  /** Clic sur un monstre : pendant ton tour, lance le sort ; sinon (ou sur un ennemi hors cible), le désigne. */
  private clicCible(vue: Vue) {
    if (!vue.u.vivant) return;
    if (vue.u.camp === 'B') this.cibleFocus = vue.u.uid;
    if (this.ciblesPossibles().includes(vue)) this.lancer(vue);
    else this.majCibles();
  }

  private lancer(cible: Vue | null) {
    const s = this.sortCourant();
    if (!s) return;
    const unique = s.cible === 'ennemi' || s.cible === 'allie';
    if (unique && !cible) return;
    this.survol = null;
    this.jouerAction(this.sortChoisi, unique ? cible!.u.uid : undefined);
  }

  // ───────────── animation des événements ─────────────

  private async animer(evs: Evenement[]) {
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.type === 'sort') {
        // Tout ce qui suit jusqu'au prochain sort ou tour arrive au moment de l'impact
        let j = i + 1;
        while (j < evs.length && !['sort', 'tour', 'fin'].includes(evs[j].type)) j++;
        await this.animerSort(e, evs.slice(i + 1, j));
        i = j - 1;
      } else await this.animerEvenement(e);
    }
    for (const vue of this.vues.values()) this.majVue(vue);
  }

  private async animerSort(e: Extract<Evenement, { type: 'sort' }>, suite: Evenement[]) {
    const vue = this.vues.get(e.uid)!;
    const look = LOOKS[vue.u.monstre.id];
    const sort = vue.u.monstre.sorts[e.sort];
    const num = look.animSorts[e.sort] ?? look.animSorts[0];
    const cle = `${look.atlas}/AnimAttaque${num}_1`;
    const anim = this.anims.get(cle);
    const impact = ((look.attaques[num] ?? 0.5) * (anim?.frames.length ?? 20)) / FPS * 1000;
    const offensif = sort.cible === 'ennemi' || sort.cible === 'ennemis';

    this.annoncer(vue, sort);
    // Élan vers la cible (sorts offensifs)
    const cible = offensif ? this.vues.get(e.cibles[0]) : undefined;
    const dx = cible ? (cible.x - vue.x) * 0.22 : 0, dy = cible ? (cible.y - vue.y) * 0.22 : 0;
    if (anim) vue.sprite.play({ key: cle, timeScale: this.v });
    if (cible) this.tweens.add({ targets: vue.sprite, x: vue.x + dx, y: vue.y + dy, duration: Math.min(impact, 350) / this.v, ease: 'Quad.easeOut' });
    await this.attendre(impact);

    // Impact : dégâts (échelonnés pour les sorts à plusieurs coups), soins, effets
    for (const x of suite) {
      await this.animerEvenement(x);
      if (x.type === 'degats') await this.attendre(sort.coups && sort.coups > 1 ? 160 : 40);
    }
    await new Promise<void>((ok) => {
      if (!anim || !vue.sprite.anims.isPlaying) return ok();
      vue.sprite.once('animationcomplete', () => ok());
      this.time.delayedCall(1500, ok);
    });
    if (cible) await new Promise<void>((ok) => this.tweens.add({ targets: vue.sprite, x: vue.x, y: vue.y, duration: 220 / this.v, ease: 'Quad.easeIn', onComplete: () => ok() }));
    if (vue.u.vivant) vue.sprite.play(`${look.atlas}/AnimStatique_1`);
    await this.attendre(150);
  }

  private async animerEvenement(e: Evenement) {
    switch (e.type) {
      case 'tour': {
        for (const vue of this.vues.values()) this.majVue(vue);
        this.majCibles();
        break;
      }
      case 'passe':
        this.flotter(this.vues.get(e.uid)!, 'Étourdi', '#cfd8ff', 15);
        await this.attendre(500);
        break;
      case 'degats': {
        const vue = this.vues.get(e.uid)!;
        if (e.poison) this.flotter(vue, `−${fmt(e.montant)}`, '#c58cff', 20);
        else if (e.critique) this.flotter(vue, `Critique ! ${fmt(e.montant)}`, '#ffd23f', 28);
        else if (e.ecrasant) this.flotter(vue, `Écrasant ${fmt(e.montant)}`, '#ffa04a', 22);
        else if (e.effleure) this.flotter(vue, `Effleuré ${fmt(e.montant)}`, '#b9c4bd', 18);
        else this.flotter(vue, fmt(e.montant), '#ffffff', 21);
        if (e.absorbe) this.flotter(vue, `Bouclier −${fmt(e.absorbe)}`, '#9fd8ff', 13, 26);
        if (vue.u.vivant || vue.u.pv > 0) {
          const look = LOOKS[vue.u.monstre.id];
          vue.sprite.play({ key: `${look.atlas}/AnimHit_1`, timeScale: this.v });
          vue.sprite.once('animationcomplete', () => { if (vue.u.vivant && !vue.sprite.anims.currentAnim?.key.includes('Attaque')) vue.sprite.play(`${look.atlas}/AnimStatique_1`); });
        }
        this.majVue(vue);
        if (e.poison) await this.attendre(450);
        break;
      }
      case 'soin':
        this.flotter(this.vues.get(e.uid)!, `+${fmt(e.montant)}`, '#7ee07a', 21);
        this.majVue(this.vues.get(e.uid)!);
        break;
      case 'effet':
        this.flotter(this.vues.get(e.uid)!, NOM_EFFET[e.effet], estBonus(e.effet) ? '#8ff0d8' : '#ff8a7a', 14, 30);
        this.majVue(this.vues.get(e.uid)!);
        break;
      case 'resiste':
        this.flotter(this.vues.get(e.uid)!, 'Résisté !', '#ffffff', 14, 30);
        break;
      case 'fin_effet':
      case 'jauge':
        this.majVue(this.vues.get(e.uid)!);
        break;
      case 'ko': {
        const vue = this.vues.get(e.uid)!;
        const look = LOOKS[vue.u.monstre.id];
        vue.sprite.play({ key: `${look.atlas}/AnimMort_1`, timeScale: this.v });
        vue.sprite.once('animationcomplete', () => this.tweens.add({ targets: [vue.sprite, vue.socle], alpha: 0, duration: 500 }));
        this.majVue(vue);
        this.majCibles();
        break;
      }
      case 'vague':
        await this.attendre(600);
        await this.nouvelleVague(e);
        break;
      case 'fin':
        await this.attendre(900);
        this.afficherFin(e.vainqueur);
        break;
      case 'invocation': {
        this.flotter(this.vues.get(e.uid)!, 'Appel du troupeau !', '#ffd23f', 16, 34);
        for (const uid of e.uids) {
          this.creerVue(this.combat.unite(uid));
          const vue = this.vues.get(uid)!;
          vue.sprite.setAlpha(0);
          this.tweens.add({ targets: vue.sprite, alpha: 1, y: { from: vue.y - 40, to: vue.y }, duration: 420 / this.v, ease: 'Bounce.easeOut' });
        }
        for (const vue of this.vues.values()) this.majVue(vue);
        await this.attendre(600);
        this.majFrise();
        this.majCibles();
        break;
      }
      case 'rejoue':
        this.flotter(this.vues.get(e.uid)!, 'Violent : encore un tour !', '#ffd23f', 16, 34);
        await this.attendre(300);
        break;
      case 'contre':
        this.flotter(this.vues.get(e.uid)!, 'Vengeance !', '#ff8a7a', 16, 34);
        await this.attendre(250);
        break;
      case 'sort':
        break;
    }
  }

  /** Nom du sort au-dessus du lanceur. */
  private annoncer(vue: Vue, sort: Sort) {
    const t = this.add.text(vue.x, vue.haut - 14, sort.nom, {
      fontFamily: POLICE, fontSize: '14px', fontStyle: '600', color: '#ffe08a', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 8, y: 3 },
    }).setOrigin(0.5, 1).setDepth(2600);
    this.tweens.add({ targets: t, alpha: 0, delay: 700 / this.v, duration: 300, onComplete: () => t.destroy() });
  }

  private flotter(vue: Vue, texte: string, couleur: string, taille: number, decalage = 0) {
    const t = this.add.text(vue.x + Phaser.Math.Between(-14, 14), vue.haut - 6 - decalage, texte, {
      fontFamily: taille >= 18 ? POLICE_CHIFFRES : POLICE, fontSize: `${taille}px`, fontStyle: taille >= 18 ? 'normal' : '600', color: couleur,
    }).setOrigin(0.5, 1).setStroke('#2a1600', taille >= 18 ? 5 : 3).setDepth(2700);
    this.tweens.add({ targets: t, y: t.y - 42, duration: 900 / this.v, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 650 / this.v, duration: 350 / this.v, onComplete: () => t.destroy() });
  }

  // ───────────── mise à jour de l'affichage ─────────────

  private titre!: Phaser.GameObjects.Text;
  /** Combats à répétition : compteur et « Arrêter après ce combat » (comme SW) ; le mode auto est forcé. */
  private interfaceRepetition() {
    const r = this.repetition!;
    this.auto = true;
    this.majBoutons();
    const t = this.add.text(14, 58, `Répétition ${r.fait + 1} / ${r.total}`, { fontFamily: POLICE, fontSize: '13px', fontStyle: '600', color: '#1d1405', backgroundColor: '#e3b54c', padding: { x: 12, y: 6 } })
      .setOrigin(0, 0).setDepth(3000);
    const stop = this.add.text(14, 92, 'Arrêter après ce combat', { fontFamily: POLICE, fontSize: '12px', fontStyle: '600', color: '#ffffff', backgroundColor: 'rgba(10,20,15,0.85)', padding: { x: 10, y: 5 } })
      .setOrigin(0, 0).setDepth(3000).setInteractive({ useHandCursor: true });
    stop.on('pointerdown', () => { r.arret = !r.arret; stop.setText(r.arret ? 'Arrêt prévu après ce combat ✓' : 'Arrêter après ce combat'); });
    void t;
  }

  private majTitre() {
    if (this.stage.donjon) { this.titre.setText(`${this.stage.nom}  ·  Vague ${this.combat.vague} / ${this.combat.nbVagues}`); return; }
    this.titre.setText(`${zone(this.stage.zone).nom} ${this.stage.numero} · ${this.stage.nom} · ${DIFFICULTES[this.stage.dif]}  ·  Vague ${this.combat.vague} / ${this.combat.nbVagues}`);
  }

  private estBoss(u: Unite) { return u.camp === 'B' && u.vague === this.combat.nbVagues && this.stage.boss === u.place; }

  /** Vague suivante : les ennemis vaincus s'effacent, les nouveaux arrivent, bannière « Vague 2 / 3 ». */
  private async nouvelleVague(e: Extract<Evenement, { type: 'vague' }>) {
    for (const [uid, vue] of [...this.vues]) {
      if (vue.u.camp !== 'B' || vue.u.vivant) continue;
      for (const o of [vue.sprite, vue.socle, vue.barres, vue.niveau, vue.effets, vue.zone]) o.destroy();
      this.vues.delete(uid);
    }
    this.cibleFocus = null;
    this.majTitre();
    const ban = this.add.image(W / 2, H / 2 - 40, 'background_levelup_banner').setDisplaySize(460, 104).setDepth(3500);
    const t = this.add.text(W / 2, H / 2 - 50, `Vague ${e.vague} / ${e.total}`, { fontFamily: POLICE_CHIFFRES, fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5).setStroke('#5a2a00', 7).setDepth(3501);
    this.tweens.add({ targets: [ban, t], alpha: { from: 0, to: 1 }, duration: 250 });
    await this.attendre(500);
    for (const uid of e.uids) {
      this.creerVue(this.combat.unite(uid));
      const vue = this.vues.get(uid)!;
      vue.sprite.setAlpha(0);
      this.tweens.add({ targets: vue.sprite, alpha: 1, x: { from: vue.x + 60, to: vue.x }, duration: 450 / this.v, ease: 'Cubic.easeOut' });
    }
    for (const vue of this.vues.values()) this.majVue(vue);
    await this.attendre(900);
    this.tweens.add({ targets: [ban, t], alpha: 0, duration: 300, onComplete: () => { ban.destroy(); t.destroy(); } });
    this.majFrise();
    this.majCibles();
  }

  private barreBossG?: Phaser.GameObjects.Graphics;
  private barreBossT?: Phaser.GameObjects.Text;
  private barreBoss(u: Unite) {
    if (!this.barreBossG?.active) {
      this.barreBossG = this.add.graphics().setDepth(2990);
      this.barreBossT = this.add.text(W / 2, 94, `BOSS · ${u.monstre.nom}`, { fontFamily: POLICE, fontSize: '14px', fontStyle: '600', color: '#ffd7cf' })
        .setOrigin(0.5, 1).setShadow(0, 1, '#000', 3, false, true).setDepth(2991);
    }
    const l = 420, x = W / 2 - l / 2, y = 98, pv = Math.max(0, u.pv / u.stats.pv);
    this.barreBossG.clear().fillStyle(0x000000, 0.75).fillRoundedRect(x - 2, y - 2, l + 4, 16, 5).fillStyle(0xe0503c).fillRoundedRect(x, y, l * pv, 12, 4)
      .lineStyle(1.5, 0xe3b54c).strokeRoundedRect(x - 2, y - 2, l + 4, 16, 5);
    this.barreBossG.setVisible(u.vivant); this.barreBossT!.setVisible(u.vivant);
  }

  private majVue(vue: Vue) {
    const { u, x, y } = vue;
    const g = vue.barres.clear();
    if (this.estBoss(u) && this.barreBossG) this.barreBoss(u);
    if (!u.vivant) {
      vue.zone.disableInteractive();
      vue.niveau.setVisible(false);
      vue.effets.setVisible(false);
      vue.socle.setStrokeStyle();
      return;
    }

    if (this.estBoss(u)) this.barreBoss(u);

    // Élément + niveau (+ couronne du leader)
    g.fillStyle(COULEUR[u.element]).fillCircle(x - 40, y + 20, 7).lineStyle(1.5, 0x000000, 0.7).strokeCircle(x - 40, y + 20, 7);
    vue.niveau.setText(`${u.place === 0 ? '♛ ' : ''}Niv. ${u.monstre.niveau ?? '?'}`).setPosition(x - 30, y + 13);

    // PV (vert allié, rouge ennemi) et jauge d'attaque
    const l = 96, bx = x - l / 2;
    g.fillStyle(0x000000, 0.7).fillRoundedRect(bx - 1, y + 30, l + 2, 10, 3);
    const pv = Math.max(0, u.pv / u.stats.pv);
    g.fillStyle(u.camp === 'A' ? 0x5cc95a : 0xe0503c).fillRoundedRect(bx, y + 31, l * pv, 8, 2);
    const bouclier = u.effets.find((x) => x.type === 'bouclier');
    if (bouclier) g.fillStyle(0xffffff, 0.6).fillRect(bx, y + 31, Math.min(l, (l * bouclier.valeur) / u.stats.pv), 3);
    g.fillStyle(0x000000, 0.7).fillRect(bx - 1, y + 41, l + 2, 5);
    g.fillStyle(0xf0c04e).fillRect(bx, y + 42, (l * Math.min(100, u.jauge)) / 100, 3);

    // Effets en cours
    const txt = u.effets.map((x) => `${COURT_EFFET[x.type]}${x.type === 'poison' && x.valeur > 1 ? '×' + x.valeur : ''} ${x.tours}`).join('  ');
    vue.effets.setText(txt).setVisible(txt.length > 0).setPosition(x, y + 49);
  }

  private majFrise() {
    const c = this.combat;
    const ordre = [c.acteur, ...c.ordrePrevu(this.frise.length - 1)].filter((u): u is Unite => !!u);
    this.frise.forEach((slot, i) => {
      const u = ordre[i];
      slot.cadre.clear();
      if (!u) { slot.portrait.setVisible(false); return; }
      const look = LOOKS[u.monstre.id];
      slot.cadre.fillStyle(0x22322b).fillCircle(slot.x, 43, slot.r).lineStyle(i === 0 ? 3 : 2.5, u.camp === 'A' ? 0x7ee07a : 0xff6a50).strokeCircle(slot.x, 43, slot.r);
      slot.portrait.setVisible(true).setTexture(look.atlas, 'AnimStatique_1_0').setOrigin(0.5, 0.45);
      const fr = slot.portrait.frame;
      const k = (slot.r * 2.3) / Math.max(fr.cutWidth, fr.cutHeight);
      // Portrait cadré sur l'image utile (planches rognées)
      const cx = fr.x + fr.cutWidth / 2, cy = fr.y + fr.cutHeight * 0.45;
      slot.portrait.setOrigin(cx / fr.realWidth, cy / fr.realHeight).setScale(k * (u.camp === 'A' ? 1 : -1), k);
    });
  }

  private majSorts() {
    const u = this.combat?.acteur;
    const joueur = !!u && u.camp === 'A' && !this.auto && !this.combat.fini;
    // Hors du tour du joueur, on montre les sorts du dernier allié (ou rien)
    const visibles = joueur;
    this.boutonsSorts.forEach((b, i) => {
      const s = visibles ? u!.monstre.sorts[i] : undefined;
      const on = !!s;
      b.cercle.clear();
      b.icone.setVisible(on);
      b.voile.setVisible(false);
      b.cd.setText('');
      b.zone.setVisible(on);
      if (!s) return;
      const cx = b.icone.x, cy = b.icone.y;
      const choisi = i === this.sortChoisi;
      if (choisi) b.cercle.fillStyle(0xffcf4a, 0.45).fillCircle(cx, cy, 53).lineStyle(3, 0xfff1b0).strokeCircle(cx, cy, 51);
      b.cercle.fillStyle(0x000000, 0.6).fillCircle(cx, cy, 45);
      b.icone.setTexture(s.icone ? `sort_${s.icone}` : '__DEFAULT').setDisplaySize(choisi ? 86 : 76, choisi ? 86 : 76);
      const r = u!.recharges[i];
      if (r > 0) { b.voile.setVisible(true); b.cd.setText(String(r)); }
    });
    // Bulle du sort choisi
    this.bulleFond.clear();
    this.bulleTexte.setText('');
    this.bulleNom.setText('');
    this.bulleConsigne?.setText('');
    if (joueur) {
      const s = u!.monstre.sorts[this.sortChoisi];
      if (s) {
        const rec = s.recharge ? `\nRecharge : ${s.recharge} tours` : '';
        this.bulleNom.setText(s.nom);
        this.bulleTexte.setText(`${s.desc ?? ''}${rec}`);
        const h = this.bulleTexte.height + 44;
        this.bulle.setY(H - 14 - h);
        this.bulleFond.fillStyle(0x0c1210, 0.92).fillRoundedRect(0, 0, 346, h, 10).lineStyle(1.5, 0xc9a24a).strokeRoundedRect(0, 0, 346, h, 10);
      }
    }
  }

  /** Réticule de la cible désignée, cibles possibles en évidence, flèche au survol, repères d'avantage d'élément. */
  private majCibles() {
    for (const t of this.tags) t.destroy();
    this.tags = [];
    const possibles = this.ciblesPossibles();
    const s = this.sortCourant();
    const u = this.combat.acteur;

    // Cibles possibles : socle cerclé (rouge = ennemis, vert = alliés)
    for (const vue of this.vues.values()) {
      if (!vue.u.vivant) continue;
      const actif = this.combat.acteur === vue.u;
      const possible = possibles.includes(vue);
      const couleur = actif ? 0xffcf4a : vue.u.camp === 'A' ? 0x7ee07a : 0xff5a45;
      vue.socle.setFillStyle(actif ? 0xffcf4a : possible ? couleur : 0x000000, actif ? 0.35 : possible ? 0.22 : 0.35)
        .setStrokeStyle(actif || possible ? 3 : 0, couleur);
    }

    // Réticule sur l'ennemi désigné (toujours visible, comme dans SW)
    this.reticule.clear();
    const f = this.combat.fini ? null : this.focus();
    if (f) {
      const g = this.reticule.setDepth(f.y - 0.6);
      g.lineStyle(3, 0xff3b2f, 1).strokeEllipse(f.x, f.y, 118, 38);
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const cx = f.x + Math.cos(a) * 66, cy = f.y + Math.sin(a) * 22;
        g.fillStyle(0xff3b2f).fillTriangle(cx, cy, cx - Math.cos(a) * 12 - Math.sin(a) * 6, cy - Math.sin(a) * 4 + Math.cos(a) * 6, cx - Math.cos(a) * 12 + Math.sin(a) * 6, cy - Math.sin(a) * 4 - Math.cos(a) * 6);
      }
    }

    // Repères d'avantage d'élément, pour un sort offensif
    if (u && s && (s.cible === 'ennemi' || s.cible === 'ennemis')) {
      for (const vue of possibles) {
        const av = avantage(u.element, vue.u.element);
        if (!av) continue;
        this.tags.push(this.add.text(vue.x, vue.y + 66, av > 0 ? '▲ Avantage' : '▼ Désavantage', {
          fontFamily: POLICE, fontSize: '11px', fontStyle: '600', color: av > 0 ? '#8dff8d' : '#ff9a8a', backgroundColor: 'rgba(0,0,0,0.55)', padding: { x: 4, y: 1 },
        }).setOrigin(0.5, 0).setDepth(2500));
      }
    }

    // Flèche : cible survolée, sinon cible qu'un nouveau clic sur le sort viserait
    let fleche: Vue | null = this.survol && possibles.includes(this.survol) ? this.survol : null;
    if (!fleche && s?.cible === 'ennemi') fleche = f;
    if (!fleche && s?.cible === 'allie') fleche = this.allieParDefaut();
    this.flecheCible.setVisible(!!fleche);
    if (fleche) this.flecheCible.setPosition(fleche.x, fleche.haut - 4).setColor(fleche.u.camp === 'A' ? '#7ee07a' : '#ff4d3d');
    this.majConsigne();
  }

  /** Dernière ligne de la bulle : comment lancer le sort choisi. */
  private majConsigne() {
    const s = this.sortCourant();
    this.bulleConsigne.setText('');
    if (!s || !this.bulleNom.text) return;
    const f = this.focus();
    const consigne = s.cible === 'ennemi' ? `Touche un ennemi, ou retouche le sort pour viser ${f ? f.u.monstre.nom : 'la cible'}.`
      : s.cible === 'ennemis' ? 'Retouche le sort (ou touche un ennemi) pour frapper tous les ennemis.'
      : s.cible === 'allie' ? 'Touche un allié, ou retouche le sort pour le plus blessé.'
      : s.cible === 'allies' ? 'Retouche le sort (ou touche un allié) pour toute l\'équipe.'
      : 'Retouche le sort pour le lancer.';
    this.bulleConsigne.setText(consigne).setY(this.bulleTexte.y + this.bulleTexte.height + 6);
    const h = this.bulleConsigne.y + this.bulleConsigne.height + 12;
    this.bulle.setY(H - 14 - h);
    this.bulleFond.clear().fillStyle(0x0c1210, 0.92).fillRoundedRect(0, 0, 346, h, 10).lineStyle(1.5, 0xc9a24a).strokeRoundedRect(0, 0, 346, h, 10);
  }

  private majBoutons() {
    this.boutonAuto.setBackgroundColor(this.auto ? '#c9a24a' : 'rgba(10,20,15,0.8)').setColor(this.auto ? '#1d1405' : '#ffffff');
    const vite = this.vitesseJeu > 1;
    this.boutonRapide.setText(`×${this.vitesseJeu}`).setBackgroundColor(vite ? '#c9a24a' : 'rgba(10,20,15,0.8)').setColor(vite ? '#1d1405' : '#ffffff');
  }

  /**
   * Fin du combat (maquette « Écrans : » 7A 8A 9A 10A) : bannière, monstres sur leurs socles avec leurs barres d'XP
   * qui se remplissent l'une après l'autre, butin en cases, puis Préparation · Rejouer · Stage suivant.
   */
  private afficherFin(vainqueur: 'A' | 'B' | null) {
    this.majSorts();
    for (const slot of this.frise) { slot.cadre.clear(); slot.portrait.setVisible(false); }
    this.reticule.clear();
    this.flecheCible.setVisible(false);
    preparerTextures(this);
    texturePierreAme(this);
    // On ne garde que l'arène (premier objet) derrière l'écran de fin
    this.children.list.slice(1).forEach((o) => (o as unknown as Phaser.GameObjects.Components.Visible).setVisible?.(false));
    const D = 4000;
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.78).setDepth(D).setInteractive();
    const t = (x: number, y: number, s: string, taille = 14, couleur = '#e9efe6', gras = false, ox = 0.5, oy = 0) => texte(this, x, y, s, taille, couleur, gras, ox, oy).setDepth(D + 3);

    const victoire = vainqueur === 'A';
    const ban = this.add.image(W / 2, 92, 'background_levelup_banner').setDisplaySize(560, 127).setDepth(D + 1);
    if (!victoire) ban.setTint(0x8a8a8a);
    this.add.text(W / 2, 80, victoire ? 'Victoire !' : vainqueur === 'B' ? 'Défaite…' : 'Match nul', { fontFamily: POLICE_CHIFFRES, fontSize: '50px', color: victoire ? '#ffffff' : '#ffd7cf' })
      .setOrigin(0.5).setStroke(victoire ? '#5a2a00' : '#3a1010', 8).setDepth(D + 2);
    this.tweens.add({ targets: ban, scaleX: { from: ban.scaleX * 0.6, to: ban.scaleX }, duration: 350, ease: 'Back.easeOut' });

    const avant = this.joueur;
    const xs = [250, 470, 690, 910].slice(0, avant.equipe.length);
    const decal = (4 - xs.length) * 110;
    let apres = avant;
    let butinAffiche: { cle: string; n: string; label: string }[] = [];
    if (victoire) {
      const butin = tirerButin(avant, this.stage, this.graine);
      apres = noterMission(appliquerVictoire(avant, this.stage, butin, Date.now()).joueur, this.stage.donjon ? 'donjon' : 'histoire', 1, Date.now());
      this.joueur = apres;
      sauver(apres);
      butinAffiche = [{ cle: 'kamas_tas', n: `+${fmt(butin.kamas)}`, label: 'kamas' }];
      if (butin.pierresAme) butinAffiche.push({ cle: 'pierre_ame', n: `+${butin.pierresAme}`, label: `pierre${butin.pierresAme > 1 ? 's' : ''} d'âme${butin.premiere ? ' (1ʳᵉ victoire)' : ''}` });
      if (butin.energie) butinAffiche.push({ cle: '', n: `+${butin.energie}`, label: 'énergie ⚡' });
      if (butin.monstre) butinAffiche.push({ cle: `monstre:${butin.monstre}`, n: fiche(butin.monstre).nom, label: avant.monstres.length < avant.places ? 'rejoint ta collection !' : 'collection pleine : à la Réception' });
      const dj = butin.donjon;
      if (dj?.rune) butinAffiche.push({ cle: 'rune', n: `Rune de ${SETS[dj.rune.set].dieu} ${dj.rune.etoiles}★`, label: SETS[dj.rune.set].nom });
      if (dj?.premiere?.rune) butinAffiche.push({ cle: 'rune', n: `Rune ${dj.premiere.rune.etoiles}★`, label: '1er passage !' });
      if (dj?.premiere?.parfaite || dj?.parfaites) butinAffiche.push({ cle: '', n: `+${(dj.premiere?.parfaite ?? 0) + dj.parfaites}`, label: `pierre parfaite${dj.premiere?.parfaite ? ' (1er passage)' : ''}` });
      if (dj?.pierresAme) butinAffiche.push({ cle: 'pierre_ame', n: `+${dj.pierresAme}`, label: 'pierre d\'âme' });
      if (dj?.symbole) butinAffiche.push({ cle: '', n: '+1', label: dj.symbole });
      if (this.repetition) this.cumuler(butin);
      if (butin.rune) butinAffiche.push({ cle: 'rune', n: `Rune de ${SETS[butin.rune.set].dieu} ${butin.rune.etoiles}★`, label: SETS[butin.rune.set].nom });
      if (butin.zone) butinAffiche.push({ cle: `monstre:${butin.zone.id}`, n: `${fiche(butin.zone.id).nom} ${'★'.repeat(butin.zone.etoiles)}`, label: `récompense de ${zone(this.stage.zone).nom}, à la Réception !` });
    }

    // Monstres sur leurs socles, barres d'XP
    const barres: ((v: number) => void)[] = [];
    avant.equipe.forEach((uid, i) => {
      const a = monstre(avant, uid), b = monstre(apres, uid);
      const x = xs[i] + decal, y = 360;
      const ko = !this.combat.unites.find((u) => u.camp === 'A' && u.place === i)?.vivant;
      this.add.ellipse(x, y, 130, 40, i === 0 ? 0xffcf4a : 0x000000, i === 0 ? 0.25 : 0.45).setStrokeStyle(i === 0 ? 3 : 0, 0xffcf4a).setDepth(D + 1);
      const sp = monstreEnPied(this, a.id, x, y, 1.15).setDepth(D + 2);
      if (ko && !victoire) sp.setTint(0x666666);
      const nom = this.combat.unites.find((u) => u.camp === 'A' && u.monstre.id === a.id)?.monstre.nom ?? a.id;
      t(x, y + 24, `${i === 0 ? '♛ ' : ''}${nom}`, 14, '#ffffff', true);
      const niv = t(x, y + 44, `Niv. ${a.niveau}${victoire ? ` · +${fmt(XP_GAIN(this.stage))} XP` : ''}`, 12, '#cfdccf');
      const gr = this.add.graphics().setDepth(D + 3);
      barres.push(this.barreXp(gr, niv, a, b, x - 80, y + 66, 160, x, y - 120, D));
    });
    barres.forEach((maj, i) => {
      if (!victoire) { maj(0); return; }
      const o = { v: 0 };
      maj(0);
      this.tweens.add({ targets: o, v: 1, duration: 1100, delay: 500 + i * 1250, ease: 'Sine.easeInOut', onUpdate: () => maj(o.v), onComplete: () => maj(1) });
    });

    // Butin
    const yb = 520;
    panneau(this, 250, yb - 14, 780, 82, D + 1);
    if (victoire) {
      t(270, yb - 4, 'BUTIN', 11, '#e3b54c', true, 0);
      const pas = butinAffiche.length > 4 ? 150 : butinAffiche.length > 3 ? 190 : 240;
      butinAffiche.forEach((o, k) => {
        const x = 360 + k * pas;
        caseSombre(this, x, yb + 30, 60, D + 2);
        if (o.cle.startsWith('monstre:')) portrait(this, o.cle.slice(8), x, yb + 30, 52, false, false, D + 3);
        else if (o.cle === 'rune') t(x, yb + 10, '⬢', 34, '#c58cff', true);
        else if (o.cle) this.add.image(x, yb + 30, o.cle).setDisplaySize(44, 44).setDepth(D + 3);
        else t(x, yb + 14, o.label.includes('énergie') ? '⚡' : '✦', 26, '#8fd3ff', true);
        t(x + 40, yb + 14, o.n, 20, '#ffffff', true, 0);
        t(x + 40, yb + 40, o.label, 12, '#cfdccf', false, 0);
      });
    } else {
      t(W / 2, yb + 10, 'Monte le niveau de tes monstres ou change d\'équipe, puis réessaie.', 15, '#cfdccf');
      t(W / 2, yb + 36, `${this.combat.tour} tours`, 12, '#93a89b');
    }

    // Combats à répétition : le suivant, ou le résumé
    if (this.repetition) {
      const r = this.repetition;
      r.fait++;
      r.historique.push({ victoire, tours: this.combat.tour });
      const encore = victoire && r.fait < r.total && !r.arret && energie(apres, Date.now()) >= this.stage.cout;
      if (encore) {
        t(W / 2, 470, `Combat suivant… (${r.fait} / ${r.total})`, 16, '#ffe08a', true);
        this.time.delayedCall(1500, () => { if (!lancerCombat(this, this.stage.id, r)) this.scene.restart({ stage: this.stage.id }); });
        return;
      }
      this.resumeRepetition(r, victoire, D);
    }

    // Boutons
    const z = zone(this.stage.zone), n = this.stage.numero;
    if (this.stage.donjon) {
      const d = DONJONS.find((x) => x.id === this.stage.donjon)!;
      const suite = n < NB_NIVEAUX && niveauOuvert(apres, d, n + 1) ? cleDonjon(d.id, n + 1) : null;
      const l: [string, boolean, () => void][] = [
        ['Donjons', false, () => this.scene.start('donjons', { donjon: d.id, niveau: n })],
        ['Préparation', false, () => this.scene.start('preparation', { stage: this.stage.id })],
        [`↻ Rejouer ⚡${this.stage.cout}`, !victoire || !suite, () => { if (!lancerCombat(this, this.stage.id)) this.scene.start('donjons', { donjon: d.id, niveau: n }); }],
      ];
      if (victoire && suite) l.push(['Niveau suivant ▸', true, () => this.scene.start('preparation', { stage: suite })]);
      let bx = W / 2 - (l.length * 190 - 14) / 2;
      for (const [libelle, vert, action] of l) { bouton(this, bx + 88, 660, 176, 46, libelle, vert, action, D + 2); bx += 190; }
      return;
    }
    const suivant = n < 7 && stageOuvert(apres, z, n, this.stage.dif) ? cleStage(z.stages[n], this.stage.dif) : null;
    const liste: [string, boolean, () => void][] = [
      ['Carte', false, () => this.scene.start('zaap', { zone: z.id, dif: this.stage.dif, stage: n - 1 })],
      ['Préparation', false, () => this.scene.start('preparation', { stage: this.stage.id })],
      [`↻ Rejouer ⚡${this.stage.cout}`, !victoire, () => { if (!lancerCombat(this, this.stage.id)) this.scene.start('zaap', { zone: z.id, dif: this.stage.dif, stage: n - 1 }); }],
    ];
    if (victoire) liste.push([suivant ? 'Stage suivant ▸' : n === 7 ? 'Zone finie ! ▸' : 'Bientôt la suite', true, () => suivant ? this.scene.start('preparation', { stage: suivant }) : this.scene.start('zaap', { zone: z.id })]);
    const largeurs = liste.map(([, vert], k) => (vert ? 210 : k === 2 ? 170 : 130));
    let x = W / 2 - (largeurs.reduce((s, w) => s + w, 0) + (liste.length - 1) * 14) / 2;
    liste.forEach(([libelle, vert, action], i) => {
      const w = largeurs[i];
      const b = bouton(this, x + w / 2, 660, w, 46, libelle, vert, action, D + 2);
      if (libelle === 'Bientôt la suite') b.griser();
      x += w + 14;
    });
  }

  private cumuler(b: ReturnType<typeof tirerButin>) {
    const c = this.repetition!.cumul, dj = b.donjon;
    c.kamas += b.kamas;
    c.pierresAme += b.pierresAme + (dj?.pierresAme ?? 0);
    c.parfaites += (dj?.parfaites ?? 0) + (dj?.premiere?.parfaite ?? 0);
    c.energie += b.energie;
    for (const r of [b.rune, dj?.rune, dj?.premiere?.rune]) if (r) c.runes[r.etoiles] = (c.runes[r.etoiles] ?? 0) + 1;
    if (dj?.symbole) c.symboles++;
    if (b.monstre) c.monstres++;
  }

  /** Résumé des combats à répétition : butin cumulé et historique (comme SW). */
  private resumeRepetition(r: Repetition, victoire: boolean, D: number) {
    const x0 = 250, y0 = 150, w = 780, h = 340;
    this.add.rectangle(W / 2, y0 + h / 2, w, h, 0x0f1814, 0.97).setStrokeStyle(2, 0xb08a3a).setDepth(D + 10);
    const t = (x: number, y: number, s: string, taille = 14, couleur = '#e9efe6', gras = false, ox = 0) => texte(this, x, y, s, taille, couleur, gras, ox, 0).setDepth(D + 11);
    const v = r.historique.filter((h2) => h2.victoire).length;
    t(W / 2, y0 + 16, `Combats à répétition · ${r.fait} / ${r.total}`, 20, '#ffffff', true, 0.5);
    t(W / 2, y0 + 46, r.arret ? 'Arrêtés à ta demande.' : !victoire ? 'Arrêtés sur une défaite.' : r.fait >= r.total ? 'Tous les combats sont faits.' : 'Plus assez d\'énergie.', 13, '#93a89b', false, 0.5);
    const c = r.cumul;
    const runes = Object.entries(c.runes).sort(([a], [b]) => Number(b) - Number(a)).map(([e, n]) => `${n} × ${e}★`).join(', ') || 'aucune';
    const lignes = [
      `Victoires : ${v} / ${r.fait}`, `Kamas : +${fmt(c.kamas)}`, `Runes : ${runes}`,
      `Pierres d'âme : +${c.pierresAme}${c.parfaites ? ` · pierres parfaites : +${c.parfaites}` : ''}`,
      `${c.energie ? `Énergie : +${c.energie}   ` : ''}${c.symboles ? `Symboles : +${c.symboles}   ` : ''}${c.monstres ? `Monstres : +${c.monstres}` : ''}`,
    ].filter((l) => l.trim());
    lignes.forEach((l, i) => t(x0 + 40, y0 + 86 + i * 30, l, 16, i === 0 ? '#ffe08a' : '#ffffff', i === 0));
    t(x0 + 500, y0 + 86, 'Historique', 13, OR, true);
    r.historique.slice(-14).forEach((h2, i) => t(x0 + 500 + Math.floor(i / 7) * 130, y0 + 110 + (i % 7) * 26,
      `${r.historique.length - Math.min(14, r.historique.length) + i + 1}. ${h2.victoire ? 'Victoire' : 'Défaite'} · ${h2.tours} t.`, 12, h2.victoire ? '#b8f5a0' : '#ff9b7a'));
  }

  /** Barre d'XP de a (avant) vers b (après) : v de 0 à 1 ; annonce « NIVEAU SUPÉRIEUR ! » à chaque passage, « MAX » au niveau max. */
  private barreXp(gr: Phaser.GameObjects.Graphics, niv: Phaser.GameObjects.Text, a: { etoiles: number; niveau: number; xp: number }, b: { niveau: number; xp: number }, x: number, y: number, w: number, ax: number, ay: number, D: number) {
    const e = a.etoiles as Etoiles;
    const max = NIVEAU_MAX[e];
    const position = (n: number, xp: number) => (n >= max ? max : n + xp / XP_NIVEAU[e][n - 1]);
    const debut = position(a.niveau, a.xp), fin = position(b.niveau, b.xp);
    let annonce = a.niveau;
    const suite = niv.text.replace(/^Niv\. \d+/, '');
    return (v: number) => {
      const p = debut + (fin - debut) * v;
      const n = Math.min(max, Math.floor(p));
      const part = n >= max ? 1 : p - n;
      gr.clear().fillStyle(0x000000, 0.65).fillRoundedRect(x - 1, y - 1, w + 2, 12, 5)
        .fillStyle(n >= max ? 0xffcf4a : 0x3d8cff).fillRoundedRect(x, y, Math.max(2, w * part), 10, 4);
      niv.setText(`${n >= max ? 'Niv. MAX' : `Niv. ${n}`}${suite}`);
      if (n > a.niveau) niv.setColor(n >= max ? '#ffcf4a' : '#7ee07a');
      if (n > annonce) {
        annonce = n;
        const txt = this.add.text(ax, ay, n >= max ? 'NIVEAU MAX !' : 'NIVEAU SUPÉRIEUR !', { fontFamily: POLICE_CHIFFRES, fontSize: '17px', color: n >= max ? '#ffcf4a' : '#7ee07a' })
          .setOrigin(0.5).setStroke('#10380e', 5).setDepth(D + 4);
        this.tweens.add({ targets: txt, y: ay - 18, scale: { from: 0.4, to: 1 }, duration: 380, ease: 'Back.easeOut' });
        this.tweens.add({ targets: txt, alpha: 0, delay: 1300, duration: 400, onComplete: () => txt.destroy() });
        this.add.particles(ax, ay + 40, 'fx:etincelle', { speed: { min: 60, max: 180 }, lifespan: 700, scale: { start: 0.5, end: 0 }, tint: [0xb6ffb0, 0xffffff], blendMode: 'ADD', emitting: false })
          .setDepth(D + 4).explode(24);
      }
    };
  }
}

const XP_GAIN = (s: Stage) => s.recompenses.xp;
const fmt = (n: number) => n.toLocaleString('fr-FR');
