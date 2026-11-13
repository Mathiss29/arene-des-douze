import Phaser from 'phaser';
import type { Element, Leader, Stats } from '../sim/types';
import { LOOKS } from './looks';
import { atlasPlanche, dossierPlanches } from './assetUrl';
import { origine } from './animations';

/** Outils d'interface partagés par les écrans (préparation, récompenses, fiches). */

export const W = 1280;
export const H = 720;
export const POLICE = 'Lexend, sans-serif';
export const CHIFFRES = 'Rowdies, Lexend, sans-serif';
export const OR = '#e3b54c';
export const COULEUR: Record<Element, number> = { feu: 0xe8673f, air: 0x69d391, eau: 0x4aa3e6, bonta: 0xf4e8a8, brakmar: 0xa965de };
export const NOM_ELEMENT: Record<Element, string> = { feu: 'Feu', air: 'Air', eau: 'Eau', bonta: 'Bonta', brakmar: 'Brâkmar' };
export const NOM_TYPE: Record<string, string> = { attaque: 'Attaque', defense: 'Défense', pv: 'PV', soutien: 'Soutien' };
export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
export const fmt = (n: number) => n.toLocaleString('fr-FR');

const NOM_STAT: Record<keyof Stats, string> = { pv: 'PV', atq: 'Attaque', def: 'Défense', vit: 'Vitesse', tc: 'Taux critique', dc: 'Dégâts critiques', pre: 'Précision', res: 'Résistance' };
const NOM_ZONE: Record<string, string> = { general: 'général', arene: 'Arène', donjon: 'Donjons', feu: 'monstres Feu', air: 'monstres Air', eau: 'monstres Eau', bonta: 'monstres Bonta', brakmar: 'monstres Brâkmar' };

/** « +10 % de Vitesse (général) » */
export const texteLeader = (l: Leader) => `+${l.valeur} % de ${NOM_STAT[l.stat]} (${NOM_ZONE[l.zone] ?? l.zone})`;
export const nomStat = (s: keyof Stats) => NOM_STAT[s];

const IMAGES_UI = ['kamas_tas', 'background_levelup_banner', 'slot_dark_background_full', 'btn_green_normal', 'btn_green_over'];

/** Charge les images d'interface et les planches des monstres demandés (une seule fois chacune). */
export function chargerUi(scene: Phaser.Scene, ids: Iterable<string>) {
  for (const f of IMAGES_UI) if (!scene.textures.exists(f)) scene.load.image(f, `assets/ui/${f}.png`);
  for (const id of new Set(ids)) {
    const a = LOOKS[id].atlas;
    if (!scene.textures.exists(a)) scene.load.multiatlas(a, atlasPlanche(a), dossierPlanches);
    if (!scene.cache.json.exists(`${a}:meta`)) scene.load.json(`${a}:meta`, atlasPlanche(a));
  }
}

/** Pierre d'âme (provisoire) : gemme violette dessinée par le jeu. */
export function texturePierreAme(scene: Phaser.Scene) {
  if (scene.textures.exists('pierre_ame')) return;
  const t = scene.textures.createCanvas('pierre_ame', 64, 64)!;
  const c = t.context, g = c.createRadialGradient(24, 22, 2, 32, 32, 28);
  g.addColorStop(0, '#f6e2ff'); g.addColorStop(0.45, '#a45ad8'); g.addColorStop(1, '#3a145a');
  c.fillStyle = g; c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2); c.fill();
  t.refresh();
}

export function texte(scene: Phaser.Scene, x: number, y: number, t: string, taille = 14, couleur = '#e9efe6', gras = false, ox = 0.5, oy = 0) {
  return scene.add.text(x, y, t, { fontFamily: POLICE, fontSize: `${taille}px`, fontStyle: gras ? '600' : 'normal', color: couleur })
    .setOrigin(ox, oy).setShadow(0, 1, '#000', 3, false, true).setDepth(1000);
}

export function panneau(scene: Phaser.Scene, x: number, y: number, w: number, h: number, profondeur = 900) {
  return scene.add.graphics().setDepth(profondeur)
    .fillStyle(0x0f1814, 0.94).fillRoundedRect(x, y, w, h, 14).lineStyle(2, 0x5d6f52).strokeRoundedRect(x, y, w, h, 14);
}

/** Bouton vert (action principale) ou sombre. Renvoie le fond et le texte (pour les détruire ou les griser). */
export function bouton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, libelle: string, vert: boolean, action: () => void, profondeur = 1001) {
  const fond: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Rectangle = vert
    ? scene.add.nineslice(x, y, 'btn_green_normal', undefined, w, h, 12, 12, 10, 10).setDepth(profondeur)
    : scene.add.rectangle(x, y, w, h, 0x2a3a32).setStrokeStyle(1.5, 0x5d6f52).setDepth(profondeur);
  const t = scene.add.text(x, y, libelle, { fontFamily: POLICE, fontSize: vert ? '19px' : '14px', fontStyle: '600', color: '#ffffff' })
    .setOrigin(0.5).setShadow(0, 2, '#1f4a12', 2, false, true).setDepth(profondeur + 1);
  fond.setInteractive({ useHandCursor: true }).on('pointerdown', action);
  if (fond instanceof Phaser.GameObjects.NineSlice) fond.on('pointerover', () => fond.setTexture('btn_green_over')).on('pointerout', () => fond.setTexture('btn_green_normal'));
  else fond.on('pointerover', () => fond.setFillStyle(0x34483e)).on('pointerout', () => fond.setFillStyle(0x2a3a32));
  return { fond, t, griser() { fond.disableInteractive().setAlpha(0.45); t.setAlpha(0.6); } };
}

/** Monstre en pied, pieds en (x, y), animation de repos. */
export function monstreEnPied(scene: Phaser.Scene, id: string, x: number, y: number, zoom = 1, miroir = false) {
  const look = LOOKS[id];
  const meta = (scene.cache.json.get(`${look.atlas}:meta`) as { meta?: { cell?: number[]; origin?: number[] } } | undefined)?.meta;
  const [ox, oy] = origine(meta);
  const k = look.echelle * zoom;
  const sp = scene.add.sprite(x, y, look.atlas, 'AnimStatique_1_0').setOrigin(ox, oy).setScale(miroir ? -k : k, k).setDepth(y);
  if (scene.anims.exists(`${look.atlas}/AnimStatique_1`)) sp.play(`${look.atlas}/AnimStatique_1`);
  return sp;
}

/** Portrait recadré dans un cercle ou un carré. Renvoie le sprite et son masque (à détruire avec). */
export function portrait(scene: Phaser.Scene, id: string, x: number, y: number, taille: number, rond = true, miroir = false, profondeur = 1001) {
  const sp = scene.add.sprite(x, y, LOOKS[id].atlas, 'AnimStatique_1_0').setDepth(profondeur);
  const f = sp.frame;
  const k = (taille * 1.1) / Math.max(f.cutWidth, f.cutHeight);
  sp.setOrigin((f.x + f.cutWidth / 2) / f.realWidth, (f.y + f.cutHeight * 0.47) / f.realHeight).setScale(miroir ? -k : k, k);
  const m = scene.make.graphics({}, false);
  if (rond) m.fillCircle(x, y, taille / 2 - 2); else m.fillRect(x - taille / 2 + 3, y - taille / 2 + 3, taille - 6, taille - 6);
  sp.setMask(m.createGeometryMask());
  return { sp, masque: m };
}
