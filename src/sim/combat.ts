import { REGLES } from './regles';
import { Rng } from './rng';
import {
  avantage, estBonus,
  type Element, type ModeCombat, type MonstreCombat, type Sort, type Stats, type TypeEffet,
} from './types';

export type Camp = 'A' | 'B';

export interface Effet {
  type: TypeEffet;
  tours: number;
  /** Bouclier : PV restants. Poison : nombre de piles. */
  valeur: number;
  /** Numéro du tour global où l'effet a été posé (il ne décompte pas à la fin de ce tour-là s'il est sur l'acteur). */
  pose: number;
}

export interface Unite {
  uid: number;
  camp: Camp;
  /** Place dans l'équipe (0 = leader). */
  place: number;
  monstre: MonstreCombat;
  element: Element;
  /** Stats avec le skill de leader appliqué. */
  stats: Stats;
  pv: number;
  jauge: number;
  vivant: boolean;
  effets: Effet[];
  /** Tours restants avant de pouvoir relancer chaque sort. */
  recharges: number[];
}

/** Ce qui se passe pendant le combat, dans l'ordre : l'affichage s'en sert pour animer. */
export type Evenement =
  | { type: 'tour'; uid: number; tour: number }
  | { type: 'passe'; uid: number; raison: 'etourdi' }
  | { type: 'sort'; uid: number; sort: number; cibles: number[] }
  | { type: 'degats'; uid: number; source: number | null; montant: number; absorbe: number; critique: boolean; ecrasant: boolean; effleure: boolean; poison?: boolean }
  | { type: 'soin'; uid: number; montant: number }
  | { type: 'effet'; uid: number; effet: TypeEffet; tours: number }
  | { type: 'resiste'; uid: number; effet: TypeEffet | 'jauge' }
  | { type: 'fin_effet'; uid: number; effet: TypeEffet }
  | { type: 'jauge'; uid: number; avant: number; apres: number }
  | { type: 'ko'; uid: number }
  | { type: 'fin'; vainqueur: Camp | null };

export interface OptionsCombat {
  equipeA: MonstreCombat[];
  equipeB: MonstreCombat[];
  graine: number;
  mode: ModeCombat;
}

/**
 * Combat au tour par tour façon Summoners War. Déterministe : même graine + mêmes choix = même combat.
 * Utilisation : `prochainTour()` désigne l'acteur, puis `jouer(sort, cible)` (ou `jouerIA()`), jusqu'à `fini`.
 */
export class Combat {
  readonly unites: Unite[];
  readonly mode: ModeCombat;
  readonly rng: Rng;
  /** Unité dont c'est le tour (null entre deux tours). */
  acteur: Unite | null = null;
  tour = 0;
  vainqueur: Camp | null = null;
  fini = false;
  private evenements: Evenement[] = [];
  private journal: Evenement[] = [];

  constructor(o: OptionsCombat) {
    this.mode = o.mode;
    this.rng = new Rng(o.graine);
    let uid = 0;
    const creer = (camp: Camp, equipe: MonstreCombat[]) => {
      const lead = equipe[0]?.leader;
      return equipe.map((m, place): Unite => {
        const stats = { ...m.stats };
        if (lead && (lead.zone === 'general' || lead.zone === o.mode || lead.zone === m.element)) {
          const k = lead.stat;
          stats[k] = ['tc', 'pre', 'res', 'dc'].includes(k) ? stats[k] + lead.valeur : Math.round(stats[k] * (1 + lead.valeur / 100));
        }
        return {
          uid: uid++, camp, place, monstre: m, element: m.element, stats, pv: stats.pv,
          jauge: 0, vivant: true, effets: [], recharges: m.sorts.map(() => 0),
        };
      });
    };
    this.unites = [...creer('A', o.equipeA), ...creer('B', o.equipeB)];
  }

  // ───────────── lecture ─────────────

  /** Événements depuis le dernier appel (pour l'affichage). */
  drainEvenements(): Evenement[] {
    const e = this.evenements;
    this.evenements = [];
    return e;
  }

  /** Tous les événements du combat (pour comparer deux combats). */
  get historique(): readonly Evenement[] {
    return this.journal;
  }

  unite(uid: number): Unite {
    return this.unites[uid];
  }

  vivants(camp: Camp): Unite[] {
    return this.unites.filter((u) => u.camp === camp && u.vivant);
  }

  a(u: Unite, t: TypeEffet): boolean {
    return u.effets.some((e) => e.type === t);
  }

  /** Vitesse en combat (bonus et lenteur compris). */
  vitesse(u: Unite): number {
    return u.stats.vit * (1 + (this.a(u, 'vit_hausse') ? REGLES.vitHausse : 0) - (this.a(u, 'lenteur') ? REGLES.lenteur : 0));
  }

  /** Sorts que l'acteur peut lancer maintenant (indices). */
  sortsDisponibles(u: Unite = this.acteur!): number[] {
    return u.monstre.sorts.map((s, i) => (!s.passif && u.recharges[i] === 0 ? i : -1)).filter((i) => i >= 0);
  }

  /** Cibles valides d'un sort (vide pour un sort sans choix de cible). */
  ciblesValides(sort: Sort, u: Unite = this.acteur!): Unite[] {
    if (sort.cible === 'ennemi') return this.vivants(adverse(u.camp));
    if (sort.cible === 'allie') return this.vivants(u.camp);
    return [];
  }

  // ───────────── déroulement ─────────────

  /** Fait avancer les jauges jusqu'au prochain acteur et commence son tour. Renvoie l'acteur, ou null si le combat est fini. */
  prochainTour(): Unite | null {
    while (!this.fini) {
      if (this.verifierFin()) return null;
      if (this.tour >= REGLES.toursMax) {
        this.terminer(null);
        return null;
      }
      const vivants = this.unites.filter((u) => u.vivant);
      while (!vivants.some((u) => u.jauge >= 100)) for (const u of vivants) u.jauge += this.vitesse(u) * REGLES.jaugeParVitesse;
      // Le plus haut joue ; égalité : le plus rapide, puis l'ordre des unités (déterministe)
      const u = vivants.reduce((m, x) => (x.jauge > m.jauge || (x.jauge === m.jauge && this.vitesse(x) > this.vitesse(m)) ? x : m));
      u.jauge = 0;
      this.tour++;
      this.acteur = u;
      this.emettre({ type: 'tour', uid: u.uid, tour: this.tour });
      u.recharges = u.recharges.map((r) => Math.max(0, r - 1));

      // Dégâts continus au début du tour
      const p = u.effets.find((e) => e.type === 'poison');
      if (p) {
        const montant = Math.round(u.stats.pv * REGLES.poisonParPile * p.valeur);
        this.infliger(u, montant, null, { critique: false, ecrasant: false, effleure: false, poison: true });
        if (!u.vivant) {
          this.finirTour(u);
          continue;
        }
      }
      if (this.a(u, 'etourdi')) {
        this.emettre({ type: 'passe', uid: u.uid, raison: 'etourdi' });
        this.finirTour(u);
        continue;
      }
      return u;
    }
    return null;
  }

  /** L'acteur lance un sort. `cible` est obligatoire pour les sorts « ennemi » et « allie ». */
  jouer(indexSort: number, cible?: number): void {
    const u = this.acteur;
    if (!u || this.fini) throw new Error('Aucun tour en cours');
    if (!this.sortsDisponibles(u).includes(indexSort)) throw new Error(`Sort ${indexSort} indisponible`);
    const sort = u.monstre.sorts[indexSort];
    const valides = this.ciblesValides(sort, u);
    let cibles: Unite[];
    if (sort.cible === 'ennemi' || sort.cible === 'allie') {
      const c = valides.find((x) => x.uid === cible);
      if (!c) throw new Error(`Cible ${cible} invalide pour ${sort.nom}`);
      cibles = [c];
    } else if (sort.cible === 'ennemis') cibles = this.vivants(adverse(u.camp));
    else if (sort.cible === 'allies') cibles = this.vivants(u.camp);
    else cibles = [u];

    u.recharges[indexSort] = sort.recharge;
    this.emettre({ type: 'sort', uid: u.uid, sort: indexSort, cibles: cibles.map((c) => c.uid) });
    this.lancer(u, sort, cibles);
    this.finirTour(u);
  }

  /** Joue le combat jusqu'au bout, les deux camps à l'IA. */
  simuler(choisir: (c: Combat) => { sort: number; cible?: number }): Camp | null {
    while (this.prochainTour()) {
      const { sort, cible } = choisir(this);
      this.jouer(sort, cible);
    }
    return this.vainqueur;
  }

  // ───────────── résolution d'un sort ─────────────

  private lancer(u: Unite, sort: Sort, cibles: Unite[]) {
    const offensif = sort.cible === 'ennemi' || sort.cible === 'ennemis';
    for (const c of cibles) {
      let dernierEffleure = false;
      if (sort.mult) {
        for (let n = 0; n < (sort.coups ?? 1); n++) {
          if (!c.vivant) break;
          const coup = this.frapper(u, c, sort);
          dernierEffleure = coup.effleure;
          if (c.vivant) for (const e of sort.effets ?? []) if (e.parCoup) this.tenterEffet(u, c, e, coup.effleure);
        }
      }
      if (!c.vivant) continue;
      if (sort.soin) this.soigner(c, Math.round(c.stats.pv * sort.soin));
      if (sort.nettoie) this.retirer(c, (t) => !estBonus(t));
      if (sort.bouclier) this.poser(c, 'bouclier', sort.bouclier.tours, Math.round(u.stats.pv * sort.bouclier.part));
      for (const e of sort.effets ?? []) {
        if (e.parCoup) continue;
        if ((e.sur ?? 'cible') === 'cible') this.tenterEffet(u, c, e, offensif && dernierEffleure);
      }
      if (sort.jauge?.cible && c.vivant) {
        const { valeur, chance } = sort.jauge.cible;
        if (valeur >= 0) this.changerJauge(c, valeur);
        else if (!dernierEffleure && this.rng.chance(chance)) {
          if (this.resiste(u, c)) this.emettre({ type: 'resiste', uid: c.uid, effet: 'jauge' });
          else this.changerJauge(c, valeur);
        }
      }
    }
    // Effets sur le lanceur ou toute son équipe : une seule fois par sort
    for (const e of sort.effets ?? []) {
      if (e.sur === 'soi') this.tenterEffet(u, u, e, false);
      if (e.sur === 'allies') for (const a of this.vivants(u.camp)) this.tenterEffet(u, a, e, false);
    }
    if (sort.jauge?.soi) this.changerJauge(u, sort.jauge.soi);
    if (sort.jauge?.allies) for (const a of this.vivants(u.camp)) if (a !== u) this.changerJauge(a, sort.jauge.allies);
  }

  /** Un coup : critique, écrasant ou effleuré selon l'élément, puis dégâts réduits par la défense. */
  private frapper(u: Unite, c: Unite, sort: Sort) {
    const av = avantage(u.element, c.element);
    const atq = u.stats.atq * (1 + (this.a(u, 'atq_hausse') ? REGLES.atqHausse : 0) - (this.a(u, 'atq_baisse') ? REGLES.atqBaisse : 0));
    const stat = { atq, def: u.stats.def, pv: u.stats.pv, vit: this.vitesse(u) };
    let brut = 0;
    for (const [k, coef] of Object.entries(sort.mult ?? {})) brut += stat[k as keyof typeof stat] * (coef ?? 0);

    const effleure = av < 0 && this.rng.chance(REGLES.effleureChance);
    const tc = u.stats.tc + (this.a(u, 'tc_hausse') ? REGLES.tcHausse : 0) + (av > 0 ? REGLES.tcAvantage : 0);
    const critique = !effleure && this.rng.chance(Math.min(100, tc));
    const ecrasant = !effleure && !critique && av > 0 && this.rng.chance(REGLES.ecrasantChance);

    if (critique) brut *= 1 + u.stats.dc / 100;
    if (ecrasant) brut *= 1 + REGLES.ecrasantBonus;
    if (effleure) brut *= 1 - REGLES.effleureMalus;

    const def = c.stats.def * (1 + (this.a(c, 'def_hausse') ? REGLES.defHausse : 0) - (this.a(c, 'def_baisse') ? REGLES.defBaisse : 0));
    const montant = Math.max(1, Math.round((brut * REGLES.defA) / (REGLES.defB + REGLES.defC * def)));
    this.infliger(c, montant, u.uid, { critique, ecrasant, effleure });
    return { montant, critique, ecrasant, effleure };
  }

  private infliger(c: Unite, montant: number, source: number | null, f: { critique: boolean; ecrasant: boolean; effleure: boolean; poison?: boolean }) {
    let absorbe = 0;
    const b = c.effets.find((e) => e.type === 'bouclier');
    if (b && !f.poison) {
      absorbe = Math.min(b.valeur, montant);
      b.valeur -= absorbe;
      if (b.valeur <= 0) this.retirer(c, (t) => t === 'bouclier');
    }
    c.pv = Math.max(0, c.pv - (montant - absorbe));
    this.emettre({ type: 'degats', uid: c.uid, source, montant: montant - absorbe, absorbe, ...f });
    if (c.pv === 0) {
      c.vivant = false;
      c.effets = [];
      c.jauge = 0;
      this.emettre({ type: 'ko', uid: c.uid });
    }
  }

  private soigner(c: Unite, montant: number) {
    const reel = Math.min(montant, c.stats.pv - c.pv);
    c.pv += reel;
    this.emettre({ type: 'soin', uid: c.uid, montant: reel });
  }

  /** Bonus : toujours posé. Malus : chance d'activation, puis résistance ; jamais sur un coup effleuré ni sous immunité. */
  private tenterEffet(u: Unite, c: Unite, e: { type: TypeEffet; chance: number; tours: number }, effleure: boolean) {
    if (!c.vivant) return;
    if (estBonus(e.type)) {
      if (this.rng.chance(e.chance)) this.poser(c, e.type, e.tours, 0);
      return;
    }
    if (effleure || this.a(c, 'immunite')) return;
    if (!this.rng.chance(e.chance)) return;
    if (this.resiste(u, c)) {
      this.emettre({ type: 'resiste', uid: c.uid, effet: e.type });
      return;
    }
    this.poser(c, e.type, e.tours, 0);
  }

  /** ✓ Chance de résister : max(15 %, Résistance − Précision). */
  private resiste(u: Unite, c: Unite): boolean {
    return this.rng.chance(Math.max(REGLES.resistanceMin, c.stats.res - u.stats.pre));
  }

  private poser(c: Unite, type: TypeEffet, tours: number, valeur: number) {
    const ex = c.effets.find((e) => e.type === type);
    if (type === 'poison') {
      // Les dégâts continus s'empilent (une pile par pose)
      if (ex) {
        ex.valeur = Math.min(REGLES.poisonPilesMax, ex.valeur + 1);
        ex.tours = Math.max(ex.tours, tours);
        ex.pose = this.tour;
      } else c.effets.push({ type, tours, valeur: 1, pose: this.tour });
    } else if (ex) {
      ex.tours = Math.max(ex.tours, tours);
      ex.valeur = Math.max(ex.valeur, valeur);
      ex.pose = this.tour;
    } else c.effets.push({ type, tours, valeur, pose: this.tour });
    this.emettre({ type: 'effet', uid: c.uid, effet: type, tours });
  }

  private retirer(c: Unite, filtre: (t: TypeEffet) => boolean) {
    for (const e of c.effets.filter((x) => filtre(x.type))) this.emettre({ type: 'fin_effet', uid: c.uid, effet: e.type });
    c.effets = c.effets.filter((x) => !filtre(x.type));
  }

  private changerJauge(c: Unite, delta: number) {
    const avant = c.jauge;
    c.jauge = Math.max(0, c.jauge + delta);
    this.emettre({ type: 'jauge', uid: c.uid, avant, apres: c.jauge });
  }

  /** Fin de tour : les effets de l'acteur perdent un tour (sauf ceux posés pendant ce tour-ci). */
  private finirTour(u: Unite) {
    for (const e of u.effets) if (e.pose !== this.tour) e.tours--;
    this.retirer(u, (t) => u.effets.some((e) => e.type === t && e.tours <= 0));
    this.acteur = null;
    this.verifierFin();
  }

  private verifierFin(): boolean {
    if (this.fini) return true;
    const a = this.vivants('A').length, b = this.vivants('B').length;
    if (a && b) return false;
    this.terminer(a ? 'A' : b ? 'B' : null);
    return true;
  }

  private terminer(v: Camp | null) {
    this.fini = true;
    this.vainqueur = v;
    this.acteur = null;
    this.emettre({ type: 'fin', vainqueur: v });
  }

  private emettre(e: Evenement) {
    this.evenements.push(e);
    this.journal.push(e);
  }
}

export const adverse = (c: Camp): Camp => (c === 'A' ? 'B' : 'A');
