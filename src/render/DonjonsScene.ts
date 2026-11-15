import Phaser from 'phaser';
import { charger } from './sauvegarde';
import type { Joueur } from '../sim/joueur';
import { fiche } from '../sim/fiches';
import { energie } from '../sim/energie';
import {
  CHANCES, DONJONS, NB_NIVEAUX, NIVEAUX, RUNES_NIVEAU, cleDonjon, donjonOuvert, niveauFini, niveauOuvert, niveauxFinis, nomZone, type Donjon,
} from '../sim/donjons';
import { SETS } from '../sim/runes';
import { H, OR, POLICE, W, bouton, chargerUi, panneau, portrait, texte } from './ui';

/**
 * Donjons (maquette « Donjons : » 1C 2B 3C 4C 5C 6C 7A 8A) : comme le Donjon de Cairos de SW, un seul lieu,
 * la liste des donjons à gauche et les 10 niveaux du donjon choisi à droite ; « Préparer » mène à la préparation d'équipe,
 * où l'on peut aussi lancer les combats à répétition.
 */
export class DonjonsScene extends Phaser.Scene {
  private joueur!: Joueur;
  private donjon!: Donjon;
  private niveau = 1;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;

  constructor() { super('donjons'); }

  init(data: { donjon?: string; niveau?: number }) {
    this.joueur = charger();
    this.donjon = DONJONS.find((d) => d.id === data?.donjon) ?? DONJONS.find((d) => donjonOuvert(this.joueur, d)) ?? DONJONS[0];
    const premierLibre = Array.from({ length: NB_NIVEAUX }, (_, i) => i + 1).find((n) => niveauOuvert(this.joueur, this.donjon, n) && !niveauFini(this.joueur, this.donjon, n));
    this.niveau = data?.niveau ?? premierLibre ?? 1;
    this.calque = [];
  }

  preload() {
    chargerUi(this, DONJONS.flatMap((d) => (d.boss ? [d.boss] : [])));
    if (!this.textures.exists('zaap_frigost')) this.load.image('zaap_frigost', 'assets/zaap/frigost.webp');
  }

  create() {
    const fond = this.add.image(W / 2, H / 2, 'zaap_frigost').setTint(0x4a5248);
    fond.setScale(Math.max(W / fond.width, H / fond.height));
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.5);
    const ret = texte(this, 16, 14, '‹ Carte', 15, '#ffe08a', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('zaap'));
    texte(this, ret.x + ret.width + 10, 14, 'Donjons', 15, '#ffffff', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    this.dessiner();
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur, now = Date.now();
    this.g(texte(this, W - 16, 14, `⚡ ${energie(j, now)}`, 15, '#8fd3ff', true, 1, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7));

    // liste des donjons
    DONJONS.forEach((d, i) => {
      const y = 70 + i * 116, ouvert = donjonOuvert(j, d), sel = d === this.donjon;
      const f = this.g(this.add.rectangle(30, y, 330, 104, 0x0f1814, 0.94).setOrigin(0).setStrokeStyle(sel ? 3 : 1.5, sel ? 0xe3b54c : 0x5d6f52).setDepth(1000));
      this.g(texte(this, 50, y + 14, d.nom, 16, ouvert ? '#ffffff' : '#8a9488', true, 0, 0));
      this.g(texte(this, 50, y + 40, d.sets.map((s) => SETS[s].dieu).join(', '), 12, ouvert ? OR : '#6f7a6c', false, 0, 0).setWordWrapWidth(280));
      this.g(texte(this, 50, y + 76, ouvert ? `${niveauxFinis(j, d)} / ${NB_NIVEAUX} niveaux` : d.boss ? `🔒 Finis ${nomZone(d.zone)} en Normal` : `🔒 Avec ${nomZone(d.zone)}, plus tard`, 12, '#93a89b', false, 0, 0));
      f.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.donjon = d; this.niveau = 1; this.dessiner(); });
    });
    const sa = this.g(this.add.rectangle(30, 70 + 3 * 116, 330, 70, 0x0f1814, 0.7).setOrigin(0).setStrokeStyle(1.5, 0x3c4840).setDepth(1000));
    this.g(texte(this, 50, 70 + 3 * 116 + 14, '🔒 Sanctuaires élémentaires', 15, '#8a9488', true, 0, 0));
    this.g(texte(this, 50, 70 + 3 * 116 + 40, 'Essences pour l\'éveil, avec l\'éveil', 12, '#6f7a6c', false, 0, 0));
    sa.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.message('Les Sanctuaires élémentaires arriveront avec l\'éveil des monstres.'));

    // le donjon choisi
    const d = this.donjon, ouvert = donjonOuvert(j, d);
    this.g(panneau(this, 380, 60, 870, 640));
    this.g(texte(this, 404, 76, d.nom, 22, '#ffffff', true, 0, 0));
    this.g(texte(this, 404, 108, d.texte, 13, '#c9cfc4', false, 0, 0).setWordWrapWidth(640));
    if (d.boss) {
      const p = portrait(this, d.boss, 1150, 108, 72, true);
      this.g(p.sp); this.g(p.masque);
      this.g(texte(this, 1150, 148, `Boss : ${fiche(d.boss).nom}`, 12, '#ffd7cf', true, 0.5, 0));
    }
    if (!ouvert) {
      this.g(texte(this, 815, 380, d.boss ? `Finis ${nomZone(d.zone)} en Normal pour ouvrir ce donjon.` : `Ce donjon s'ouvrira avec ${nomZone(d.zone)}, dans une prochaine version.`, 17, '#ffe08a', true, 0.5, 0.5));
      return;
    }

    // les 10 niveaux
    for (let n = 1; n <= NB_NIVEAUX; n++) {
      const y = 186 + (n - 1) * 40, b = NIVEAUX[n - 1], [rmin, rmax] = RUNES_NIVEAU[n - 1];
      const ok = niveauOuvert(j, d, n), fini = niveauFini(j, d, n), sel = n === this.niveau;
      const f = this.g(this.add.rectangle(400, y, 640, 34, sel ? 0x3a3220 : n % 2 ? 0x16211c : 0x1a2620).setOrigin(0, 0.5).setStrokeStyle(sel ? 2 : 0, 0xe3b54c).setDepth(1000));
      const c = ok ? '#ffffff' : '#5f6a5c';
      this.g(texte(this, 416, y, `Niv. ${n}`, 14, c, true, 0, 0.5));
      this.g(texte(this, 490, y, `Boss ${'★'.repeat(b.etoiles)} niv. ${b.niveau}`, 13, ok ? '#ffcf4a' : '#5f6a5c', false, 0, 0.5));
      this.g(texte(this, 680, y, `Runes ${rmin === rmax ? rmin : `${rmin}-${rmax}`}★${n >= 8 ? ' Rare+' : ''}`, 13, ok ? '#d9b3ff' : '#5f6a5c', false, 0, 0.5));
      this.g(texte(this, 880, y, fini ? 'Fini' : ok ? 'Nouveau' : '🔒', 13, fini ? '#7fd05a' : ok ? '#ffe08a' : '#5f6a5c', true, 0, 0.5));
      this.g(texte(this, 1000, y, `⚡${b.cout}`, 13, ok ? '#8fd3ff' : '#5f6a5c', true, 0, 0.5));
      f.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (ok) { this.niveau = n; this.dessiner(); } else this.message(`Finis le niveau ${n - 1} pour ouvrir le niveau ${n}.`); });
    }

    // butin possible
    const n = this.niveau, [rmin, rmax] = RUNES_NIVEAU[n - 1];
    this.g(texte(this, 1060, 186, 'BUTIN POSSIBLE', 12, OR, true, 0, 0.5));
    const butin = [
      `Runes ${rmin === rmax ? rmin : `${rmin} à ${rmax}`}★`, ...d.sets.map((s) => `  ${SETS[s].dieu} (${SETS[s].nom})`),
      'Kamas', `Pierre d'âme (rare)`, ...(n >= 6 ? ['Pierre parfaite (très rare)'] : []), ...(n >= 3 ? [d.symbole] : []),
      niveauFini(j, d, n) ? '' : n <= 5 ? '1er passage : rune ' + Math.min(6, rmax + 1) + '★' : '1er passage : pierre parfaite',
    ].filter(Boolean);
    butin.forEach((l, i) => this.g(texte(this, 1060, 212 + i * 22, l, 12, l.startsWith('1er') ? '#ffe08a' : l.startsWith('  ') ? '#d9b3ff' : '#c9cfc4', l.startsWith('1er'), 0, 0.5)));
    void CHANCES;

    const pret = niveauOuvert(j, d, n);
    const b = bouton(this, 1140, 660, 200, 54, `Préparer · niv. ${n}`, true, () => this.scene.start('preparation', { stage: cleDonjon(d.id, n) }));
    this.g(b.fond); this.g(b.t);
    if (!pret) b.griser();
    this.g(texte(this, 404, 660, 'Dans la préparation : « Combattre » ou « Répéter » jusqu\'à 30 fois en auto.', 12, '#93a89b', false, 0, 0.5));
  }

  private message(s: string) {
    this.avis?.destroy();
    const tx = this.add.text(0, 0, s, { fontFamily: POLICE, fontSize: '15px', color: '#ffffff', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
    const f = this.add.rectangle(0, 0, tx.width + 36, tx.height + 22, 0x0c1410, 0.95).setStrokeStyle(1.5, 0xb08a3a);
    const c = this.add.container(W / 2, 40, [f, tx]).setDepth(5000);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2400, duration: 500, onComplete: () => c.destroy() });
  }
}
