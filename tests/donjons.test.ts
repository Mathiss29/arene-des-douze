import { describe, expect, it } from 'vitest';
import { Combat } from '../src/sim/combat';
import { choisirAction } from '../src/sim/ia';
import { monstreCombat } from '../src/sim/fiches';
import { lireSauvegarde, nouveauJoueur, type Joueur } from '../src/sim/joueur';
import { CHANCES, DONJONS, NIVEAUX, cleDonjon, donjonOuvert, niveauOuvert, vaguesDonjon } from '../src/sim/donjons';
import { appliquerVictoire, stage, tirerButin, vaguesEnnemies, ZONES } from '../src/sim/stages';
import { bassin } from '../src/sim/invocation';

const bouftous = DONJONS.find((d) => d.id === 'bouftous')!;
const astrubFini = (j: Joueur): Joueur => ({ ...j, stagesFinis: [...ZONES[0].stages] });

describe('donjons (comme Cairos)', () => {
  it('trois donjons ; les Bouftous s\'ouvrent avec Astrub fini en Normal, niveau par niveau', () => {
    expect(DONJONS.map((d) => d.id)).toEqual(['bouftous', 'dragon_cochon', 'cimetiere']);
    let j = nouveauJoueur();
    expect(donjonOuvert(j, bouftous)).toBe(false);
    j = astrubFini(j);
    expect(donjonOuvert(j, bouftous)).toBe(true);
    expect(niveauOuvert(j, bouftous, 1)).toBe(true);
    expect(niveauOuvert(j, bouftous, 2)).toBe(false);
    j = { ...j, stagesFinis: [...j.stagesFinis, cleDonjon('bouftous', 1)] };
    expect(niveauOuvert(j, bouftous, 2)).toBe(true);
    expect(donjonOuvert(j, DONJONS[1])).toBe(false); // Madrestam pas encore là
  });

  it('niveaux : coûts et étoiles du boss de SW, 3 vagues, le boss seul à la fin', () => {
    expect(NIVEAUX.map((n) => n.cout)).toEqual([5, 5, 6, 6, 7, 7, 7, 8, 8, 8]);
    for (let n = 1; n <= 10; n++) {
      const s = stage(cleDonjon('bouftous', n));
      expect(s.vagues).toHaveLength(3);
      expect(s.vagues[2]).toEqual([expect.objectContaining({ id: 'bouftou_royal', etoiles: NIVEAUX[n - 1].etoiles, niveau: NIVEAUX[n - 1].niveau })]);
      expect(s.cout).toBe(NIVEAUX[n - 1].cout);
    }
    const { vaguesSuivantes } = vaguesEnnemies(stage(cleDonjon('bouftous', 10)));
    expect(vaguesSuivantes[1][0].stats.pv).toBeGreaterThan(monstreCombat('bouftou_royal', 5, 65).stats.pv * 1.5);
    expect(vaguesDonjon(bouftous, 1)[0]).toHaveLength(3);
  });

  it('le Bouftou Royal n\'est jamais invoqué au Cercle', () => {
    expect(bassin('parfaite', 4).some((m) => m.id === 'bouftou_royal')).toBe(false);
  });

  it('le boss appelle des renforts quand il a de la place', () => {
    let vu = false;
    for (let g = 0; g < 20 && !vu; g++) {
      const c = new Combat({ equipeA: [monstreCombat('dragoss_argile', 6, 40)], equipeB: [monstreCombat('bouftou_royal', 4, 30)], graine: g, mode: 'donjon' });
      c.simuler((x) => choisirAction(x));
      vu = c.historique.some((e) => e.type === 'invocation');
      if (vu) expect(c.unites.filter((u) => u.camp === 'B').length).toBe(3);
    }
    expect(vu).toBe(true);
  });

  it('butin : runes des sets du donjon, peu de pierres, symbole ; premier passage', () => {
    const j = astrubFini(nouveauJoueur());
    const s = stage(cleDonjon('bouftous', 8));
    const butins = Array.from({ length: 2000 }, (_, g) => tirerButin(j, s, g).donjon!);
    const runes = butins.filter((b) => b.rune);
    expect(runes.length / 2000).toBeGreaterThan(0.7);
    expect(runes.every((b) => bouftous.sets.includes(b.rune!.set) && b.rune!.etoiles >= 5 && (b.rune!.grade ?? 0) >= 2)).toBe(true);
    expect(butins.filter((b) => b.pierresAme).length / 2000).toBeLessThan(CHANCES.pierreAme / 100 + 0.03);
    expect(butins.filter((b) => b.parfaites).length / 2000).toBeLessThan(0.01);
    expect(butins.every((b) => b.premiere?.parfaite === 1)).toBe(true);
    const b = tirerButin(j, s, 1);
    const r = appliquerVictoire(j, s, b, 0).joueur;
    expect(r.stagesFinis).toContain(cleDonjon('bouftous', 8));
    expect(r.pierres.parfaite).toBeGreaterThanOrEqual(1);
    expect(tirerButin(r, s, 1).donjon!.premiere).toBeUndefined();
    const lu = lireSauvegarde(JSON.parse(JSON.stringify({ ...r, symboles: { [bouftous.symbole]: 2 } })))!;
    expect(lu.symboles).toEqual({ [bouftous.symbole]: 2 });
  });
});
