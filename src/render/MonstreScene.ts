import Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import { monstre, type Joueur } from '../sim/joueur';
import { fiche, monstreCombat } from '../sim/fiches';
import {
  GRADES, LISTE_SETS, NOM_STAT_RUNE, SETS, avecRunes, coutMontee, prixVente, setsActifs, valeurPrincipale, type Rune, type SetRune, type StatRune,
} from '../sim/runes';
import {
  PREREGLAGES_MAX, ameliorer, appliquerPrereglage, coutPrereglage, enregistrerPrereglage, equiper, prereglages,
  retirerRune, retraitGratuit, runes, runesDe, selection, vendreRunes,
} from '../sim/inventaire';
import { noterMission } from '../sim/missions';
import type { Stats } from '../sim/types';
import { COULEUR, H, OR, POLICE, W, bouton, chargerUi, fmt, panneau, portrait, texte } from './ui';
import { COULEUR_GRADE, VERT, bandeauPierre, carteMonstre, chargerIdentite, decorVivant, etoiles, runeMedaillon } from './identite';

/**
 * « Gérer » les runes d'un monstre, disposé comme dans Summoners War (vidéo de Mathis du 25/11/2026 ✓) :
 * à gauche le monstre, ses stats, les runes Avant / Après, le coût de déséquipement et « Appliquer » (les changements se préparent,
 * puis s'appliquent d'un coup) ; en haut à droite les filtres (set, places en fleur, stat principale, deux sous-stats) ;
 * en bas à droite l'inventaire en grille avec son tri. Toucher une rune ouvre sa fiche (comparaison, équiper, améliorer, vendre).
 * Habillage « Pierre et émeraude », runes en médaillons.
 */
const hexa = (c: number) => '#' + c.toString(16).padStart(6, '0');
type Tri = 'grade' | 'etoiles' | 'niveau' | 'obtenu' | 'sous';
const NOM_TRI: Record<Tri, string> = { grade: 'Grade', etoiles: 'Étoiles', niveau: 'Niv. d\'amélioration', obtenu: 'Obtenu', sous: 'Sous-stats' };
const STATS: StatRune[] = ['vit', 'pv_fixe', 'pv', 'atq_fixe', 'atq', 'def_fixe', 'def', 'tc', 'dc', 'res', 'pre'];
const NOM_COURT: Record<keyof Stats, string> = { pv: 'PV', atq: 'ATQ', def: 'DEF', vit: 'VIT', tc: 'Tx crit.', dc: 'Dég. crit.', res: 'Résist.', pre: 'Précision' };
const POURCENT = new Set<keyof Stats>(['tc', 'dc', 'res', 'pre']);
const COLS = 10, LIGNES = 5;
/** « ATQ +9 % » plutôt que « ATQ % +9 ». */
const libStat = (s: StatRune, v: number) => { const n = NOM_STAT_RUNE[s]; return n.endsWith(' %') ? `${n.slice(0, -2)} +${v} %` : `${n} +${v}`; };
type Popup = null | 'set' | 'principale' | 'sous0' | 'sous1' | 'tri' | 'reglages' | 'rune' | 'vente';

export class MonstreScene extends Phaser.Scene {
  private joueur!: Joueur;
  private uid = 0;
  private retour: { scene: string; data?: object } = { scene: 'cercle' };
  private choisie: number | null = null;
  private page = 0;
  private occupe = false;
  private popup: Popup = null;
  private vente = { etoiles: 3, grade: 1 };
  private tri: Tri = 'grade';
  private croissant = false;
  private f = { sets: new Set<SetRune>(), places: new Set<number>(), principale: null as StatRune | null, sous: [null, null] as (StatRune | null)[], libres: false, etoiles: 1, grade: 0 };
  /** Changements préparés, appliqués d'un coup : place → rune à mettre, ou null pour retirer la rune portée. */
  private prepare = new Map<number, number | null>();
  /** Sélection multiple pour la vente (null : mode normal). */
  private coche: Set<number> | null = null;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;

  constructor() { super('monstre'); }

  init(data: { uid: number; retour?: { scene: string; data?: object }; set?: SetRune }) {
    this.joueur = charger();
    this.uid = data.uid ?? this.joueur.monstres[0].uid;
    this.retour = data.retour ?? { scene: 'cercle' };
    this.choisie = null; this.page = 0; this.occupe = false; this.popup = null; this.coche = null; this.calque = [];
    this.tri = 'grade'; this.croissant = false; this.prepare = new Map();
    this.f = { sets: new Set(data.set ? [data.set] : []), places: new Set(), principale: null, sous: [null, null], libres: false, etoiles: 1, grade: 0 };
  }

  preload() {
    chargerUi(this, []);
    chargerIdentite(this);
  }

  create() {
    const m = monstre(this.joueur, this.uid), f = fiche(m.id);
    decorVivant(this, 200).teinter(COULEUR[f.element]);
    bandeauPierre(this, 'Retour', () => !this.occupe && this.scene.start(this.retour.scene, this.retour.data));
    texte(this, W / 2, 25, 'Gérer les runes', 20, '#eef2e4', true, 0.5, 0.5).setDepth(2001);
    this.dessiner();
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }
  private gs(l: Phaser.GameObjects.GameObject[]) { for (const o of l) this.calque.push(o); }
  private rune(uid: number | null | undefined) { return uid === null || uid === undefined ? undefined : runes(this.joueur).find((r) => r.uid === uid); }

  /** Runes portées une fois les changements préparés appliqués. */
  private apres(): Rune[] {
    const l: Rune[] = [];
    for (let e = 1; e <= 6; e++) {
      const r = this.prepare.has(e) ? this.rune(this.prepare.get(e)) : runesDe(this.joueur, this.uid).find((x) => x.emplacement === e);
      if (r) l.push(r);
    }
    return l;
  }

  private appliquerSur(j: Joueur): Joueur {
    const now = Date.now();
    let k = j;
    for (const [e, u] of this.prepare) {
      if (u === null) { const r = runesDe(k, this.uid).find((x) => x.emplacement === e); if (r) k = retirerRune(k, r.uid, now); } else if (runes(k).some((r) => r.uid === u)) k = equiper(k, u, this.uid, now);
    }
    return k;
  }

  private cout(): number { const G = 1e12; try { return G - this.appliquerSur({ ...this.joueur, kamas: G }).kamas; } catch { return 0; } }

  /** Bouton plat : vert quand il est choisi. `icone` : symbole de set à la place du texte. */
  private puce(x: number, y: number, w: number, h: number, lib: string, on: boolean, action: () => void, profondeur = 1001, taille = 13) {
    const gr = this.g(this.add.graphics().setDepth(profondeur));
    gr.fillStyle(on ? VERT : 0x161b13).fillRoundedRect(x, y - h / 2, w, h, 7).lineStyle(1.5, on ? 0xf0ff9a : 0x4a5a3c).strokeRoundedRect(x, y - h / 2, w, h, 7);
    this.g(this.add.text(x + w / 2, y, lib, { fontFamily: POLICE, fontSize: `${taille}px`, fontStyle: '600', color: on ? '#1c2408' : '#dfe8d6' }).setOrigin(0.5).setDepth(profondeur + 1));
    this.g(this.add.zone(x, y - h / 2, w, h).setOrigin(0).setDepth(profondeur + 2).setInteractive({ useHandCursor: true })).on('pointerdown', () => { if (!this.occupe) action(); });
  }

  /** Liste déroulante façon SW : barre sombre, valeur au centre, flèche à droite. */
  private deroulant(x: number, y: number, w: number, lib: string, actif: boolean, action: () => void) {
    const gr = this.g(this.add.graphics().setDepth(1001));
    gr.fillStyle(0x0b0d0a).fillRoundedRect(x, y - 15, w, 30, 5).lineStyle(1.5, actif ? VERT : 0x4a5a3c).strokeRoundedRect(x, y - 15, w, 30, 5);
    this.g(texte(this, x + w / 2, y, lib, 14, actif ? '#d8ff5a' : '#ffffff', true, 0.5, 0.5).setDepth(1002));
    this.g(texte(this, x + w - 16, y, '▼', 11, '#d8ff5a', false, 0.5, 0.5).setDepth(1002));
    this.g(this.add.zone(x, y - 15, w, 30).setOrigin(0).setDepth(1003).setInteractive({ useHandCursor: true })).on('pointerdown', () => { if (!this.occupe) action(); });
  }

  private liste(): Rune[] {
    const f = this.f, portees = new Set(runesDe(this.joueur, this.uid).map((r) => r.uid));
    const l = runes(this.joueur).filter((r) => !portees.has(r.uid) && (!f.sets.size || f.sets.has(r.set)) && (!f.places.size || f.places.has(r.emplacement))
      && (!f.principale || r.principale === f.principale) && f.sous.every((s) => !s || r.sous.some((x) => x.stat === s))
      && (!f.libres || r.porteur === undefined) && r.etoiles >= f.etoiles && r.grade >= f.grade);
    const sous = (r: Rune) => { const c = f.sous.filter(Boolean); return c.length ? r.sous.filter((x) => c.includes(x.stat)).reduce((s, x) => s + x.valeur, 0) : r.sous.reduce((s, x) => s + 1 + x.montees, 0); };
    const cle: Record<Tri, (r: Rune) => number[]> = {
      grade: (r) => [r.grade, r.etoiles, r.niveau], etoiles: (r) => [r.etoiles, r.grade, r.niveau], niveau: (r) => [r.niveau, r.etoiles, r.grade],
      obtenu: (r) => [r.uid], sous: (r) => [sous(r), r.etoiles, r.grade],
    };
    const k = cle[this.tri], sens = this.croissant ? 1 : -1;
    return l.sort((a, b) => { const x = k(a), y = k(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return (x[i] - y[i]) * sens; return b.uid - a.uid; });
  }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur;
    for (const [e, u] of this.prepare) if (u !== null && !this.rune(u)) this.prepare.delete(e);   // rune vendue entre-temps
    this.g(texte(this, W - 18, 25, `${fmt(j.kamas)} kamas`, 15, '#ffe08a', true, 1, 0.5).setDepth(2001));
    this.gauche();
    this.filtres();
    this.inventaire();
    if (this.popup === 'rune') this.ficheRune();
    else if (this.popup === 'set') this.choixSet();
    else if (this.popup === 'principale' || this.popup === 'sous0' || this.popup === 'sous1') this.choixStat(this.popup);
    else if (this.popup === 'tri') this.choixTri();
    else if (this.popup === 'reglages') this.reglages();
    else if (this.popup === 'vente') this.fenetreVente();
  }

  // ───────────── à gauche : monstre, stats, Avant / Après, Appliquer ─────────────

  private gauche() {
    const j = this.joueur, m = monstre(j, this.uid), f = fiche(m.id), avant = runesDe(j, this.uid), apres = this.apres(), change = this.prepare.size > 0;
    this.gs(carteMonstre(this, m, f.element, 56, 104, 66));
    this.g(texte(this, 100, 88, `Niv. ${m.niveau}  ${f.nom}`, 17, '#ffffff', true, 0, 0.5));
    this.gs(etoiles(this, 100, 114, m.etoiles, 16, 0));
    const base = monstreCombat(m.id, m.etoiles, m.niveau), a = avecRunes(base, avant).stats, b = avecRunes(base, apres).stats;
    (['pv', 'atq', 'def', 'vit', 'tc', 'dc', 'res', 'pre'] as (keyof Stats)[]).forEach((k, i) => {
      const y = 156 + i * 22 + (i > 3 ? 8 : 0), d = Math.round(b[k] - a[k]), pc = POURCENT.has(k) ? ' %' : '';
      this.g(texte(this, 28, y, NOM_COURT[k], 14.5, '#dfe8d6', false, 0, 0.5));
      this.g(texte(this, 214, y, `${fmt(Math.round(a[k]))}${pc}`, 14.5, '#ffffff', true, 1, 0.5));
      if (d) this.g(texte(this, 222, y, `${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))}${pc}`, 13, d > 0 ? '#7fd05a' : '#ff7a6a', true, 0, 0.5));
    });
    const sets = Object.keys(setsActifs(apres)) as SetRune[];
    this.g(texte(this, 28, 352, sets.length ? `Sets : ${sets.map((s) => SETS[s].nom).join(' · ')}` : 'Aucun set complet', 12.5, sets.length ? OR : '#93a89b', true, 0, 0.5));
    // Avant / Après
    this.g(this.add.rectangle(18, 370, 346, 136, 0x000000, 0.45).setOrigin(0).setStrokeStyle(1.5, 0x4a5a3c).setDepth(900));
    this.g(texte(this, 30, 385, 'Avant', 12.5, '#c9cfc4', true, 0, 0.5));
    this.g(texte(this, 214, 385, 'Après', 12.5, change ? '#d8ff5a' : '#c9cfc4', true, 0, 0.5));
    this.g(texte(this, 191, 448, '›', 30, '#6f7862', true, 0.5, 0.5));
    for (let e = 1; e <= 6; e++) {
      const dx = ((e - 1) % 3) * 48, y = 424 + Math.floor((e - 1) / 3) * 50;
      const ra = avant.find((x) => x.emplacement === e) ?? null, rb = apres.find((x) => x.emplacement === e) ?? null;
      this.gs(runeMedaillon(this, ra, 52 + dx, y, 46, { numero: e, profondeur: 1000 }));
      this.gs(runeMedaillon(this, rb, 236 + dx, y, 46, { numero: e, profondeur: 1000, choisie: this.prepare.has(e) }));
      for (const [r, x] of [[ra, 52 + dx], [rb, 236 + dx]] as const) {
        if (!r) continue;
        this.g(this.add.zone(x, y, 46, 46).setDepth(1012).setInteractive({ useHandCursor: true })).on('pointerdown', () => { if (!this.occupe && !this.coche) { this.choisie = r.uid; this.popup = 'rune'; this.dessiner(); } });
      }
    }
    const cout = change ? this.cout() : 0;
    this.g(texte(this, 191, 524, `Coût de déséquipement : ${fmt(cout)} kamas`, 12.5, cout > j.kamas ? '#ff7a6a' : '#dfe8d6', false, 0.5, 0.5));
    if (retraitGratuit(j, Date.now())) this.g(texte(this, 191, 541, 'Retraits gratuits (nouveau ou de retour)', 10.5, '#7fd05a', false, 0.5, 0.5));
    const ap = bouton(this, change ? 150 : 191, 574, change ? 220 : 260, 44, 'Appliquer', true, () => {
      if (cout > this.joueur.kamas) return this.message(`Il te faut ${fmt(cout)} kamas pour retirer les runes en place (tu en as ${fmt(this.joueur.kamas)}).`);
      try { this.joueur = this.appliquerSur(this.joueur); sauver(this.joueur); this.prepare.clear(); this.message('Runes mises en place.'); } catch (e) { this.message((e as Error).message); }
      this.dessiner();
    });
    if (!change) ap.griser();
    this.g(ap.fond); this.g(ap.t);
    if (change) { const an = bouton(this, 314, 574, 92, 40, 'Annuler', false, () => { this.prepare.clear(); this.dessiner(); }); an.t.setFontSize(13); this.g(an.fond); this.g(an.t); }
    // préréglages
    this.g(texte(this, 22, 640, 'Préréglages', 12, '#93a89b', true, 0, 0.5));
    const pre = prereglages(j, this.uid);
    for (let i = 0; i < PREREGLAGES_MAX; i++) {
      const p = pre[i], x = 150 + i * 84;
      const bt = bouton(this, x, 640, 78, 34, p ? `Mettre ${i + 1}` : `Vide ${i + 1}`, false, () => {
        if (!p) return this.message('Préréglage vide : touche « Garder » pour y enregistrer les runes portées.');
        const c = coutPrereglage(this.joueur, this.uid, i, Date.now());
        try { this.joueur = appliquerPrereglage(this.joueur, this.uid, i, Date.now()); sauver(this.joueur); this.prepare.clear(); if (c) this.message(`Préréglage ${i + 1} remis : ${fmt(c)} kamas de retraits.`); } catch (e) { this.message((e as Error).message); }
        this.dessiner();
      });
      bt.t.setFontSize(12); if (!p) bt.fond.setAlpha(0.6); this.g(bt.fond); this.g(bt.t);
      const s = this.g(texte(this, x, 674, 'Garder', 11, '#c6f02e', true, 0.5, 0.5));
      s.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.joueur = enregistrerPrereglage(this.joueur, this.uid, i, `Préréglage ${i + 1}`); sauver(this.joueur);
        this.message(`Runes portées gardées dans le préréglage ${i + 1}.`); this.dessiner();
      });
    }
  }

  // ───────────── en haut à droite : les filtres, comme SW ─────────────

  private filtres() {
    const f = this.f, X = 380;
    this.g(panneau(this, X, 62, 884, 174));
    const ouvrir = (p: Popup) => () => { this.popup = p; this.dessiner(); };
    // set
    const ns = f.sets.size, set1 = [...f.sets][0];
    this.puce(X + 24, 98, 170, 36, ns === 0 ? 'Tous  ▼' : ns === 1 ? `${SETS[set1].nom}  ▼` : `${ns} sets  ▼`, ns > 0, ouvrir('set'), 1001, 15);
    if (ns === 1 && this.textures.exists('symboles')) this.g(this.add.image(X + 44, 98, 'symboles', set1).setDisplaySize(26, 26).setDepth(1004));
    // places en fleur : on allume celles qu'on veut voir (aucune = toutes)
    const cx = X + 109, cy = 172;
    for (let e = 1; e <= 6; e++) {
      const a = ((e - 1) * Math.PI) / 3, x = cx + Math.sin(a) * 34, y = cy - Math.cos(a) * 34, on = f.places.has(e);
      const pts = [0, 1, 2, 3, 4, 5].map((i) => new Phaser.Math.Vector2(x + Math.sin((i * Math.PI) / 3) * 17, y - Math.cos((i * Math.PI) / 3) * 17));
      this.g(this.add.graphics().setDepth(1001).fillStyle(on ? VERT : 0x2b3026).fillPoints(pts, true).lineStyle(1.5, on ? 0xf0ff9a : 0x10130d).strokePoints(pts, true));
      this.g(texte(this, x, y, String(e), 14, on ? '#1c2408' : '#c9d6bf', true, 0.5, 0.5).setShadow(0, 0, '#000', 0).setDepth(1002));
      this.g(this.add.zone(x, y, 32, 32).setDepth(1003).setInteractive({ useHandCursor: true })).on('pointerdown', () => {
        if (this.occupe) return;
        if (on) f.places.delete(e); else f.places.add(e);
        this.page = 0; this.dessiner();
      });
    }
    // stat principale et sous-stats
    const xd = X + 226, wd = 884 - 226 - 26;
    this.g(texte(this, xd, 82, 'Stat principale', 13, '#dfe8d6', true, 0, 0.5));
    this.deroulant(xd, 106, wd, f.principale ? NOM_STAT_RUNE[f.principale] : 'Toutes', !!f.principale, ouvrir('principale'));
    this.g(texte(this, xd, 136, 'Sous-stats (la rune doit avoir les deux)', 13, '#dfe8d6', true, 0, 0.5));
    this.deroulant(xd, 160, wd, f.sous[0] ? NOM_STAT_RUNE[f.sous[0]] : 'Toutes', !!f.sous[0], ouvrir('sous0'));
    this.deroulant(xd, 198, wd, f.sous[1] ? NOM_STAT_RUNE[f.sous[1]] : 'Toutes', !!f.sous[1], ouvrir('sous1'));
  }

  // ───────────── en bas à droite : l'inventaire ─────────────

  private inventaire() {
    const j = this.joueur, X = 380, L = 884, gx = X + 24;
    const liste = this.liste(), parPage = COLS * LIGNES, pages = Math.max(1, Math.ceil(liste.length / parPage));
    this.page = Math.min(this.page, pages - 1);
    this.g(panneau(this, X, 242, L, 464));
    const plus = (this.f.libres ? 1 : 0) + (this.f.etoiles > 1 ? 1 : 0) + (this.f.grade > 0 ? 1 : 0);
    this.puce(gx, 276, 40, 32, plus ? `⚙ ${plus}` : '⚙', plus > 0, () => { this.popup = 'reglages'; this.dessiner(); }, 1001, 15);
    this.deroulant(gx + 48, 276, 230, NOM_TRI[this.tri], false, () => { this.popup = 'tri'; this.dessiner(); });
    this.puce(gx + 286, 276, 40, 32, this.croissant ? '▲' : '▼', false, () => { this.croissant = !this.croissant; this.page = 0; this.dessiner(); });
    if (this.coche) {
      const ids = [...this.coche], total = runes(j).filter((r) => this.coche!.has(r.uid)).reduce((s, r) => s + prixVente(r), 0);
      this.puce(gx + 340, 276, 250, 32, ids.length ? `Vendre ${ids.length} · ${fmt(total)} kamas` : 'Coche les runes à vendre', ids.length > 0, () => {
        if (!ids.length) return;
        const res = vendreRunes(this.joueur, ids);
        this.joueur = res.joueur; sauver(this.joueur); this.coche = null;
        this.message(`${ids.length} rune${ids.length > 1 ? 's' : ''} vendue${ids.length > 1 ? 's' : ''} : +${fmt(res.kamas)} kamas`); this.dessiner();
      });
      this.puce(gx + 596, 276, 84, 32, 'Annuler', false, () => { this.coche = null; this.dessiner(); });
    } else {
      this.puce(gx + 340, 276, 150, 32, 'Vendre plusieurs', false, () => { this.coche = new Set(); this.dessiner(); });
      this.puce(gx + 496, 276, 138, 32, 'Vente sélective', false, () => { this.popup = 'vente'; this.dessiner(); });
    }
    this.g(texte(this, X + L - 26, 276, `${liste.length} / ${runes(j).length}`, 14, '#ffe08a', true, 1, 0.5));
    if (!liste.length) this.g(texte(this, X + L / 2, 470, runes(j).length ? 'Aucune rune ne correspond à ces filtres.' : 'Aucune rune pour l\'instant. Elles tombent dans les zones,\nles coffres des missions et les donjons.', 14, '#93a89b', false, 0.5, 0.5).setAlign('center'));
    const prepares = new Set([...this.prepare.values()]);
    liste.slice(this.page * parPage, (this.page + 1) * parPage).forEach((r, k) => {
      const x = gx + 42 + (k % COLS) * 83.5, y = 336 + Math.floor(k / COLS) * 72;
      const coche = this.coche?.has(r.uid) ?? false, prep = prepares.has(r.uid);
      this.gs(runeMedaillon(this, r, x, y, 62, { choisie: this.coche ? coche : prep, profondeur: 1000 }));
      if (r.porteur !== undefined) { const p = portrait(this, monstre(j, r.porteur).id, x - 22, y + 20, 24, true, false, 1011); this.g(this.add.circle(x - 22, y + 20, 13, 0x10130d).setStrokeStyle(1.5, 0xd9a35a).setDepth(1010)); this.g(p.sp); this.g(p.masque); }
      if (coche || prep) this.g(texte(this, x - 24, y - 22, '✔', 16, '#d8ff5a', true, 0.5, 0.5).setDepth(1012));
      this.g(this.add.zone(x, y, 78, 68).setDepth(1015).setInteractive({ useHandCursor: true })).on('pointerdown', () => {
        if (this.occupe) return;
        if (this.coche) {
          if (r.porteur !== undefined) return this.message('Une rune portée ne se vend pas : retire-la d\'abord.');
          if (coche) this.coche.delete(r.uid); else this.coche.add(r.uid);
        } else { this.choisie = r.uid; this.popup = 'rune'; }
        this.dessiner();
      });
    });
    if (pages > 1) {
      this.g(texte(this, X + L / 2, 684, `${this.page + 1} / ${pages}`, 13, '#c9cfc4', false, 0.5, 0.5));
      if (this.page > 0) this.puce(X + L / 2 - 80, 684, 40, 28, '‹', false, () => { this.page--; this.dessiner(); }, 1001, 16);
      if (this.page < pages - 1) this.puce(X + L / 2 + 40, 684, 40, 28, '›', false, () => { this.page++; this.dessiner(); }, 1001, 16);
    }
  }

  // ───────────── fenêtres ─────────────

  /** Voile sombre et panneau ; toucher le voile ou la croix referme. Renvoie la profondeur du contenu. */
  private fenetre(x: number, y: number, w: number, h: number, titre?: string): number {
    const fermer = () => { if (!this.occupe) { this.popup = null; this.dessiner(); } };
    this.g(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(3000).setInteractive()).on('pointerdown', fermer);
    this.g(panneau(this, x, y, w, h, 3001));
    this.g(this.add.zone(x, y, w, h).setOrigin(0).setDepth(3001).setInteractive());   // le panneau ne referme pas
    if (titre) this.g(texte(this, x + w / 2, y + 32, titre, 18, '#ffffff', true, 0.5, 0.5).setDepth(3002));
    this.g(texte(this, x + w - 30, y + 30, '✕', 20, '#dfe8d6', true, 0.5, 0.5).setDepth(3004)).setInteractive({ useHandCursor: true }).on('pointerdown', fermer);
    return 3002;
  }

  /** Choix du set : une tuile par set avec le nombre de runes possédées (plusieurs sets possibles). */
  private choixSet() {
    const P = this.fenetre(330, 96, 620, 510, 'Set'), f = this.f, tous = runes(this.joueur);
    const tuile = (i: number, nom: string, n: number, on: boolean, action: () => void, set?: SetRune) => {
      const x = 372 + (i % 4) * 142, y = 160 + Math.floor(i / 4) * 92;
      this.g(this.add.graphics().setDepth(P).fillStyle(on ? 0x2f3a16 : 0x161b13).fillRoundedRect(x, y, 132, 82, 8).lineStyle(on ? 2.5 : 1.5, on ? VERT : 0x4a5a3c).strokeRoundedRect(x, y, 132, 82, 8));
      if (set && this.textures.exists('symboles')) this.g(this.add.image(x + 66, y + 30, 'symboles', set).setDisplaySize(40, 40).setDepth(P + 1));
      else this.g(texte(this, x + 66, y + 30, `${n}`, 20, '#ffe08a', true, 0.5, 0.5).setDepth(P + 1));
      this.g(texte(this, x + 66, y + 66, nom, 13, on ? '#d8ff5a' : '#ffffff', true, 0.5, 0.5).setDepth(P + 1));
      if (set) { this.g(this.add.circle(x + 116, y + 14, 12, 0xb3261e).setStrokeStyle(1.5, 0xffffff).setDepth(P + 1)); this.g(texte(this, x + 116, y + 14, String(n), 11, '#ffffff', true, 0.5, 0.5).setDepth(P + 2)); }
      this.g(this.add.zone(x, y, 132, 82).setOrigin(0).setDepth(P + 3).setInteractive({ useHandCursor: true })).on('pointerdown', () => { action(); this.page = 0; this.dessiner(); });
    };
    tuile(0, 'Tous', tous.length, f.sets.size === 0, () => { f.sets.clear(); this.popup = null; });
    LISTE_SETS.forEach((s, i) => tuile(i + 1, SETS[s].nom, tous.filter((r) => r.set === s).length, f.sets.has(s), () => { if (f.sets.has(s)) f.sets.delete(s); else f.sets.add(s); }, s));
    const ok = bouton(this, 640, 566, 200, 38, 'Voir les runes', true, () => { this.popup = null; this.dessiner(); }, P + 1); ok.t.setFontSize(16); this.g(ok.fond); this.g(ok.t);
  }

  /** Choix d'une stat (principale ou sous-stat) : deux colonnes, comme SW. */
  private choixStat(p: 'principale' | 'sous0' | 'sous1') {
    const P = this.fenetre(440, 150, 400, 400, p === 'principale' ? 'Stat principale' : 'Sous-stat'), f = this.f;
    const actuelle = p === 'principale' ? f.principale : f.sous[p === 'sous0' ? 0 : 1];
    const choisir = (s: StatRune | null) => { if (p === 'principale') f.principale = s; else f.sous[p === 'sous0' ? 0 : 1] = s; this.popup = null; this.page = 0; this.dessiner(); };
    ([null, ...STATS] as (StatRune | null)[]).forEach((s, i) => {
      const x = 470 + (i % 2) * 176, y = 226 + Math.floor(i / 2) * 50;
      this.puce(x, y, 166, 40, s ? NOM_STAT_RUNE[s] : 'Toutes', actuelle === s, () => choisir(s), P, 14);
    });
  }

  private choixTri() {
    const P = this.fenetre(490, 190, 300, 330, 'Trier par');
    (Object.keys(NOM_TRI) as Tri[]).forEach((t, i) => this.puce(520, 270 + i * 46, 240, 38, NOM_TRI[t], this.tri === t, () => { this.tri = t; this.popup = null; this.page = 0; this.dessiner(); }, P, 14));
  }

  /** Roue dentée : runes libres seulement, étoiles et grade minimum. */
  private reglages() {
    const P = this.fenetre(350, 200, 580, 300, 'Afficher'), f = this.f, X = 350, Y = 200;
    const re = (action: () => void) => () => { action(); this.page = 0; this.dessiner(); };
    const lab = (y: number, t: string) => this.g(texte(this, X + 36, y, t, 13, '#93a89b', true, 0, 0.5).setDepth(P));
    lab(Y + 88, 'Runes');
    this.puce(X + 120, Y + 88, 110, 32, 'Toutes', !f.libres, re(() => { f.libres = false; }), P);
    this.puce(X + 238, Y + 88, 150, 32, 'Libres seulement', f.libres, re(() => { f.libres = true; }), P);
    lab(Y + 138, 'Étoiles');
    for (let e = 1; e <= 6; e++) this.puce(X + 120 + (e - 1) * 70, Y + 138, 64, 32, e === 1 ? 'Toutes' : `${e}★ et +`, f.etoiles === e, re(() => { f.etoiles = e; }), P, 12);
    lab(Y + 188, 'Grade');
    GRADES.forEach((g, i) => this.puce(X + 120 + i * 86, Y + 188, 80, 32, i ? `${g} +` : 'Tous', f.grade === i, re(() => { f.grade = i; }), P, 11.5));
    const ok = bouton(this, W / 2, Y + 252, 200, 38, 'Voir les runes', true, () => { this.popup = null; this.dessiner(); }, P + 1); ok.t.setFontSize(16); this.g(ok.fond); this.g(ok.t);
  }

  /** Fiche d'une rune : stats, comparaison avec la rune prévue à la même place, équiper ou retirer (préparé), améliorer, vendre. */
  private ficheRune() {
    const r = this.rune(this.choisie);
    if (!r) { this.popup = null; return; }
    const j = this.joueur, c = COULEUR_GRADE[r.grade], X = 400, Y = 110, P = this.fenetre(X, Y, 480, 500);
    const apres = this.apres(), enPlace = apres.find((x) => x.emplacement === r.emplacement), dansApres = enPlace?.uid === r.uid;
    this.gs(runeMedaillon(this, r, X + 74, Y + 76, 84, { profondeur: P }));
    this.g(texte(this, X + 130, Y + 52, `Rune ${SETS[r.set].nom} (${r.emplacement})`, 18, '#ffffff', true, 0, 0.5).setDepth(P));
    this.g(texte(this, X + 130, Y + 76, `${GRADES[r.grade]} · +${r.niveau}`, 13, hexa(c), true, 0, 0.5).setDepth(P));
    this.gs(etoiles(this, X + 130, Y + 98, r.etoiles, 14, 0, P));
    const porteur = r.porteur !== undefined ? monstre(j, r.porteur) : undefined;
    this.g(texte(this, X + 444, Y + 98, porteur ? (r.porteur === this.uid ? 'Portée par ce monstre' : `Portée par ${fiche(porteur.id).nom}`) : 'Libre', 12, porteur && r.porteur !== this.uid ? '#d9a35a' : '#93a89b', false, 1, 0.5).setDepth(P));
    this.g(texte(this, X + 36, Y + 142, libStat(r.principale, valeurPrincipale(r)), 19, '#ffffff', true, 0, 0.5).setDepth(P));
    r.sous.forEach((s, i) => this.g(texte(this, X + 36, Y + 172 + i * 22, `${libStat(s.stat, s.valeur)}${s.montees ? `  ${'▲'.repeat(s.montees)}` : ''}`, 14, s.montees ? '#b8f5a0' : '#dfe8d6', false, 0, 0.5).setDepth(P)));
    for (let i = r.sous.length; i < 4; i++) this.g(texte(this, X + 36, Y + 172 + i * 22, `— sous-stat à +${(i + 1) * 3}`, 13, '#5f6a5c', false, 0, 0.5).setDepth(P));
    this.g(texte(this, X + 36, Y + 262, `${SETS[r.set].nom} (${SETS[r.set].pieces} runes) : ${SETS[r.set].effet}`, 11.5, '#93a89b', false, 0, 0).setWordWrapWidth(410).setDepth(P));
    // comparaison avec ce qui est prévu à la même place
    this.g(this.add.rectangle(X + 30, Y + 300, 420, 82, 0x000000, 0.5).setOrigin(0).setStrokeStyle(1.5, 0x4a5a3c).setDepth(P));
    if (dansApres) this.g(texte(this, X + 240, Y + 341, 'Cette rune est celle prévue à cette place.', 13, '#93a89b', false, 0.5, 0.5).setDepth(P));
    else {
      const m = monstre(j, this.uid), base = monstreCombat(m.id, m.etoiles, m.niveau), avec = [...apres.filter((x) => x.emplacement !== r.emplacement), r];
      const a = avecRunes(base, apres).stats, b = avecRunes(base, avec).stats;
      this.g(texte(this, X + 40, Y + 314, enPlace ? `Par rapport à la rune de la place ${r.emplacement}` : `Place ${r.emplacement} vide : ce que tu gagnes`, 12, '#93a89b', true, 0, 0.5).setDepth(P));
      const ecarts = (Object.keys(NOM_COURT) as (keyof Stats)[]).map((k) => [k, Math.round(b[k] - a[k])] as const).filter(([, d]) => d);
      if (!ecarts.length) this.g(texte(this, X + 40, Y + 336, 'Aucun écart de stats.', 13, '#dfe8d6', false, 0, 0.5).setDepth(P));
      ecarts.slice(0, 6).forEach(([k, d], i) => {
        const x = X + 40 + (i % 3) * 136, y = Y + 336 + Math.floor(i / 3) * 20;
        this.g(texte(this, x, y, NOM_COURT[k], 12.5, '#dfe8d6', false, 0, 0.5).setDepth(P));
        this.g(texte(this, x + 124, y, `${d > 0 ? '+' : '−'}${fmt(Math.abs(d))}${POURCENT.has(k) ? ' %' : ''}`, 12.5, d > 0 ? '#7fd05a' : '#ff7a6a', true, 1, 0.5).setDepth(P));
      });
      const sa = Object.keys(setsActifs(apres)) as SetRune[], sb = Object.keys(setsActifs(avec)) as SetRune[];
      const perdus = sa.filter((s) => !sb.includes(s)), gagnes = sb.filter((s) => !sa.includes(s));
      if (perdus.length || gagnes.length) this.g(texte(this, X + 440, Y + 314, [...gagnes.map((s) => `+ ${SETS[s].nom}`), ...perdus.map((s) => `− ${SETS[s].nom}`)].join('  '), 12, perdus.length ? '#ff7a6a' : '#7fd05a', true, 1, 0.5).setDepth(P));
    }
    // actions
    const fermer = () => { this.popup = null; this.dessiner(); };
    let y = Y + 414;
    if (dansApres) {
      const b = bouton(this, X + 240, y, 420, 42, 'Retirer', false, () => { if (r.porteur === this.uid) this.prepare.set(r.emplacement, null); else this.prepare.delete(r.emplacement); fermer(); }, P + 1);
      b.t.setFontSize(16); this.g(b.fond); this.g(b.t);
    } else {
      const b = bouton(this, X + 240, y, 420, 42, 'Équiper', true, () => {
        if (r.porteur === this.uid) this.prepare.delete(r.emplacement); else this.prepare.set(r.emplacement, r.uid);
        fermer();
      }, P + 1);
      this.g(b.fond); this.g(b.t);
    }
    y += 48;
    const libre = r.porteur === undefined, wv = libre ? 134 : 0;
    if (r.niveau < 15) {
      const pal = Math.min(15, (Math.floor(r.niveau / 3) + 1) * 3), deux = pal < 15, wb = (420 - wv - (wv ? 8 : 0) - (deux ? 8 : 0)) / (deux ? 2 : 1);
      const b1 = bouton(this, X + 30 + wb / 2, y, wb, 38, `+${pal} · ${fmt(coutMontee(r, pal))}`, false, () => this.monter(r, pal), P + 1); b1.t.setFontSize(13).setColor('#c6f02e'); this.g(b1.fond); this.g(b1.t);
      if (deux) { const b2 = bouton(this, X + 30 + wb + 8 + wb / 2, y, wb, 38, `+15 · ${fmt(coutMontee(r, 15))}`, false, () => this.monter(r, 15), P + 1); b2.t.setFontSize(13).setColor('#c6f02e'); this.g(b2.fond); this.g(b2.t); }
    }
    if (libre) {
      const plein = r.niveau >= 15, wvv = plein ? 420 : wv;
      const b = bouton(this, X + 450 - wvv / 2, y, wvv, 38, `Vendre · ${fmt(prixVente(r))}`, false, () => {
        const res = vendreRunes(this.joueur, [r.uid]);
        this.joueur = res.joueur; sauver(this.joueur); this.choisie = null; this.message(`Rune vendue : +${fmt(res.kamas)} kamas`); fermer();
      }, P + 1);
      b.t.setFontSize(13); this.g(b.fond); this.g(b.t);
    }
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
    this.dessiner();
    if (!res.paliers.length) return;
    this.occupe = true;
    res.paliers.forEach((p, k) => this.time.delayedCall(250 + k * 650, () => {
      const y = 110 + 172 + p.sous * 22;
      const eclat = this.add.rectangle(640, y, 420, 22, p.nouvelle ? 0xffd23a : 0x7fd05a, 0.45).setDepth(4000);
      const t = texte(this, 840, y, `+${p.niveau} : ${p.nouvelle ? 'nouvelle sous-stat !' : 'sous-stat renforcée !'}`, 14, p.nouvelle ? '#ffe08a' : '#b8f5a0', true, 1, 0.5).setDepth(4001);
      this.cameras.main.flash(120, 255, 230, 160, false);
      this.tweens.add({ targets: [eclat, t], alpha: 0, delay: 450, duration: 400, onComplete: () => { eclat.destroy(); t.destroy(); } });
    }));
    this.time.delayedCall(250 + res.paliers.length * 650 + 200, () => { this.occupe = false; });
  }

  /** Vente sélective (choix 7B) : runes non portées et jamais montées, jusqu'à N étoiles et un grade. */
  private fenetreVente() {
    const v = this.vente, j = this.joueur, P = this.fenetre(390, 200, 500, 300, 'Vente sélective');
    const uids = selection(j, v.etoiles, v.grade).filter((u) => ![...this.prepare.values()].includes(u));
    const total = runes(j).filter((r) => uids.includes(r.uid)).reduce((s, r) => s + prixVente(r), 0);
    this.g(texte(this, 640, 262, 'Runes non portées et jamais montées', 13, '#93a89b', false, 0.5, 0.5).setDepth(P));
    const choix = (y: number, lib: string, moins: () => void, plus: () => void) => {
      this.g(texte(this, 640, y, lib, 16, '#ffffff', true, 0.5, 0.5).setDepth(P));
      const a = bouton(this, 470, y, 44, 32, '−', false, () => { moins(); this.dessiner(); }, P); this.g(a.fond); this.g(a.t);
      const b = bouton(this, 810, y, 44, 32, '+', false, () => { plus(); this.dessiner(); }, P); this.g(b.fond); this.g(b.t);
    };
    choix(310, `Jusqu'à ${v.etoiles}★`, () => { v.etoiles = Math.max(1, v.etoiles - 1); }, () => { v.etoiles = Math.min(6, v.etoiles + 1); });
    choix(360, `Jusqu'au grade ${GRADES[v.grade]}`, () => { v.grade = Math.max(0, v.grade - 1); }, () => { v.grade = Math.min(4, v.grade + 1); });
    this.g(texte(this, 640, 408, `${uids.length} rune${uids.length > 1 ? 's' : ''} · ${fmt(total)} kamas`, 16, OR, true, 0.5, 0.5).setDepth(P));
    const ok = bouton(this, 720, 460, 160, 40, 'Vendre', true, () => {
      if (!uids.length) return;
      const r = vendreRunes(this.joueur, uids);
      this.joueur = r.joueur; sauver(this.joueur); this.popup = null;
      this.message(`${uids.length} rune${uids.length > 1 ? 's' : ''} vendue${uids.length > 1 ? 's' : ''} : +${fmt(r.kamas)} kamas`);
      this.dessiner();
    }, P);
    if (!uids.length) ok.griser();
    this.g(ok.fond); this.g(ok.t);
    const an = bouton(this, 540, 460, 140, 40, 'Annuler', false, () => { this.popup = null; this.dessiner(); }, P);
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
