import { describe, expect, it } from 'vitest';
import { Combat, type Evenement } from '../src/sim/combat';
import { choisirAction } from '../src/sim/ia';
import { REGLES } from '../src/sim/regles';
import type { Element, MonstreCombat, Sort, Stats } from '../src/sim/types';

// ───────────── fixtures ─────────────

const STATS: Stats = { pv: 9000, atq: 700, def: 550, vit: 100, tc: 15, dc: 50, pre: 0, res: 15 };
const FRAPPE: Sort = { id: 'frappe', nom: 'Frappe', recharge: 0, cible: 'ennemi', mult: { atq: 3.6 } };

function monstre(id: string, element: Element, stats: Partial<Stats> = {}, sorts: Sort[] = [FRAPPE], extra: Partial<MonstreCombat> = {}): MonstreCombat {
  return { id, nom: id, element, stats: { ...STATS, ...stats }, sorts, ...extra };
}

/** Équipe de 4 variée pour les combats complets. */
function equipe(prefixe: string): MonstreCombat[] {
  return [
    monstre(`${prefixe}_feu`, 'feu', { vit: 110, tc: 30 }, [FRAPPE, { id: 'zone', nom: 'Zone', recharge: 3, cible: 'ennemis', mult: { atq: 2.2 }, effets: [{ type: 'poison', chance: 40, tours: 2 }] }]),
    monstre(`${prefixe}_eau`, 'eau', { vit: 104, pre: 30 }, [FRAPPE, { id: 'gel', nom: 'Gel', recharge: 4, cible: 'ennemi', mult: { atq: 3.8 }, effets: [{ type: 'etourdi', chance: 60, tours: 1 }] }]),
    monstre(`${prefixe}_air`, 'air', { vit: 120 }, [FRAPPE, { id: 'envol', nom: 'Envol', recharge: 4, cible: 'allies', effets: [{ type: 'vit_hausse', chance: 100, tours: 2 }], jauge: { allies: 20 } }]),
    monstre(`${prefixe}_bonta`, 'bonta', { pv: 11000 }, [FRAPPE, { id: 'soin', nom: 'Soin', recharge: 3, cible: 'allies', soin: 0.2, nettoie: true }]),
  ];
}

/** Lance le sort `sort` de l'acteur sur la première cible valide. */
function jouerSur(c: Combat, sort = 0, cible?: number) {
  const u = c.acteur!;
  const s = u.monstre.sorts[sort];
  const valides = c.ciblesValides(s, u);
  c.jouer(sort, cible ?? valides[0]?.uid);
}

const degats = (h: readonly Evenement[]) => h.filter((e): e is Extract<Evenement, { type: 'degats' }> => e.type === 'degats' && !e.poison);

// ───────────── tests ─────────────

describe('déterminisme', () => {
  it('la même graine donne exactement le même combat 4 contre 4', () => {
    const jouer = () => {
      const c = new Combat({ equipeA: equipe('a'), equipeB: equipe('b'), graine: 1234, mode: 'arene' });
      c.simuler(choisirAction);
      return c;
    };
    const c1 = jouer(), c2 = jouer();
    expect(c1.fini).toBe(true);
    expect(c1.vainqueur).not.toBeNull();
    expect(c2.historique).toEqual(c1.historique);
  });

  it('une autre graine donne un autre combat', () => {
    const h = (graine: number) => {
      const c = new Combat({ equipeA: equipe('a'), equipeB: equipe('b'), graine, mode: 'arene' });
      c.simuler(choisirAction);
      return JSON.stringify(c.historique);
    };
    expect(h(1)).not.toBe(h(2));
  });
});

describe('jauge d\'attaque', () => {
  it('un monstre deux fois plus rapide joue deux fois plus souvent', () => {
    const c = new Combat({
      equipeA: [monstre('rapide', 'feu', { vit: 200, pv: 1e9 })],
      equipeB: [monstre('lent', 'feu', { vit: 100, pv: 1e9 })],
      graine: 1, mode: 'histoire',
    });
    const tours = { A: 0, B: 0 };
    for (let i = 0; i < 60; i++) {
      tours[c.prochainTour()!.camp]++;
      jouerSur(c);
    }
    // 2 tours pour 1 (à un tour près, selon où tombe le dépassement de jauge)
    expect(Math.abs(tours.A - 40)).toBeLessThanOrEqual(1);
    expect(Math.abs(tours.B - 20)).toBeLessThanOrEqual(1);
  });

  it('la jauge monte de 7 % de la vitesse par tick', () => {
    expect(REGLES.jaugeParVitesse).toBe(0.07);
  });
});

describe('dégâts', () => {
  it('suivent la formule de Summoners War (sans critique, éléments neutres)', () => {
    const c = new Combat({
      equipeA: [monstre('a', 'feu', { tc: 0, vit: 200 })],
      equipeB: [monstre('b', 'bonta')],
      graine: 5, mode: 'histoire',
    });
    c.prochainTour();
    jouerSur(c);
    const [d] = degats(c.historique);
    expect(d.montant).toBe(Math.round((700 * 3.6 * 1000) / (1140 + 3.5 * 550)));
    expect(d.critique || d.ecrasant || d.effleure).toBe(false);
  });

  it('l\'avantage d\'élément ajoute 15 % de critique (85 % + 15 % = toujours critique)', () => {
    for (let g = 0; g < 30; g++) {
      const c = new Combat({ equipeA: [monstre('feu', 'feu', { tc: 85, vit: 200 })], equipeB: [monstre('air', 'air')], graine: g, mode: 'histoire' });
      c.prochainTour();
      jouerSur(c);
      expect(degats(c.historique)[0].critique).toBe(true);
    }
  });

  it('un coup effleuré n\'est jamais critique et ne pose aucun malus', () => {
    let effleures = 0;
    for (let g = 0; g < 200; g++) {
      const sort: Sort = { ...FRAPPE, effets: [{ type: 'def_baisse', chance: 100, tours: 2 }] };
      const c = new Combat({ equipeA: [monstre('air', 'air', { tc: 100, pre: 100, vit: 200 }, [sort])], equipeB: [monstre('feu', 'feu', { res: 0 })], graine: g, mode: 'histoire' });
      c.prochainTour();
      jouerSur(c);
      const [d] = degats(c.historique);
      if (d.effleure) {
        effleures++;
        expect(d.critique).toBe(false);
        expect(c.historique.some((e) => e.type === 'effet')).toBe(false);
      }
    }
    expect(effleures).toBeGreaterThan(50);
  });

  it('défense réduite : la cible prend plus de dégâts', () => {
    const sorts: Sort[] = [FRAPPE, { id: 'casse', nom: 'Casse', recharge: 0, cible: 'ennemi', effets: [{ type: 'def_baisse', chance: 100, tours: 2 }] }];
    const c = new Combat({ equipeA: [monstre('a', 'feu', { tc: 0, pre: 100, vit: 300 }, sorts)], equipeB: [monstre('b', 'bonta', { res: 0, pv: 1e9 })], graine: 3, mode: 'histoire' });
    // Premier tour : on tente la casse jusqu'à ce qu'elle passe (15 % de résistance minimum)
    let posee = false;
    while (!posee) {
      c.prochainTour();
      if (c.acteur!.camp === 'B') { jouerSur(c); continue; }
      jouerSur(c, 1);
      posee = c.a(c.unite(1), 'def_baisse');
    }
    while (c.prochainTour()!.camp !== 'A') jouerSur(c);
    jouerSur(c, 0);
    const d = degats(c.historique).filter((x) => x.source === 0).at(-1)!;
    expect(d.montant).toBe(Math.round((700 * 3.6 * 1000) / (1140 + 3.5 * 550 * (1 - REGLES.defBaisse))));
  });
});

describe('malus et résistance', () => {
  it('résistance minimale de 15 % même avec 100 % de précision', () => {
    let resistes = 0;
    const n = 3000;
    for (let g = 0; g < n; g++) {
      const sort: Sort = { id: 'x', nom: 'x', recharge: 0, cible: 'ennemi', effets: [{ type: 'def_baisse', chance: 100, tours: 2 }] };
      const c = new Combat({ equipeA: [monstre('a', 'feu', { pre: 100, vit: 200 }, [sort])], equipeB: [monstre('b', 'bonta', { res: 0 })], graine: g, mode: 'histoire' });
      c.prochainTour();
      jouerSur(c);
      if (c.historique.some((e) => e.type === 'resiste')) resistes++;
    }
    expect(resistes / n).toBeGreaterThan(0.12);
    expect(resistes / n).toBeLessThan(0.18);
  });

  it('un monstre étourdi passe son prochain tour puis rejoue', () => {
    const etourdir: Sort = { ...FRAPPE, id: 'e', mult: { atq: 0.1 }, effets: [{ type: 'etourdi', chance: 100, tours: 1 }] };
    const petit: Sort = { ...FRAPPE, id: 'p', mult: { atq: 0.1 } };
    for (let g = 0; g < 20; g++) {
      const c = new Combat({ equipeA: [monstre('a', 'feu', { pre: 100, vit: 200 }, [etourdir, petit])], equipeB: [monstre('b', 'bonta', { res: 0 })], graine: g, mode: 'histoire' });
      c.prochainTour();
      jouerSur(c, 0);
      if (!c.a(c.unite(1), 'etourdi')) continue; // résisté : on essaie une autre graine
      const debut = c.historique.length;
      let toursB = 0;
      while (toursB < 2) {
        const u = c.prochainTour();
        toursB = c.historique.slice(debut).filter((e) => e.type === 'tour' && e.uid === 1).length;
        if (u && toursB < 2) jouerSur(c, u.camp === 'A' ? 1 : 0);
      }
      const h = c.historique.slice(debut);
      const iTours = h.flatMap((e, i) => (e.type === 'tour' && e.uid === 1 ? [i] : []));
      expect(h[iTours[0] + 1]).toEqual({ type: 'passe', uid: 1, raison: 'etourdi' });
      expect(h[iTours[1] + 1]?.type).not.toBe('passe');
      return;
    }
    throw new Error('étourdissement jamais posé');
  });

  it('les dégâts continus font 5 % des PV max par pile au début du tour', () => {
    const sort: Sort = { id: 'p', nom: 'p', recharge: 0, cible: 'ennemi', effets: [{ type: 'poison', chance: 100, tours: 2 }] };
    for (let g = 0; g < 20; g++) {
      const c = new Combat({ equipeA: [monstre('a', 'feu', { pre: 100, vit: 200 }, [sort])], equipeB: [monstre('b', 'bonta', { res: 0 })], graine: g, mode: 'histoire' });
      c.prochainTour();
      jouerSur(c);
      if (!c.a(c.unite(1), 'poison')) continue;
      while (c.prochainTour()!.camp === 'A') jouerSur(c);
      const d = c.historique.filter((e) => e.type === 'degats' && e.poison).at(-1) as Extract<Evenement, { type: 'degats' }>;
      expect(d.montant).toBe(Math.round(9000 * 0.05));
      return;
    }
    throw new Error('poison jamais posé');
  });
});

describe('sorts', () => {
  it('un sort à 3 tours de recharge revient au 3e tour suivant', () => {
    const sorts: Sort[] = [FRAPPE, { id: 'gros', nom: 'Gros', recharge: 3, cible: 'ennemi', mult: { atq: 1 } }];
    const c = new Combat({ equipeA: [monstre('a', 'feu', { vit: 300 }, sorts)], equipeB: [monstre('b', 'bonta', { pv: 1e9 })], graine: 1, mode: 'histoire' });
    const dispo: boolean[] = [];
    let lance = false;
    while (dispo.length < 4) {
      const u = c.prochainTour()!;
      if (u.camp === 'B') { jouerSur(c); continue; }
      if (!lance) { jouerSur(c, 1); lance = true; continue; }
      dispo.push(c.sortsDisponibles().includes(1));
      jouerSur(c, 0);
    }
    expect(dispo).toEqual([false, false, true, true]);
  });

  it('le soin rend des PV sans dépasser le maximum, et le nettoyage retire les malus', () => {
    const soin: Sort = { id: 's', nom: 'Soin', recharge: 0, cible: 'allies', soin: 0.3, nettoie: true };
    const c = new Combat({ equipeA: [monstre('a', 'eau', { vit: 300 }, [soin])], equipeB: [monstre('b', 'bonta')], graine: 1, mode: 'histoire' });
    const a = c.unite(0);
    a.pv = 5000;
    a.effets.push({ type: 'def_baisse', tours: 2, valeur: 0, pose: 0 });
    c.prochainTour();
    jouerSur(c);
    expect(a.pv).toBe(5000 + 2700);
    expect(c.a(a, 'def_baisse')).toBe(false);
  });

  it('le bouclier absorbe les dégâts avant les PV', () => {
    const c = new Combat({ equipeA: [monstre('a', 'feu', { tc: 0, vit: 300 })], equipeB: [monstre('b', 'bonta')], graine: 1, mode: 'histoire' });
    const b = c.unite(1);
    b.effets.push({ type: 'bouclier', tours: 2, valeur: 300, pose: 0 });
    c.prochainTour();
    jouerSur(c);
    const [d] = degats(c.historique);
    expect(d.absorbe).toBe(300);
    expect(b.pv).toBe(9000 - d.montant);
    expect(c.a(b, 'bouclier')).toBe(false);
  });
});

describe('skill de leader', () => {
  it('s\'applique à toute l\'équipe selon sa zone', () => {
    const lead = { stat: 'pv' as const, valeur: 33, zone: 'arene' as const };
    const equipeA = [monstre('lead', 'feu', {}, [FRAPPE], { leader: lead }), monstre('x', 'eau')];
    const arene = new Combat({ equipeA, equipeB: [monstre('b', 'air')], graine: 1, mode: 'arene' });
    const donjon = new Combat({ equipeA, equipeB: [monstre('b', 'air')], graine: 1, mode: 'donjon' });
    expect(arene.unite(1).stats.pv).toBe(Math.round(9000 * 1.33));
    expect(donjon.unite(1).stats.pv).toBe(9000);
  });

  it('un leader d\'élément ne concerne que cet élément', () => {
    const lead = { stat: 'atq' as const, valeur: 30, zone: 'feu' as const };
    const c = new Combat({ equipeA: [monstre('lead', 'feu', {}, [FRAPPE], { leader: lead }), monstre('x', 'eau')], equipeB: [monstre('b', 'air')], graine: 1, mode: 'histoire' });
    expect(c.unite(0).stats.atq).toBe(910);
    expect(c.unite(1).stats.atq).toBe(700);
  });
});

describe('IA', () => {
  it('vise l\'ennemi désigné par le joueur tant qu\'il est debout', () => {
    const c = new Combat({ equipeA: [monstre('a', 'feu', { vit: 300 })], equipeB: [monstre('b1', 'bonta'), monstre('b2', 'bonta')], graine: 1, mode: 'histoire' });
    c.prochainTour();
    c.unite(2).pv = 100;
    expect(choisirAction(c).cible).toBe(2); // sans consigne : le plus blessé
    expect(choisirAction(c, 1).cible).toBe(1);
  });
});

describe('fin de combat', () => {
  it('s\'arrête quand une équipe n\'a plus de monstre debout', () => {
    const c = new Combat({ equipeA: [monstre('a', 'feu', { atq: 5000, vit: 300 })], equipeB: [monstre('b', 'bonta', { pv: 100 })], graine: 1, mode: 'histoire' });
    expect(c.simuler(choisirAction)).toBe('A');
    expect(c.historique.at(-1)).toEqual({ type: 'fin', vainqueur: 'A' });
  });

  it('match nul au-delà du nombre de tours maximum', () => {
    const rien: Sort = { id: 'r', nom: 'Rien', recharge: 0, cible: 'soi' };
    const c = new Combat({ equipeA: [monstre('a', 'feu', {}, [rien])], equipeB: [monstre('b', 'bonta', {}, [rien])], graine: 1, mode: 'histoire' });
    expect(c.simuler(choisirAction)).toBeNull();
    expect(c.tour).toBe(REGLES.toursMax);
  });
});
