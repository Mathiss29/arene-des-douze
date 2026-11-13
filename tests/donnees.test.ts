import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import MONSTRES from '../src/data/monstres.json';
import { ELEMENTS, avantage, type FicheMonstre } from '../src/sim/types';
import { LOOKS } from '../src/render/looks';
import FICHES_COMBAT from '../src/data/fiches.json';
import { monstreCombat } from '../src/sim/fiches';
import { Combat } from '../src/sim/combat';
import { choisirAction } from '../src/sim/ia';

const FICHES = MONSTRES as FicheMonstre[];

/** Noms d'animations d'une planche (sans le numéro d'image). */
function animations(atlas: string): Set<string> {
  const d = JSON.parse(readFileSync(`public/assets/sprites/${atlas}.json`, 'utf8'));
  const frames: { filename: string }[] = d.textures ? d.textures.flatMap((t: { frames: { filename: string }[] }) => t.frames) : [];
  const noms = d.textures ? frames.map((f) => f.filename) : Object.keys(d.frames);
  return new Set(noms.map((n) => n.replace(/_\d+$/, '')));
}

describe('monstres de l\'alpha', () => {
  it('ont des identifiants uniques et des valeurs valides', () => {
    expect(new Set(FICHES.map((f) => f.id)).size).toBe(FICHES.length);
    for (const f of FICHES) {
      expect(ELEMENTS).toContain(f.element);
      expect(['attaque', 'defense', 'pv', 'soutien']).toContain(f.type);
      expect(f.etoiles).toBeGreaterThanOrEqual(1);
      expect(f.etoiles).toBeLessThanOrEqual(5);
      expect(f.nomEveil, `${f.id} sans nom éveillé`).toBeTruthy();
    }
    expect(new Set(FICHES.map((f) => f.nomEveil)).size).toBe(FICHES.length);
  });

  it.each(FICHES.map((f) => [f.id]))('%s a une planche avec repos, coup reçu, mort et ses attaques', (id) => {
    const look = LOOKS[id];
    expect(look, `pas de look pour ${id}`).toBeDefined();
    const a = animations(look.atlas);
    for (const n of ['AnimStatique_1', 'AnimHit_1', 'AnimMort_1']) expect(a.has(n), `${id} : ${n}`).toBe(true);
    for (const n of Object.keys(look.attaques)) expect(a.has(`AnimAttaque${n}_1`), `${id} : AnimAttaque${n}_1`).toBe(true);
  });
});

describe('éléments (fidèles à Summoners War)', () => {
  it('Feu > Air > Eau > Feu', () => {
    expect(avantage('feu', 'air')).toBe(1);
    expect(avantage('air', 'eau')).toBe(1);
    expect(avantage('eau', 'feu')).toBe(1);
    expect(avantage('air', 'feu')).toBe(-1);
  });

  it('Bonta et Brâkmar sont forts l\'un contre l\'autre et neutres face aux autres', () => {
    expect(avantage('bonta', 'brakmar')).toBe(1);
    expect(avantage('brakmar', 'bonta')).toBe(1);
    expect(avantage('bonta', 'feu')).toBe(0);
    expect(avantage('eau', 'brakmar')).toBe(0);
  });
});

describe('fiches de combat', () => {
  it('comme SW : PV/15 + Attaque + Défense (6★ niv. 40) ne dépend que des étoiles naturelles', () => {
    const budget: Record<number, number> = { 1: 1482, 2: 1647, 3: 1812, 4: 1977, 5: 2142 };
    for (const m of MONSTRES as FicheMonstre[]) {
      const s = (FICHES_COMBAT as Record<string, { stats: { pv: number; atq: number; def: number } }>)[m.id].stats;
      expect(Math.abs(s.pv / 15 + s.atq + s.def - budget[m.etoiles]), m.id).toBeLessThanOrEqual(2);
    }
  });

  it('chaque monstre de l\'alpha a sa fiche, et rien de plus', () => {
    expect(Object.keys(FICHES_COMBAT).sort()).toEqual(FICHES.map((f) => f.id).sort());
  });

  it.each(FICHES.map((f) => [f.id]))('%s : sorts valides, icônes et animations présentes', (id) => {
    const m = monstreCombat(id);
    const look = LOOKS[id];
    const anims = animations(look.atlas);
    expect(m.sorts.length).toBeGreaterThanOrEqual(2);
    expect(m.sorts[0].recharge).toBe(0);
    m.sorts.forEach((s, i) => {
      expect(s.desc, `${id}/${s.id} sans description`).toBeTruthy();
      expect(existsSync(`public/assets/ui/sorts/sort_${s.icone}.png`), `${id}/${s.id} : icône ${s.icone}`).toBe(true);
      const num = look.animSorts[i];
      expect(num, `${id} : pas d'animation pour le sort ${i}`).toBeDefined();
      expect(anims.has(`AnimAttaque${num}_1`), `${id} : AnimAttaque${num}_1`).toBe(true);
    });
  });

  it('le combat d\'essai se joue jusqu\'au bout, à l\'identique avec la même graine', () => {
    const jouer = () => {
      const c = new Combat({
        equipeA: ['scarafeuille_blanc', 'kwak_de_flamme', 'scarafeuille_bleu', 'piou_vert'].map((id) => monstreCombat(id)),
        equipeB: ['kwak_de_vent', 'scarafeuille_noir', 'scarafeuille_rouge', 'piou_rouge'].map((id) => monstreCombat(id)),
        graine: 77, mode: 'histoire',
      });
      c.simuler(choisirAction);
      return c;
    };
    const a = jouer(), b = jouer();
    expect(a.vainqueur).not.toBeNull();
    expect(b.historique).toEqual(a.historique);
  });
});
