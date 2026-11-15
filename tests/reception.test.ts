import { describe, expect, it } from 'vitest';
import { lireSauvegarde, nouveauJoueur, type Joueur } from '../src/sim/joueur';
import { energie } from '../src/sim/energie';
import { DUREE_CADEAU, cadeaux, distribuer, envoyer, marquerVus, recevoir, recevoirEnergie, recevoirTout, refusCadeau, utiliserCode } from '../src/sim/reception';
import { appliquerVictoire, stage, tirerButin } from '../src/sim/stages';

const T = 1_000_000;

describe('Réception', () => {
  it('7 jours pour les cadeaux ordinaires, sans limite pour les monstres et les pierres', () => {
    let j = envoyer(nouveauJoueur(), 'a', 'Kamas', { kamas: 100 }, T);
    j = envoyer(j, 'b', 'Pierres', { pierresAme: 3 }, T);
    j = envoyer(j, 'c', 'Monstre', { monstre: 'piou_rouge' }, T);
    j = envoyer(j, 'a', 'Doublon', { kamas: 999 }, T);
    expect(cadeaux(j, T)).toHaveLength(3);
    expect(cadeaux(j, T + DUREE_CADEAU + 1).map((c) => c.id).sort()).toEqual(['b', 'c']);
  });

  it('recevoir, tout recevoir sans l\'énergie, puis l\'énergie', () => {
    let j: Joueur = { ...nouveauJoueur(), energie: { n: 10, depuis: T } };
    j = envoyer(envoyer(envoyer(j, 'k', 'Kamas', { kamas: 100 }, T), 'e', 'Énergie', { energie: 30 }, T), 'p', 'Parfaite', { pierres: { parfaite: 2 } }, T);
    const k = j.kamas;
    j = recevoir(j, 'k', T);
    expect(j.kamas).toBe(k + 100);
    expect(() => recevoir(j, 'k', T)).toThrow();
    j = recevoirTout(j, T);
    expect(j.pierres.parfaite).toBe(2);
    expect(cadeaux(j, T).map((c) => c.id)).toEqual(['e']);
    j = recevoirEnergie(j, T);
    expect(energie(j, T)).toBe(40);
    expect(cadeaux(j, T)).toHaveLength(0);
  });

  it('un monstre attend s\'il n\'y a plus de place', () => {
    let j: Joueur = { ...nouveauJoueur(), places: 4 };
    j = envoyer(j, 'm', 'Monstre', { monstre: 'piou_rouge' }, T);
    expect(refusCadeau(j, cadeaux(j, T)[0])).toBe('places');
    expect(() => recevoir(j, 'm', T)).toThrow();
    expect(cadeaux(recevoirTout(j, T), T)).toHaveLength(1);
    j = { ...j, places: 5 };
    j = recevoir(j, 'm', T);
    expect(j.monstres).toHaveLength(5);
  });

  it('monstre gagné en combat avec la collection pleine : il part à la Réception', () => {
    const j = { ...nouveauJoueur(), places: 4 };
    const s = stage('astrub-3');
    const b = { ...tirerButin(j, s, 1), monstre: 'scarafeuille_vert' };
    const r = appliquerVictoire(j, s, b, T).joueur;
    expect(r.monstres).toHaveLength(4);
    expect(cadeaux(r, T).some((c) => c.contenu.monstre === 'scarafeuille_vert')).toBe(true);
  });

  it('cadeaux de mise à jour une seule fois, codes une seule fois, sauvegarde', () => {
    let j = distribuer(nouveauJoueur(), T);
    const n = cadeaux(j, T).length;
    expect(n).toBeGreaterThan(0);
    j = distribuer(recevoirTout(j, T), T);
    expect(cadeaux(j, T).length).toBe(0);
    expect(utiliserCode(j, 'pas-un-code', T).erreur).toBe('inconnu');
    const r = utiliserCode(j, ' douze01 ', T);
    expect(r.cadeau).toBeDefined();
    expect(utiliserCode(r.joueur, 'DOUZE01', T).erreur).toBe('deja');
    j = marquerVus(r.joueur, T);
    const lu = lireSauvegarde(JSON.parse(JSON.stringify(j)))!;
    expect(cadeaux(lu, T)).toEqual(cadeaux(j, T));
    expect(lu.cadeauxDonnes).toEqual(j.cadeauxDonnes);
  });
});
