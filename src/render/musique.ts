import Phaser from 'phaser';

/**
 * Musique du jeu (faite avec Suno par Mathis, forfait gratuit : usage non commercial).
 * Une seule piste à la fois, gardée d'un écran à l'autre (le gestionnaire de sons de Phaser est commun à toutes les scènes),
 * fondu entre deux pistes. Chargée en arrière-plan pour ne pas retarder l'écran. Volume réglé dans les Options.
 * Sur navigateur, le son ne démarre qu'après une première touche ou un clic : Phaser attend ce moment tout seul.
 */
const CLE_VOLUME = 'arene-des-douze:volume-musique';
export const PISTES: Record<string, string> = { incarnam: 'assets/musique/incarnam.mp3' };

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
    if (nomCourant !== nom || !scene.sys.game) return;
    const ancienne = courante;
    if (ancienne) scene.tweens.add({ targets: ancienne, volume: 0, duration: 1200, onComplete: () => ancienne.destroy() });
    const s = scene.sound.add(cle, { loop: true, volume: 0 });
    courante = s;
    const fondu = () => scene.tweens.add({ targets: s, volume: volumeMusique(), duration: 2000 });
    if (scene.sound.locked) scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => { s.play(); fondu(); });
    else { s.play(); fondu(); }
  };
  if (scene.cache.audio.exists(cle)) return lancer();
  scene.load.audio(cle, url);
  scene.load.once(`filecomplete-audio-${cle}`, lancer);
  scene.load.start();
}
