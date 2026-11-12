/** Types du contenu du jeu (src/data). Aucune dépendance à Phaser ni au navigateur. */

/** Cycle fidèle à Summoners War : Feu > Air > Eau > Feu ; Bonta et Brâkmar se battent l'un l'autre. */
export type Element = 'feu' | 'air' | 'eau' | 'bonta' | 'brakmar';

/** Les quatre types de monstres de Summoners War. */
export type TypeMonstre = 'attaque' | 'defense' | 'pv' | 'soutien';

export interface FicheMonstre {
  id: string;
  nom: string;
  famille: string;
  element: Element;
  /** Étoiles à l'invocation (1 à 5). */
  etoiles: 1 | 2 | 3 | 4 | 5;
  type: TypeMonstre;
}

export const ELEMENTS: readonly Element[] = ['feu', 'air', 'eau', 'bonta', 'brakmar'];

const BAT: Record<Element, Element> = { feu: 'air', air: 'eau', eau: 'feu', bonta: 'brakmar', brakmar: 'bonta' };

/** +1 si l'attaquant a l'avantage, -1 s'il est désavantagé, 0 sinon. */
export function avantage(attaquant: Element, cible: Element): -1 | 0 | 1 {
  if (BAT[attaquant] === cible) return 1;
  if (BAT[cible] === attaquant) return -1;
  return 0;
}

// ───────────────────────────── Combat ─────────────────────────────

/** Stats de combat (fiche niveau max + runes + skill de leader). tc, dc, pre et res sont en %. */
export interface Stats {
  pv: number;
  atq: number;
  def: number;
  vit: number;
  tc: number;
  dc: number;
  pre: number;
  res: number;
}

export type Bonus = 'atq_hausse' | 'def_hausse' | 'vit_hausse' | 'tc_hausse' | 'bouclier' | 'immunite';
export type Malus = 'atq_baisse' | 'def_baisse' | 'lenteur' | 'etourdi' | 'poison';
export type TypeEffet = Bonus | Malus;

export const BONUS: readonly TypeEffet[] = ['atq_hausse', 'def_hausse', 'vit_hausse', 'tc_hausse', 'bouclier', 'immunite'];
export const estBonus = (t: TypeEffet) => BONUS.includes(t);

export type CibleSort = 'ennemi' | 'ennemis' | 'allie' | 'allies' | 'soi';

export interface EffetSort {
  type: TypeEffet;
  /** Chance d'activation en % (100 = toujours). */
  chance: number;
  tours: number;
  /** Qui le reçoit : la cible du sort (défaut), le lanceur, ou toute l'équipe du lanceur. */
  sur?: 'cible' | 'soi' | 'allies';
  /** Tenté après chaque coup (« chaque coup a 30 % de chance de… ») au lieu d'une fois à la fin. */
  parCoup?: boolean;
}

export interface Sort {
  id: string;
  nom: string;
  /** Temps de recharge en tours ; 0 = sort de base. */
  recharge: number;
  cible: CibleSort;
  /** Nombre de coups (défaut 1). */
  coups?: number;
  /** Multiplicateur de dégâts par coup : somme de stat × coefficient (ex. { atq: 3.6 }). */
  mult?: Partial<Record<'atq' | 'def' | 'pv' | 'vit', number>>;
  effets?: EffetSort[];
  /** Soin en fraction des PV max de chaque cible. */
  soin?: number;
  /** Bouclier en fraction des PV max du lanceur, posé sur chaque cible pour `tours` tours. */
  bouclier?: { part: number; tours: number };
  /** Retire tous les malus des cibles. */
  nettoie?: boolean;
  /** Jauge d'attaque en points de % : la cible (négatif = réduction, résistable), le lanceur, ses alliés. */
  jauge?: { cible?: { valeur: number; chance: number }; soi?: number; allies?: number };
  /** Passif : jamais lancé (effets permanents à venir). */
  passif?: boolean;
}

export type ZoneLeader = 'general' | 'arene' | 'donjon' | Element;

export interface Leader {
  stat: keyof Stats;
  /** Bonus en % de la stat de base (pour tc, pre, res : points de %). */
  valeur: number;
  zone: ZoneLeader;
}

/** Monstre prêt pour le combat. */
export interface MonstreCombat {
  id: string;
  nom: string;
  element: Element;
  stats: Stats;
  sorts: Sort[];
  leader?: Leader;
}

export type ModeCombat = 'histoire' | 'donjon' | 'arene';
