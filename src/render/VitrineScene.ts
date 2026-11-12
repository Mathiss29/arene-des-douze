import Phaser from 'phaser';
import MONSTRES from '../data/monstres.json';
import type { FicheMonstre } from '../sim/types';
import { LOOKS } from './looks';
import { atlasPlanche, dossierPlanches } from './assetUrl';
import { creerAnimations, origine } from './animations';

const FICHES = MONSTRES as FicheMonstre[];

const COULEUR_ELEMENT: Record<string, number> = {
  feu: 0xe8673f, air: 0x69d391, eau: 0x4aa3e6, bonta: 0xf4e8a8, brakmar: 0xa965de,
};
const NOM_ELEMENT: Record<string, string> = { feu: 'Feu', air: 'Air', eau: 'Eau', bonta: 'Bonta', brakmar: 'Brâkmar' };
const NOM_TYPE: Record<string, string> = { attaque: 'Attaque', defense: 'Défense', pv: 'PV', soutien: 'Soutien' };

interface Case {
  fiche: FicheMonstre;
  sprite: Phaser.GameObjects.Sprite;
  nom: Phaser.GameObjects.Text;
  info: Phaser.GameObjects.Text;
  anim: Phaser.GameObjects.Text;
  socle: Phaser.GameObjects.Ellipse;
  sequence: string[];
  etape: number;
}

/**
 * Étape 1 de l'alpha : vitrine des planches.
 * Vérifie que les 13 monstres de l'alpha se chargent depuis le R2 et que toutes leurs animations jouent.
 * Clic sur un monstre : animation suivante. Touche M : miroir (orientation des ennemis).
 */
export class VitrineScene extends Phaser.Scene {
  private cases: Case[] = [];
  private titre!: Phaser.GameObjects.Text;
  private aide!: Phaser.GameObjects.Text;
  private miroir = false;

  constructor() {
    super('vitrine');
  }

  preload() {
    const barre = this.add.text(20, 20, 'Chargement des planches…', { fontFamily: 'sans-serif', fontSize: '16px', color: '#e9efe6' });
    this.load.on('progress', (p: number) => barre.setText(`Chargement des planches… ${Math.round(p * 100)} %`));
    this.load.on('loaderror', (f: Phaser.Loader.File) => console.error('Planche introuvable :', f.key, f.url));
    this.load.once('complete', () => barre.destroy());
    for (const f of FICHES) {
      const look = LOOKS[f.id];
      this.load.multiatlas(look.atlas, atlasPlanche(look.atlas), dossierPlanches);
      this.load.json(`${look.atlas}:meta`, atlasPlanche(look.atlas));
    }
  }

  create() {
    this.titre = this.add.text(0, 0, 'Arène des Douze · vitrine des monstres de l\'alpha', {
      fontFamily: 'Georgia, serif', fontSize: '24px', color: '#e3b54c',
    }).setOrigin(0.5, 0);
    this.aide = this.add.text(0, 0, 'Clic sur un monstre : animation suivante · M : miroir (ennemis)', {
      fontFamily: 'sans-serif', fontSize: '14px', color: '#93a89b',
    }).setOrigin(0.5, 0);

    for (const fiche of FICHES) {
      const look = LOOKS[fiche.id];
      const anims = creerAnimations(this, look.atlas);
      const meta = (this.cache.json.get(`${look.atlas}:meta`) as { meta?: { cell?: number[]; origin?: number[] } } | undefined)?.meta;
      const [ox, oy] = origine(meta);

      // Direction 1 uniquement : course, attaques dans l'ordre, coup reçu, mort
      const dir1 = (a: string) => anims.includes(a);
      const attaques = Object.keys(look.attaques).map((n) => `AnimAttaque${n}_1`).filter(dir1);
      const sequence = ['AnimCourse_1', ...attaques, 'AnimHit_1', 'AnimMort_1'].filter(dir1);

      const socle = this.add.ellipse(0, 0, 90, 26, COULEUR_ELEMENT[fiche.element], 0.35);
      const sprite = this.add.sprite(0, 0, look.atlas).setOrigin(ox, oy).setScale(look.echelle).setInteractive({ useHandCursor: true });
      sprite.play(`${look.atlas}/AnimStatique_1`);
      const nom = this.add.text(0, 0, fiche.nom, { fontFamily: 'sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#e9efe6' }).setOrigin(0.5, 0);
      const info = this.add.text(0, 0, `${'★'.repeat(fiche.etoiles)} · ${NOM_ELEMENT[fiche.element]} · ${NOM_TYPE[fiche.type]}`, {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#' + COULEUR_ELEMENT[fiche.element].toString(16).padStart(6, '0'),
      }).setOrigin(0.5, 0);
      const anim = this.add.text(0, 0, 'Repos', { fontFamily: 'monospace', fontSize: '11px', color: '#93a89b' }).setOrigin(0.5, 0);
      for (const t of [nom, info, anim]) t.setDepth(10).setShadow(0, 1, '#000', 3, false, true);

      const c: Case = { fiche, sprite, nom, info, anim, socle, sequence, etape: 0 };
      sprite.on('pointerdown', () => this.suivante(c));
      this.cases.push(c);
    }

    this.input.keyboard?.on('keydown-M', () => {
      this.miroir = !this.miroir;
      for (const c of this.cases) c.sprite.setFlipX(this.miroir);
    });

    this.disposer();
    this.scale.on('resize', () => this.disposer());
  }

  /** Joue l'animation suivante de la séquence, puis revient au repos. */
  private suivante(c: Case) {
    if (c.sequence.length === 0) return;
    const nom = c.sequence[c.etape % c.sequence.length];
    c.etape++;
    const atlas = LOOKS[c.fiche.id].atlas;
    c.anim.setText(nom.replace(/_1$/, ''));
    c.sprite.off('animationcomplete');
    c.sprite.play({ key: `${atlas}/${nom}`, repeat: nom.startsWith('AnimCourse') ? 2 : 0 });
    c.sprite.once('animationcomplete', () => {
      this.time.delayedCall(nom.startsWith('AnimMort') ? 700 : 0, () => {
        c.sprite.play(`${atlas}/AnimStatique_1`);
        c.anim.setText('Repos');
      });
    });
  }

  /** Grille par famille : Pious, Scarafeuilles, Kwaks. S'adapte à la taille de l'écran. */
  private disposer() {
    const { width, height } = this.scale;
    const familles = [...new Set(this.cases.map((c) => c.fiche.famille))];
    const zoom = Math.min(1, width / 980, (height - 90) / (familles.length * 220));
    this.titre.setPosition(width / 2, 14).setScale(Math.max(0.7, zoom));
    this.aide.setPosition(width / 2, 48).setScale(Math.max(0.7, zoom));

    const haut = 90;
    const hauteurLigne = (height - haut) / familles.length;
    familles.forEach((famille, ligne) => {
      const membres = this.cases.filter((c) => c.fiche.famille === famille);
      const largeurCol = Math.min(190 * zoom, width / membres.length);
      const x0 = width / 2 - (largeurCol * (membres.length - 1)) / 2;
      const yPieds = haut + hauteurLigne * ligne + hauteurLigne * 0.62;
      membres.forEach((c, i) => {
        const x = x0 + i * largeurCol;
        c.socle.setPosition(x, yPieds).setScale(zoom);
        c.sprite.setPosition(x, yPieds).setScale(LOOKS[c.fiche.id].echelle * zoom);
        c.nom.setPosition(x, yPieds + 30 * zoom).setScale(Math.max(0.75, zoom));
        c.info.setPosition(x, yPieds + 48 * zoom).setScale(Math.max(0.75, zoom));
        c.anim.setPosition(x, yPieds + 64 * zoom).setScale(Math.max(0.75, zoom));
      });
    });
  }
}
