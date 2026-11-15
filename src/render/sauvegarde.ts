import { lireSauvegarde, nouveauJoueur, type Joueur } from '../sim/joueur';

/**
 * Sauvegarde locale (navigateur). Le stockage peut être absent ou plein : on joue quand même, sans sauvegarde.
 * Une sauvegarde illisible n'est jamais écrasée : elle est mise de côté (clé « …:illisible ») avant de repartir.
 * Une copie de secours est gardée à chaque changement de version. Export/import par un code à copier-coller.
 * Plus tard, le serveur de comptes prendra le relais (comme dans Diablofus).
 */
const CLE = 'arene-des-douze:joueur';
const SECOURS = 'arene-des-douze:secours';

export function charger(): Joueur {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) {
      const j = lireSauvegarde(JSON.parse(brut));
      if (j) return j;
      localStorage.setItem(`${CLE}:illisible:${new Date().toISOString()}`, brut);
      localStorage.removeItem(CLE);
    }
  } catch {
    /* stockage indisponible ou sauvegarde illisible : nouveau joueur */
  }
  return nouveauJoueur();
}

export function sauver(j: Joueur): void {
  try {
    const avant = localStorage.getItem(CLE);
    if (avant && !avant.includes(`"version":${j.version}`)) localStorage.setItem(SECOURS, avant);
    localStorage.setItem(CLE, JSON.stringify(j));
  } catch {
    /* stockage indisponible : la partie continue sans sauvegarde */
  }
}

/** Code de sauvegarde à copier (base64 du JSON). */
export function exporter(j: Joueur): string {
  const texte = JSON.stringify(j);
  return 'AD1:' + btoa(String.fromCharCode(...new TextEncoder().encode(texte)));
}

/** Lit un code de sauvegarde ; null s'il est invalide. */
export function importer(code: string): Joueur | null {
  try {
    const c = code.trim().replace(/^AD1:/, '');
    const texte = new TextDecoder().decode(Uint8Array.from(atob(c), (x) => x.charCodeAt(0)));
    return lireSauvegarde(JSON.parse(texte));
  } catch {
    return null;
  }
}

/** Recommencer : la partie actuelle est gardée en secours. */
export function effacer(): void {
  try {
    const avant = localStorage.getItem(CLE);
    if (avant) localStorage.setItem(SECOURS, avant);
    localStorage.removeItem(CLE);
  } catch { /* rien */ }
}

// ───────────── erreurs (pour « Signaler un bug ») ─────────────

const erreurs: string[] = [];
export function noterErreur(e: string): void {
  erreurs.push(`${new Date().toISOString()} ${e}`.slice(0, 600));
  if (erreurs.length > 10) erreurs.shift();
}
export const dernieresErreurs = () => [...erreurs];
