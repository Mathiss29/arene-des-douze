import { describe, expect, it } from 'vitest';
import { NIVEAU_MAX, XP_NIVEAU, ajouterXp, partStats, statsAuNiveau, type Etoiles } from '../src/sim/progression';
import { ajouterMonstre, definirEquipe, donnerXp, equipePourStage, evoluer, lireSauvegarde, nouveauJoueur, monstre, peutEvoluer, trierMonstres } from '../src/sim/joueur';
import { appliquerVictoire, equipeEnnemie, equipeJoueur, LISTE_STAGES, stage, tirerButin } from '../src/sim/stages';
import { Combat } from '../src/sim/combat';
import { choisirAction } from '../src/sim/ia';

const ETOILES: Etoiles[] = [1, 2, 3, 4, 5, 6];

describe('niveaux et XP (table de SW)', () => {
  it('niveau max 15 / 20 / 25 / 30 / 35 / 40', () => {
    expect(ETOILES.map((e) => NIVEAU_MAX[e])).toEqual([15, 20, 25, 30, 35, 40]);
    for (const e of ETOILES) expect(XP_NIVEAU[e].length).toBe(NIVEAU_MAX[e] - 1);
  });

  it('totaux de la table : 15 120 XP (1★), 35 822 (2★), 82 182 (3★)', () => {
    const total = (e: Etoiles) => XP_NIVEAU[e].reduce((a, b) => a + b, 0);
    expect(total(1)).toBe(15120);
    expect(total(2)).toBe(35822);
    expect(total(3)).toBe(82182);
  });

  it('l\'XP fait monter de plusieurs niveaux, et l\'excédent est perdu au niveau max', () => {
    expect(ajouterXp(1, 1, 0, 460)).toEqual({ niveau: 2, xp: 0 });
    expect(ajouterXp(1, 1, 0, 1000)).toEqual({ niveau: 3, xp: 24 });
    expect(ajouterXp(1, 14, 0, 99999)).toEqual({ niveau: 15, xp: 0 });
  });
});

describe('stats', () => {
  it('grandissent avec le niveau, baissent un peu après évolution, et 6★ 40 = stats de la fiche', () => {
    for (const e of ETOILES) expect(partStats(e, NIVEAU_MAX[e])).toBeGreaterThan(partStats(e, 1));
    for (const e of [2, 3, 4, 5, 6] as Etoiles[]) {
      const avant = partStats((e - 1) as Etoiles, NIVEAU_MAX[(e - 1) as Etoiles]);
      expect(partStats(e, 1)).toBeLessThan(avant);
      expect(partStats(e, NIVEAU_MAX[e])).toBeGreaterThan(avant);
    }
    const s = { pv: 10000, atq: 800, def: 600, vit: 101, tc: 15, dc: 50, pre: 0, res: 15 };
    expect(statsAuNiveau(s, 6, 40)).toEqual(s);
    expect(statsAuNiveau(s, 1, 1).vit).toBe(101);
  });
});

describe('joueur', () => {
  it('commence avec 4 monstres niveau 1 en équipe', () => {
    const j = nouveauJoueur();
    expect(j.monstres).toHaveLength(4);
    expect(j.equipe).toHaveLength(4);
    expect(j.monstres.every((m) => m.niveau === 1)).toBe(true);
  });

  it('équipe : 1 à 4 monstres, sans doublon', () => {
    const j = nouveauJoueur();
    expect(definirEquipe(j, [2, 1]).equipe).toEqual([2, 1]);
    expect(() => definirEquipe(j, [1, 1])).toThrow();
    expect(() => definirEquipe(j, [])).toThrow();
    expect(() => definirEquipe(j, [1, 2, 3, 4, 1])).toThrow();
  });

  it('évolution : niveau max, autant de nourriture que d\'étoiles, kamas ; repart niveau 1', () => {
    let j = nouveauJoueur(); // Piou Vert uid 1, 1★
    expect(() => evoluer(j, 1, [3])).toThrow(/niveau 15/);
    j = donnerXp(j, [1], 99999).joueur;
    expect(() => evoluer(j, 1, [2])).toThrow(/1★/); // uid 2 = Kwak 3★
    expect(() => evoluer(j, 1, [3, 4])).toThrow(/1 monstre/);
    const apres = evoluer(j, 1, [3]);
    expect(monstre(apres, 1)).toMatchObject({ etoiles: 2, niveau: 1, xp: 0 });
    expect(apres.monstres.some((m) => m.uid === 3)).toBe(false);
    expect(apres.equipe).not.toContain(3);
    expect(apres.kamas).toBe(j.kamas - 1600);
  });

  it('retient l\'équipe de chaque stage, sans les monstres disparus', () => {
    let j = nouveauJoueur();
    expect(equipePourStage(j, 'astrub-1')).toEqual([1, 2, 3, 4]);
    j = definirEquipe(j, [3, 1], 'astrub-1');
    j = definirEquipe(j, [2], 'astrub-2');
    expect(equipePourStage(j, 'astrub-1')).toEqual([3, 1]);
    j = evoluer(donnerXp(j, [1], 99999).joueur, 1, [3]);
    expect(equipePourStage(j, 'astrub-1')).toEqual([1]);
    expect(equipePourStage(lireSauvegarde(JSON.parse(JSON.stringify(j)))!, 'astrub-2')).toEqual([2]);
  });

  it('repère les monstres prêts à évoluer', () => {
    let j = nouveauJoueur();
    expect(peutEvoluer(j, 1)).toBe(false);
    j = donnerXp(j, [1], 99999).joueur;
    expect(peutEvoluer(j, 1)).toBe(true); // Pious 1★ en nourriture, 5000 kamas
    expect(peutEvoluer({ ...j, kamas: 100 }, 1)).toBe(false);
  });

  it('trie la collection par étoiles, niveau ou élément', () => {
    const j = donnerXp(nouveauJoueur(), [3], 2000).joueur;
    expect(trierMonstres(j.monstres, 'etoiles')[0].id).toBe('kwak_de_flamme');
    expect(trierMonstres(j.monstres, 'niveau')[0].id).toBe('piou_bleu');
    expect(trierMonstres(j.monstres, 'element').map((m) => m.id)).toEqual(['kwak_de_flamme', 'piou_rouge', 'piou_vert', 'piou_bleu']);
  });

  it('ajoute un monstre avec un nouvel identifiant', () => {
    const { joueur, uid } = ajouterMonstre(nouveauJoueur(), 'scarafeuille_bleu');
    expect(uid).toBe(5);
    expect(monstre(joueur, 5)).toMatchObject({ id: 'scarafeuille_bleu', etoiles: 3, niveau: 1 });
  });

  it('une sauvegarde se relit à l\'identique, une sauvegarde abîmée est refusée ou réparée', () => {
    const j = donnerXp(nouveauJoueur(), [1, 2], 3000).joueur;
    expect(lireSauvegarde(JSON.parse(JSON.stringify(j)))).toEqual(j);
    expect(lireSauvegarde(null)).toBeNull();
    expect(lireSauvegarde({ version: 99 })).toBeNull();
    const abimee = { ...j, monstres: [...j.monstres, { uid: 50, id: 'inconnu', etoiles: 1, niveau: 1, xp: 0 }], equipe: [50, 1] };
    const r = lireSauvegarde(abimee)!;
    expect(r.monstres).toHaveLength(4);
    expect(r.equipe).toEqual([1]);
  });
});

describe('stages et butin', () => {
  it('chaque stage a des ennemis valides', () => {
    for (const s of LISTE_STAGES) expect(equipeEnnemie(s).length).toBeGreaterThan(0);
  });

  it('le butin est déterministe ; la première victoire donne une pierre d\'âme', () => {
    const j = nouveauJoueur(), s = stage('astrub-1');
    expect(tirerButin(j, s, 42)).toEqual(tirerButin(j, s, 42));
    const b = tirerButin(j, s, 42);
    expect(b.premiere).toBe(true);
    expect(b.pierresAme).toBeGreaterThanOrEqual(1);
    const { joueur, niveaux } = appliquerVictoire(j, s, b);
    expect(joueur.stagesFinis).toContain('astrub-1');
    expect(joueur.kamas).toBe(j.kamas + b.kamas);
    expect(Object.keys(niveaux)).toHaveLength(4);
    expect(tirerButin(joueur, s, 42).premiere).toBe(false);
  });

  it('le premier stage se gagne avec l\'équipe de départ (au moins 3 fois sur 4 en auto)', () => {
    const j = nouveauJoueur(), s = stage('astrub-1');
    let victoires = 0;
    for (let g = 0; g < 100; g++) {
      const c = new Combat({ equipeA: equipeJoueur(j), equipeB: equipeEnnemie(s), graine: g, mode: 'histoire' });
      if (c.simuler(choisirAction) === 'A') victoires++;
    }
    expect(victoires).toBeGreaterThanOrEqual(75);
  });
});
