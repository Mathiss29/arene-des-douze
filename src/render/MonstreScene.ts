import Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import { monstre, type Joueur } from '../sim/joueur';
import { fiche, monstreCombat } from '../sim/fiches';
import {
  GRADES, LISTE_SETS, NOM_STAT_RUNE, SETS, avecRunes, coutMontee, prixVente, setsActifs, valeurPrincipale, type Rune, type SetRune, type StatRune,
} from '../sim/runes';
import {
  PREREGLAGES_MAX, ameliorer, appliquerPrereglage, coutEquiper, coutPrereglage, coutRetrait, enregistrerPrereglage, equiper, prereglages,
  retirerRune, retraitGratuit, runes, runesDe, selection, vendreRunes,
} from '../sim/inventaire';
import { noterMission } from '../sim/missions';
import type { Stats } from '../sim/types';
import { LOOKS } from './looks';
import { creerAnimations } from './animations';
import { COULEUR, H, OR, POLICE, W, bouton, chargerUi, fmt, monstreEnPied, panneau, texte } from './ui';
import { COULEUR_GRADE, VERT, bandeauPierre, chargerIdentite, decorVivant, etoiles, runeMedaillon } from './identite';

/**
 * Écran des runes d'un monstre (planche n° 8 : 1A 2A+C 3B 4A 5A, sur la maquette « Runes : » 1A 5C 6A 7B 8C).
 * À gauche : la roue des 6 places autour du monstre, les sets, les stats, les préréglages.
 * Au milieu : l'inventaire en grille, tous les filtres visibles (place, set, libres ou portées, étoiles, grade, stat principale), trié par étoiles puis grade.
 * À droite : la fiche de la rune touchée, comparée d'office à la rune portée à la même place.
 */
const hexa = (c: number) => '#' + c.toString(16).padStart(6, '0');
const CX = 191, CY = 222, R = 106;
const POS = [0, 1, 2, 3, 4, 5].map((i) => ({ x: CX + Math.sin((i * Math.PI) / 3) * R, y: CY - Math.cos((i * Math.PI) / 3) * R }));
type Tri = 'etoiles' | 'niveau' | 'recent';
const NOM_TRI: Record<Tri, string> = { etoiles: 'étoiles', niveau: 'niveau', recent: 'récentes' };
const STATS_PRINCIPALES: StatRune[] = ['atq', 'atq_fixe', 'pv', 'pv_fixe', 'def', 'def_fixe', 'vit', 'tc', 'dc', 'res', 'pre'];
const NOM_COURT: Record<keyof Stats, string> = { pv: 'PV', atq: 'ATQ', def: 'DEF', vit: 'VIT', tc: 'Tx crit.', dc: 'Dég. crit.', res: 'Résist.', pre: 'Précision' };
const POURCENT = new Set<keyof Stats>(['tc', 'dc', 'res', 'pre']);
const COLS = 6, LIGNES = 4;
const STAT_COURTE: Record<StatRune, string> = { atq: 'ATQ%', atq_fixe: 'ATQ', pv: 'PV%', pv_fixe: 'PV', def: 'DEF%', def_fixe: 'DEF', vit: 'VIT', tc: 'Crit', dc: 'Dég', res: 'Rés', pre: 'Préc' };
/** « ATQ +9 % » plutôt que « ATQ % +9 ». */
const libStat = (s: StatRune, v: number) => { const n = NOM_STAT_RUNE[s]; return n.endsWith(' %') ? `${n.slice(0, -2)} +${v} %` : `${n} +${v}`; };

export class MonstreScene extends Phaser.Scene {
  private joueur!: Joueur;
  private uid = 0;
  private retour: { scene: string; data?: object } = { scene: 'cercle' };
  private choisie: number | null = null;
  private page = 0;
  private occupe = false;
  private vente: { etoiles: number; grade: number } | null = null;
  private tri: Tri = 'etoiles';
  private f: { place: number | null; set: SetRune | null; porte: 'toutes' | 'libres' | 'portees'; etoiles: number; grade: number; principale: StatRune | null } = { place: null, set: null, porte: 'toutes', etoiles: 1, grade: 0, principale: null };
  /** Sélection multiple pour la vente (null : mode normal). */
  private coche: Set<number> | null = null;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;

  constructor() { super('monstre'); }

  init(data: { uid: number; retour?: { scene: string; data?: object } }) {
    this.joueur = charger();
    this.uid = data.uid ?? this.joueur.monstres[0].uid;
    this.retour = data.retour ?? { scene: 'cercle' };
    this.choisie = null; this.page = 0; this.occupe = false; this.vente = null; this.coche = null; this.calque = [];
    this.tri = 'etoiles'; this.f = { place: null, set: null, porte: 'toutes', etoiles: 1, grade: 0, principale: null };
  }

  preload() {
    chargerUi(this, [monstre(this.joueur, this.uid).id]);
    chargerIdentite(this);
  }

  create() {
    const m = monstre(this.joueur, this.uid), f = fiche(m.id);
    creerAnimations(this, LOOKS[m.id].atlas);
    decorVivant(this, CX).teinter(COULEUR[f.element]);
    bandeauPierre(this, 'Retour', () => !this.occupe && this.scene.start(this.retour.scene, this.retour.data));
    texte(this, W / 2, 25, `Runes · ${f.nom}`, 20, '#eef2e4', true, 0.5, 0.5).setDepth(2001);
    const g = this.add.graphics().setDepth(8);
    g.lineStyle(5, 0x0b0d0a, 0.9).strokeCircle(CX, CY, R).lineStyle(1.5, VERT, 0.45).strokeCircle(CX, CY, R).fillStyle(0x0b0d0a, 0.5).fillCircle(CX, CY, 58).lineStyle(1.5, 0x6f7862).strokeCircle(CX, CY, 58);
    const sp = monstreEnPied(this, m.id, CX, CY + 44, 1).setDepth(10);
    const k = Math.min(96 / (sp.frame.cutHeight * Math.abs(sp.scaleY)), 1.2 / Math.abs(sp.scaleY));
    sp.setScale(sp.scaleX * k, sp.scaleY * k);
    this.dessiner();
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }
  private gs(l: Phaser.GameObjects.GameObject[]) { for (const o of l) this.calque.push(o); }

  private faire(f: (j: Joueur) => Joueur) {
    try { this.joueur = f(this.joueur); sauver(this.joueur); } catch (e) { this.message((e as Error).message); }
    this.dessiner();
  }

  /** Puce de filtre : verte quand elle est choisie. `icone` : symbole de set à la place du texte. */
  private puce(x: number, y: number, w: number, h: number, lib: string, on: boolean, action: () => void, profondeur = 1001, icone?: string) {
    const gr = this.g(this.add.graphics().setDepth(profondeur));
    gr.fillStyle(on ? VERT : 0x161b13).fillRoundedRect(x, y - h / 2, w, h, 7).lineStyle(1.5, on ? 0xf0ff9a : 0x4a5a3c).strokeRoundedRect(x, y - h / 2, w, h, 7);
    if (icone && this.textures.exists('symboles')) this.g(this.add.image(x + w / 2, y, 'symboles', icone).setDisplaySize(h - 6, h - 6).setDepth(profondeur + 1));
    else this.g(this.add.text(x + w / 2, y, lib, { fontFamily: POLICE, fontSize: '13px', fontStyle: '600', color: on ? '#1c2408' : '#c9d6bf' }).setOrigin(0.5).setDepth(profondeur + 1));
    this.g(this.add.zone(x, y - h / 2, w, h).setOrigin(0).setDepth(profondeur + 2).setInteractive({ useHandCursor: true })).on('pointerdown', () => { if (!this.occupe) action(); });
  }

  private liste(): Rune[] {
    const f = this.f;
    const l = runes(this.joueur).filter((r) => r.porteur !== this.uid && (f.place === null || r.emplacement === f.place) && (!f.set || r.set === f.set)
      && (f.porte === 'toutes' || (r.porteur === undefined) === (f.porte === 'libres')) && r.etoiles >= f.etoiles && r.grade >= f.grade && (!f.principale || r.principale === f.principale));
    if (this.tri === 'etoiles') l.sort((a, b) => b.etoiles - a.etoiles || b.grade - a.grade || b.niveau - a.niveau || b.uid - a.uid);
    else if (this.tri === 'niveau') l.sort((a, b) => b.niveau - a.niveau || b.etoiles - a.etoiles || b.grade - a.grade || b.uid - a.uid);
    else l.sort((a, b) => b.uid - a.uid);
    return l;
  }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur, m = monstre(j, this.uid), portees = runesDe(j, this.uid), now = Date.now();
    this.g(texte(this, W - 18, 25, `${fmt(j.kamas)} kamas`, 15, '#ffe08a', true, 1, 0.5).setDepth(2001));

    // la roue : toucher une place filtre l'inventaire sur cette place
    POS.forEach((p, i) => {
      const e = i + 1, r = portees.find((x) => x.emplacement === e), sel = this.f.place === e;
      this.gs(runeMedaillon(this, r ?? null, p.x, p.y, 74, { choisie: sel, numero: e, profondeur: 20 }));
      this.g(this.add.zone(p.x, p.y, 72, 72).setDepth(40).setInteractive({ useHandCursor: true })).on('pointerdown', () => {
        if (this.occupe || this.coche) return;
        this.f.place = sel ? null : e; this.page = 0; this.choisie = r ? r.uid : null; this.dessiner();
      });
    });

    // sets et stats
    this.g(panneau(this, 18, 372, 346, 244));
    const sets = Object.keys(setsActifs(portees)) as SetRune[];
    this.g(texte(this, 38, 398, sets.length ? sets.map((s) => SETS[s].nom).join(' · ') : portees.length ? 'Aucun set complet' : 'Aucune rune', 14, sets.length ? OR : '#93a89b', true, 0, 0.5));
    this.g(texte(this, 38, 412, sets.map((s) => `${SETS[s].nom} : ${SETS[s].effet}`).join('\n') || 'Deux ou quatre runes du même set donnent un bonus.', 11, '#dfe8d6', false, 0, 0).setWordWrapWidth(306));
    const base = monstreCombat(m.id, m.etoiles, m.niveau), avec = avecRunes(base, portees);
    (['pv', 'atq', 'def', 'vit', 'tc', 'dc', 'res', 'pre'] as (keyof Stats)[]).forEach((k, i) => {
      const x = 38 + (i % 2) * 156, y = 500 + Math.floor(i / 2) * 25, plus = Math.round(avec.stats[k] - base.stats[k]);
      if (Math.floor(i / 2) % 2 === 0 && i % 2 === 0) this.g(this.add.rectangle(30, y, 322, 24, 0x000000, 0.45).setOrigin(0, 0.5).setDepth(1000));
      this.g(texte(this, x, y, NOM_COURT[k], 13, '#dfe8d6', false, 0, 0.5));
      this.g(texte(this, x + 96, y, `${fmt(Math.round(base.stats[k]))}${POURCENT.has(k) ? ' %' : ''}`, 13, '#ffffff', true, 1, 0.5));
      if (plus) this.g(texte(this, x + 146, y, `+${fmt(plus)}`, 12, '#7fd05a', true, 1, 0.5));
    });

    // préréglages
    this.g(texte(this, 22, 648, 'Préréglages', 12, '#93a89b', true, 0, 0.5));
    const pre = prereglages(j, this.uid);
    for (let i = 0; i < PREREGLAGES_MAX; i++) {
      const p = pre[i], x = 150 + i * 84;
      const b = bouton(this, x, 648, 78, 34, p ? `Mettre ${i + 1}` : `Vide ${i + 1}`, false, () => {
        if (!p) return this.message('Préréglage vide : touche « Garder » pour y enregistrer les runes portées.');
        const c = coutPrereglage(this.joueur, this.uid, i, Date.now());
        this.faire((k) => appliquerPrereglage(k, this.uid, i, Date.now()));
        if (c) this.message(`Préréglage ${i + 1} remis : ${fmt(c)} kamas de retraits.`);
      });
      b.t.setFontSize(12); if (!p) b.fond.setAlpha(0.6); this.g(b.fond); this.g(b.t);
      const s = this.g(texte(this, x, 682, 'Garder', 11, '#c6f02e', true, 0.5, 0.5));
      s.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.faire((k) => enregistrerPrereglage(k, this.uid, i, `Préréglage ${i + 1}`)); this.message(`Runes portées gardées dans le préréglage ${i + 1}.`); });
    }

    this.inventaire();
    // fiche de la rune touchée
    this.g(panneau(this, 954, 62, 310, 644));
    const r = this.choisie !== null ? runes(j).find((x) => x.uid === this.choisie) : undefined;
    if (!r) this.g(texte(this, 1109, 360, 'Touche une place de la roue\nou une rune de l\'inventaire.', 14, '#93a89b', false, 0.5, 0.5).setAlign('center'));
    else this.carte(r, portees, now);
    if (this.vente) this.fenetreVente();
  }

  private inventaire() {
    const j = this.joueur, f = this.f, X = 380, L = 562, gx = X + 24;
    const liste = this.liste(), parPage = COLS * LIGNES, pages = Math.max(1, Math.ceil(liste.length / parPage));
    this.page = Math.min(this.page, pages - 1);
    this.g(panneau(this, X, 62, L, 644));
    const filtrer = (action: () => void) => () => { action(); this.page = 0; this.dessiner(); };
    // place
    this.puce(gx, 100, 62, 30, 'Toutes', f.place === null, filtrer(() => { f.place = null; }));
    for (let e = 1; e <= 6; e++) this.puce(gx + 68 + (e - 1) * 40, 100, 34, 30, String(e), f.place === e, filtrer(() => { f.place = f.place === e ? null : e; }));
    // set, par symbole
    this.puce(gx, 138, 46, 30, 'Tous', f.set === null, filtrer(() => { f.set = null; }));
    LISTE_SETS.forEach((s, i) => this.puce(gx + 51 + i * 31, 138, 28, 30, '', f.set === s, filtrer(() => { f.set = f.set === s ? null : s; }), 1001, s));
    this.puce(gx + 420, 100, 94, 30, `Tri : ${NOM_TRI[this.tri]}`, false, () => { this.tri = this.tri === 'etoiles' ? 'niveau' : this.tri === 'niveau' ? 'recent' : 'etoiles'; this.page = 0; this.dessiner(); });
    // tous les filtres restent visibles (planche n° 8, 2A+C) : libres ou portées, étoiles, grade, puis la stat principale
    let x = gx;
    const suite = (w: number, lib: string, on: boolean, action: () => void) => { this.puce(x, 176, w, 30, lib, on, filtrer(action)); x += w + 5; };
    suite(56, 'Libres', f.porte === 'libres', () => { f.porte = f.porte === 'libres' ? 'toutes' : 'libres'; });
    suite(64, 'Portées', f.porte === 'portees', () => { f.porte = f.porte === 'portees' ? 'toutes' : 'portees'; });
    x += 5;
    for (const e of [4, 5, 6]) suite(44, `${e}★ +`, f.etoiles === e, () => { f.etoiles = f.etoiles === e ? 1 : e; });
    x += 5;
    ([[1, 'Mag. +'], [2, 'Rare +'], [3, 'Hér. +'], [4, 'Lég.']] as const).forEach(([g, lib]) => suite(54, lib, f.grade === g, () => { f.grade = f.grade === g ? 0 : g; }));
    this.puce(gx, 214, 54, 30, 'Toutes', f.principale === null, filtrer(() => { f.principale = null; }));
    STATS_PRINCIPALES.forEach((st, i) => this.puce(gx + 59 + i * 41.5, 214, 37.5, 30, STAT_COURTE[st], f.principale === st, filtrer(() => { f.principale = f.principale === st ? null : st; })));
    const resume = [`${liste.length} rune${liste.length > 1 ? 's' : ''}`, f.place ? `place ${f.place}` : '', f.set ? SETS[f.set].nom : '', f.porte === 'libres' ? 'libres' : f.porte === 'portees' ? 'portées par un autre monstre' : '',
      f.etoiles > 1 ? `${f.etoiles}★ et plus` : '', f.grade ? `${GRADES[f.grade]} et plus` : '', f.principale ? NOM_STAT_RUNE[f.principale] : ''].filter(Boolean).join(' · ');
    this.g(texte(this, gx, 244, resume, 12, '#93a89b', false, 0, 0.5));
    if (!liste.length) this.g(texte(this, X + L / 2, 430, runes(j).length ? 'Aucune rune ne correspond à ces filtres.' : 'Aucune rune pour l\'instant. Elles tombent dans les zones,\nles coffres des missions et les donjons.', 13, '#93a89b', false, 0.5, 0.5).setAlign('center'));
    liste.slice(this.page * parPage, (this.page + 1) * parPage).forEach((r, k) => {
      const x = gx + 43 + (k % COLS) * 86, y = 288 + Math.floor(k / COLS) * 95;
      const coche = this.coche?.has(r.uid) ?? false;
      this.gs(runeMedaillon(this, r, x, y, 62, { choisie: this.coche ? coche : this.choisie === r.uid, profondeur: 1000 }));
      this.g(texte(this, x, y + 38, libStat(r.principale, valeurPrincipale(r)), 10.5, '#dfe8d6', false, 0.5, 0.5));
      this.g(texte(this, x, y + 51, r.porteur !== undefined ? `sur ${fiche(monstre(j, r.porteur).id).nom}`.slice(0, 16) : SETS[r.set].nom, 9.5, r.porteur !== undefined ? '#d9a35a' : '#93a89b', false, 0.5, 0.5));
      if (coche) this.g(texte(this, x - 24, y - 24, '✔', 16, '#d8ff5a', true, 0.5, 0.5).setDepth(1012));
      this.g(this.add.zone(x, y + 6, 82, 100).setDepth(1015).setInteractive({ useHandCursor: true })).on('pointerdown', () => {
        if (this.occupe) return;
        if (this.coche) {
          if (r.porteur !== undefined) return this.message('Une rune portée ne se vend pas : retire-la d\'abord.');
          if (coche) this.coche.delete(r.uid); else this.coche.add(r.uid);
        } else this.choisie = r.uid;
        this.dessiner();
      });
    });
    // bas : vente et pages
    const yb = 672;
    if (this.coche) {
      const ids = [...this.coche], total = runes(j).filter((r) => this.coche!.has(r.uid)).reduce((s, r) => s + prixVente(r), 0);
      const v = bouton(this, gx + 120, yb, 240, 38, ids.length ? `Vendre ${ids.length} · ${fmt(total)} kamas` : 'Coche les runes à vendre', true, () => {
        if (!ids.length) return;
        const res = vendreRunes(this.joueur, ids);
        this.joueur = res.joueur; sauver(this.joueur); this.coche = null; this.choisie = null;
        this.message(`${ids.length} rune${ids.length > 1 ? 's' : ''} vendue${ids.length > 1 ? 's' : ''} : +${fmt(res.kamas)} kamas`); this.dessiner();
      });
      v.t.setFontSize(14); if (!ids.length) v.griser(); this.g(v.fond); this.g(v.t);
      const a = bouton(this, gx + 300, yb, 100, 38, 'Annuler', false, () => { this.coche = null; this.dessiner(); }); this.g(a.fond); this.g(a.t);
    } else {
      const a = bouton(this, gx + 82, yb, 164, 36, 'Sélection multiple', false, () => { this.coche = new Set(); this.choisie = null; this.dessiner(); }); a.t.setFontSize(13); this.g(a.fond); this.g(a.t);
      const b = bouton(this, gx + 244, yb, 148, 36, 'Vente sélective', false, () => { this.vente = { etoiles: 3, grade: 1 }; this.dessiner(); }); b.t.setFontSize(13); this.g(b.fond); this.g(b.t);
    }
    if (pages > 1) {
      this.g(texte(this, X + L - 96, yb, `${this.page + 1} / ${pages}`, 13, '#c9cfc4', false, 0.5, 0.5));
      if (this.page > 0) this.puce(X + L - 168, yb, 36, 30, '‹', false, () => { this.page--; this.dessiner(); });
      if (this.page < pages - 1) this.puce(X + L - 60, yb, 36, 30, '›', false, () => { this.page++; this.dessiner(); });
    }
  }

  private carte(r: Rune, portees: Rune[], now: number) {
    const j = this.joueur, c = COULEUR_GRADE[r.grade], X = 978, D = 1240;
    this.gs(runeMedaillon(this, r, X + 40, 122, 80, { profondeur: 1001 }));
    this.g(texte(this, X + 92, 100, `Rune ${SETS[r.set].nom} (${r.emplacement})`, 16, '#ffffff', true, 0, 0.5));
    this.g(texte(this, X + 92, 122, `${GRADES[r.grade]} · +${r.niveau}`, 12.5, hexa(c), true, 0, 0.5));
    this.gs(etoiles(this, X + 92, 142, r.etoiles, 13, 0, 1002));
    const porteur = r.porteur !== undefined ? monstre(j, r.porteur) : undefined;
    this.g(texte(this, X, 176, porteur ? (r.porteur === this.uid ? 'Portée par ce monstre' : `Portée par ${fiche(porteur.id).nom}`) : `${SETS[r.set].dieu} · libre`, 11.5, porteur && r.porteur !== this.uid ? '#d9a35a' : '#93a89b', false, 0, 0.5));
    this.g(texte(this, X, 204, libStat(r.principale, valeurPrincipale(r)), 18, '#ffffff', true, 0, 0.5));
    r.sous.forEach((s, i) => this.g(texte(this, X, 232 + i * 21, `${libStat(s.stat, s.valeur)}${s.montees ? `  ${'▲'.repeat(s.montees)}` : ''}`, 13.5, s.montees ? '#b8f5a0' : '#dfe8d6', false, 0, 0.5)));
    for (let i = r.sous.length; i < 4; i++) this.g(texte(this, X, 232 + i * 21, `— sous-stat à +${(i + 1) * 3}`, 12.5, '#5f6a5c', false, 0, 0.5));
    this.g(texte(this, X, 322, `${SETS[r.set].nom} (${SETS[r.set].pieces} runes) : ${SETS[r.set].effet}`, 11, '#93a89b', false, 0, 0).setWordWrapWidth(262));

    // comparaison d'office avec la rune portée à la même place
    if (r.porteur !== this.uid) {
      const m = monstre(j, this.uid), base = monstreCombat(m.id, m.etoiles, m.niveau), enPlace = portees.find((x) => x.emplacement === r.emplacement);
      const apres = [...portees.filter((x) => x.emplacement !== r.emplacement), r], a = avecRunes(base, portees).stats, b = avecRunes(base, apres).stats;
      this.g(this.add.rectangle(X - 4, 364, 270, 118, 0x000000, 0.5).setOrigin(0).setStrokeStyle(1.5, 0x4a5a3c).setDepth(1000));
      this.g(texte(this, X + 6, 378, enPlace ? `Par rapport à la rune portée (place ${r.emplacement})` : `Place ${r.emplacement} vide : ce que tu gagnes`, 11.5, '#93a89b', true, 0, 0.5));
      const ecarts = (Object.keys(NOM_COURT) as (keyof Stats)[]).map((k) => [k, Math.round(b[k] - a[k])] as const).filter(([, d]) => d);
      if (!ecarts.length) this.g(texte(this, X + 6, 400, 'Aucun écart de stats.', 12.5, '#dfe8d6', false, 0, 0.5));
      ecarts.slice(0, 6).forEach(([k, d], i) => {
        const x = X + 6 + (i % 2) * 130, y = 400 + Math.floor(i / 2) * 20;
        this.g(texte(this, x, y, NOM_COURT[k], 12.5, '#dfe8d6', false, 0, 0.5));
        this.g(texte(this, x + 118, y, `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}${POURCENT.has(k) ? ' %' : ''}`, 12.5, d > 0 ? '#7fd05a' : '#ff7a6a', true, 1, 0.5));
      });
      const sa = Object.keys(setsActifs(portees)) as SetRune[], sb = Object.keys(setsActifs(apres)) as SetRune[];
      const perdus = sa.filter((s) => !sb.includes(s)), gagnes = sb.filter((s) => !sa.includes(s));
      const lib = perdus.length || gagnes.length ? [...gagnes.map((s) => `+ ${SETS[s].nom}`), ...perdus.map((s) => `− ${SETS[s].nom}`)].join('   ') : 'Sets inchangés';
      this.g(texte(this, X + 6, 466, lib, 12, perdus.length ? '#ff7a6a' : gagnes.length ? '#7fd05a' : '#93a89b', true, 0, 0.5));
    }

    // actions
    let y = 514;
    if (r.porteur === this.uid) {
      const cr = coutRetrait(j, r, now);
      const b = bouton(this, 1109, y, 262, 42, cr ? `Retirer · ${fmt(cr)} kamas` : 'Retirer (gratuit)', false, () => {
        if (this.joueur.kamas < cr) return this.message(`Il te faut ${fmt(cr)} kamas pour retirer cette rune.`);
        this.faire((k) => retirerRune(k, r.uid, Date.now()));
      });
      this.g(b.fond); this.g(b.t);
    } else {
      const ce = coutEquiper(j, r.uid, this.uid, now);
      const b = bouton(this, 1109, y, 262, 42, ce ? `Équiper · ${fmt(ce)} kamas` : 'Équiper', true, () => {
        if (this.joueur.kamas < ce) return this.message(`Il te faut ${fmt(ce)} kamas pour retirer les runes en place.`);
        this.faire((k) => equiper(k, r.uid, this.uid, Date.now()));
      });
      b.t.setFontSize(ce ? 15 : 19); this.g(b.fond); this.g(b.t);
    }
    y += 48;
    if (r.niveau < 15) {
      const pal = Math.min(15, (Math.floor(r.niveau / 3) + 1) * 3), c1 = coutMontee(r, pal), c15 = coutMontee(r, 15);
      const large = pal >= 15;
      const b1 = bouton(this, large ? 1109 : 1043, y, large ? 262 : 128, 38, `+${pal} · ${fmt(c1)}`, false, () => this.monter(r, pal)); b1.t.setFontSize(13).setColor('#c6f02e'); this.g(b1.fond); this.g(b1.t);
      if (!large) { const b2 = bouton(this, 1176, y, 128, 38, `+15 · ${fmt(c15)}`, false, () => this.monter(r, 15)); b2.t.setFontSize(13).setColor('#c6f02e'); this.g(b2.fond); this.g(b2.t); }
      y += 44;
    }
    if (r.porteur === undefined) {
      const b = bouton(this, 1109, y, 262, 36, `Vendre · ${fmt(prixVente(r))} kamas`, false, () => {
        const res = vendreRunes(this.joueur, [r.uid]);
        this.joueur = res.joueur; sauver(this.joueur); this.choisie = null; this.message(`Rune vendue : +${fmt(res.kamas)} kamas`); this.dessiner();
      });
      b.t.setFontSize(13); this.g(b.fond); this.g(b.t);
    }
    if (retraitGratuit(j, now)) this.g(texte(this, 1109, 684, 'Retraits gratuits (nouveau ou de retour)', 11, '#7fd05a', false, 0.5, 0.5));
    void D;
  }

  /** Forgemagie (choix 5C) : la rune monte d'un coup, puis chaque palier qui ajoute ou monte une sous-stat s'affiche. */
  private monter(r: Rune, jusqua: number) {
    if (this.occupe) return;
    const cout = coutMontee(r, jusqua);
    if (this.joueur.kamas < cout) return this.message(`Il te faut ${fmt(cout)} kamas (tu en as ${fmt(this.joueur.kamas)}).`);
    let res;
    try { res = ameliorer(this.joueur, r.uid, jusqua, Date.now() & 0x7fffffff); } catch (e) { return this.message((e as Error).message); }
    this.joueur = noterMission(res.joueur, 'rune', 1, Date.now());
    sauver(this.joueur);
    this.choisie = r.uid;
    this.dessiner();
    if (!res.paliers.length) return;
    this.occupe = true;
    res.paliers.forEach((p, k) => this.time.delayedCall(250 + k * 650, () => {
      const y = 232 + p.sous * 21;
      const eclat = this.add.rectangle(1109, y, 270, 21, p.nouvelle ? 0xffd23a : 0x7fd05a, 0.45).setDepth(2000);
      const t = texte(this, 1236, y, `+${p.niveau} : ${p.nouvelle ? 'nouvelle !' : 'renforcée !'}`, 13, p.nouvelle ? '#ffe08a' : '#b8f5a0', true, 1, 0.5).setDepth(2001);
      this.cameras.main.flash(120, 255, 230, 160, false);
      this.tweens.add({ targets: [eclat, t], alpha: 0, delay: 450, duration: 400, onComplete: () => { eclat.destroy(); t.destroy(); } });
    }));
    this.time.delayedCall(250 + res.paliers.length * 650 + 200, () => { this.occupe = false; });
  }

  /** Vente sélective (choix 7B) : runes non portées et jamais montées, jusqu'à N étoiles et un grade. */
  private fenetreVente() {
    const v = this.vente!, j = this.joueur;
    const uids = selection(j, v.etoiles, v.grade);
    const total = runes(j).filter((r) => uids.includes(r.uid)).reduce((s, r) => s + prixVente(r), 0);
    this.g(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.55).setDepth(3000).setInteractive());
    this.g(panneau(this, 390, 200, 500, 300, 3001));
    this.g(texte(this, 640, 222, 'Vente sélective', 20, '#ffffff', true, 0.5, 0).setDepth(3002));
    this.g(texte(this, 640, 256, 'Runes non portées et jamais montées', 13, '#93a89b', false, 0.5, 0).setDepth(3002));
    const choix = (y: number, lib: string, moins: () => void, plus: () => void) => {
      this.g(texte(this, 640, y, lib, 16, '#ffffff', true, 0.5, 0.5).setDepth(3002));
      const a = bouton(this, 470, y, 44, 32, '−', false, () => { moins(); this.dessiner(); }, 3002); this.g(a.fond); this.g(a.t);
      const b = bouton(this, 810, y, 44, 32, '+', false, () => { plus(); this.dessiner(); }, 3002); this.g(b.fond); this.g(b.t);
    };
    choix(310, `Jusqu'à ${v.etoiles}★`, () => { v.etoiles = Math.max(1, v.etoiles - 1); }, () => { v.etoiles = Math.min(6, v.etoiles + 1); });
    choix(360, `Jusqu'au grade ${GRADES[v.grade]}`, () => { v.grade = Math.max(0, v.grade - 1); }, () => { v.grade = Math.min(4, v.grade + 1); });
    this.g(texte(this, 640, 408, `${uids.length} rune${uids.length > 1 ? 's' : ''} · ${fmt(total)} kamas`, 16, OR, true, 0.5, 0.5).setDepth(3002));
    const ok = bouton(this, 720, 460, 160, 40, 'Vendre', true, () => {
      if (!uids.length) return;
      const r = vendreRunes(this.joueur, uids);
      this.joueur = r.joueur; sauver(this.joueur); this.vente = null; this.choisie = null;
      this.message(`${uids.length} rune${uids.length > 1 ? 's' : ''} vendue${uids.length > 1 ? 's' : ''} : +${fmt(r.kamas)} kamas`);
      this.dessiner();
    }, 3002);
    if (!uids.length) ok.griser();
    this.g(ok.fond); this.g(ok.t);
    const an = bouton(this, 540, 460, 140, 40, 'Annuler', false, () => { this.vente = null; this.dessiner(); }, 3002);
    this.g(an.fond); this.g(an.t);
  }

  private message(s: string) {
    this.avis?.destroy();
    const tx = this.add.text(0, 0, s, { fontFamily: POLICE, fontSize: '15px', color: '#ffffff', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
    const f = this.add.rectangle(0, 0, tx.width + 36, tx.height + 22, 0x0c1410, 0.95).setStrokeStyle(1.5, 0xb08a3a);
    const c = this.add.container(W / 2, 84, [f, tx]).setDepth(5000);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2400, duration: 500, onComplete: () => c.destroy() });
  }
}
void H;
