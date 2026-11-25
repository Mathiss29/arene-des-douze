import Phaser from 'phaser';
import { charger, sauver } from './sauvegarde';
import { monstre, type Joueur } from '../sim/joueur';
import { fiche, monstreCombat } from '../sim/fiches';
import {
  GRADES, NOM_STAT_RUNE, SETS, avecRunes, coutMontee, prixVente, setsActifs, valeurPrincipale, type Rune,
} from '../sim/runes';
import {
  PREREGLAGES_MAX, ameliorer, appliquerPrereglage, coutEquiper, coutPrereglage, coutRetrait, enregistrerPrereglage, equiper, prereglages,
  retirerRune, retraitGratuit, runes, runesDe, selection, vendreRunes,
} from '../sim/inventaire';
import { noterMission } from '../sim/missions';
import { LOOKS } from './looks';
import { creerAnimations } from './animations';
import { H, OR, POLICE, W, bouton, chargerUi, fmt, monstreEnPied, panneau, texte } from './ui';

/**
 * Fiche d'un monstre, onglet Runes (maquette « Runes : » 1A 5C 6A 7B 8C) : les 6 emplacements autour du monstre,
 * la rune choisie (monter palier par palier ou jusqu'à +15, avec l'animation de forgemagie), retirer, équiper,
 * l'inventaire filtré par emplacement, la vente sélective et 3 préréglages.
 */
import { COULEUR_GRADE, chargerIdentite, runeMedaillon } from './identite';
const hexa = (c: number) => '#' + c.toString(16).padStart(6, '0');
const CX = 290, CY = 360, R = 170;
const POS = [-90, -30, 30, 90, 150, 210].map((a) => ({ x: CX + Math.cos((a * Math.PI) / 180) * R, y: CY + Math.sin((a * Math.PI) / 180) * R }));

export class MonstreScene extends Phaser.Scene {
  private joueur!: Joueur;
  private uid = 0;
  private retour: { scene: string; data?: object } = { scene: 'cercle' };
  private choisie: number | null = null;
  private emplacement: number | null = null;
  private page = 0;
  private occupe = false;
  private vente: { etoiles: number; grade: number } | null = null;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;

  constructor() { super('monstre'); }

  init(data: { uid: number; retour?: { scene: string; data?: object } }) {
    this.joueur = charger();
    this.uid = data.uid ?? this.joueur.monstres[0].uid;
    this.retour = data.retour ?? { scene: 'cercle' };
    this.choisie = null; this.emplacement = null; this.page = 0; this.occupe = false; this.vente = null; this.calque = [];
  }

  preload() {
    chargerUi(this, [monstre(this.joueur, this.uid).id]);
    chargerIdentite(this);
    if (!this.textures.exists('zaap_incarnam')) this.load.image('zaap_incarnam', 'assets/zaap/incarnam.webp');
  }

  create() {
    const m = monstre(this.joueur, this.uid);
    creerAnimations(this, LOOKS[m.id].atlas);
    const fond = this.add.image(W / 2, H / 2, 'zaap_incarnam').setTint(0x4a5248);
    fond.setScale(Math.max(W / fond.width, H / fond.height));
    this.add.rectangle(W / 2, H / 2, W, H, 0x050a08, 0.5);
    const ret = texte(this, 16, 14, '‹ Retour', 15, '#ffe08a', true, 0, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7);
    ret.setInteractive({ useHandCursor: true }).on('pointerdown', () => !this.occupe && this.scene.start(this.retour.scene, this.retour.data));
    this.add.circle(CX, CY, R, 0x000000, 0).setStrokeStyle(2, 0x5d6f52, 0.6);
    monstreEnPied(this, m.id, CX, CY + 60, 1.25).setDepth(10);
    this.dessiner();
  }

  private g<T extends Phaser.GameObjects.GameObject>(o: T): T { this.calque.push(o); return o; }

  private faire(f: (j: Joueur) => Joueur) {
    try { this.joueur = f(this.joueur); sauver(this.joueur); } catch (e) { this.message((e as Error).message); }
    this.dessiner();
  }

  private dessiner() {
    for (const o of this.calque) o.destroy();
    this.calque = [];
    const j = this.joueur, m = monstre(j, this.uid), f = fiche(m.id), portees = runesDe(j, this.uid), now = Date.now();

    // en-tête et stats
    this.g(texte(this, W - 16, 14, `${fmt(j.kamas)} kamas`, 15, '#ffe08a', true, 1, 0).setBackgroundColor('rgba(8,14,11,0.85)').setPadding(12, 7, 12, 7));
    this.g(texte(this, 140, 16, `${f.nom}  ${'★'.repeat(m.etoiles)}  niv. ${m.niveau}`, 20, '#ffffff', true, 0, 0));
    const sets = setsActifs(portees);
    const lib = Object.entries(sets).map(([s, n]) => `${SETS[s as Rune['set']].dieu}${n! > 1 ? ` ×${n}` : ''} (${SETS[s as Rune['set']].nom})`).join(' · ');
    this.g(texte(this, 140, 46, lib ? `Sets : ${lib}` : 'Aucun set complet', 13, lib ? OR : '#93a89b', false, 0, 0));
    const base = monstreCombat(m.id, m.etoiles, m.niveau), avec = avecRunes(base, portees);
    const lignes: [string, keyof typeof base.stats, string][] = [['PV', 'pv', ''], ['ATQ', 'atq', ''], ['DEF', 'def', ''], ['VIT', 'vit', ''], ['Crit.', 'tc', ' %'], ['Dég. crit.', 'dc', ' %'], ['Rés.', 'res', ' %'], ['Préc.', 'pre', ' %']];
    lignes.forEach(([n, k, u], i) => {
      const x = 40 + (i % 4) * 130, y = 600 + Math.floor(i / 4) * 44;
      this.g(texte(this, x, y, n, 12, '#93a89b', false, 0, 0));
      const plus = Math.round(avec.stats[k] - base.stats[k]);
      this.g(texte(this, x, y + 16, `${fmt(Math.round(base.stats[k]))}${u}`, 15, '#ffffff', true, 0, 0));
      if (plus) this.g(texte(this, x + 62, y + 18, `+${fmt(plus)}`, 13, '#7fd05a', false, 0, 0));
    });

    // les 6 emplacements
    POS.forEach((p, i) => {
      const e = i + 1, r = portees.find((x) => x.emplacement === e);
      const sel = this.emplacement === e;
      for (const o of runeMedaillon(this, r ?? null, p.x, p.y, 78, { choisie: sel, numero: e, profondeur: 20 })) this.g(o);
      const hx = this.g(this.add.zone(p.x, p.y, 74, 74).setDepth(40));
      hx.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.occupe) return;
        this.emplacement = sel ? null : e; this.page = 0;
        this.choisie = r ? r.uid : null;
        this.dessiner();
      });
    });

    // carte de la rune choisie
    this.g(panneau(this, 600, 60, 640, 250));
    const r = this.choisie !== null ? runes(j).find((x) => x.uid === this.choisie) : undefined;
    if (!r) this.g(texte(this, 920, 185, 'Touche un emplacement ou une rune de ton inventaire.', 15, '#93a89b', false, 0.5, 0.5));
    else this.carte(r, now);

    // inventaire
    this.inventaire(now);
    // préréglages
    this.g(texte(this, 600, 668, 'Préréglages', 13, '#c9cfc4', true, 0, 0.5));
    const pre = prereglages(j, this.uid);
    for (let i = 0; i < PREREGLAGES_MAX; i++) {
      const p = pre[i], x = 760 + i * 160;
      const b = bouton(this, x, 668, 110, 34, p ? `Mettre ${i + 1}` : `Vide ${i + 1}`, false, () => {
        if (!p) return this.message('Préréglage vide : touche « Enreg. » pour y garder les runes portées.');
        const c = coutPrereglage(this.joueur, this.uid, i, Date.now());
        this.faire((k) => appliquerPrereglage(k, this.uid, i, Date.now()));
        if (c) this.message(`Préréglage ${i + 1} remis : ${fmt(c)} kamas de retraits.`);
      });
      b.t.setFontSize(13); if (!p) b.fond.setAlpha(0.6); this.g(b.fond); this.g(b.t);
      const s = this.g(texte(this, x + 66, 668, 'Enreg.', 11, '#ffe08a', false, 0, 0.5));
      s.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.faire((k) => enregistrerPrereglage(k, this.uid, i, `Préréglage ${i + 1}`)); this.message(`Runes portées gardées dans le préréglage ${i + 1}.`); });
    }
    if (this.vente) this.fenetreVente();
  }

  private carte(r: Rune, now: number) {
    const j = this.joueur, c = COULEUR_GRADE[r.grade];
    this.g(texte(this, 624, 76, `Rune de ${SETS[r.set].dieu} (${r.emplacement})`, 19, '#ffffff', true, 0, 0));
    this.g(texte(this, 1216, 80, `${r.etoiles}★ ${GRADES[r.grade]} · +${r.niveau}`, 14, hexa(c), true, 1, 0));
    this.g(texte(this, 624, 104, `${SETS[r.set].nom} (${SETS[r.set].pieces}) : ${SETS[r.set].effet}`, 12, '#93a89b', false, 0, 0));
    this.g(texte(this, 624, 132, `${NOM_STAT_RUNE[r.principale]} +${valeurPrincipale(r)}`, 18, '#ffffff', true, 0, 0));
    r.sous.forEach((s, i) => this.g(texte(this, 624, 164 + i * 22, `${NOM_STAT_RUNE[s.stat]} +${s.valeur}${s.montees ? `  (+${s.montees})` : ''}`, 14, s.montees ? '#7fd05a' : '#c9cfc4', false, 0, 0)));
    for (let i = r.sous.length; i < 4; i++) this.g(texte(this, 624, 164 + i * 22, `— sous-stat à +${(i + 1) * 3}`, 13, '#5f6a5c', false, 0, 0));
    const porteur = r.porteur !== undefined ? monstre(j, r.porteur) : undefined;
    this.g(texte(this, 1216, 132, porteur ? (r.porteur === this.uid ? 'Portée par ce monstre' : `Portée par ${fiche(porteur.id).nom}`) : 'Dans l\'inventaire', 12, '#93a89b', false, 1, 0));

    const y = 280;
    if (r.niveau < 15) {
      const pal = Math.min(15, (Math.floor(r.niveau / 3) + 1) * 3), c1 = coutMontee(r, pal), c15 = coutMontee(r, 15);
      const b1 = bouton(this, 700, y, 170, 36, `+${pal} · ${fmt(c1)}`, true, () => this.monter(r, pal));
      b1.t.setFontSize(14); this.g(b1.fond); this.g(b1.t);
      if (pal < 15) { const b2 = bouton(this, 880, y, 180, 36, `+15 · ${fmt(c15)}`, false, () => this.monter(r, 15)); b2.t.setFontSize(13); this.g(b2.fond); this.g(b2.t); }
    }
    if (r.porteur === this.uid) {
      const cr = coutRetrait(j, r, now);
      const b = bouton(this, 1140, y, 150, 36, cr ? `Retirer · ${fmt(cr)}` : 'Retirer (gratuit)', false, () => {
        if (this.joueur.kamas < cr) return this.message(`Il te faut ${fmt(cr)} kamas pour retirer cette rune.`);
        this.faire((k) => retirerRune(k, r.uid, Date.now()));
      });
      b.t.setFontSize(13); this.g(b.fond); this.g(b.t);
    } else {
      const ce = coutEquiper(j, r.uid, this.uid, now);
      const b = bouton(this, 1140, y, 150, 36, ce ? `Équiper · ${fmt(ce)}` : 'Équiper', true, () => {
        if (this.joueur.kamas < ce) return this.message(`Il te faut ${fmt(ce)} kamas pour retirer les runes en place.`);
        this.faire((k) => equiper(k, r.uid, this.uid, Date.now()));
      });
      b.t.setFontSize(13); this.g(b.fond); this.g(b.t);
    }
    if (retraitGratuit(j, now)) this.g(texte(this, 1216, 250, 'Retraits gratuits (nouveau ou de retour)', 11, '#7fd05a', false, 1, 0.5));
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
      const y = 164 + p.sous * 22 + 9;
      const eclat = this.add.rectangle(920, y, 600, 22, p.nouvelle ? 0xffd23a : 0x7fd05a, 0.45).setDepth(2000);
      const t = texte(this, 1100, y, `+${p.niveau} : ${p.nouvelle ? 'nouvelle sous-stat !' : 'sous-stat renforcée !'}`, 15, p.nouvelle ? '#ffe08a' : '#b8f5a0', true, 0.5, 0.5).setDepth(2001);
      this.cameras.main.flash(120, 255, 230, 160, false);
      this.tweens.add({ targets: [eclat, t], alpha: 0, delay: 450, duration: 400, onComplete: () => { eclat.destroy(); t.destroy(); } });
    }));
    this.time.delayedCall(250 + res.paliers.length * 650 + 200, () => { this.occupe = false; });
  }

  private inventaire(now: number) {
    const j = this.joueur, e = this.emplacement;
    const liste = runes(j).filter((r) => r.porteur !== this.uid && (e === null || r.emplacement === e))
      .sort((a, b) => b.etoiles - a.etoiles || b.grade - a.grade || b.niveau - a.niveau);
    const parPage = 16, pages = Math.max(1, Math.ceil(liste.length / parPage));
    this.page = Math.min(this.page, pages - 1);
    this.g(panneau(this, 600, 322, 640, 318));
    this.g(texte(this, 620, 336, `Mes runes${e ? ` · emplacement ${e}` : ''} (${liste.length})`, 14, '#ffffff', true, 0, 0));
    const bv = bouton(this, 1150, 346, 150, 30, 'Vente sélective', false, () => { this.vente = { etoiles: 3, grade: 1 }; this.dessiner(); });
    bv.t.setFontSize(12); this.g(bv.fond); this.g(bv.t);
    if (!liste.length) this.g(texte(this, 920, 470, 'Aucune rune ici. Elles tombent dans les zones, les coffres des missions et le donjon.', 13, '#93a89b', false, 0.5, 0.5).setWordWrapWidth(520).setAlign('center'));
    liste.slice(this.page * parPage, (this.page + 1) * parPage).forEach((r, k) => {
      const x = 660 + (k % 8) * 74, y = 410 + Math.floor(k / 8) * 84, sel = this.choisie === r.uid;
      for (const o of runeMedaillon(this, r, x, y, 66, { choisie: sel, profondeur: 1000 })) this.g(o);
      const hx = this.g(this.add.zone(x, y, 64, 64).setDepth(1010));
      if (r.porteur !== undefined) this.g(texte(this, x, y + 41, 'portée', 10, '#93a89b', false, 0.5, 0.5));
      else if (e === null) this.g(texte(this, x, y + 41, `empl. ${r.emplacement}`, 10, '#93a89b', false, 0.5, 0.5));
      hx.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.occupe) { this.choisie = r.uid; this.dessiner(); } });
    });
    if (pages > 1) {
      this.g(texte(this, 920, 620, `${this.page + 1} / ${pages}`, 12, '#c9cfc4', false, 0.5, 0.5));
      if (this.page > 0) { const b = bouton(this, 850, 620, 50, 24, '‹', false, () => { this.page--; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
      if (this.page < pages - 1) { const b = bouton(this, 990, 620, 50, 24, '›', false, () => { this.page++; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
    }
    void now;
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
    const c = this.add.container(W / 2, 40, [f, tx]).setDepth(5000);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2400, duration: 500, onComplete: () => c.destroy() });
  }
}

