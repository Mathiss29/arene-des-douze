import Phaser from 'phaser';
import { LOOKS } from '../looks';
import { atlasPlanche, distant, dossierPlanches } from '../assetUrl';
import { creerAnimations, origine } from '../animations';
import { chargerFx, dureeFx, poserFx } from '../fx';
import { creerPanneau, type Question } from './panneau';

/**
 * Maquette « Éveils : » jouable dans le jeu (adresse #maquette-eveils).
 * Cinq monstres éveillés dans la salle des Scarafeuilles ; chaque option du panneau change l'écran en direct.
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

/** Étincelles et auras par élément (effets officiels). Brâkmar : étincelles dorées recolorées en violet. */
const ETINCELLES: Record<Element, string> = { feu: '8645', air: '8641', eau: '8643', bonta: '8647', brakmar: '8647' };
const AURA: Record<Element, string> = { feu: '9606', air: '7981', eau: '9138', bonta: '8647', brakmar: '8842' };
const EVEIL: Record<string, { fx: string; k: number }> = { A: { fx: '8020', k: 0.75 }, B: { fx: '922', k: 1.2 }, C: { fx: '9691', k: 1 } };
const TOUS_FX = ['8190', '7996', '8641', '8643', '8645', '8647', '9138', '7981', '9606', '8842', '8020', '922', '9691'];

const QUESTIONS: Question[] = [
  { titre: 'Kwaks éveillés', aide: 'Le Kwakère est la forme adulte du Kwak (planche existante).', options: [{ id: 'A', texte: 'Forme Kwakère' }, { id: 'B', texte: 'Même apparence + style d\'éveil' }] },
  { titre: 'Bouftous éveillés', aide: 'Le Boufton (jeune) devient Bouftou (adulte).', options: [{ id: 'A', texte: 'Boufton → Bouftou' }, { id: 'B', texte: 'Même apparence + style d\'éveil' }] },
  {
    titre: 'Aura des éveillés',
    options: [{ id: 'A', texte: 'Cercle magique + étincelles' }, { id: 'B', texte: 'Anneau doré' }, { id: 'C', texte: 'Aura d\'élément' }, { id: 'D', texte: 'Halo lumineux' }, { id: 'E', texte: 'Aucune' }],
    defaut: 'C',
  },
  { titre: 'Quand l\'aura est visible', aide: 'B : l\'aura n\'apparaît que sur le monstre dont c\'est le tour.', options: [{ id: 'A', texte: 'Tout le temps' }, { id: 'B', texte: 'Pendant son tour' }, { id: 'C', texte: 'Dans la collection seulement' }] },
  { titre: 'Taille (familles sans forme adulte)', options: [{ id: 'A', texte: 'Identique' }, { id: 'B', texte: '+12 %' }, { id: 'C', texte: '+20 %' }], defaut: 'B' },
  { titre: 'Couleurs (familles sans forme adulte)', options: [{ id: 'A', texte: 'Identiques' }, { id: 'B', texte: 'Plus vives' }] },
  { titre: 'Moment de l\'éveil', options: [{ id: 'A', texte: 'Colonne de lumière' }, { id: 'B', texte: 'Lotus' }, { id: 'C', texte: 'Pilier blanc' }] },
  { titre: 'Nom affiché', options: [{ id: 'A', texte: 'Nom éveillé seul' }, { id: 'B', texte: 'Nom éveillé + monstre d\'origine' }] },
  { titre: 'Éléments manquants', aide: 'Les Kwaks n\'existent qu\'en Feu, Air et Eau : on peut recolorer le Kwak de Terre.', options: [{ id: 'A', texte: 'Recolorer (Kwaks Bonta et Brâkmar)' }, { id: 'B', texte: 'Familles incomplètes' }] },
];

export class MaquetteEveils extends Phaser.Scene {
  private choix: string[] = QUESTIONS.map((q) => q.defaut ?? 'A');
  private calque: Phaser.GameObjects.GameObject[] = [];
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
    chargerFx(this, TOUS_FX);
  }

  create() {
    const s = W / 2300;
    this.add.image(-520 * s, -600 * s, 'arene:maquette').setOrigin(0).setScale(s);
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.35);
    creerPanneau('Éveils', 'Cinq monstres éveillés en combat. Choisis une option : l\'écran change tout de suite. Les effets sont les vrais effets de sorts de Dofus 3.', this.questionsAvecActions(), (c) => {
      this.choix = c;
      if (this.sys.isActive()) this.dessiner();
    });
    // Mode « pendant son tour » : le tour passe d'un monstre à l'autre
    this.time.addEvent({ delay: 1600, loop: true, callback: () => { this.actif = (this.actif + 1) % SLOTS.length; if (this.choix[3] === 'B') this.dessiner(); } });
    this.dessiner();
  }

  private questionsAvecActions(): Question[] {
    return QUESTIONS.map((q, i) => {
      if (i === 0) return { ...q, action: { texte: 'Comparer avec la base', faire: () => { this.base = !this.base; this.dessiner(); } } };
      if (i === 6) return { ...q, action: { texte: 'Rejouer l\'éveil', faire: () => this.eveil() } };
      return q;
    });
  }

  private vider() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
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
    const [, , aura, quand, taille, couleurs, , nom, manquants] = this.choix;
    for (const [i, s] of SLOTS.entries()) {
      const { id, adulte } = this.apparence(s);
      const eveille = !this.base;
      const k = eveille && !adulte ? { A: 1, B: 1.12, C: 1.2 }[taille]! : 1;
      const sp = this.monstre(id, s.x, s.y, k);
      if (eveille && !adulte && couleurs === 'B') sp.preFX?.addColorMatrix().saturate(0.6);

      // Socle doré du monstre dont c'est le tour (mode B)
      if (quand === 'B') {
        const actif = i === this.actif;
        this.garder(this.add.ellipse(s.x, s.y, 110 * s.fx, 34 * s.fx, actif ? 0xffcf4a : 0x000000, actif ? 0.3 : 0.25).setStrokeStyle(actif ? 3 : 0, 0xffcf4a).setDepth(s.y - 2));
      }
      const auraVisible = eveille && quand !== 'C' && (quand === 'A' || i === this.actif);
      if (auraVisible) this.aura(aura, s, sp);

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

  private aura(style: string, s: Slot, sp: Phaser.GameObjects.Sprite) {
    const k = s.fx * Z;
    if (style === 'A') {
      this.garder(poserFx(this, '8190', s.x, s.y, k * 1.9, true).setDepth(s.y - 1));
      const e = this.garder(poserFx(this, ETINCELLES[s.element], s.x, s.y, k * 1.2, true).setDepth(s.y + 1).setAlpha(0.9));
      if (s.element === 'brakmar') e.preFX?.addColorMatrix().hue(235);
    } else if (style === 'B') {
      this.garder(poserFx(this, '7996', s.x, s.y, k * 0.62, true).setDepth(s.y - 1));
    } else if (style === 'C') {
      this.garder(poserFx(this, AURA[s.element], s.x, s.y, k * 0.9, true).setDepth(s.y - 1).setAlpha(0.6));
      this.garder(poserFx(this, AURA[s.element], s.x, s.y, k * 0.9, true).setDepth(s.y + 1).setAlpha(0.45));
    } else if (style === 'D') {
      const g = sp.preFX?.addGlow(COULEUR[s.element], 4, 0, false, 0.1, 12);
      if (g) this.garder(this.tweens.add({ targets: g, outerStrength: 9, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) as unknown as Phaser.GameObjects.GameObject);
    }
  }

  /** Moment de l'éveil : chaque monstre repart de sa forme de base et se transforme dans l'effet choisi. */
  private eveil() {
    this.base = true;
    this.dessiner();
    const e = EVEIL[this.choix[6]];
    this.time.delayedCall(400, () => {
      for (const s of SLOTS) poserFx(this, e.fx, s.x, s.y, s.fx * Z * e.k, false).setDepth(3000);
      this.time.delayedCall(dureeFx(e.fx) * 1000 * 0.45, () => { this.base = false; this.dessiner(); });
    });
  }
}
