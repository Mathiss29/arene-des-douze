import type Phaser from 'phaser';
/**
 * Apparence des monstres : planche, échelle et attaques disponibles (repris de src/render/looks.ts de Diablofus).
 * `attaques` : numéro d'AnimAttaque → moment de l'impact (fraction de l'animation), pour caler les dégâts.
 * Seule la direction 1 sert : les alliés la jouent telle quelle, les ennemis en miroir.
 */
export interface Look {
  atlas: string;
  echelle: number;
  attaques: Record<number, number>;
  /** Animation d'attaque jouée pour chaque sort (index du sort → numéro d'AnimAttaque). */
  animSorts: number[];
  /** Couleur refaite (élément qui manque dans Dofus) : rotation de teinte en degrés, saturation (0 = inchangée), luminosité (1 = inchangée). */
  teinte?: { hue: number; sat: number; lum: number };
}

const PIOU = (attaque2: number): Omit<Look, 'atlas'> => ({ echelle: 0.55, attaques: { 1: 16 / 32, 2: attaque2 }, animSorts: [1, 2] });
const SCARAFEUILLE: Omit<Look, 'atlas'> = { echelle: 0.64, attaques: { 0: 16 / 28, 1: 17 / 31 }, animSorts: [0, 1, 1] };
const KWAK: Omit<Look, 'atlas'> = { echelle: 0.64, attaques: { 0: 11 / 20, 1: 5 / 15 }, animSorts: [0, 1, 1] };

export const LOOKS: Record<string, Look> = {
  piou_rouge: { atlas: 'piou_rouge', ...PIOU(22 / 44) },
  piou_vert: { atlas: 'piou_vert', ...PIOU(22 / 44) },
  piou_bleu: { atlas: 'piou_bleu', ...PIOU(22 / 44) },
  piou_jaune: { atlas: 'piou_jaune', ...PIOU(13 / 26) },
  piou_violet: { atlas: 'piou_violet', ...PIOU(22 / 44) },
  scarafeuille_rouge: { atlas: 'scarafeuille_rouge', ...SCARAFEUILLE },
  scarafeuille_vert: { atlas: 'scarafeuille_vert', ...SCARAFEUILLE },
  scarafeuille_bleu: { atlas: 'scarafeuille_bleu', ...SCARAFEUILLE },
  scarafeuille_blanc: { atlas: 'scarafeuille_blanc', ...SCARAFEUILLE },
  scarafeuille_noir: { atlas: 'scarafeuille_noir', ...SCARAFEUILLE },
  kwak_de_flamme: { atlas: 'kwak_de_flamme', ...KWAK },
  kwak_de_vent: { atlas: 'kwak_de_vent', ...KWAK },
  kwak_de_glace: { atlas: 'kwak_de_glace', ...KWAK },
  // Base des recolorations Bonta et Brâkmar des Kwaks (maquette « Éveils : »)
  kwak_de_terre: { atlas: 'kwak_de_terre', ...KWAK },
  // Forme adulte (maquette « Éveils : »)
  bouftou_royal: { atlas: 'royal', echelle: 1.05, attaques: { 0: 10 / 20 }, animSorts: [0, 0, 0] },
  boufton_noir: { atlas: 'boufton_noir', echelle: 0.55, attaques: { 0: 9 / 32, 1: 8 / 17, 2: 39 / 78 }, animSorts: [0, 1, 2] },
  // Familles de la 0.1 (maquettes « 5★ : » et « Invocation : »), échelles et impacts repris de Diablofus ; bloc fait par familles.py
  pichon_orange: { atlas: 'pichon_orange', echelle: 0.44, attaques: { 0: 8 / 29, 1: 11 / 32 }, animSorts: [0, 1] },
  pichon_vert: { atlas: 'pichon_vert', echelle: 0.69, attaques: { 0: 10 / 32, 1: 8 / 30 }, animSorts: [0, 1] },
  pichon_bleu: { atlas: 'pichon_bleu', echelle: 0.44, attaques: { 0: 5 / 31, 1: 7 / 27 }, animSorts: [0, 1] },
  pichon_blanc: { atlas: 'pichon_blanc', echelle: 0.5, attaques: { 0: 10 / 34, 1: 12 / 34 }, animSorts: [0, 1] },
  pichon_sombre: { atlas: 'pichon_bleu', echelle: 0.44, attaques: { 0: 5 / 31, 1: 7 / 27 }, animSorts: [0, 1], teinte: { hue: 60, sat: 0, lum: 0.7 } },
  kwak_dore: { atlas: 'kwak_de_terre', echelle: 0.64, attaques: { 0: 11/20, 1: 5/15 }, animSorts: [0, 1, 1], teinte: { hue: -25, sat: -0.4, lum: 1.45 } },
  kwak_sombre: { atlas: 'kwak_de_terre', echelle: 0.64, attaques: { 0: 11/20, 1: 5/15 }, animSorts: [0, 1, 1], teinte: { hue: -160, sat: -0.3, lum: 0.6 } },
  larve_orange: { atlas: 'larve_orange', echelle: 0.71, attaques: { 0: 6 / 27, 1: 10 / 25, 2: 7 / 26 }, animSorts: [0, 1, 2] },
  larve_verte: { atlas: 'larve_verte', echelle: 0.71, attaques: { 0: 6 / 27, 1: 10 / 25 }, animSorts: [0, 1, 1] },
  larve_bleue: { atlas: 'larve_bleue', echelle: 0.71, attaques: { 0: 6 / 27, 1: 10 / 25, 2: 7 / 26 }, animSorts: [0, 1, 2] },
  larve_doree: { atlas: 'larve_doree', echelle: 0.9, attaques: { 0: 12/24, 1: 9/18 }, animSorts: [0, 1, 1] },
  larve_sombre: { atlas: 'larve_bleue', echelle: 0.71, attaques: { 0: 6 / 27, 1: 10 / 25, 2: 7 / 26 }, animSorts: [0, 1, 2], teinte: { hue: 60, sat: 0, lum: 0.7 } },
  kwakere_de_flamme: { atlas: 'kwakere_de_flamme', echelle: 1.09, attaques: { 0: 13/32, 1: 6/40, 2: 6/40 }, animSorts: [0, 1, 2] },
  kwakere_de_terre: { atlas: 'kwakere_de_terre', echelle: 1.09, attaques: { 0: 13/32, 1: 6/40, 2: 6/40 }, animSorts: [0, 1, 2] },
  kwakere_de_glace: { atlas: 'kwakere_de_glace', echelle: 1.09, attaques: { 0: 13/32, 1: 6/40, 2: 6/40 }, animSorts: [0, 1, 2] },
  kwakere_d_or: { atlas: 'kwakere_de_glace', echelle: 1.09, attaques: { 0: 13/32, 1: 6/40, 2: 6/40 }, animSorts: [0, 1, 2], teinte: { hue: 200, sat: 0.3, lum: 1.3 } },
  kwakere_de_vent: { atlas: 'kwakere_de_vent', echelle: 1.09, attaques: { 0: 13/32, 1: 6/40, 2: 6/40 }, animSorts: [0, 1, 2] },
  koalak_griotte: { atlas: 'koalak_griotte', echelle: 0.64, attaques: { 0: 18/31, 1: 20/30 }, animSorts: [0, 1, 1] },
  koalak_reinette: { atlas: 'koalak_reinette', echelle: 0.64, attaques: { 0: 18/31, 1: 20/30 }, animSorts: [0, 1, 1] },
  koalak_indigo: { atlas: 'koalak_indigo', echelle: 0.64, attaques: { 0: 18/31, 1: 20/30 }, animSorts: [0, 1, 1] },
  koalak_coco: { atlas: 'koalak_coco', echelle: 0.64, attaques: { 0: 18/31, 1: 20/30 }, animSorts: [0, 1, 1] },
  koalak_myrtille: { atlas: 'koalak_reinette', echelle: 0.64, attaques: { 0: 18/31, 1: 20/30 }, animSorts: [0, 1, 1], teinte: { hue: 190, sat: 0, lum: 0.8 } },
  chef_de_guerre_bouftou: { atlas: 'chef_de_guerre_bouftou', echelle: 0.55, attaques: { 0: 10 / 37, 1: 14 / 24, 2: 9 / 26 }, animSorts: [0, 1, 2] },
  boufton_orageux: { atlas: 'boufton_orageux', echelle: 0.5, attaques: { 0: 9 / 32, 1: 8 / 17 }, animSorts: [0, 1, 1] },
  bouftou_nuageux: { atlas: 'bouftou_nuageux', echelle: 0.5, attaques: { 0: 9 / 32 }, animSorts: [0, 0, 0] },
  boufton_palichon: { atlas: 'boufton_palichon', echelle: 0.55, attaques: { 0: 9 / 32, 1: 8 / 17 }, animSorts: [0, 1, 1] },
  bouftou_noir: { atlas: 'bouftou_noir', echelle: 0.55, attaques: { 0: 9 / 32, 1: 10 / 22, 2: 5 / 27 }, animSorts: [0, 1, 2] },
  dragoss_argile: { atlas: 'dragoss_argile', echelle: 0.61, attaques: { 0: 12/25, 1: 15/31 }, animSorts: [0, 1, 1] },
  dragoss_calcaire: { atlas: 'dragoss_calcaire', echelle: 0.54, attaques: { 0: 12/25, 1: 15/31 }, animSorts: [0, 1, 1] },
  dragoss_ardoise: { atlas: 'dragoss_ardoise', echelle: 0.58, attaques: { 0: 12/25, 1: 15/31 }, animSorts: [0, 1, 1] },
  dragoss_dore: { atlas: 'dragoss_argile', echelle: 0.61, attaques: { 0: 12/25, 1: 15/31 }, animSorts: [0, 1, 1], teinte: { hue: 12, sat: -0.35, lum: 1.35 } },
  dragoss_charbon: { atlas: 'dragoss_charbon', echelle: 0.61, attaques: { 0: 12/25, 1: 15/31 }, animSorts: [0, 1, 1] },
  gelee_royale_fraise: { atlas: 'gelee_royale_fraise', echelle: 1.0, attaques: { 0: 12/41, 1: 24/45, 2: 16/37 }, animSorts: [0, 1, 2] },
  gelee_royale_menthe: { atlas: 'gelee_royale_menthe', echelle: 1.0, attaques: { 0: 12/41, 1: 24/45, 2: 16/37 }, animSorts: [0, 1, 2] },
  gelee_royale_bleuet: { atlas: 'gelee_royale_bleuet', echelle: 1.0, attaques: { 0: 12/41, 1: 24/45, 2: 16/37 }, animSorts: [0, 1, 2] },
  gelee_royale_citron: { atlas: 'gelee_royale_citron', echelle: 1.0, attaques: { 0: 12/41, 1: 24/45, 2: 16/37 }, animSorts: [0, 1, 2] },
  gelee_royale_mure: { atlas: 'gelee_royale_bleuet', echelle: 1.0, attaques: { 0: 12/41, 1: 24/45, 2: 16/37 }, animSorts: [0, 1, 2], teinte: { hue: 50, sat: 0, lum: 0.8 } },
};

/** Applique la couleur refaite d'un monstre à son sprite (WebGL seulement ; sans effet en Canvas). */
export function teinter(sprite: Phaser.GameObjects.Sprite, id: string) {
  const t = LOOKS[id]?.teinte;
  if (!t || !sprite.preFX) return;
  const m = sprite.preFX.addColorMatrix();
  m.hue(t.hue);
  if (t.sat) m.saturate(t.sat, true);
  if (t.lum !== 1) m.brightness(t.lum, true);
}
