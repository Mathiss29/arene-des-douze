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
};
