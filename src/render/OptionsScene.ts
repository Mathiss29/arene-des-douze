import Phaser from 'phaser';
import { charger, dernieresErreurs, effacer, exporter, importer, sauver } from './sauvegarde';
import { VERSION_JEU } from '../version';
import { reglerVolume, volumeMusique } from './musique';
import { H, OR, POLICE, W, bouton, panneau, texte } from './ui';

/**
 * Options : version du jeu, export et import de la sauvegarde (un code à copier), « Signaler un bug » (copie un rapport
 * à coller sur Discord : version, appareil, dernières erreurs, résumé de la partie), plein écran, recommencer.
 */
export class OptionsScene extends Phaser.Scene {
  private avis?: Phaser.GameObjects.Container;
  private confirmer = false;

  constructor() { super('options'); }

  init() { this.confirmer = false; }

  preload() { if (!this.textures.exists('zaap_incarnam')) this.load.image('zaap_incarnam', 'assets/zaap/incarnam.webp'); }

  create() {
    const fond = this.add.image(W / 2, H / 2, 'zaap_incarnam').setTint(0x5a6450);
    fond.setScale(Math.max(W / fond.width, H / fond.height));
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.5);
    const ret = texte(this, 16, 14, '‹ Incarnam', 15, '#ffe08a', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.start('ile'));
    panneau(this, 340, 80, 600, 580);
    texte(this, W / 2, 104, 'Options', 24, '#ffffff', true, 0.5, 0);
    texte(this, W / 2, 140, `Arène des Douze · version ${VERSION_JEU} · fan game gratuit, sans achat`, 13, '#93a89b', false, 0.5, 0);

    const ligne = (y: number, titre: string, aide: string, lib: string, vert: boolean, action: () => void) => {
      texte(this, 380, y - 12, titre, 16, '#ffffff', true, 0, 0.5);
      texte(this, 380, y + 12, aide, 12, '#93a89b', false, 0, 0.5).setWordWrapWidth(360);
      bouton(this, 830, y, 170, 42, lib, vert, action);
    };
    ligne(196, 'Exporter ma partie', 'Copie un code à garder ou à coller sur un autre appareil.', 'Copier le code', true, () => this.exporter());
    ligne(264, 'Importer une partie', 'Colle un code : il remplace la partie de cet appareil.', 'Coller un code', false, () => this.importer());
    ligne(332, 'Signaler un bug', 'Copie un rapport (version, appareil, erreurs) à coller sur le Discord.', 'Copier le rapport', false, () => this.signaler());
    ligne(400, 'Plein écran', 'Conseillé sur téléphone, en mode paysage.', 'Plein écran', false, () => {
      if (this.scale.isFullscreen) this.scale.stopFullscreen(); else this.scale.startFullscreen();
    });
    const libVolume = () => { const v = volumeMusique(); return v === 0 ? 'Coupée' : `${Math.round(v * 100)} %`; };
    const bv = bouton(this, 830, 468, 170, 42, libVolume(), false, () => {
      const v = volumeMusique(), suite = v >= 1 ? 0 : v === 0 ? 0.3 : v < 0.6 ? 0.6 : 1;
      reglerVolume(suite); bv.t.setText(libVolume());
    });
    texte(this, 380, 456, 'Musique', 16, '#ffffff', true, 0, 0.5);
    texte(this, 380, 480, 'Touche pour changer le volume : 30 %, 60 %, 100 %, coupée.', 12, '#93a89b', false, 0, 0.5);
    ligne(536, 'Recommencer', 'Efface la partie (une copie de secours est gardée).', 'Recommencer', false, () => this.recommencer());
    texte(this, W / 2, 630, 'Monstres : Dofus 3 (Ankama) · musique faite avec Suno · fan game inspiré de Summoners War', 11, '#6f7a6c', false, 0.5, 0.5);
    void OR;
  }

  private async copier(t: string, ok: string) {
    try { await navigator.clipboard.writeText(t); this.message(ok); } catch { window.prompt('Copie ce texte :', t); }
  }

  private exporter() { void this.copier(exporter(charger()), 'Code copié ! Garde-le précieusement.'); }

  private importer() {
    const code = window.prompt('Colle ton code de sauvegarde :');
    if (!code) return;
    const j = importer(code);
    if (!j) return this.message('Ce code n\'est pas valide.');
    effacer(); sauver(j);
    this.message('Partie importée !');
    this.time.delayedCall(900, () => this.scene.start('ile'));
  }

  private signaler() {
    const j = charger();
    const rapport = [
      `Arène des Douze ${VERSION_JEU} — rapport de bug`,
      `Date : ${new Date().toISOString()}`,
      `Appareil : ${navigator.userAgent} · écran ${window.innerWidth}×${window.innerHeight}`,
      `Partie : ${j.monstres.length} monstres, ${j.stagesFinis.length} stages finis, ${j.kamas} kamas, ${(j.runes ?? []).length} runes`,
      'Dernières erreurs :', ...(dernieresErreurs().length ? dernieresErreurs() : ['(aucune)']),
      'Ce qui s\'est passé : …',
    ].join('\n');
    void this.copier(rapport, 'Rapport copié : colle-le sur le Discord avec ce que tu faisais.');
  }

  private recommencer() {
    if (!this.confirmer) { this.confirmer = true; return this.message('Touche encore « Recommencer » pour confirmer.'); }
    effacer();
    this.scene.start('ile');
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
