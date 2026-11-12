import { lireSauvegarde, nouveauJoueur, type Joueur } from '../sim/joueur';

/**
 * Sauvegarde locale (navigateur). Le stockage peut être absent ou plein : on joue quand même, sans sauvegarde.
 * Plus tard, le serveur de comptes prendra le relais (comme dans Diablofus).
 */
const CLE = 'arene-des-douze:joueur';

export function charger(): Joueur {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return lireSauvegarde(JSON.parse(brut)) ?? nouveauJoueur();
  } catch {
    /* stockage indisponible ou sauvegarde illisible : nouveau joueur */
  }
  return nouveauJoueur();
}

export function sauver(j: Joueur): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(j));
  } catch {
    /* stockage indisponible : la partie continue sans sauvegarde */
  }
}
