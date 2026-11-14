import { describe, expect, it } from 'vitest';
import { lireSauvegarde, nouveauJoueur } from '../src/sim/joueur';
import { MINE, avantPlein, kamasEnMine, recolterMine } from '../src/sim/mine';

const H = 3_600_000;

describe('Mine de kamas', () => {
  it('produit à l\'heure jusqu\'au stockage max', () => {
    const j = { ...nouveauJoueur(), mine: 0 };
    expect(kamasEnMine(j, H / 2)).toBe(MINE.parHeure / 2);
    expect(kamasEnMine(j, 100 * H)).toBe(MINE.max);
    expect(kamasEnMine(nouveauJoueur(), 5 * H)).toBe(0);   // pas encore lancée
  });
  it('la récolte garde la production entamée, sauf si la mine était pleine', () => {
    const j = { ...nouveauJoueur(), mine: 0 };
    const r = recolterMine(j, H / 2 + 1000);
    expect(r.kamas).toBe(MINE.parHeure / 2);
    expect(r.joueur.kamas).toBe(j.kamas + MINE.parHeure / 2);
    expect(kamasEnMine(r.joueur, H / 2 + 1000)).toBe(0);
    expect(kamasEnMine(r.joueur, H / 2 + 6000)).toBe(1);   // les 1000 ms déjà passées comptent
    const plein = recolterMine(j, 100 * H);
    expect(plein.kamas).toBe(MINE.max);
    expect(plein.joueur.mine).toBe(100 * H);
    expect(avantPlein(plein.joueur, 100 * H)).toBe((MINE.max / MINE.parHeure) * H);
  });
  it('la mine est gardée dans la sauvegarde', () => {
    expect(lireSauvegarde(JSON.parse(JSON.stringify({ ...nouveauJoueur(), mine: 1234 })))?.mine).toBe(1234);
    expect(lireSauvegarde(JSON.parse(JSON.stringify(nouveauJoueur())))?.mine).toBeUndefined();
  });
});
