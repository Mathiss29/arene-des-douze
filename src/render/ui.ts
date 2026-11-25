import Phaser from 'phaser';
import type { Element, Leader, Stats } from '../sim/types';
import { LOOKS, teinter } from './looks';
import { atlasPlanche, dossierPlanche } from './assetUrl';
import { origine } from './animations';
import { fiche } from '../sim/fiches';
import { PIERRES, type Pierre } from '../sim/invocation';
import { SETS, type SetRune } from '../sim/runes';

/** Outils d'interface partagés par les écrans (préparation, récompenses, fiches). */

export const W = 1280;
export const H = 720;
/** Direction artistique (maquettes « DA : » et « Planche : » 1A 2A, nov. 2026) : Fredoka, cadres et boutons de Dofus 3. */
export const POLICE = 'Fredoka, Lexend, sans-serif';
export const CHIFFRES = 'Rowdies, Lexend, sans-serif';
export const OR = '#e3b54c';
export const COULEUR: Record<Element, number> = { feu: 0xe8673f, air: 0x69d391, eau: 0x4aa3e6, bonta: 0xfff1b8, brakmar: 0xa965de };
export const NOM_ELEMENT: Record<Element, string> = { feu: 'Feu', air: 'Air', eau: 'Eau', bonta: 'Bonta', brakmar: 'Brâkmar' };
export const NOM_TYPE: Record<string, string> = { attaque: 'Attaque', defense: 'Défense', pv: 'PV', soutien: 'Soutien' };
export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
export const fmt = (n: number) => n.toLocaleString('fr-FR');

const NOM_STAT: Record<keyof Stats, string> = { pv: 'PV', atq: 'Attaque', def: 'Défense', vit: 'Vitesse', tc: 'Taux critique', dc: 'Dégâts critiques', pre: 'Précision', res: 'Résistance' };
const NOM_ZONE: Record<string, string> = { general: 'général', arene: 'Arène', donjon: 'Donjons', feu: 'monstres Feu', air: 'monstres Air', eau: 'monstres Eau', bonta: 'monstres Bonta', brakmar: 'monstres Brâkmar' };

/** « +10 % de Vitesse (général) » */
export const texteLeader = (l: Leader) => `+${l.valeur} % de ${NOM_STAT[l.stat]} (${NOM_ZONE[l.zone] ?? l.zone})`;
export const nomStat = (s: keyof Stats) => NOM_STAT[s];

const IMAGES_UI = ['kamas_tas', 'background_levelup_banner', 'btn_green_normal', 'btn_green_over', 'btn_green_pressed', 'block_border_double', 'headerBgStone', 'slot_dark_background_full', 'bouton_or'];

/** Charge les images d'interface et les planches des monstres demandés (une seule fois chacune). */
export function chargerUi(scene: Phaser.Scene, ids: Iterable<string>) {
  for (const f of IMAGES_UI) if (!scene.textures.exists(f)) scene.load.image(f, `assets/ui/${f}.png`);
  // pierres d'invocation (images fournies par Mathis, 256 px) : elles remplacent les gemmes dessinées par le jeu
  for (const k of ['ame', 'parfaite', 'feu', 'eau', 'air', 'lumiere', 'legendaire', 'transcendante']) if (!scene.textures.exists(`pierre_${k}`)) scene.load.image(`pierre_${k}`, `assets/ui/pierres/${k}.webp`);
  // vignettes de tous les monstres (280 Ko) : les portraits n'ont pas besoin des planches (plusieurs Mo chacune)
  if (!scene.textures.exists('vignettes')) scene.load.atlas('vignettes', 'assets/ui/vignettes.webp', 'assets/ui/vignettes.json');
  for (const id of new Set(ids)) {
    const a = LOOKS[id].atlas;
    if (!scene.textures.exists(a)) scene.load.multiatlas(a, atlasPlanche(a), dossierPlanche(a));
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

export function panneau(scene: Phaser.Scene, x: number, y: number, w: number, h: number, profondeur = 900): Phaser.GameObjects.Container | Phaser.GameObjects.Graphics {
  // cadre double de Dofus 3 sur un fond sombre ; sans la texture (écran qui ne charge pas l'interface), l'ancien cadre dessiné
  if (!scene.textures.exists('block_border_double')) {
    return scene.add.graphics().setDepth(profondeur)
      .fillStyle(0x0f1814, 0.94).fillRoundedRect(x, y, w, h, 14).lineStyle(2, 0x5d6f52).strokeRoundedRect(x, y, w, h, 14);
  }
  const fond = scene.add.rectangle(6, 6, w - 12, h - 12, 0x0f1814, 0.95).setOrigin(0);
  const cadre = scene.add.nineslice(0, 0, 'block_border_double', undefined, w, h, 26, 26, 26, 26).setOrigin(0);
  return scene.add.container(x, y, [fond, cadre]).setDepth(profondeur);
}

/** Bandeau de titre en pierre (Dofus 3), centré en haut d'une fenêtre. Renvoie les deux objets (à détruire avec le calque). */
export function titreFenetre(scene: Phaser.Scene, x: number, y: number, largeur: number, titre: string, profondeur = 1000) {
  const bandeau = scene.add.image(x, y, 'headerBgStone').setDisplaySize(largeur, 58).setDepth(profondeur);
  const t = scene.add.text(x, y - 3, titre, { fontFamily: POLICE, fontSize: '23px', fontStyle: '600', color: '#ffe9b0' })
    .setOrigin(0.5).setShadow(0, 2, '#000000', 2, false, true).setDepth(profondeur + 1);
  return [bandeau, t] as const;
}

/** Bouton vert anis de Dofus 3 (action principale) ou sombre. Renvoie le fond et le texte (pour les détruire ou les griser). */
export function bouton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, libelle: string, vert: boolean, action: () => void, profondeur = 1001) {
  const repos = vert ? 'btn_green_normal' : 'slot_dark_background_full';
  const dessine = scene.textures.exists(repos);
  const fond: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Rectangle = dessine
    ? scene.add.nineslice(x, y, repos, undefined, w, h, 12, 12, 10, 10).setDepth(profondeur)
    : scene.add.rectangle(x, y, w, h, vert ? 0xa8d91a : 0x2a3a32).setStrokeStyle(1.5, 0x5d6f52).setDepth(profondeur);
  const t = scene.add.text(x, y, libelle, { fontFamily: POLICE, fontSize: vert ? '19px' : '15px', fontStyle: '600', color: vert ? '#26330a' : '#e6efdc' })
    .setOrigin(0.5).setDepth(profondeur + 1);
  if (vert) t.setShadow(0, 1, '#e9ff8a', 0, false, true); else t.setShadow(0, 2, '#000000', 2, false, true);
  fond.setInteractive({ useHandCursor: true }).on('pointerdown', action);
  if (fond instanceof Phaser.GameObjects.NineSlice) {
    if (vert) fond.on('pointerover', () => fond.setTexture('btn_green_over')).on('pointerout', () => { if (fond.active && t.active) { fond.setTexture(repos); t.setY(y); } })
      .on('pointerdown', () => { if (fond.active && t.active) { fond.setTexture('btn_green_pressed'); t.setY(y + 2); } }).on('pointerup', () => { if (fond.active && t.active) { fond.setTexture('btn_green_over'); t.setY(y); } });
    else fond.on('pointerover', () => fond.setTint(0xcfe0c8)).on('pointerout', () => fond.clearTint());
  }
  return { fond, t, griser() { fond.disableInteractive().setAlpha(0.45); t.setAlpha(0.6); } };
}

/** Bouton doré (cadre d'or de Dofus 3) pour les moments forts : invoquer, ouvrir un coffre, évoluer, onglet choisi. */
export function boutonOr(scene: Phaser.Scene, x: number, y: number, w: number, h: number, libelle: string, action: () => void, profondeur = 1001) {
  const fond: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Rectangle = scene.textures.exists('bouton_or')
    ? scene.add.nineslice(x, y, 'bouton_or', undefined, w, h, 15, 15, 15, 15).setDepth(profondeur)
    : scene.add.rectangle(x, y, w, h, 0xe6c15f).setDepth(profondeur);
  const t = scene.add.text(x, y, libelle, { fontFamily: POLICE, fontSize: '19px', fontStyle: '600', color: '#3d2606' })
    .setOrigin(0.5).setShadow(0, 1, '#ffe9a8', 0, false, true).setDepth(profondeur + 1);
  fond.setInteractive({ useHandCursor: true }).on('pointerdown', action);
  if (fond instanceof Phaser.GameObjects.NineSlice) fond.on('pointerover', () => fond.active && fond.setTint(0xfff2c0)).on('pointerout', () => fond.active && fond.clearTint());
  return { fond, t, griser() { fond.disableInteractive().setAlpha(0.45); t.setAlpha(0.6); } };
}

/** Case sombre (monstre, objet du butin), dessinée en vectoriel pour rester nette à toutes les tailles. */
export function caseSombre(scene: Phaser.Scene, x: number, y: number, taille: number, profondeur = 1000) {
  const r = Math.round(taille * 0.12), d = taille / 2;
  const g = scene.add.graphics().setDepth(profondeur)
    .fillStyle(0x0b1210, 1).fillRoundedRect(x - d, y - d, taille, taille, r)
    .fillStyle(0x1c2823, 1).fillRoundedRect(x - d + 3, y - d + 3, taille - 6, taille - 6, r - 2)
    .lineStyle(2, 0x4e5e52, 1).strokeRoundedRect(x - d + 1, y - d + 1, taille - 2, taille - 2, r);
  const zone = scene.add.zone(x, y, taille, taille).setDepth(profondeur);
  return { g, zone };
}

/** Monstre en pied, pieds en (x, y), animation de repos. */
/** Planche prête ? Sinon (réseau coupé, fichier manquant), on dessine une silhouette au lieu de planter. */
export function planchePrete(scene: Phaser.Scene, atlas: string): boolean {
  return scene.textures.exists(atlas) && scene.textures.get(atlas).has('AnimStatique_1_0');
}
function silhouette(scene: Phaser.Scene) {
  if (!scene.textures.exists('silhouette')) {
    const g = scene.make.graphics({}, false).fillStyle(0x3c4840, 1).fillCircle(40, 30, 22).fillEllipse(40, 74, 56, 60);
    g.generateTexture('silhouette', 80, 110); g.destroy();
  }
  return 'silhouette';
}

export function monstreEnPied(scene: Phaser.Scene, id: string, x: number, y: number, zoom = 1, miroir = false) {
  const look = LOOKS[id];
  const meta = (scene.cache.json.get(`${look.atlas}:meta`) as { meta?: { cell?: number[]; origin?: number[] } } | undefined)?.meta;
  const [ox, oy] = origine(meta);
  const k = look.echelle * zoom;
  if (!planchePrete(scene, look.atlas)) return scene.add.sprite(x, y, silhouette(scene)).setOrigin(0.5, 1).setDepth(y);
  const sp = scene.add.sprite(x, y, look.atlas, 'AnimStatique_1_0').setOrigin(ox, oy).setScale(miroir ? -k : k, k).setDepth(y);
  teinter(sp, id);
  if (scene.anims.exists(`${look.atlas}/AnimStatique_1`)) sp.play(`${look.atlas}/AnimStatique_1`);
  return sp;
}

/** Monstre en pied et net : le sprite de la planche, remplacé par sa pose nette dès qu'elle est chargée. `garder` reçoit chaque objet créé. */
export function monstreNet(scene: Phaser.Scene, id: string, x: number, y: number, zoom: number, garder: (o: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image) => void, miroir = false) {
  const sp = monstreEnPied(scene, id, x, y, zoom, miroir);
  garder(sp);
  const poser = () => { if (!sp.active || !scene.scene.isActive()) return; const p = poseNette(scene, id, sp, poser); if (p) garder(p); };
  poser();
  return sp;
}

/**
 * Pose nette d'un monstre affiché en grand : les planches sont dessinées petites (pour le combat) et deviennent floues une fois
 * agrandies ; `public/assets/poses/<atlas>.webp` est la même pose de repos rendue en grand depuis le squelette de Dofus 3.
 * Pose l'image exactement sur le sprite `sp` (déjà placé et mis à l'échelle), puis cache le sprite. Tant que l'image n'est pas
 * chargée, renvoie null et appelle `quandPrete` à l'arrivée (pour redessiner).
 */
export function poseNette(scene: Phaser.Scene, id: string, sp: Phaser.GameObjects.Sprite, quandPrete?: () => void): Phaser.GameObjects.Image | null {
  const atlas = LOOKS[id].atlas, cle = `pose:${atlas}`;
  if (!scene.textures.exists(atlas)) return null;
  if (!scene.textures.exists(cle)) {
    if (scene.load.isLoading() && scene.load.list.getArray().concat(scene.load.inflight.getArray()).some((f) => f.key === cle)) return null;
    scene.load.image(cle, `assets/poses/${atlas}.webp`);
    scene.load.once(`filecomplete-image-${cle}`, () => quandPrete?.());
    scene.load.start();
    return null;
  }
  const f = sp.frame, sx = Math.abs(sp.scaleX), sy = Math.abs(sp.scaleY);
  const bas = sp.y + (f.y + f.cutHeight - sp.originY * f.realHeight) * sy;
  const centre = sp.x + (f.x + f.cutWidth / 2 - sp.originX * f.realWidth) * sx * (sp.scaleX < 0 ? -1 : 1);
  const img = scene.add.image(centre, bas, cle).setOrigin(0.5, 1).setDepth(sp.depth);
  const k = (f.cutHeight * sy) / img.height;
  img.setScale(sp.scaleX < 0 ? -k : k, k);
  teinter(img as unknown as Phaser.GameObjects.Sprite, id);
  sp.setVisible(false);
  return img;
}

/**
 * Charge des planches à la demande (fiche, monstre en pied) puis appelle `puis` ; tout de suite si elles sont déjà là.
 * Les écrans ne préchargent plus les planches de toute la collection (le Chemin chargeait 17 Mo, le bestiaire 70 Mo).
 */
const TENTEES = new Set<string>();
export function chargerPuis(scene: Phaser.Scene, ids: Iterable<string>, puis: () => void) {
  const manque = [...new Set(ids)].filter((id) => !scene.textures.exists(LOOKS[id].atlas) && !TENTEES.has(LOOKS[id].atlas));
  if (!manque.length) {
    // déjà là : tout de suite ; déjà tentée sans succès : rien (pas de boucle)
    if ([...ids].every((id) => scene.textures.exists(LOOKS[id].atlas))) puis();
    return;
  }
  for (const id of manque) TENTEES.add(LOOKS[id].atlas); // une seule tentative : pas de boucle si le réseau échoue
  chargerUi(scene, manque);
  scene.load.once('complete', () => { if (scene.sys.isActive()) puis(); });
  scene.load.start();
}

/** Portrait recadré dans un cercle ou un carré (vignette légère, sinon la planche). Renvoie le sprite et son masque (à détruire avec). */
export function portrait(scene: Phaser.Scene, id: string, x: number, y: number, taille: number, rond = true, miroir = false, profondeur = 1001) {
  const atlas = LOOKS[id].atlas;
  const vignette = scene.textures.exists('vignettes') && scene.textures.get('vignettes').has(atlas);
  const pret = !vignette && planchePrete(scene, atlas);
  const sp = vignette ? scene.add.sprite(x, y, 'vignettes', atlas).setDepth(profondeur)
    : pret ? scene.add.sprite(x, y, atlas, 'AnimStatique_1_0').setDepth(profondeur) : scene.add.sprite(x, y, silhouette(scene)).setDepth(profondeur);
  teinter(sp, id);
  const f = sp.frame;
  // rond : le monstre déborde un peu (gros plan) ; carré : il tient en entier dans le cadre, avec de la marge
  const k = (taille * (rond ? 1.1 : 0.8)) / Math.max(f.cutWidth, f.cutHeight);
  sp.setOrigin((f.x + f.cutWidth / 2) / f.realWidth, (f.y + f.cutHeight * (rond ? 0.47 : 0.5)) / f.realHeight).setScale(miroir ? -k : k, k);
  const m = scene.make.graphics({}, false);
  if (rond) m.fillCircle(x, y, taille / 2 - 2); else m.fillRect(x - taille / 2 + 3, y - taille / 2 + 3, taille - 6, taille - 6);
  sp.setMask(m.createGeometryMask());
  return { sp, masque: m };
}

/** Texte d'un contenu de cadeau ou de récompense (Réception, Chemin de l'invocateur). */
export function texteContenu(c: { kamas?: number; pierresAme?: number; pierres?: Partial<Record<string, number>>; energie?: number; fragments?: number; monstre?: string; runes?: { etoiles: number; set?: string }[]; choix5?: boolean }): string {
  const l: string[] = [];
  if (c.choix5) l.push('Un monstre 5★ au choix');
  if (c.monstre) l.push(`${fiche(c.monstre).nom} ${'★'.repeat(fiche(c.monstre).etoiles)}`);
  if (c.kamas) l.push(`${fmt(c.kamas)} kamas`);
  if (c.pierresAme) l.push(`${c.pierresAme} pierre${c.pierresAme > 1 ? 's' : ''} d'âme`);
  for (const [p, n] of Object.entries(c.pierres ?? {})) if (n) l.push(`${PIERRES[p as Pierre].nom}${n > 1 ? ` ×${n}` : ''}`);
  if (c.energie) l.push(`${c.energie} énergie`);
  if (c.fragments) l.push(`${c.fragments} fragment${c.fragments > 1 ? 's' : ''}`);
  if (c.runes?.length) l.push(`${c.runes.length} rune${c.runes.length > 1 ? 's' : ''} ${c.runes[0].etoiles}★${c.runes[0].set ? ` (${SETS[c.runes[0].set as SetRune].dieu})` : ''}`);
  return l.join(' · ');
}
