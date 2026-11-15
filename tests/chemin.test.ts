import { describe, expect, it } from 'vitest';
import { compter, lireSauvegarde, nouveauJoueur, type Joueur } from '../src/sim/joueur';
import {
  CHOIX_5, DEFIS, PALIERS, TOUTES, aRecevoirChemin, avancement, coffreRecu, palierOuvert, peutRecevoirQuete, recevoirCoffre, recevoirDefi, recevoirQuete,
} from '../src/sim/chemin';
import { noterMission } from '../src/sim/missions';
import { fiche } from '../src/sim/fiches';
import { LOOKS } from '../src/render/looks';

const tout = (j: Joueur): Joueur => {
  let k = j;
  for (const q of TOUTES) if (peutRecevoirQuete(k, q) && PALIERS.every((p) => !p.quetes.includes(q) || palierOuvert(k, p))) k = recevoirQuete(k, q.id, 0, q.recompense.choix5 ? CHOIX_5[0] : undefined);
  return k;
};

describe('Chemin de l\'invocateur', () => {
  it('paliers Novice, Intermédiaire, Avancé et défis ; beaucoup de quêtes, toutes avec un écran et des ids uniques', () => {
    expect(PALIERS.map((p) => p.nom)).toEqual(['Novice', 'Intermédiaire', 'Avancé']);
    expect(TOUTES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(TOUTES.map((q) => q.id)).size).toBe(TOUTES.length);
    expect(PALIERS[2].coffre.pierres?.transcendante).toBe(1);
    expect(DEFIS.find((d) => d.id === 'donjon')!.recompense.monstre).toBe('chef_de_guerre_bouftou');
    for (const id of CHOIX_5) { expect(fiche(id).etoiles).toBe(5); expect(LOOKS[id]).toBeDefined(); }
  });

  it('avancement lu dans l\'état et les compteurs ; recevoir une seule fois', () => {
    let j = nouveauJoueur();
    const n2 = PALIERS[0].quetes.find((q) => q.id === 'n2')!;
    expect(peutRecevoirQuete(j, n2)).toBe(false);
    j = noterMission(j, 'mine', 1, 0);
    expect(j.compteurs?.mine).toBe(1);
    expect(aRecevoirChemin(j)).toBe(true);
    const k = j.kamas;
    j = recevoirQuete(j, 'n2', 0);
    expect(j.kamas).toBe(k + 1000);
    expect(() => recevoirQuete(j, 'n2', 0)).toThrow();
    expect(avancement(compter(j, 'invoquer', 4), { type: 'compteur', cle: 'invoquer', n: 10 })).toEqual({ fait: 4, objectif: 10 });
  });

  it('le palier suivant s\'ouvre après le précédent ; coffres et défis', () => {
    let j: Joueur = { ...nouveauJoueur(), stagesFinis: ['astrub-1', 'astrub-2', 'astrub-3', 'astrub-4', 'astrub-5', 'astrub-6', 'astrub-7', 'donjon:bouftous-1'] };
    expect(palierOuvert(j, PALIERS[1])).toBe(false);
    expect(() => recevoirQuete(j, 'i1', 0)).toThrow();
    // tout le reste du palier Novice
    j = { ...j, compteurs: { mine: 20, ameliorer: 1, invoquer: 10, cadeau: 1, missionRecue: 1, coffre: 1, histoire: 20, rune: 10, donjon: 10 },
      decouverts: Array.from({ length: 45 }, (_, i) => `m${i}`) };
    j = { ...j, monstres: j.monstres.map((m, i) => (i === 0 ? { ...m, etoiles: 3 as const } : m)) };
    j = { ...j, runes: [{ uid: 1, set: 'iop', emplacement: 1, etoiles: 3, grade: 0, niveau: 3, principale: 'atq_fixe', sous: [], porteur: j.monstres[0].uid }] };
    j = tout(j);
    expect(PALIERS[0].quetes.every((q) => j.chemin!.includes(q.id))).toBe(true);
    expect(palierOuvert(j, PALIERS[1])).toBe(true);
    const parfaites = j.pierres.parfaite ?? 0;
    j = recevoirCoffre(j, 'novice', 0);
    expect(coffreRecu(j, PALIERS[0])).toBe(true);
    expect(j.pierres.parfaite).toBe(parfaites + 1);
    j = tout(j);
    expect(j.chemin).toContain('i1');
    const dc = DEFIS.find((d) => d.id === 'collection')!;
    expect(dc.etapes.every((q) => j.chemin!.includes(q.id))).toBe(true);
    j = recevoirDefi(j, 'collection', 0);
    expect(j.pierres.legendaire).toBe(1);
    expect(lireSauvegarde(JSON.parse(JSON.stringify(j)))!.chemin).toEqual(j.chemin);
  });

  it('5★ au choix en finissant Astrub en Enfer', () => {
    const enfer = [1, 2, 3, 4, 5, 6, 7].map((n) => `astrub-${n}@2`);
    let j: Joueur = { ...nouveauJoueur(), stagesFinis: enfer, chemin: [...PALIERS[0].quetes, ...PALIERS[1].quetes].map((q) => q.id) };
    expect(() => recevoirQuete(j, 'a5', 0)).toThrow();
    j = recevoirQuete(j, 'a5', 0, 'dragoss_ardoise');
    expect(j.monstres.some((m) => m.id === 'dragoss_ardoise')).toBe(true);
  });
});
