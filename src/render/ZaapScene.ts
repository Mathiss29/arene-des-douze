import Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import { type Joueur } from '../sim/joueur';
import { avantProchaine, energie, ENERGIE } from '../sim/energie';
import {
  CHANCE_MONSTRE, DIFFICULTES, ZONES, brecheOuverte, cleStage, difficulteOuverte, prochainStage, stage, stageOuvert, stagesFinis, zoneFinie, zoneOuverte,
  type Zone,
} from '../sim/stages';
import { fiche } from '../sim/fiches';
import type { Element } from '../sim/types';
import { COULEUR, H, NOM_ELEMENT, OR, POLICE, W, bouton, chargerUi, fmt, hex, portrait, texte, texturePierreAme } from './ui';

/**
 * Zaap : la carte des combats (maquette « Zaap : » 1A…8A et idées 1 à 14).
 * Carte : les zones en îles flottantes dans le ciel d'Incarnam, reliées par un chemin ; les autres modes à droite.
 * Zone : son image en grand, les 7 stages en liste à droite (comme SW), onglets de difficulté, aperçu et butin.
 */
const BAT_ELEMENT: Record<Element, Element> = { feu: 'eau', air: 'feu', eau: 'air', bonta: 'brakmar', brakmar: 'bonta' };
/** Place des îles sur la carte (centre, largeur), dans l'ordre des zones. */
const ILES = [[260, 400, 250], [520, 230, 210], [700, 470, 200], [900, 250, 190]] as const;
const MODES = [
  ['Donjons', 'frigost', 'Les donjons arrivent après les runes.'],
  ['Tour des Dimensions', 'incarnam', 'La Tour des Dimensions (100 étages) arrive plus tard.'],
  ['Kolizéum', 'bastion', 'Le Kolizéum (combats contre les équipes des autres joueurs) arrive plus tard.'],
  ['Brèche du jour', 'madrestam', 'Une brèche s\'ouvre chaque jour quand toutes les zones sont finies en Normal.'],
] as const;

export class ZaapScene extends Phaser.Scene {
  private joueur!: Joueur;
  private vue: 'carte' | 'zone' = 'carte';
  private zone!: Zone;
  private dif = 0;
  private choix = 0;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private plaqueEnergie?: Phaser.GameObjects.Text;
  private avis?: Phaser.GameObjects.Container;

  constructor() { super('zaap'); }

  init(data: { zone?: string; dif?: number; stage?: number }) {
    this.joueur = charger();
    this.zone = ZONES.find((z) => z.id === data?.zone) ?? ZONES[0];
    this.vue = data?.zone ? 'zone' : 'carte';
    this.dif = data?.dif ?? 0;
    this.choix = data?.stage ?? this.premierAJouer();
  }

  preload() {
    chargerUi(this, [...new Set(ZONES.flatMap((z) => [...z.stages.flatMap((s) => stage(s).ennemis.map((e) => e.id)), ...(z.recompense ? [z.recompense.id] : [])]))]);
    if (!this.textures.exists('ile_ciel')) this.load.image('ile_ciel', 'assets/ile/ciel.webp');
    for (const n of ['astrub', 'madrestam', 'bastion', 'frigost', 'incarnam', 'mapItemFight_2', 'mapItemBoss_2', 'mapItemStart', 'lock_big', 'mapSelector'])
      if (!this.textures.exists(`zaap_${n}`)) this.load.image(`zaap_${n}`, `assets/zaap/${n}.webp`);
  }

  create() {
    texturePierreAme(this);
    this.dessiner();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.majEnergie() });
  }

  private premierAJouer() {
    const i = this.zone.stages.findIndex((_, n) => stageOuvert(this.joueur, this.zone, n, this.dif) && !this.joueur.stagesFinis.includes(cleStage(this.zone.stages[n], this.dif)));
    return i < 0 ? 0 : i;
  }

  private voir(cle: string) {
    if (this.joueur.vus.includes(cle)) return false;
    this.joueur = { ...this.joueur, vus: [...this.joueur.vus, cle] };
    sauver(this.joueur);
    return true;
  }
  private vu = (cle: string) => this.joueur.vus.includes(cle);

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    this.tweens.killAll();
    if (this.vue === 'carte') this.carte(); else this.dansZone();
    this.haut();
  }

  private garder<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }
  private t(x: number, y: number, s: string, taille = 14, couleur = '#e9efe6', gras = false, ox = 0.5, oy = 0, prof = 1000) {
    return this.garder(texte(this, x, y, s, taille, couleur, gras, ox, oy).setDepth(prof));
  }
  private plaque(x: number, y: number, s: string, couleur = '#ffffff', ox = 0, taille = 15) {
    return this.t(x, y, s, taille, couleur, true, ox, 0).setBackgroundColor('rgba(8,14,11,0.86)').setPadding(12, 7, 12, 7);
  }

  // ───────────── barre du haut ─────────────

  private haut() {
    const j = this.joueur;
    const ret = this.plaque(16, 14, this.vue === 'carte' ? '‹ Incarnam' : '‹ Carte', '#ffe08a');
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.vue === 'carte') this.scene.start('ile'); else { this.vue = 'carte'; this.dessiner(); }
    });
    const kamas = this.plaque(W - 16, 14, `${fmt(j.kamas)} kamas`, '#ffe08a', 1);
    const pierres = this.plaque(kamas.x - kamas.width - 8, 14, `◆ ${j.pierresAme}`, '#d9b3ff', 1);
    this.plaqueEnergie = this.plaque(pierres.x - pierres.width - 8, 14, '', '#8fd3ff', 1);
    this.majEnergie();
  }

  private majEnergie() {
    if (!this.plaqueEnergie?.active) return;
    const now = Date.now(), n = energie(this.joueur, now), reste = avantProchaine(this.joueur, now);
    const mm = Math.floor(reste / 60000), ss = Math.floor((reste % 60000) / 1000).toString().padStart(2, '0');
    this.plaqueEnergie.setText(`⚡ ${n} / ${ENERGIE.max}${reste ? `  ·  +1 dans ${mm}:${ss}` : ''}`);
  }

  private message(s: string) {
    this.avis?.destroy();
    const tx = this.add.text(0, 0, s, { fontFamily: POLICE, fontSize: '15px', color: '#ffffff', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
    const f = this.add.rectangle(0, 0, tx.width + 36, tx.height + 22, 0x0c1410, 0.94).setStrokeStyle(1.5, 0xb08a3a);
    const c = this.add.container(W / 2, H - 120, [f, tx]).setDepth(5000);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2600, duration: 500, onComplete: () => c.destroy() });
  }

  // ───────────── la carte ─────────────

  private carte() {
    const j = this.joueur;
    const ciel = this.garder(this.add.image(W / 2, H / 2, 'ile_ciel'));
    ciel.setScale(Math.max(W / ciel.width, H / ciel.height) * 1.05);

    // chemin entre les îles
    const g = this.garder(this.add.graphics().setDepth(1));
    g.lineStyle(3, 0xffe08a, 0.7);
    for (let i = 1; i < ZONES.length; i++) {
      const [x0, y0] = ILES[i - 1], [x1, y1] = ILES[i];
      const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / 18);
      for (let k = 0; k < n; k += 2) g.lineBetween(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, x0 + ((x1 - x0) * (k + 1)) / n, y0 + ((y1 - y0) * (k + 1)) / n);
    }

    ZONES.forEach((z, i) => this.ile(z, i));

    // autres modes, à droite (verrouillés pour l'instant)
    MODES.forEach(([nom, img, msg], i) => {
      const x = W - 86, y = 112 + i * 140, w = 148, h = 124;
      const ouvert = nom === 'Brèche du jour' && brecheOuverte(j);
      const im = this.garder(this.add.image(x, y, `zaap_${img}`).setDisplaySize(w, h).setDepth(10));
      im.setCrop(im.width * 0.15, 0, im.width * 0.7, im.height);
      im.setDisplaySize(w / 0.7, h);
      if (!ouvert) im.setTint(0x555555);
      const cadre = this.garder(this.add.rectangle(x, y, w, h).setStrokeStyle(2, ouvert ? 0xb08a3a : 0x5d6f52).setDepth(11).setInteractive({ useHandCursor: true }));
      cadre.on('pointerdown', () => this.message(msg));
      this.garder(this.add.rectangle(x, y + h / 2 - 15, w, 30, 0x080e0b, 0.88).setDepth(11));
      this.t(x, y + h / 2 - 25, nom, 13, '#ffffff', true, 0.5, 0, 12);
      if (!ouvert) this.garder(this.add.image(x, y - 12, 'zaap_lock_big').setDisplaySize(30, 30).setDepth(12));
    });

    // Continuer : le prochain stage à gagner (idée 9)
    const p = prochainStage(j);
    if (p) {
      const s = stage(p), z = ZONES.find((x) => x.id === s.zone)!;
      const b = bouton(this, W - 250, H - 44, 240, 54, `Continuer ▸`, true, () => this.ouvrirZone(z, s.dif, s.numero - 1), 1001);
      this.garder(b.fond); this.garder(b.t);
      this.t(W - 250, H - 84, `${z.nom} · stage ${s.numero} · ${DIFFICULTES[s.dif]}`, 12, '#ffe08a', true, 0.5, 0, 1001)
        .setBackgroundColor('rgba(8,14,11,0.8)').setPadding(8, 3, 8, 3);
    }

    // Premier passage : Ganymède montre où toucher (idée 13)
    if (!this.vu('tuto:zaap')) {
      const [x, y, w] = ILES[0];
      this.bulle('Touche Astrub pour choisir ton premier combat.', 40, y - 150);
      this.fleche(x + 30, y - w * 0.3 - 30);
    }
  }

  private ile(z: Zone, i: number) {
    const j = this.joueur;
    const [x, y, w] = ILES[i], h = w * 0.58;
    const ouverte = zoneOuverte(j, z);
    const flot = this.garder(this.add.container(x, y).setDepth(20 + i));
    // roche sous l'île, puis le dessus (image de la zone dans un ovale)
    const roche = this.add.graphics();
    roche.fillStyle(0x6b5538).fillPoints([{ x: -w * 0.42, y: 0 }, { x: w * 0.42, y: 0 }, { x: w * 0.26, y: h * 0.45 }, { x: w * 0.08, y: h * 0.62 }, { x: 0, y: h * 0.9 }, { x: -w * 0.1, y: h * 0.6 }, { x: -w * 0.28, y: h * 0.42 }], true);
    roche.fillStyle(0x4a3a26).fillPoints([{ x: 0, y: h * 0.1 }, { x: w * 0.3, y: h * 0.12 }, { x: w * 0.08, y: h * 0.62 }, { x: 0, y: h * 0.9 }], true);
    const im = this.add.image(0, 0, `zaap_${z.image}`);
    im.setScale(Math.max(w / im.width, h / im.height) * 1.02);
    const m = this.make.graphics({}, false).fillEllipse(x, y, w, h);
    im.setMask(m.createGeometryMask());
    const bord = this.add.graphics().lineStyle(3, 0xfff0be, 0.55).strokeEllipse(0, 0, w, h);
    flot.add([roche, im, bord]);
    if (!ouverte) im.setTint(0x6a6a6a);
    // brume sur les zones pas encore découvertes (idée 12)
    if (!ouverte) {
      const brume = this.add.graphics();
      for (let k = 0; k < 7; k++) brume.fillStyle(0xdfe8ee, 0.22).fillEllipse((k - 3) * w * 0.12, Math.sin(k) * h * 0.12, w * 0.7, h * 0.55);
      flot.add([brume, this.add.image(0, -4, 'zaap_lock_big').setDisplaySize(34, 34)]);
      this.tweens.add({ targets: brume, x: 10, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (this.voir(`brume:${z.id}`) && i > 0) {
      // la brume se lève la première fois
      const brume = this.add.graphics();
      for (let k = 0; k < 7; k++) brume.fillStyle(0xdfe8ee, 0.35).fillEllipse((k - 3) * w * 0.12, Math.sin(k) * h * 0.12, w * 0.7, h * 0.55);
      flot.add(brume);
      this.tweens.add({ targets: brume, alpha: 0, scale: 1.6, duration: 1800, ease: 'Cubic.easeOut' });
    }
    // l'île flotte (idée 4)
    this.calque.push(m);
    this.tweens.add({ targets: flot, y: y - 6, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: m, y: -6, duration: 2200 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // nom, avancée, runes
    const n = stagesFinis(j, z, 0);
    const lignes = ouverte ? `${n} / 7 · ${DIFFICULTES[0]}${zoneFinie(j, z, 0) ? ' ✓' : ''}` : z.stages.length ? 'Verrouillée' : 'Bientôt';
    this.t(x, y + h / 2 + 34, z.nom, 15, '#ffffff', true, 0.5, 0, 40).setBackgroundColor('rgba(8,14,11,0.9)').setPadding(12, 5, 12, 5);
    this.t(x, y + h / 2 + 64, `${lignes}  ·  runes d'${z.runes}`, 11, '#ffe08a', false, 0.5, 0, 40);
    if (ouverte && !this.vu(`zone:${z.id}`)) this.nouveau(x + w / 2 - 10, y - h / 2 + 6, 41);
    // récompense de la zone (7A)
    if (ouverte && z.recompense && !j.recompensesZones.includes(z.id)) {
      const ry = y + h / 2 + 104;
      this.garder(this.add.rectangle(x, ry, 250, 46, 0x080e0b, 0.9).setStrokeStyle(1.5, 0xb08a3a).setDepth(40));
      const p = portrait(this, z.recompense.id, x - 100, ry, 36, true, false, 41);
      this.garder(p.sp); this.calque.push(p.masque);
      this.t(x - 76, ry - 15, `Finir ${z.nom} (Normal) :`, 11, '#c9cfc4', false, 0, 0, 41);
      this.t(x - 76, ry + 1, `${fiche(z.recompense.id).nom} ${'★'.repeat(z.recompense.etoiles)}`, 13, OR, true, 0, 0, 41);
    }
    const zoneClic = this.garder(this.add.zone(x, y, w, h + 40).setDepth(45).setInteractive({ useHandCursor: true }));
    zoneClic.on('pointerdown', () => {
      if (!ouverte) return this.message(z.stages.length ? `Finis d'abord ${ZONES[i - 1].nom} en Normal.` : `${z.nom} arrive bientôt.`);
      this.ouvrirZone(z, 0);
    });
  }

  private nouveau(x: number, y: number, prof: number) {
    const t = this.t(x, y, 'Nouveau !', 12, '#ffffff', true, 0.5, 0.5, prof).setBackgroundColor('#e8673f').setPadding(8, 3, 8, 3);
    this.tweens.add({ targets: t, scale: 1.12, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private bulle(s: string, x: number, y: number) {
    const tx = this.t(x, y, `Ganymède\n${s}`, 14, '#ffffff', false, 0, 0.5, 3000);
    tx.setWordWrapWidth(260).setBackgroundColor('rgba(12,20,16,0.95)').setPadding(14, 10, 14, 10);
    this.garder(this.add.rectangle(tx.x + tx.width / 2, tx.y, tx.width, tx.height).setStrokeStyle(2, 0xb08a3a).setDepth(3000));
  }

  private fleche(x: number, y: number) {
    const f = this.t(x, y, '▼', 34, OR, true, 0.5, 0.5, 3001).setStroke('#3a2410', 5);
    this.tweens.add({ targets: f, y: y + 12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private ouvrirZone(z: Zone, dif: number, n?: number) {
    this.zone = z; this.dif = dif; this.vue = 'zone';
    this.choix = n ?? this.premierAJouer();
    this.dessiner();
  }

  // ───────────── une zone ─────────────

  private dansZone() {
    const j = this.joueur, z = this.zone;
    const fond = this.garder(this.add.image(W / 2, H / 2, `zaap_${z.image}`));
    fond.setScale(Math.max(W / fond.width, H / fond.height));
    const voile = this.garder(this.add.graphics());
    for (let k = 0; k < 40; k++) voile.fillStyle(0x050806, (k / 40) * 0.7).fillRect(W * 0.35 + k * (W * 0.65 / 40), 0, W * 0.65 / 40 + 1, H);
    this.plaque(16, 60, `${z.nom}`, '#ffffff', 0, 20);
    this.t(18, 104, `${stagesFinis(j, z, this.dif)} / 7 · ${DIFFICULTES[this.dif]}  ·  runes d'${z.runes}`, 12, '#ffe08a', false, 0, 0).setBackgroundColor('rgba(8,14,11,0.8)').setPadding(8, 3, 8, 3);
    const premiere = this.voir(`zone:${z.id}`);

    // panneau
    const px = 690, py = 66, pw = 574, ph = 638;
    this.garder(this.add.rectangle(px + pw / 2, py + ph / 2, pw, ph, 0x0a100d, 0.94).setStrokeStyle(2, 0x5d6f52).setDepth(900));
    // onglets de difficulté (4A)
    DIFFICULTES.forEach((d, k) => {
      const ouvert = difficulteOuverte(j, z, k), x = px + 14 + k * ((pw - 28) / 3) + (pw - 28) / 6, on = k === this.dif;
      const r = this.garder(this.add.rectangle(x, py + 28, (pw - 28) / 3 - 6, 34, on ? 0xe3b54c : 0x16211c).setStrokeStyle(1.5, on ? 0xe3b54c : 0x3c5045).setDepth(901));
      this.t(x, py + 28, `${ouvert ? '' : '🔒 '}${d}`, 14, on ? '#1d1405' : ouvert ? '#c9cfc4' : '#6f7f75', true, 0.5, 0.5, 902);
      if (ouvert && k > 0 && !this.vu(`dif:${z.id}@${k}`)) this.nouveau(x + 60, py + 12, 903);
      r.setInteractive({ useHandCursor: ouvert }).on('pointerdown', () => {
        if (!ouvert) return this.message(`${d} s'ouvre quand ${z.nom} est finie en ${DIFFICULTES[k - 1]} (comme SW).`);
        this.voir(`dif:${z.id}@${k}`);
        this.dif = k; this.choix = this.premierAJouer(); this.dessiner();
      });
    });
    // liste des 7 stages (3A)
    z.stages.forEach((id, n) => {
      const s = stage(cleStage(id, this.dif)), y = py + 70 + n * 42, on = n === this.choix;
      const ouvert = stageOuvert(j, z, n, this.dif), fait = j.stagesFinis.includes(s.id);
      const r = this.garder(this.add.rectangle(px + pw / 2, y + 16, pw - 28, 38, on ? 0x1d2a20 : 0x121c17).setStrokeStyle(1.5, on ? 0xe3b54c : 0x121c17).setDepth(901));
      this.garder(this.add.image(px + 34, y + 16, n === 6 ? 'zaap_mapItemBoss_2' : 'zaap_mapItemFight_2').setDisplaySize(n === 6 ? 34 : 30, n === 6 ? 39 : 34).setDepth(902).setAlpha(ouvert ? 1 : 0.45));
      this.t(px + 58, y + 6, `Stage ${n + 1} · ${s.nom}`, 14, ouvert ? '#ffffff' : '#6f7f75', true, 0, 0, 902);
      this.t(px + pw - 82, y + 8, `⚡${s.cout}`, 13, ouvert ? '#8fd3ff' : '#4f6070', true, 0, 0, 902);
      this.t(px + pw - 34, y + 7, fait ? '✓' : ouvert ? '' : '🔒', 15, '#7ee07a', true, 0.5, 0, 902);
      r.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (!ouvert) return this.message('Gagne d\'abord le stage d\'avant.');
        this.choix = n; this.dessiner();
      });
    });
    this.apercu(px, py + 370, pw);

    // Ganymède raconte la zone à la première visite (idée 6), puis guide le premier combat (idée 13)
    if (premiere && z.texte) this.bulle(z.texte, 30, 470);
    else if (!this.vu('tuto:zaap')) { this.bulle('Choisis le stage 1, puis touche « Préparer l\'équipe ».', 300, 520); this.fleche(px + 250, py + 600); }
  }

  /** Aperçu du stage choisi : ennemis, conseil d'élément, butin, monstres qui peuvent tomber (6A, idées 2 et 8). */
  private apercu(px: number, py: number, pw: number) {
    const j = this.joueur, z = this.zone, n = this.choix;
    const s = stage(cleStage(z.stages[n], this.dif));
    this.garder(this.add.rectangle(px + pw / 2, py, pw - 28, 1.5, 0x3c5045).setDepth(901));
    this.t(px + 20, py + 10, `STAGE ${n + 1} · ${s.nom.toUpperCase()}${s.boss !== undefined ? ' · BOSS' : ''}`, 12, OR, true, 0, 0, 902);
    s.vagues.forEach((v, k) => {
      const x0 = px + 24 + k * 182;
      this.t(x0, py + 32, `Vague ${k + 1}`, 10, '#9fb3a6', true, 0, 0, 902);
      v.forEach((e, i) => {
        const x = x0 + 18 + i * 42, y = py + 66;
        const el = fiche(e.id).element as Element, boss = k === s.vagues.length - 1 && i === s.boss;
        this.garder(this.add.circle(x, y, 19, 0x1d2a20).setStrokeStyle(boss ? 3.5 : 2, boss ? 0xff3a20 : COULEUR[el]).setDepth(902));
        const p = portrait(this, e.id, x, y, 38, true, true, 903);
        this.garder(p.sp); this.calque.push(p.masque);
        this.t(x, y + 21, `${e.etoiles}★${e.niveau}`, 9, boss ? '#ff9b7a' : '#ffe08a', true, 0.5, 0, 904);
      });
    });
    // conseil : l'élément qui a l'avantage sur la plupart des ennemis
    const compte = new Map<Element, number>();
    for (const e of s.ennemis) { const b = BAT_ELEMENT[fiche(e.id).element as Element]; compte.set(b, (compte.get(b) ?? 0) + 1); }
    const conseil = [...compte.entries()].sort((a, b) => b[1] - a[1])[0][0];
    this.t(px + 20, py + 106, 'Conseil :', 12, '#9fb3a6', false, 0, 0, 902);
    this.garder(this.add.circle(px + 92, py + 114, 7, COULEUR[conseil]).setDepth(902));
    this.t(px + 104, py + 105, `${NOM_ELEMENT[conseil]} (avantage sur la plupart des ennemis)`, 13, hex(COULEUR[conseil]), true, 0, 0, 902);
    // butin
    const by = py + 136;
    this.garder(this.add.image(px + 32, by + 10, 'kamas_tas').setDisplaySize(26, 26).setDepth(902));
    this.t(px + 50, by + 1, `${fmt(s.recompenses.kamas)}`, 14, '#ffffff', true, 0, 0, 902);
    this.t(px + 130, by + 1, `XP ${fmt(s.recompenses.xp)}`, 14, '#ffffff', true, 0, 0, 902);
    this.t(px + 240, by + 1, `◆ ${s.recompenses.pierreChance} %${j.stagesFinis.includes(s.id) ? '' : ' (+1 la 1ʳᵉ fois)'}`, 14, '#d9b3ff', true, 0, 0, 902);
    const peut = [...new Set(s.ennemis.map((e) => fiche(e.id).nom))].join(', ');
    this.t(px + 20, by + 28, `Peut donner (${CHANCE_MONSTRE} %) : ${peut}`, 12, '#c9cfc4', false, 0, 0, 902).setWordWrapWidth(pw - 40);
    if (n === 6 && z.recompense && this.dif === 0 && !j.recompensesZones.includes(z.id))
      this.t(px + 20, by + 48, `+ ${fiche(z.recompense.id).nom} ${'★'.repeat(z.recompense.etoiles)} en finissant la zone`, 12, OR, true, 0, 0, 902);

    // boutons : préparer (énergie) et répéter (plus tard, 8A)
    const ouvert = stageOuvert(j, z, n, this.dif);
    const b = bouton(this, px + 210, py + 244, 380, 46, ouvert ? `Préparer l'équipe   ⚡${s.cout}` : 'Gagne le stage d\'avant', true, () => {
      if (!ouvert) return;
      if (energie(j, Date.now()) < s.cout) return this.message(`Pas assez d'énergie : il en faut ${s.cout}. Elle revient d'elle-même, 1 toutes les 5 minutes.`);
      this.voir('tuto:zaap');
      this.scene.start('preparation', { stage: s.id });
    }, 1001);
    this.garder(b.fond); this.garder(b.t);
    if (!ouvert) b.griser();
    const r = bouton(this, px + 480, py + 244, 150, 46, '↻ Répéter', false, () => this.message('Le combat répété arrive plus tard.'), 1001);
    this.garder(r.fond); this.garder(r.t);
  }
}
