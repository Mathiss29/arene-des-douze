import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import MONSTRES from '../src/data/monstres.json';
import { ELEMENTS, avantage, type FicheMonstre } from '../src/sim/types';
import { LOOKS } from '../src/render/looks';

const FICHES = MONSTRES as FicheMonstre[];

/** Noms d'animations d'une planche (sans le numéro d'image). */
function animations(atlas: string): Set<string> {
  const d = JSON.parse(readFileSync(`public/assets/sprites/${atlas}.json`, 'utf8'));
  const frames: { filename: string }[] = d.textures ? d.textures.flatMap((t: { frames: { filename: string }[] }) => t.frames) : [];
  const noms = d.textures ? frames.map((f) => f.filename) : Object.keys(d.frames);
  return new Set(noms.map((n) => n.replace(/_\d+$/, '')));
}

describe('monstres de l\'alpha', () => {
  it('ont des identifiants uniques et des valeurs valides', () => {
    expect(new Set(FICHES.map((f) => f.id)).size).toBe(FICHES.length);
    for (const f of FICHES) {
      expect(ELEMENTS).toContain(f.element);
      expect(['attaque', 'defense', 'pv', 'soutien']).toContain(f.type);
      expect(f.etoiles).toBeGreaterThanOrEqual(1);
      expect(f.etoiles).toBeLessThanOrEqual(5);
    }
  });

  it.each(FICHES.map((f) => [f.id]))('%s a une planche avec repos, coup reçu, mort et ses attaques', (id) => {
    const look = LOOKS[id];
    expect(look, `pas de look pour ${id}`).toBeDefined();
    const a = animations(look.atlas);
    for (const n of ['AnimStatique_1', 'AnimHit_1', 'AnimMort_1']) expect(a.has(n), `${id} : ${n}`).toBe(true);
    for (const n of Object.keys(look.attaques)) expect(a.has(`AnimAttaque${n}_1`), `${id} : AnimAttaque${n}_1`).toBe(true);
  });
});

describe('éléments (fidèles à Summoners War)', () => {
  it('Feu > Air > Eau > Feu', () => {
    expect(avantage('feu', 'air')).toBe(1);
    expect(avantage('air', 'eau')).toBe(1);
    expect(avantage('eau', 'feu')).toBe(1);
    expect(avantage('air', 'feu')).toBe(-1);
  });

  it('Bonta et Brâkmar sont forts l\'un contre l\'autre et neutres face aux autres', () => {
    expect(avantage('bonta', 'brakmar')).toBe(1);
    expect(avantage('brakmar', 'bonta')).toBe(1);
    expect(avantage('bonta', 'feu')).toBe(0);
    expect(avantage('eau', 'brakmar')).toBe(0);
  });
});
