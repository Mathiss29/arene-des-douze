import { describe, expect, it } from 'vitest';
import { lireSauvegarde, nouveauJoueur, type Joueur } from '../src/sim/joueur';
import {
  FRAGMENTS_TRANSCENDANCE, ORDRE_PIERRES, PIERRES, ajouterPierres, assemblerTranscendante, bassin, invoquer, nombre, refus,
} from '../src/sim/invocation';
import { fiche } from '../src/sim/fiches';

const riche = (p: Parameters<typeof ajouterPierres>[1], n: number): Joueur => ajouterPierres({ ...nouveauJoueur(), kamas: 10_000_000, places: 100_000 }, p, n);

describe('Invocation (chances de SW)', () => {
  it('chaque pierre a ses chances qui font 100 % et des monstres pour chaque grade', () => {
    for (const p of ORDRE_PIERRES) {
      expect(PIERRES[p].chances.reduce((s, [, c]) => s + c, 0)).toBeCloseTo(100, 5);
      for (const [e] of PIERRES[p].chances) expect(bassin(p, e).length, `${p} ${e}★`).toBeGreaterThan(0);
    }
  });
  it('les pierres donnent les bons grades et les bons éléments (Bonta et Brâkmar seulement par leur pierre)', () => {
    for (const p of ORDRE_PIERRES) {
      const { invoques } = invoquer(riche(p, 300), p, 10, 7);
      for (const m of invoques) {
        const f = fiche(m.id);
        expect(PIERRES[p].elements).toContain(f.element);
        expect(PIERRES[p].chances.map(([e]) => e)).toContain(f.etoiles);
      }
    }
  });
  it('les fréquences suivent les chances (pierre d\'âme : ~74 / 25 / 1 %)', () => {
    const { invoques } = invoquer(riche('ame', 20_000), 'ame', 20_000, 42);
    const part = (e: number) => invoques.filter((m) => m.etoiles === e).length / invoques.length * 100;
    expect(part(1)).toBeGreaterThan(72); expect(part(1)).toBeLessThan(76);
    expect(part(2)).toBeGreaterThan(23); expect(part(2)).toBeLessThan(26.5);
    expect(part(3)).toBeGreaterThan(0.8); expect(part(3)).toBeLessThan(1.9);
  });
  it('la pierre transcendante donne toujours un 5★ ; même graine = même tirage', () => {
    const r = invoquer(riche('transcendante', 5), 'transcendante', 5, 3);
    expect(r.invoques.every((m) => m.etoiles === 5)).toBe(true);
    expect(invoquer(riche('parfaite', 10), 'parfaite', 10, 9).invoques.map((m) => m.id)).toEqual(invoquer(riche('parfaite', 10), 'parfaite', 10, 9).invoques.map((m) => m.id));
  });
  it('paie pierres et kamas, ajoute les monstres, note les nouveaux', () => {
    const j = { ...nouveauJoueur(), pierresAme: 12, kamas: 5000 };
    const r = invoquer(j, 'ame', 10, 1);
    expect(r.joueur.pierresAme).toBe(2);
    expect(r.joueur.kamas).toBe(5000 - 3000);
    expect(r.joueur.monstres.length).toBe(j.monstres.length + 10);
    const premiers = new Set<string>();
    for (const m of r.invoques) { expect(m.nouveau).toBe(!j.decouverts.includes(m.id) && !premiers.has(m.id)); premiers.add(m.id); }
    for (const m of r.invoques) expect(r.joueur.decouverts).toContain(m.id);
  });
  it('refuse sans pierres, sans kamas ou sans place', () => {
    const j = nouveauJoueur();
    expect(refus(j, 'ame', 1)).toBe('pierres');
    expect(refus({ ...j, pierresAme: 1, kamas: 0 }, 'ame', 1)).toBe('kamas');
    expect(refus({ ...j, pierresAme: 1, places: j.monstres.length }, 'ame', 1)).toBe('places');
    expect(() => invoquer(j, 'parfaite', 1, 1)).toThrow();
  });
});

describe('Collection', () => {
  it('fragments → pierre transcendante', () => {
    const j = { ...nouveauJoueur(), fragments: FRAGMENTS_TRANSCENDANCE + 3 };
    const r = assemblerTranscendante(j);
    expect(nombre(r, 'transcendante')).toBe(1);
    expect(r.fragments).toBe(3);
    expect(() => assemblerTranscendante(r)).toThrow();
  });
  it('pierres, fragments, bestiaire et places gardés dans la sauvegarde', () => {
    const j = { ...ajouterPierres(nouveauJoueur(), 'legendaire', 2), fragments: 7, places: 130 };
    const l = lireSauvegarde(JSON.parse(JSON.stringify(j)))!;
    expect(l.pierres.legendaire).toBe(2);
    expect(l.fragments).toBe(7);
    expect(l.places).toBe(130);
    expect(lireSauvegarde({ ...j, places: 50 })!.places).toBe(120);
    expect(l.decouverts).toEqual(expect.arrayContaining(j.monstres.map((m) => m.id)));
  });
});
