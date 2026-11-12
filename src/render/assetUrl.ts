/**
 * Adresses des planches de monstres.
 * - Les atlas JSON sont dans public/assets/sprites (copiés depuis Diablofus).
 * - Les images AVIF restent sur le R2 de Diablofus. En dév, Vite les relaie sous /r2 (vite.config.ts) ;
 *   en ligne, le build lit VITE_ASSETS_URL (https://assets.diablofus.com).
 */
const DISTANT = ((import.meta.env.VITE_ASSETS_URL as string | undefined) || '/r2').replace(/\/+$/, '');

/** Dossier où Phaser va chercher les pages d'images d'un multi-atlas. */
export const dossierPlanches = `${DISTANT}/sprites/`;

/** Atlas JSON d'une planche. */
export const atlasPlanche = (cle: string) => `assets/sprites/${cle}.json`;
