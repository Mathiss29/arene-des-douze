/**
 * Constantes du combat, reprises de Summoners War: Sky Arena.
 * ✓ = vérifié sur une source SW ; ⚠ = valeur SW usuelle non confirmée par une source, à ajuster si besoin.
 */
export const REGLES = {
  /** ✓ À chaque tick, la jauge d'attaque monte de 7 % de la vitesse. */
  jaugeParVitesse: 0.07,
  /** ✓ Réduction des dégâts : 1000 / (1140 + 3,5 × DEF). */
  defA: 1000,
  defB: 1140,
  defC: 3.5,
  /** ✓ Taux critique et dégâts critiques de base (stats des fiches). */
  tcBase: 15,
  dcBase: 50,
  /** ✓ L'avantage d'élément donne +15 % de taux critique, le désavantage −15 % (ordre des tests : effleuré, critique, écrasant). */
  tcAvantage: 15,
  tcDesavantage: 15,
  /** ✓ Coup écrasant (avantage, coup non critique) : 35 % de chances, +30 % de dégâts. */
  ecrasantChance: 35,
  ecrasantBonus: 0.3,
  /**
   * ✓ Coup effleuré (désavantage) : 50 % de chances, −30 % de dégâts ; jamais critique, ne pose aucun malus ni baisse de jauge.
   * ⚠ Une source ajoute « −16 % de plus en désavantage » sans préciser le calcul : non appliqué.
   */
  effleureChance: 50,
  effleureMalus: 0.3,
  /** ✓ Les dégâts varient d'environ ±2,5 % (sauf dégâts fixes). */
  variation: 0.025,
  /** ✓ Chance de résister à un malus : max(15 %, Résistance − Précision). */
  resistanceMin: 15,
  /** ⚠ Valeurs SW usuelles des bonus et malus (page « Buffs » du wiki non lue : à confirmer). */
  atqHausse: 0.5,
  defHausse: 0.7,
  vitHausse: 0.3,
  tcHausse: 30,
  atqBaisse: 0.5,
  defBaisse: 0.7,
  lenteur: 0.3,
  /** ⚠ Dégâts continus : 5 % des PV max par pile, au début du tour de la victime. */
  poisonParPile: 0.05,
  poisonPilesMax: 10,
  /** Garde-fou : au-delà, le combat est déclaré nul. */
  toursMax: 600,
} as const;
