import { describe, expect, it } from 'vitest';
import { lireSauvegarde, nouveauJoueur } from '../src/sim/joueur';
import { COFFRES, MISSIONS, aRecevoir, avantRemise, coffreOuvrable, etatMissions, jourMissions, noterMission, ouvrirCoffre, points, recevoirMission, recevoirTout } from '../src/sim/missions';

// 15 nov. 2026 à 12 h, heure de Paris (UTC+1)
const MIDI = Date.UTC(2026, 10, 15, 11);
const H = 3_600_000;

describe('missions du jour', () => {
  it('comme SW : 180 points possibles, 4 missions à +15 et 6 à +20', () => {
    expect(MISSIONS.reduce((s, m) => s + m.points, 0)).toBe(180);
    expect(MISSIONS.filter((m) => m.points === 15)).toHaveLength(4);
    expect(COFFRES.map((c) => c.points)).toEqual([20, 40, 60, 80, 100]);
    expect(COFFRES[4].fragments).toBe(2);
  });

  it('les missions possibles aujourd\'hui suffisent pour les 100 points', () => {
    expect(MISSIONS.filter((m) => !m.bientot).reduce((s, m) => s + m.points, 0)).toBeGreaterThanOrEqual(100);
  });

  it('le jour change à 6 h, heure de Paris, été comme hiver', () => {
    expect(jourMissions(Date.UTC(2026, 10, 15, 4, 59))).toBe('2026-11-14'); // 5 h 59 à Paris
    expect(jourMissions(Date.UTC(2026, 10, 15, 5, 0))).toBe('2026-11-15'); // 6 h à Paris
    expect(jourMissions(Date.UTC(2026, 6, 15, 3, 59))).toBe('2026-07-14'); // 5 h 59 à Paris (UTC+2)
    expect(jourMissions(Date.UTC(2026, 6, 15, 4, 0))).toBe('2026-07-15');
    expect(Math.round(avantRemise(MIDI) / 60_000)).toBe(18 * 60);
  });

  it('avancer, recevoir et ouvrir les coffres', () => {
    let j = nouveauJoueur();
    expect(aRecevoir(j, MIDI)).toBe(false);
    j = noterMission(j, 'invoquer', 2, MIDI);
    expect(() => recevoirMission(j, 'invoquer', MIDI)).toThrow();
    j = noterMission(j, 'invoquer', 5, MIDI);
    expect(etatMissions(j, MIDI).compte.invoquer).toBe(3);
    j = noterMission(noterMission(j, 'connexion', 1, MIDI), 'mine', 1, MIDI);
    expect(aRecevoir(j, MIDI)).toBe(true);
    j = recevoirMission(j, 'invoquer', MIDI);
    expect(() => recevoirMission(j, 'invoquer', MIDI)).toThrow();
    j = recevoirTout(j, MIDI);
    expect(points(etatMissions(j, MIDI))).toBe(45);
    expect(coffreOuvrable(etatMissions(j, MIDI), 1)).toBe(true);
    const k = j.kamas, p = j.pierresAme;
    j = ouvrirCoffre(ouvrirCoffre(j, 0, MIDI), 1, MIDI);
    expect(j.kamas).toBe(k + 10_000);
    expect(j.pierresAme).toBe(p + 8);
    expect(() => ouvrirCoffre(j, 1, MIDI)).toThrow();
    expect(() => ouvrirCoffre(j, 2, MIDI)).toThrow();
    expect(aRecevoir(j, MIDI)).toBe(false);
  });

  it('le dernier coffre donne 2 fragments ; tout repart à zéro le lendemain', () => {
    let j = nouveauJoueur();
    for (const m of MISSIONS.filter((x) => !x.bientot)) j = noterMission(j, m.id, m.objectif, MIDI);
    j = recevoirTout(j, MIDI);
    for (let i = 0; i < 5; i++) j = ouvrirCoffre(j, i, MIDI);
    expect(j.fragments).toBe(2);
    expect(j.pierres.parfaite).toBe(1);
    const lu = lireSauvegarde(JSON.parse(JSON.stringify(j)))!;
    expect(points(etatMissions(lu, MIDI))).toBe(points(etatMissions(j, MIDI)));
    const demain = etatMissions(j, MIDI + 24 * H);
    expect(points(demain)).toBe(0);
    expect(demain.coffres).toEqual([]);
  });
});
