/**
 * Générateur aléatoire à graine (mulberry32). Tout le hasard de la sim passe par lui, jamais par Math.random() :
 * la même graine et les mêmes choix donnent toujours le même combat (rejouable par le serveur pour le PvP).
 */
export class Rng {
  private s: number;

  constructor(graine: number) {
    this.s = graine >>> 0;
  }

  /** Nombre dans [0, 1). */
  suivant(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entier entre min et max inclus. */
  entier(min: number, max: number): number {
    return min + Math.floor(this.suivant() * (max - min + 1));
  }

  /** Vrai avec une probabilité de pct %. */
  chance(pct: number): boolean {
    return this.suivant() * 100 < pct;
  }

  /** État interne, pour sauvegarder ou rejouer une partie. */
  get etat(): number {
    return this.s;
  }
}
