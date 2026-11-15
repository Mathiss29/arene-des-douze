import Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import type { Joueur } from '../sim/joueur';
import {
  COFFRES, MISSIONS, avantRemise, coffreOuvrable, compte, etatMissions, finie, ouvrirCoffre, peutRecevoir, points, recevoirMission, recevoirTout,
  type Coffre,
} from '../sim/missions';
import { H, OR, POLICE, W, bouton, chargerUi, fmt, panneau, texte } from './ui';

/**
 * Missions du jour (maquette « Missions : » 1A 2B 3A 4B 5A 6B 7A 8C 9A) : barre de 100 points et 5 coffres,
 * liste des missions avec « Recevoir » ou « Y aller » (grisées si leur contenu n'existe pas encore), « Tout recevoir ».
 */
const X0 = 150, LARG = W - 300;

export class MissionsScene extends Phaser.Scene {
  private joueur!: Joueur;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;

  constructor() { super('missions'); }

  init() { this.joueur = charger(); this.calque = []; }

  preload() {
    chargerUi(this, []);
    if (!this.textures.exists('zaap_incarnam')) this.load.image('zaap_incarnam', 'assets/zaap/incarnam.webp');
  }

  create() {
    const fond = this.add.image(W / 2, H / 2, 'zaap_incarnam').setTint(0x5a6450);
    fond.setScale(Math.max(W / fond.width, H / fond.height));
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.45);
    const ret = texte(this, 16, 14, '‹ Incarnam', 15, '#ffe08a', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ile'));
    this.dessiner();
    this.time.addEvent({ delay: 30_000, loop: true, callback: () => this.dessiner() });
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const now = Date.now(), e = etatMissions(this.joueur, now), pts = points(e);
    this.g(panneau(this, X0, 60, LARG, 640));
    this.g(texte(this, X0 + 24, 76, 'Missions du jour', 22, '#ffffff', true, 0, 0));
    const r = avantRemise(now), h = Math.floor(r / 3_600_000), m = Math.floor((r % 3_600_000) / 60_000);
    this.g(texte(this, X0 + LARG - 24, 82, `Nouvelles missions dans ${h} h ${String(m).padStart(2, '0')}`, 13, '#c9cfc4', false, 1, 0));

    // barre de points et coffres
    const bx = X0 + 60, bw = LARG - 120, by = 150;
    this.g(this.add.rectangle(bx, by, bw, 12, 0x1c2823).setOrigin(0, 0.5).setStrokeStyle(1, 0x4e5e52).setDepth(1000));
    this.g(this.add.rectangle(bx, by, (bw * Math.min(100, pts)) / 100, 12, 0x7fd05a).setOrigin(0, 0.5).setDepth(1001));
    this.g(texte(this, bx - 12, by, `${pts}`, 18, OR, true, 1, 0.5));
    COFFRES.forEach((c, i) => {
      const x = bx + (bw * c.points) / 100, ouvert = e.coffres.includes(i), pret = coffreOuvrable(e, i);
      const couleur = ouvert ? 0x3a4a40 : pret ? 0xe3b54c : 0x6b5a3a;
      const coffre = this.g(this.add.rectangle(x, by - 2, 40, 30, couleur).setStrokeStyle(2, pret ? 0xffffff : 0x2a2a20).setDepth(1002));
      this.g(this.add.rectangle(x, by - 10, 40, 4, 0x2a1e10, 0.7).setDepth(1003));
      this.g(texte(this, x, by + 18, `${c.points}`, 12, pret ? OR : '#c9cfc4', true, 0.5, 0));
      this.g(texte(this, x, by + 34, ouvert ? 'Ouvert' : contenu(c), 11, ouvert ? '#7f8a7c' : '#e9efe6', false, 0.5, 0).setAlign('center'));
      if (pret) {
        this.tweens.add({ targets: coffre, scale: 1.12, yoyo: true, repeat: -1, duration: 500 });
        coffre.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          this.joueur = ouvrirCoffre(this.joueur, i, Date.now()); sauver(this.joueur);
          this.message(`Coffre ouvert : ${contenu(c).replace(/\n/g, ', ')}`);
          this.dessiner();
        });
      }
    });

    // liste des missions
    const y0 = 238, pas = 40;
    MISSIONS.forEach((mi, k) => {
      const y = y0 + k * pas, fini = finie(e, mi.id), recue = e.recues.includes(mi.id), grise = !!mi.bientot;
      this.g(this.add.rectangle(X0 + 24, y, LARG - 48, pas - 6, k % 2 ? 0x16211c : 0x1a2620).setOrigin(0, 0.5).setDepth(999));
      this.g(this.add.circle(X0 + 46, y, 8, recue ? 0x4a5a50 : fini ? 0x7fd05a : 0x000000, recue || fini ? 1 : 0).setStrokeStyle(2, grise ? 0x4a5446 : 0x9fb39a).setDepth(1000));
      const coul = grise ? '#6f7a6c' : recue ? '#8a9488' : '#ffffff';
      this.g(texte(this, X0 + 66, y, mi.nom, 15, coul, false, 0, 0.5));
      this.g(texte(this, X0 + 480, y, grise ? 'Bientôt' : `${fmt(compte(e, mi.id))} / ${fmt(mi.objectif)}`, 14, grise ? '#6f7a6c' : '#c9cfc4', false, 0, 0.5));
      this.g(texte(this, X0 + 640, y, `+${mi.points}`, 15, grise ? '#6f7a6c' : OR, true, 0, 0.5));
      const bxm = X0 + LARG - 100;
      if (recue) this.g(texte(this, bxm, y, 'Reçu', 14, '#8a9488', false, 0.5, 0.5));
      else if (peutRecevoir(e, mi.id)) {
        const b = bouton(this, bxm, y, 130, 30, 'Recevoir', true, () => { this.joueur = recevoirMission(this.joueur, mi.id, Date.now()); sauver(this.joueur); this.dessiner(); });
        b.t.setFontSize(14); this.g(b.fond); this.g(b.t);
      } else if (grise) {
        const b = bouton(this, bxm, y, 130, 30, 'Bientôt', false, () => this.message(mi.bientot!));
        b.fond.setAlpha(0.5); b.t.setAlpha(0.6); this.g(b.fond); this.g(b.t);
      } else {
        const b = bouton(this, bxm, y, 130, 30, 'Y aller', false, () => this.scene.start(mi.ecran ?? 'ile'));
        this.g(b.fond); this.g(b.t);
      }
    });

    const nb = MISSIONS.filter((mi) => peutRecevoir(e, mi.id)).length;
    this.g(texte(this, X0 + 24, 668, `${pts} / 100 points · 180 possibles`, 13, '#c9cfc4', false, 0, 0.5));
    if (nb) {
      const b = bouton(this, X0 + LARG - 110, 668, 180, 40, `Tout recevoir (${nb})`, true, () => { this.joueur = recevoirTout(this.joueur, Date.now()); sauver(this.joueur); this.dessiner(); });
      this.g(b.fond); this.g(b.t);
    }
  }

  private message(s: string) {
    this.avis?.destroy();
    const tx = this.add.text(0, 0, s, { fontFamily: POLICE, fontSize: '15px', color: '#ffffff', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
    const f = this.add.rectangle(0, 0, tx.width + 36, tx.height + 22, 0x0c1410, 0.95).setStrokeStyle(1.5, 0xb08a3a);
    const c = this.add.container(W / 2, 210, [f, tx]).setDepth(5000);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2200, duration: 500, onComplete: () => c.destroy() });
  }
}

function contenu(c: Coffre): string {
  const l: string[] = [];
  if (c.kamas) l.push(`${fmt(c.kamas)} kamas`);
  if (c.pierresAme) l.push(`${c.pierresAme} pierres d'âme`);
  if (c.parfaites) l.push(`${c.parfaites} pierre parfaite`);
  if (c.energie) l.push(`${c.energie} énergie`);
  if (c.fragments) l.push(`${c.fragments} fragments`);
  if (c.rune) l.push(`1 rune ${c.rune}★`);
  return l.join('\n');
}
