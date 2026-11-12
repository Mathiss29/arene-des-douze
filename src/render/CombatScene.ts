import Phaser from 'phaser';
import { Combat, type Evenement, type Unite } from '../sim/combat';
import { choisirAction } from '../sim/ia';
import { fiche, monstreCombat } from '../sim/fiches';
import { avantage, estBonus, type Element, type Sort, type TypeEffet } from '../sim/types';
import { LOOKS } from './looks';
import { atlasPlanche, distant, dossierPlanches } from './assetUrl';
import { creerAnimations, FPS, origine } from './animations';

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

/** Équipes du combat d'essai (le leader en premier). */
const ALLIES = ['scarafeuille_blanc', 'kwak_de_flamme', 'scarafeuille_bleu', 'piou_vert'];
const ENNEMIS = ['kwak_de_vent', 'scarafeuille_noir', 'scarafeuille_rouge', 'piou_rouge'];
const ARENE = 'mondes/astrub/sol_arene_scarafeuilles.webp';
/** Pieds des monstres : alliés en bas à gauche, ennemis en haut à droite. */
const PLACES = {
  A: [[330, 470], [210, 525], [430, 550], [280, 610]],
  B: [[900, 250], [1020, 295], [800, 315], [960, 370]],
} as const;

const NIVEAU_MAX: Record<number, number> = { 1: 15, 2: 20, 3: 25, 4: 30, 5: 35 };

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
  private vues = new Map<number, Vue>();
  private auto = false;
  private rapide = false;
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

  constructor() {
    super('combat');
  }

  preload() {
    const barre = this.add.text(W / 2, H / 2, 'Chargement…', { fontFamily: POLICE, fontSize: '18px', color: '#e9efe6' }).setOrigin(0.5);
    this.load.on('progress', (p: number) => barre.setText(`Chargement… ${Math.round(p * 100)} %`));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.error('Fichier introuvable :', f.key, f.url));
    this.load.once('complete', () => barre.destroy());
    this.load.image('arene', distant(ARENE));
    for (const id of [...ALLIES, ...ENNEMIS]) {
      const look = LOOKS[id];
      if (!this.textures.exists(look.atlas)) this.load.multiatlas(look.atlas, atlasPlanche(look.atlas), dossierPlanches);
      this.load.json(`${look.atlas}:meta`, atlasPlanche(look.atlas));
      for (const s of monstreCombat(id).sorts) if (s.icone) this.load.image(`sort_${s.icone}`, `assets/ui/sorts/sort_${s.icone}.png`);
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
    this.add.image(-520 * s, -600 * s, 'arene').setOrigin(0).setScale(s);

    this.combat = new Combat({
      equipeA: ALLIES.map(monstreCombat),
      equipeB: ENNEMIS.map(monstreCombat),
      graine: (Date.now() ^ (Math.random() * 1e9)) >>> 0,
      mode: 'histoire',
    });
    for (const u of this.combat.unites) this.creerVue(u);
    this.creerInterface();
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
    const echelle = look.echelle * ZOOM;
    const sens = u.camp === 'A' ? 1 : -1;

    const socle = this.add.ellipse(x, y, 96, 30, 0x000000, 0.35).setDepth(y - 1);
    const sprite = this.add.sprite(x, y, look.atlas).setOrigin(ox, oy).setScale(echelle * sens, echelle).setDepth(y);
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
    this.boutonRapide = bouton(W - 14, '×2', () => { this.rapide = !this.rapide; this.majBoutons(); });
    this.boutonAuto = bouton(W - 70, 'Auto', () => {
      this.auto = !this.auto;
      this.majBoutons();
      if (this.auto && !this.occupe && this.combat.acteur?.camp === 'A') this.jouerIA();
      this.majSorts();
    });
    this.add.text(14, 22, 'Combat d\'essai · Salle des Scarafeuilles', {
      fontFamily: POLICE, fontSize: '13px', fontStyle: '600', color: '#ffe08a', backgroundColor: 'rgba(10,20,15,0.8)', padding: { x: 12, y: 7 },
    }).setDepth(3000);
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
    return this.rapide ? 2 : 1;
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
      case 'fin':
        await this.attendre(900);
        this.afficherFin(e.vainqueur);
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

  private majVue(vue: Vue) {
    const { u, x, y } = vue;
    const g = vue.barres.clear();
    if (!u.vivant) {
      vue.zone.disableInteractive();
      vue.niveau.setVisible(false);
      vue.effets.setVisible(false);
      vue.socle.setStrokeStyle();
      return;
    }

    // Élément + niveau (+ couronne du leader)
    const f = fiche(u.monstre.id);
    g.fillStyle(COULEUR[u.element]).fillCircle(x - 40, y + 20, 7).lineStyle(1.5, 0x000000, 0.7).strokeCircle(x - 40, y + 20, 7);
    vue.niveau.setText(`${u.place === 0 ? '♛ ' : ''}Niv. ${NIVEAU_MAX[f.etoiles]}`).setPosition(x - 30, y + 13);

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
    this.boutonRapide.setBackgroundColor(this.rapide ? '#c9a24a' : 'rgba(10,20,15,0.8)').setColor(this.rapide ? '#1d1405' : '#ffffff');
  }

  private afficherFin(vainqueur: 'A' | 'B' | null) {
    this.majSorts();
    for (const slot of this.frise) { slot.cadre.clear(); slot.portrait.setVisible(false); }
    const voile = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(4000).setInteractive();
    const titre = vainqueur === 'A' ? 'Victoire !' : vainqueur === 'B' ? 'Défaite…' : 'Match nul';
    this.add.text(W / 2, H / 2 - 40, titre, { fontFamily: POLICE_CHIFFRES, fontSize: '64px', color: vainqueur === 'A' ? '#ffd23f' : '#ff8a7a' })
      .setOrigin(0.5).setStroke('#2a1600', 8).setDepth(4001);
    this.add.text(W / 2, H / 2 + 50, 'Rejouer', {
      fontFamily: POLICE, fontSize: '20px', fontStyle: '600', color: '#1d1405', backgroundColor: '#e3b54c', padding: { x: 22, y: 10 },
    }).setOrigin(0.5).setDepth(4001).setInteractive({ useHandCursor: true }).on('pointerdown', () => { voile.destroy(); this.scene.restart(); });
    this.add.text(W / 2, H / 2 + 100, `${this.combat.tour} tours`, { fontFamily: POLICE, fontSize: '14px', color: '#cfdccf' }).setOrigin(0.5).setDepth(4001);
  }
}

const fmt = (n: number) => n.toLocaleString('fr-FR');
