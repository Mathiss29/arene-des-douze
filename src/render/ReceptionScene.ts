import Phaser from 'phaser';
import { bandeauPierre, chargerIdentite, decorVivant } from './identite';
import { charger, sauver } from './sauvegarde';
import type { Joueur } from '../sim/joueur';
import { fiche } from '../sim/fiches';
import { PIERRES, type Pierre } from '../sim/invocation';
import { cadeaux, marquerVus, recevoir, recevoirEnergie, recevoirTout, refusCadeau, utiliserCode, type Contenu } from '../sim/reception';
import { OR, POLICE, W, bouton, chargerUi, fmt, panneau, portrait, texte } from './ui';

/**
 * Réception (maquette « Réception : » 1A 2C 3B 4A 5C 6C 7B) : les cadeaux qui attendent, « Nouveau » sur ceux pas encore vus,
 * « Recevoir », « Tout recevoir » (sans l'énergie), « Recevoir l'énergie », et un code à taper (codes partagés sur Discord).
 */
const X0 = 150, LARG = W - 300, PAR_PAGE = 9;

export class ReceptionScene extends Phaser.Scene {
  private joueur!: Joueur;
  private nouveaux = new Set<string>();
  private page = 0;
  private calque: Phaser.GameObjects.GameObject[] = [];
  private avis?: Phaser.GameObjects.Container;

  constructor() { super('reception'); }

  init() {
    this.joueur = charger(); this.calque = []; this.page = 0;
    const now = Date.now();
    this.nouveaux = new Set(cadeaux(this.joueur, now).filter((c) => !c.vu).map((c) => c.id));
    this.joueur = marquerVus(this.joueur, now); sauver(this.joueur);
  }

  preload() {
    chargerUi(this, []); // portraits : vignettes seulement
    chargerIdentite(this);
  }

  create() {
    decorVivant(this);
    bandeauPierre(this, 'Incarnam', () => this.scene.start('ile'));
    texte(this, W / 2, 25, 'Réception', 21, '#eef2e4', true, 0.5, 0.5).setDepth(2001);
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
    const now = Date.now(), liste = cadeaux(this.joueur, now);
    const pages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
    this.page = Math.min(this.page, pages - 1);
    this.g(panneau(this, X0, 60, LARG, 640));
    this.g(texte(this, X0 + 24, 76, 'Réception', 22, '#ffffff', true, 0, 0));
    this.g(texte(this, X0 + 150, 84, liste.length ? `${liste.length} cadeau${liste.length > 1 ? 'x' : ''}` : '', 13, '#c9cfc4', false, 0, 0));
    const energie = liste.some((c) => c.contenu.energie), autres = liste.some((c) => !c.contenu.energie && !refusCadeau(this.joueur, c));
    if (energie) { const b = bouton(this, X0 + LARG - 330, 92, 180, 36, 'Recevoir l\'énergie', false, () => this.faire((j) => recevoirEnergie(j, Date.now()))); this.g(b.fond); this.g(b.t); }
    if (autres) { const b = bouton(this, X0 + LARG - 120, 92, 180, 40, 'Tout recevoir', true, () => this.faire((j) => recevoirTout(j, Date.now()))); this.g(b.fond); this.g(b.t); }

    if (!liste.length) this.g(texte(this, W / 2, 360, 'Rien pour l\'instant. Ganymède te préviendra quand un cadeau arrivera.', 16, '#c9cfc4', false, 0.5, 0.5));
    const y0 = 160, pas = 52;
    liste.slice(this.page * PAR_PAGE, (this.page + 1) * PAR_PAGE).forEach((c, k) => {
      const y = y0 + k * pas, refus = refusCadeau(this.joueur, c);
      this.g(this.add.rectangle(X0 + 24, y, LARG - 48, pas - 8, k % 2 ? 0x16211c : 0x1a2620).setOrigin(0, 0.5).setDepth(999));
      if (this.nouveaux.has(c.id)) this.g(texte(this, X0 + 36, y, 'Nouveau', 11, '#1c1400', true, 0, 0.5).setBackgroundColor('#e3b54c').setPadding(6, 2, 6, 2).setShadow(0, 0, '#000', 0));
      if (c.contenu.monstre) { const pt = portrait(this, c.contenu.monstre, X0 + 130, y, 38, false); this.g(pt.sp); this.g(pt.masque); }
      this.g(texte(this, X0 + 160, y - 9, c.titre, 15, '#ffffff', false, 0, 0.5));
      this.g(texte(this, X0 + 160, y + 11, contenu(c.contenu), 13, OR, false, 0, 0.5));
      const reste = c.expire === undefined ? 'Sans limite' : duree(c.expire - now);
      this.g(texte(this, X0 + LARG - 230, y, reste, 13, c.expire !== undefined && c.expire - now < 86_400_000 ? '#ff9b7a' : '#c9cfc4', false, 0.5, 0.5));
      if (refus) {
        const b = bouton(this, X0 + LARG - 100, y, 150, 32, 'Collection pleine', false, () => this.message('Ta collection est pleine : fais de la place au Cercle d\'amélioration.'));
        b.fond.setAlpha(0.6); b.t.setFontSize(12); this.g(b.fond); this.g(b.t);
      } else {
        const b = bouton(this, X0 + LARG - 100, y, 150, 32, 'Recevoir', true, () => this.faire((j) => recevoir(j, c.id, Date.now())));
        b.t.setFontSize(14); this.g(b.fond); this.g(b.t);
      }
    });

    if (pages > 1) {
      this.g(texte(this, W / 2, 652, `${this.page + 1} / ${pages}`, 14, '#c9cfc4', false, 0.5, 0.5));
      if (this.page > 0) { const b = bouton(this, W / 2 - 90, 652, 60, 30, '‹', false, () => { this.page--; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
      if (this.page < pages - 1) { const b = bouton(this, W / 2 + 90, 652, 60, 30, '›', false, () => { this.page++; this.dessiner(); }); this.g(b.fond); this.g(b.t); }
    }
    // code (choix 6C)
    const bc = bouton(this, X0 + 110, 668, 180, 36, 'Entrer un code', false, () => this.code());
    this.g(bc.fond); this.g(bc.t);
  }

  private code() {
    const saisi = window.prompt('Code cadeau :');
    if (!saisi) return;
    const r = utiliserCode(this.joueur, saisi, Date.now());
    if (r.erreur) return this.message(r.erreur === 'deja' ? 'Ce code a déjà été utilisé.' : 'Ce code n\'existe pas.');
    this.joueur = r.joueur; sauver(this.joueur);
    this.nouveaux.add(`code:${r.cadeau!.id}`);
    this.message(`Cadeau reçu : ${r.cadeau!.titre}`);
    this.dessiner();
  }

  private message(s: string) {
    this.avis?.destroy();
    const tx = this.add.text(0, 0, s, { fontFamily: POLICE, fontSize: '15px', color: '#ffffff', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5);
    const f = this.add.rectangle(0, 0, tx.width + 36, tx.height + 22, 0x0c1410, 0.95).setStrokeStyle(1.5, 0xb08a3a);
    const c = this.add.container(W / 2, 130, [f, tx]).setDepth(5000);
    this.avis = c;
    this.tweens.add({ targets: c, alpha: 0, delay: 2200, duration: 500, onComplete: () => c.destroy() });
  }
}

function contenu(c: Contenu): string {
  const l: string[] = [];
  if (c.monstre) l.push(`${fiche(c.monstre).nom} ${'★'.repeat(fiche(c.monstre).etoiles)}`);
  if (c.kamas) l.push(`${fmt(c.kamas)} kamas`);
  if (c.pierresAme) l.push(`${c.pierresAme} pierre${c.pierresAme > 1 ? 's' : ''} d'âme`);
  for (const [p, n] of Object.entries(c.pierres ?? {})) if (n) l.push(`${PIERRES[p as Pierre].nom} ×${n}`);
  if (c.energie) l.push(`${c.energie} énergie`);
  if (c.fragments) l.push(`${c.fragments} fragment${c.fragments > 1 ? 's' : ''}`);
  if (c.runes?.length) l.push(`${c.runes.length} rune${c.runes.length > 1 ? 's' : ''} ${c.runes[0].etoiles}★`);
  return l.join(' · ');
}

function duree(ms: number): string {
  const j = Math.floor(ms / 86_400_000), h = Math.floor((ms % 86_400_000) / 3_600_000);
  return j > 0 ? `${j} j ${h} h` : `${h} h`;
}
