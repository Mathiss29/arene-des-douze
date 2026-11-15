import { describe, expect, it } from 'vitest';
import { lireSauvegarde, nouveauJoueur, VERSION_SAUVEGARDE } from '../src/sim/joueur';

describe('sauvegarde versionnée', () => {
  it('une sauvegarde d\'une version plus ancienne est lue et passée à la version actuelle', () => {
    const v1 = { ...nouveauJoueur(), version: 1, places: 50 };
    const l = lireSauvegarde(JSON.parse(JSON.stringify(v1)))!;
    expect(l.version).toBe(VERSION_SAUVEGARDE);
    expect(l.places).toBe(120);
  });
  it('une version du futur ou un objet abîmé ne sont pas lus', () => {
    expect(lireSauvegarde({ ...nouveauJoueur(), version: VERSION_SAUVEGARDE + 1 })).toBeNull();
    expect(lireSauvegarde({ version: 2, monstres: 'x' })).toBeNull();
  });
});
