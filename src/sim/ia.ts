import type { Combat, Unite } from './combat';
import { avantage } from './types';

/**
 * IA simple et déterministe (mode auto et défense du Kolizéum) :
 * - lance le sort disponible le plus avancé (les sorts à recharge sont les plus forts) ;
 * - garde un sort de soin tant que personne n'est sous 70 % de PV ;
 * - vise en priorité un ennemi sur lequel elle a l'avantage d'élément, puis le plus blessé ;
 * - soigne l'allié le plus blessé.
 */
export function choisirAction(c: Combat): { sort: number; cible?: number } {
  const u = c.acteur!;
  const allies = c.vivants(u.camp);
  const blesse = allies.some((a) => a.pv / a.stats.pv < 0.7);
  const dispo = c.sortsDisponibles(u);

  const sort = [...dispo].reverse().find((i) => {
    const s = u.monstre.sorts[i];
    const soinPur = !!s.soin && !s.mult;
    return !soinPur || blesse;
  }) ?? dispo[0];

  const s = u.monstre.sorts[sort];
  if (s.cible === 'ennemi') return { sort, cible: meilleure(c.ciblesValides(s, u), (x) => x.pv / x.stats.pv - 0.3 * avantage(u.element, x.element)).uid };
  if (s.cible === 'allie') return { sort, cible: meilleure(c.ciblesValides(s, u), (x) => x.pv / x.stats.pv).uid };
  return { sort };
}

/** L'unité au plus petit score ; à égalité, la première (déterministe). */
function meilleure(us: Unite[], score: (u: Unite) => number): Unite {
  return us.reduce((m, x) => (score(x) < score(m) ? x : m));
}
