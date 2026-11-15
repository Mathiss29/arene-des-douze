import { cadeaux, recevoir } from '../src/sim/reception';
import { describe, expect, it } from 'vitest';
import { lireSauvegarde, nouveauJoueur, type Joueur } from '../src/sim/joueur';
import { ENERGIE, avantProchaine, changerEnergie, energie } from '../src/sim/energie';
import {
  ZONES, appliquerVictoire, brecheOuverte, cleStage, difficulteOuverte, prochainStage, stage, stageOuvert, tirerButin, zone, zoneOuverte,
} from '../src/sim/stages';

const astrub = zone('astrub');
const gagner = (j: Joueur, cle: string, graine = 1) => appliquerVictoire(j, stage(cle), tirerButin(j, stage(cle), graine), 0).joueur;

describe('Zones et difficultés (SW : 7 stages, Normal → Difficile → Enfer)', () => {
  it('7 stages par zone, le boss au 7ᵉ', () => {
    expect(astrub.stages).toHaveLength(7);
    expect(stage('astrub-7').boss).toBe(0);
    expect(stage('astrub-3').numero).toBe(3);
  });
  it('la difficulté renforce les ennemis et les récompenses', () => {
    const n = stage('astrub-2'), d = stage('astrub-2@1'), e = stage('astrub-2@2');
    expect(d.ennemis[0].etoiles).toBe(n.ennemis[0].etoiles + 1);
    expect(e.ennemis[0].niveau).toBeGreaterThan(d.ennemis[0].niveau);
    expect(e.recompenses.xp).toBeGreaterThan(n.recompenses.xp);
    expect([n.cout, d.cout, e.cout]).toEqual([...ENERGIE.cout]);
    expect(() => stage('astrub-2@3')).toThrow();
  });
  it('les stages s\'ouvrent un par un, la difficulté suivante quand la zone est finie', () => {
    let j = nouveauJoueur();
    expect(zoneOuverte(j, astrub)).toBe(true);
    expect(zoneOuverte(j, ZONES[1])).toBe(false);
    expect(stageOuvert(j, astrub, 0, 0)).toBe(true);
    expect(stageOuvert(j, astrub, 1, 0)).toBe(false);
    expect(prochainStage(j)).toBe('astrub-1');
    for (let i = 0; i < 6; i++) j = gagner(j, astrub.stages[i]);
    expect(difficulteOuverte(j, astrub, 1)).toBe(false);
    expect(prochainStage(j)).toBe('astrub-7');
    j = gagner(j, 'astrub-7');
    expect(difficulteOuverte(j, astrub, 1)).toBe(true);
    expect(prochainStage(j)).toBe(cleStage('astrub-1', 1));
    expect(brecheOuverte(j)).toBe(false);   // les autres zones n'ont pas encore de stages
  });
  it('finir la zone en Normal donne sa récompense une seule fois', () => {
    let j = nouveauJoueur();
    for (let i = 0; i < 6; i++) j = gagner(j, astrub.stages[i]);
    const b = tirerButin(j, stage('astrub-7'), 3);
    expect(b.zone).toEqual(astrub.recompense);
    j = appliquerVictoire(j, stage('astrub-7'), b, 0).joueur;
    // la récompense arrive à la Réception (maquette « Réception : » 3B)
    expect(cadeaux(j, 0).some((c) => c.id === 'zone:astrub' && c.contenu.monstre === astrub.recompense!.id)).toBe(true);
    j = recevoir(j, 'zone:astrub', 0);
    expect(j.monstres.some((m) => m.id === astrub.recompense!.id)).toBe(true);
    expect(j.recompensesZones).toContain('astrub');
    expect(tirerButin(j, stage('astrub-7'), 3).zone).toBeUndefined();
  });
  it('des monstres et de l\'énergie tombent parfois, toujours pareil pour une même graine', () => {
    const j = nouveauJoueur(), s = stage('astrub-3');
    const butins = Array.from({ length: 400 }, (_, g) => tirerButin(j, s, g));
    const monstres = butins.filter((b) => b.monstre).length, energies = butins.filter((b) => b.energie).length;
    expect(monstres).toBeGreaterThan(0); expect(monstres).toBeLessThan(40);
    expect(energies).toBeGreaterThan(50); expect(energies).toBeLessThan(160);
    expect(butins.every((b) => !b.monstre || s.ennemis.some((e) => e.id === b.monstre))).toBe(true);
    expect(tirerButin(j, s, 7)).toEqual(tirerButin(j, s, 7));
  });
});

describe('Énergie (SW : +1 toutes les 5 minutes)', () => {
  const M = 60_000;
  it('pleine au départ, se dépense et revient avec le temps', () => {
    let j = nouveauJoueur();
    expect(energie(j, 0)).toBe(ENERGIE.max);
    j = changerEnergie(j, -3, 1000);
    expect(energie(j, 1000)).toBe(ENERGIE.max - 3);
    expect(energie(j, 1000 + 5 * M)).toBe(ENERGIE.max - 2);
    expect(energie(j, 1000 + 100 * M)).toBe(ENERGIE.max);
    expect(avantProchaine(j, 1000 + 2 * M)).toBe(3 * M);
    expect(() => changerEnergie(j, -999, 1000)).toThrow();
  });
  it('la recharge entamée est gardée ; au-delà du max, pas de recharge mais rien de perdu', () => {
    let j = changerEnergie(nouveauJoueur(), -10, 0);
    j = changerEnergie(j, -1, 7 * M);   // 1 unité revenue à 5 min, 2 min entamées
    expect(energie(j, 7 * M)).toBe(ENERGIE.max - 10);
    expect(energie(j, 10 * M)).toBe(ENERGIE.max - 9);
    const plein = changerEnergie(nouveauJoueur(), 5, 0);
    expect(energie(plein, 999 * M)).toBe(ENERGIE.max + 5);
  });
  it('gardée dans la sauvegarde', () => {
    const j = changerEnergie(nouveauJoueur(), -4, 123);
    expect(lireSauvegarde(JSON.parse(JSON.stringify(j)))?.energie).toEqual(j.energie);
    expect(lireSauvegarde(JSON.parse(JSON.stringify({ ...nouveauJoueur(), recompensesZones: undefined, vus: undefined })))?.vus).toEqual([]);
  });
});
