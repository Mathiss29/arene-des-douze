import { describe, expect, it } from 'vitest';
import { Rng } from '../src/sim/rng';

describe('Rng', () => {
  it('la même graine donne toujours la même suite', () => {
    const a = new Rng(42), b = new Rng(42);
    for (let i = 0; i < 1000; i++) expect(a.suivant()).toBe(b.suivant());
  });

  it('deux graines différentes donnent des suites différentes', () => {
    const a = new Rng(1), b = new Rng(2);
    expect(Array.from({ length: 5 }, () => a.suivant())).not.toEqual(Array.from({ length: 5 }, () => b.suivant()));
  });

  it('reste dans [0, 1) et entier respecte ses bornes', () => {
    const r = new Rng(7);
    for (let i = 0; i < 10000; i++) {
      const x = r.suivant();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = r.entier(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it('reprend exactement à partir de son état', () => {
    const r = new Rng(99);
    r.suivant(); r.suivant();
    const copie = new Rng(r.etat);
    expect(copie.suivant()).toBe(r.suivant());
  });
});
