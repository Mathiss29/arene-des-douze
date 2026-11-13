import Phaser from 'phaser';
import { LOOKS } from '../looks';
import { atlasPlanche, distant, dossierPlanches } from '../assetUrl';
import { creerAnimations, origine } from '../animations';
import { auraElement, cercleRunique, eveil, halo, type Corps, type Effet, type StyleEveil } from '../effets';
import { creerPanneau, type Question } from './panneau';

/**
 * Maquette « Éveils : » jouable dans le jeu (adresse #maquette-eveils).
 * Cinq monstres éveillés dans la salle des Scarafeuilles ; chaque option du panneau change l'écran en direct.
 * Effets maison (src/render/effets.ts), générés par le jeu.
 */

const W = 1280;
const H = 720;
const POLICE = 'Lexend, sans-serif';
const Z = 1.2;

type Element = 'feu' | 'air' | 'eau' | 'bonta' | 'brakmar';
const COULEUR: Record<Element, number> = { feu: 0xe8673f, air: 0x69d391, eau: 0x4aa3e6, bonta: 0xf4e8a8, brakmar: 0xa965de };

interface Slot {
  base: string;
  /** Forme adulte, si la famille en a une. */
  adulte?: string;
  nomBase: string;
  nomEveil: string;
  element: Element;
  /** Taille des effets autour de ce monstre. */
  fx: number;
  x: number;
  y: number;
}

const SLOTS: Slot[] = [
  { base: 'scarafeuille_bleu', nomBase: 'Scarafeuille Bleu', nomEveil: 'Ondine', element: 'eau', fx: 1.35, x: 170, y: 390 },
  { base: 'piou_vert', nomBase: 'Piou Vert', nomEveil: 'Zéphyrin', element: 'air', fx: 0.8, x: 405, y: 390 },
  { base: 'scarafeuille_noir', nomBase: 'Scarafeuille Noir', nomEveil: 'Sylvombre', element: 'brakmar', fx: 1.35, x: 640, y: 390 },
  { base: 'kwak_de_flamme', adulte: 'kwakere_de_flamme', nomBase: 'Kwak de Flamme', nomEveil: 'Flambard', element: 'feu', fx: 1.1, x: 875, y: 390 },
  { base: 'boufton_noir', adulte: 'bouftou_noir', nomBase: 'Boufton Noir', nomEveil: 'Suinombre', element: 'brakmar', fx: 1.2, x: 1110, y: 390 },
];

const QUESTIONS: Question[] = [
  { titre: 'Kwaks éveillés', aide: 'Le Kwakère est la forme adulte du Kwak (planche existante).', options: [{ id: 'A', texte: 'Forme Kwakère' }, { id: 'B', texte: 'Même apparence + aura' }] },
  { titre: 'Bouftous éveillés', aide: 'Le Boufton (jeune) devient Bouftou (adulte).', options: [{ id: 'A', texte: 'Boufton → Bouftou' }, { id: 'B', texte: 'Même apparence + aura' }] },
  {
    titre: 'Aura des éveillés',
    aide: 'Particules : braises (Feu), bulles et ondes (Eau), feuilles (Air), rayons dorés (Bonta), fumée (Brâkmar).',
    options: [{ id: 'A', texte: 'Particules d\'élément' }, { id: 'B', texte: 'Cercle runique au sol' }, { id: 'C', texte: 'Halo lumineux' }, { id: 'D', texte: 'Particules + halo' }, { id: 'E', texte: 'Aucune' }],
  },
  { titre: 'Intensité de l\'aura', options: [{ id: 'A', texte: 'Discrète' }, { id: 'B', texte: 'Normale' }, { id: 'C', texte: 'Spectaculaire' }], defaut: 'B' },
  { titre: 'Quand l\'aura est visible', aide: 'B : l\'aura n\'apparaît que sur le monstre dont c\'est le tour.', options: [{ id: 'A', texte: 'Tout le temps' }, { id: 'B', texte: 'Pendant son tour' }, { id: 'C', texte: 'Dans la collection seulement' }] },
  { titre: 'Taille (familles sans forme adulte)', options: [{ id: 'A', texte: 'Identique' }, { id: 'B', texte: '+12 %' }, { id: 'C', texte: '+20 %' }], defaut: 'B' },
  { titre: 'Couleurs (familles sans forme adulte)', options: [{ id: 'A', texte: 'Identiques' }, { id: 'B', texte: 'Plus vives' }] },
  { titre: 'Moment de l\'éveil', aide: 'Clique sur « Rejouer l\'éveil » pour le voir.', options: [{ id: 'A', texte: 'Implosion puis éclair' }, { id: 'B', texte: 'Pilier de lumière' }, { id: 'C', texte: 'Tourbillon' }] },
  { titre: 'Nom affiché', options: [{ id: 'A', texte: 'Nom éveillé seul' }, { id: 'B', texte: 'Nom éveillé + monstre d\'origine' }] },
  { titre: 'Éléments manquants', aide: 'Les Kwaks n\'existent qu\'en Feu, Air et Eau : on peut recolorer le Kwak de Terre.', options: [{ id: 'A', texte: 'Recolorer (Kwaks Bonta et Brâkmar)' }, { id: 'B', texte: 'Familles incomplètes' }] },
];

export class MaquetteEveils extends Phaser.Scene {
  private choix: string[] = QUESTIONS.map((q) => q.defaut ?? 'A');
  private calque: Phaser.GameObjects.GameObject[] = [];
  private effets: Effet[] = [];
  private sprites: (Phaser.GameObjects.Sprite | undefined)[] = [];
  private actif = 0;
  private base = false;

  constructor() {
    super('maquette-eveils');
  }

  preload() {
    const t = this.add.text(W / 2, H / 2, 'Chargement…', { fontFamily: POLICE, fontSize: '18px', color: '#e9efe6' }).setOrigin(0.5);
    this.load.once('complete', () => t.destroy());
    this.load.image('arene:maquette', distant('mondes/astrub/sol_arene_scarafeuilles.webp'));
    const ids = new Set([...SLOTS.flatMap((s) => [s.base, s.adulte].filter((x): x is string => !!x)), 'kwak_de_terre']);
    for (const id of ids) {
      const a = LOOKS[id].atlas;
      this.load.multiatlas(a, atlasPlanche(a), dossierPlanches);
      this.load.json(`${a}:meta`, atlasPlanche(a));
    }
  }

  create() {
    const s = W / 2300;
    this.add.image(-520 * s, -600 * s, 'arene:maquette').setOrigin(0).setScale(s);
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.35);
    creerPanneau('Éveils', 'Cinq monstres éveillés en combat. Choisis une option : l\'écran change tout de suite. Effets faits maison (particules, halos, runes), générés par le jeu.', this.questionsAvecActions(), (c) => {
      this.choix = c;
      if (this.sys.isActive()) this.dessiner();
    });
    // Mode « pendant son tour » : le tour passe d'un monstre à l'autre
    this.time.addEvent({ delay: 1600, loop: true, callback: () => { this.actif = (this.actif + 1) % SLOTS.length; if (this.choix[4] === 'B') this.dessiner(); } });
    this.dessiner();
  }

  private questionsAvecActions(): Question[] {
    return QUESTIONS.map((q, i) => {
      if (i === 0) return { ...q, action: { texte: 'Comparer avec la base', faire: () => { this.base = !this.base; this.dessiner(); } } };
      if (i === 7) return { ...q, action: { texte: 'Rejouer l\'éveil', faire: () => this.eveil() } };
      return q;
    });
  }

  private vider() {
    for (const e of this.effets) e.detruire();
    this.effets = [];
    for (const o of this.calque) o.destroy();
    this.calque = [];
  }

  /** Taille visible d'un monstre à l'écran, pour dimensionner ses effets. */
  private corps(sp: Phaser.GameObjects.Sprite, s: Slot): Corps {
    const f = sp.frame;
    return { x: s.x, y: s.y, largeur: Math.min(220, f.cutWidth * Math.abs(sp.scaleX)), hauteur: Math.min(240, f.cutHeight * sp.scaleY) };
  }

  private garder<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.calque.push(o);
    return o;
  }

  /** Planche à afficher pour un slot selon les choix (forme adulte ou non). */
  private apparence(s: Slot): { id: string; adulte: boolean } {
    if (this.base) return { id: s.base, adulte: false };
    const q = s.base.startsWith('kwak') ? 0 : s.base.startsWith('boufton') ? 1 : -1;
    if (s.adulte && q >= 0 && this.choix[q] === 'A') return { id: s.adulte, adulte: true };
    return { id: s.base, adulte: false };
  }

  private monstre(id: string, x: number, y: number, taille: number) {
    const look = LOOKS[id];
    creerAnimations(this, look.atlas);
    const meta = (this.cache.json.get(`${look.atlas}:meta`) as { meta?: { cell?: number[]; origin?: number[] } } | undefined)?.meta;
    const [ox, oy] = origine(meta);
    const sp = this.garder(this.add.sprite(x, y, look.atlas).setOrigin(ox, oy).setScale(look.echelle * Z * taille).setDepth(y));
    sp.play(`${look.atlas}/AnimStatique_1`);
    return sp;
  }

  private dessiner() {
    this.vider();
    const [, , aura, intensite, quand, taille, couleurs, , nom, manquants] = this.choix;
    this.sprites = [];
    for (const [i, s] of SLOTS.entries()) {
      const { id, adulte } = this.apparence(s);
      const eveille = !this.base;
      const k = eveille && !adulte ? { A: 1, B: 1.12, C: 1.2 }[taille]! : 1;
      const sp = this.monstre(id, s.x, s.y, k);
      this.sprites[i] = sp;
      if (eveille && !adulte && couleurs === 'B') sp.preFX?.addColorMatrix().saturate(0.6);

      // Socle doré du monstre dont c'est le tour (mode B)
      if (quand === 'B') {
        const actif = i === this.actif;
        this.garder(this.add.ellipse(s.x, s.y, 110 * s.fx, 34 * s.fx, actif ? 0xffcf4a : 0x000000, actif ? 0.3 : 0.25).setStrokeStyle(actif ? 3 : 0, 0xffcf4a).setDepth(s.y - 2));
      }
      const auraVisible = eveille && quand !== 'C' && (quand === 'A' || i === this.actif);
      if (auraVisible) this.aura(aura, { A: 0.5, B: 1, C: 1.8 }[intensite]!, s, sp);

      // Nom
      const titre = eveille ? s.nomEveil : s.nomBase;
      const sous = eveille && nom === 'B' ? s.nomBase : '';
      this.garder(this.add.text(s.x, s.y + 44, titre, { fontFamily: POLICE, fontSize: '17px', fontStyle: '600', color: eveille ? '#' + COULEUR[s.element].toString(16).padStart(6, '0') : '#e9efe6' })
        .setOrigin(0.5, 0).setShadow(0, 1, '#000', 4, false, true).setDepth(2000));
      if (sous) this.garder(this.add.text(s.x, s.y + 66, sous, { fontFamily: POLICE, fontSize: '12px', color: '#cfdccf' }).setOrigin(0.5, 0).setShadow(0, 1, '#000', 3, false, true).setDepth(2000));
    }
    if (quand === 'C') this.garder(this.add.text(W / 2, 520, 'En combat, pas d\'aura : elle n\'apparaît que dans la collection.', { fontFamily: POLICE, fontSize: '14px', color: '#ffe08a', backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 10, y: 5 } }).setOrigin(0.5).setDepth(2000));

    // Éléments manquants : Kwaks Bonta et Brâkmar recolorés depuis le Kwak de Terre
    this.garder(this.add.text(W / 2, 560, 'Éléments manquants des Kwaks', { fontFamily: POLICE, fontSize: '13px', fontStyle: '600', color: '#c9a24a' }).setOrigin(0.5).setDepth(2000));
    if (manquants === 'A') {
      const bonta = this.monstre('kwak_de_terre', W / 2 - 120, 690, 0.8);
      const fb = bonta.preFX?.addColorMatrix();
      fb?.hue(12); fb?.saturate(-0.8, true);
      fb?.brightness(1.4, true);
      const brak = this.monstre('kwak_de_terre', W / 2 + 120, 690, 0.8);
      const fk = brak.preFX?.addColorMatrix();
      fk?.hue(-140); fk?.brightness(0.78, true);
      for (const [x, t, c] of [[W / 2 - 120, 'Kwak Bonta', '#f4e8a8'], [W / 2 + 120, 'Kwak Brâkmar', '#c48cf0']] as const)
        this.garder(this.add.text(x + 70, 640, t, { fontFamily: POLICE, fontSize: '13px', fontStyle: '600', color: c }).setOrigin(0, 0.5).setShadow(0, 1, '#000', 3, false, true).setDepth(2000));
    } else {
      this.garder(this.add.text(W / 2, 640, 'Kwaks en Feu, Air et Eau seulement', { fontFamily: POLICE, fontSize: '13px', color: '#9fb3a6' }).setOrigin(0.5).setDepth(2000));
    }
  }

  private aura(style: string, densite: number, s: Slot, sp: Phaser.GameObjects.Sprite) {
    const c = this.corps(sp, s);
    if (style === 'A' || style === 'D') this.effets.push(auraElement(this, s.element, c, densite));
    if (style === 'B') this.effets.push(cercleRunique(this, s.element, c, densite));
    if (style === 'C' || style === 'D') this.effets.push(halo(this, s.element, sp, style === 'D' ? densite * 0.7 : densite));
  }

  /** Moment de l'éveil : chaque monstre repart de sa forme de base et se transforme. */
  private eveil() {
    this.base = true;
    this.dessiner();
    const style: StyleEveil = ({ A: 'explosion', B: 'pilier', C: 'tourbillon' } as const)[this.choix[7] as 'A' | 'B' | 'C'];
    let fait = false;
    SLOTS.forEach((s, i) => {
      const sp = this.sprites[i];
      if (!sp) return;
      eveil(this, s.element, this.corps(sp, s), () => this.sprites[i], style, () => {
        if (fait) return;
        fait = true;
        this.base = false;
        this.dessiner();
      });
    });
  }
}
