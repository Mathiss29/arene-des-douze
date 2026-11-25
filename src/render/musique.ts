import Phaser from 'phaser';

/**
 * Musique du jeu (faite avec Suno par Mathis, forfait gratuit : usage non commercial).
 * Une seule piste à la fois, gardée d'un écran à l'autre (le gestionnaire de sons de Phaser est commun à toutes les scènes),
 * fondu entre deux pistes. Chargée en arrière-plan pour ne pas retarder l'écran. Volume réglé dans les Options.
 * Sur navigateur, le son ne démarre qu'après une première touche ou un clic : Phaser attend ce moment tout seul.
 */
const CLE_VOLUME = 'arene-des-douze:volume-musique';
export const PISTES: Record<string, string> = {
  incarnam: 'assets/musique/incarnam.mp3', // « Waltz de Magie »
  combat: 'assets/musique/combat.mp3', // « Heroic Charge »
};

/** Piste de chaque écran : la musique de combat en combat, celle d'Incarnam ailleurs. */
export const pisteDe = (scene: string) => (scene === 'combat' ? 'combat' : 'incarnam');

let courante: Phaser.Sound.BaseSound | null = null;
let nomCourant = '';

export function volumeMusique(): number {
  try { const v = Number(localStorage.getItem(CLE_VOLUME)); return localStorage.getItem(CLE_VOLUME) === null ? 0.6 : Math.min(1, Math.max(0, v)); } catch { return 0.6; }
}

export function reglerVolume(v: number) {
  try { localStorage.setItem(CLE_VOLUME, String(v)); } catch { /* rien */ }
  if (courante) (courante as Phaser.Sound.WebAudioSound).setVolume(v);
}

export function jouerMusique(scene: Phaser.Scene, nom: string) {
  if (nomCourant === nom && courante?.isPlaying) return;
  const url = PISTES[nom];
  if (!url) return;
  nomCourant = nom;
  const cle = `musique_${nom}`;
  const lancer = () => {
    if (nomCourant !== nom) return;
    const sons = scene.sys.game.sound;
    const ancienne = courante;
    if (ancienne) fondu(ancienne, 0, 1200, () => ancienne.destroy());
    const s = sons.add(cle, { loop: true }) as Phaser.Sound.WebAudioSound;
    s.setVolume(0);
    courante = s;
    const partir = () => { if (courante !== s) return; s.play(); fondu(s, volumeMusique(), 2000); };
    if (sons.locked) sons.once(Phaser.Sound.Events.UNLOCKED, partir); else partir();
  };
  if (scene.sys.game.cache.audio.exists(cle)) return lancer();
  // chargement hors du chargeur des scènes (il est partagé avec leurs planches et leurs événements « complete »)
  const son = scene.sys.game.sound as Phaser.Sound.WebAudioSoundManager;
  if (EN_COURS.has(cle)) return;
  EN_COURS.add(cle);
  fetch(url).then((r) => r.arrayBuffer()).then((buf) => {
    if (son.decodeAudio) {
      const fini = (k: string) => { if (k !== cle) return; son.off(Phaser.Sound.Events.DECODED, fini); EN_COURS.delete(cle); lancer(); };
      son.on(Phaser.Sound.Events.DECODED, fini);
      son.decodeAudio(cle, buf);
    }
  }).catch(() => EN_COURS.delete(cle));
}

const EN_COURS = new Set<string>();

/** Fondu indépendant des scènes (une scène arrêtée n'anime plus ses tweens). */
function fondu(son: Phaser.Sound.BaseSound, cible: number, ms: number, fin?: () => void) {
  const s = son as Phaser.Sound.WebAudioSound, depart = s.volume, t0 = performance.now();
  const id = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    if (!s.manager) { clearInterval(id); return; }
    s.setVolume(depart + (cible - depart) * k);
    if (k >= 1) { clearInterval(id); fin?.(); }
  }, 50);
}
