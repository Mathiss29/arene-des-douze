/**
 * Énergie des combats d'histoire (maquette « Zaap : » 5A). SW : elle revient d'elle-même, 1 toutes les 5 minutes ✓.
 * Maximum et coûts : les nôtres ⚠ (SW fait monter le maximum avec le niveau d'invocateur, non vérifié ;
 * coûts 3 / 4 / 5 selon la difficulté d'après un seul guide). Pur : le temps est passé en argument (ms).
 */
import type { Joueur } from './joueur';

export const ENERGIE = { max: 60, recharge: 5 * 60_000, cout: [3, 4, 5] as const };

/** Énergie disponible maintenant. Au-delà du maximum (récompenses), elle ne se recharge plus mais n'est pas perdue. */
export function energie(j: Joueur, maintenant: number): number {
  const e = j.energie;
  if (!e) return ENERGIE.max;
  if (e.n >= ENERGIE.max) return e.n;
  return Math.min(ENERGIE.max, e.n + Math.floor(Math.max(0, maintenant - e.depuis) / ENERGIE.recharge));
}

/** Temps avant la prochaine unité (ms), 0 si l'énergie est pleine. */
export function avantProchaine(j: Joueur, maintenant: number): number {
  const e = j.energie;
  if (!e || energie(j, maintenant) >= ENERGIE.max) return 0;
  return ENERGIE.recharge - (Math.max(0, maintenant - e.depuis) % ENERGIE.recharge);
}

/** Ajoute (ou retire, si n < 0) de l'énergie en gardant la recharge entamée. */
export function changerEnergie(j: Joueur, n: number, maintenant: number): Joueur {
  const avant = energie(j, maintenant);
  const apres = avant + n;
  if (apres < 0) throw new Error(`Pas assez d'énergie : ${avant} pour ${-n}`);
  // la recharge entamée continue ; si on était plein, elle part de maintenant
  const e = j.energie;
  const depuis = !e || avant >= ENERGIE.max ? maintenant : e.depuis + Math.floor(Math.max(0, maintenant - e.depuis) / ENERGIE.recharge) * ENERGIE.recharge;
  return { ...j, energie: { n: apres, depuis } };
}
