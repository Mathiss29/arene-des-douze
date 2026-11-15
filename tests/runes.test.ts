import { describe, expect, it } from 'vitest';
import { Combat } from '../src/sim/combat';
import { choisirAction } from '../src/sim/ia';
import { monstreCombat } from '../src/sim/fiches';
import { lireSauvegarde, nourrir, nouveauJoueur, type Joueur } from '../src/sim/joueur';
import { Rng } from '../src/sim/rng';
import { avecRunes, bonusRunes, creerRune, monter, PRINCIPALES, setsActifs, valeurPrincipale, type Rune, type SetRune } from '../src/sim/runes';
import {
  ameliorer, appliquerPrereglage, coutEquiper, donnerRune, enregistrerPrereglage, equiper, retirerRune, retraitGratuit, runesDe,
  selection, vendreRunes, visite,
} from '../src/sim/inventaire';
import { equipeJoueur } from '../src/sim/stages';

const JOUR = 86_400_000, T = 1_000 * JOUR;
const rune = (p: Partial<Rune> & { set: SetRune; emplacement: Rune['emplacement'] }, uid = 1): Rune =>
  ({ uid, etoiles: 6, grade: 0, niveau: 0, principale: PRINCIPALES[p.emplacement][0], sous: [], ...p });

describe('runes (fidèles à SW)', () => {
  it('stat principale : départ, gain par niveau, valeur à +15', () => {
    expect(valeurPrincipale({ principale: 'atq', etoiles: 6, niveau: 0 })).toBe(11);
    expect(valeurPrincipale({ principale: 'atq', etoiles: 6, niveau: 15 })).toBe(63);
    expect(valeurPrincipale({ principale: 'vit', etoiles: 6, niveau: 15 })).toBe(42);
    expect(valeurPrincipale({ principale: 'pv_fixe', etoiles: 5, niveau: 15 })).toBe(2088);
  });

  it('création : emplacement, stat principale permise, sous-stats selon le grade, jamais la même que la principale', () => {
    for (let g = 0; g < 300; g++) {
      const r = creerRune(1, { etoiles: 5 }, new Rng(g));
      expect(PRINCIPALES[r.emplacement]).toContain(r.principale);
      expect(r.sous).toHaveLength(r.grade);
      expect(r.sous.some((s) => s.stat === r.principale)).toBe(false);
      expect(new Set(r.sous.map((s) => s.stat)).size).toBe(r.sous.length);
    }
  });

  it('montée sans échec : sous-stats à +3/+6/+9/+12, 4 au plus', () => {
    const r = creerRune(1, { etoiles: 6, grade: 2, emplacement: 2 }, new Rng(4));
    const m = monter(r, 15, new Rng(5));
    expect(m.rune.niveau).toBe(15);
    expect(m.rune.sous).toHaveLength(4);
    expect(m.paliers.map((p) => p.niveau)).toEqual([3, 6, 9, 12]);
    expect(m.paliers.filter((p) => p.nouvelle)).toHaveLength(2);
    expect(m.rune.sous.reduce((s, x) => s + x.montees, 0)).toBe(2);
  });

  it('sets : 2 ou 4 pièces, bonus en % de la base', () => {
    const l = [rune({ set: 'sram', emplacement: 1 }, 1), rune({ set: 'sram', emplacement: 2 }, 2), rune({ set: 'sram', emplacement: 3 }, 3), rune({ set: 'sram', emplacement: 4 }, 4),
      rune({ set: 'enutrof', emplacement: 5 }, 5), rune({ set: 'enutrof', emplacement: 6 }, 6)];
    expect(setsActifs(l)).toEqual({ sram: 1, enutrof: 1 });
    expect(setsActifs(l.slice(0, 3))).toEqual({});
    const base = { pv: 10000, atq: 1000, def: 500, vit: 100, tc: 15, dc: 50, pre: 0, res: 15 };
    const b = bonusRunes(base, l);
    // stat principale par défaut : ATQ fixe en 1, 2, 4 et 6 (22 à 6★ +0), PV fixe en 5 (360) ; Fatal +35 %, Énergie +15 % de la base
    expect(b.atq).toBe(22 * 4 + 350);
    expect(b.pv).toBe(360 + 1500);
    expect(b.def).toBe(22);
  });

  it('combat : un monstre runé est plus fort, et le combat reste déterministe', () => {
    const l = [1, 2, 3, 4, 5, 6].map((e, i) => creerRune(i + 1, { etoiles: 6, grade: 4, set: e <= 4 ? 'sram' : 'enutrof', emplacement: e as Rune['emplacement'] }, new Rng(e)))
      .map((r) => monter(r, 15, new Rng(r.uid)).rune);
    const m = avecRunes(monstreCombat('piou_vert'), l);
    expect(m.stats.atq).toBeGreaterThan(monstreCombat('piou_vert').stats.atq * 1.5);
    const jouer = (g: number) => {
      const c = new Combat({ equipeA: [m], equipeB: [monstreCombat('piou_rouge')], graine: g, mode: 'histoire' });
      c.simuler((x) => choisirAction(x));
      return c.historique;
    };
    expect(jouer(3)).toEqual(jouer(3));
  });

  it('sets de combat : Violent fait rejouer, Vampire soigne, Vengeance contre-attaque, Bouclier protège', () => {
    const set = (s: SetRune, n: 2 | 4) => [1, 2, 3, 4, 5, 6].slice(0, n).map((e, i) => rune({ set: s, emplacement: e as Rune['emplacement'] }, i + 1));
    const types = new Set<string>();
    for (let g = 0; g < 40; g++) {
      const a = [avecRunes(monstreCombat('piou_vert'), set('ecaflip', 4)), avecRunes(monstreCombat('piou_bleu'), set('eniripsa', 4)), avecRunes(monstreCombat('piou_rouge'), set('feca', 2))];
      const b = [avecRunes(monstreCombat('kwak_de_flamme'), set('sacrieur', 2)), avecRunes(monstreCombat('piou_rouge'), set('sacrieur', 2))];
      const c = new Combat({ equipeA: a, equipeB: b, graine: g, mode: 'histoire' });
      c.simuler((x) => choisirAction(x));
      for (const e of c.historique) {
        types.add(e.type);
        if (e.type === 'soin' && c.unite(e.uid).camp === 'A' && c.unite(e.uid).monstre.sets?.eniripsa) types.add('vampire');
        if (e.type === 'effet' && e.effet === 'bouclier') types.add('bouclier');
      }
    }
    expect(types).toContain('rejoue');
    expect(types).toContain('contre');
    expect(types).toContain('vampire');
    expect(types).toContain('bouclier');
  });
});

describe('runes du joueur', () => {
  const avecRune = (j: Joueur, e: Rune['emplacement'], g = 1) => donnerRune(j, { etoiles: 4, emplacement: e, set: 'iop' }, g);

  it('retrait payant, gratuit pour un joueur nouveau ou de retour', () => {
    let j = visite(nouveauJoueur(), T);
    expect(retraitGratuit(j, T + 10 * JOUR)).toBe(true);
    expect(retraitGratuit(j, T + 40 * JOUR)).toBe(false);
    j = visite(j, T + 40 * JOUR);
    expect(retraitGratuit(j, T + 41 * JOUR)).toBe(true); // de retour après 40 jours d'absence
    j = visite(j, T + 45 * JOUR);
    expect(retraitGratuit(j, T + 80 * JOUR)).toBe(false);
  });

  it('équiper, remplacer (payant), retirer, runes des monstres sacrifiés', () => {
    let j: Joueur = { ...nouveauJoueur(), kamas: 100_000, cree: 0 };
    const a = avecRune(j, 2, 1); j = a.joueur;
    const b = avecRune(j, 2, 2); j = b.joueur;
    const uid = j.monstres[0].uid;
    j = equiper(j, a.rune.uid, uid, T);
    expect(runesDe(j, uid).map((r) => r.uid)).toEqual([a.rune.uid]);
    expect(coutEquiper(j, b.rune.uid, uid, T)).toBe(10_000);
    j = equiper(j, b.rune.uid, uid, T);
    expect(j.kamas).toBe(90_000);
    expect(runesDe(j, uid).map((r) => r.uid)).toEqual([b.rune.uid]);
    expect(equipeJoueur({ ...j, equipe: [uid] })[0].stats.vit).toBeGreaterThanOrEqual(equipeJoueur({ ...nouveauJoueur(), equipe: [uid] })[0].stats.vit);
    j = retirerRune(j, b.rune.uid, T);
    expect(j.kamas).toBe(80_000);
    // une rune sur un monstre sacrifié revient dans l'inventaire
    j = equiper(j, a.rune.uid, j.monstres[3].uid, T);
    j = nourrir(j, uid, [j.monstres[3].uid], new Rng(1)).joueur;
    expect(j.runes!.find((r) => r.uid === a.rune.uid)!.porteur).toBeUndefined();
  });

  it('monter, vendre, vente sélective, préréglages, sauvegarde', () => {
    let j: Joueur = { ...nouveauJoueur(), kamas: 1_000_000, cree: T };
    for (let e = 1; e <= 6; e++) j = donnerRune(j, { etoiles: 3, emplacement: e as Rune['emplacement'], grade: 0 }, e).joueur;
    const r = j.runes![0];
    const m = ameliorer(j, r.uid, 15, 9);
    expect(m.rune.niveau).toBe(15);
    expect(m.paliers).toHaveLength(4);
    expect(m.joueur.kamas).toBe(1_000_000 - m.cout);
    j = m.joueur;
    const uid = j.monstres[0].uid;
    for (const x of j.runes!.slice(0, 3)) j = equiper(j, x.uid, uid, T);
    j = enregistrerPrereglage(j, uid, 0, 'Vitesse');
    for (const x of runesDe(j, uid)) j = retirerRune(j, x.uid, T);
    j = appliquerPrereglage(j, uid, 0, T);
    expect(runesDe(j, uid)).toHaveLength(3);
    const sel = selection(j, 3, 4);
    expect(sel).toHaveLength(3); // les 3 runes non portées et jamais montées
    const v = vendreRunes(j, sel);
    expect(v.kamas).toBeGreaterThan(0);
    expect(() => vendreRunes(j, [runesDe(j, uid)[0].uid])).toThrow();
    const lu = lireSauvegarde(JSON.parse(JSON.stringify(v.joueur)))!;
    expect(lu.runes).toEqual(v.joueur.runes);
    expect(lu.prereglages).toEqual(v.joueur.prereglages);
  });
});
