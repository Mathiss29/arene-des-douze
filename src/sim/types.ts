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
