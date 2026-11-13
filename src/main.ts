import Phaser from 'phaser';
import { CombatScene } from './render/CombatScene';
import { VitrineScene } from './render/VitrineScene';
import { MaquetteEveils } from './render/maquettes/MaquetteEveils';

// Polices de Dofus 3 (Lexend pour l'interface, Rowdies pour les chiffres), chargées avant le premier texte
await Promise.all(['400 16px Lexend', '600 16px Lexend', '16px Rowdies'].map((f) => document.fonts.load(f).catch(() => undefined)));

// #vitrine : vitrine des planches ; #maquette-<nom> : maquette jouable avec son panneau de questions ; sinon le combat
const MAQUETTES: Record<string, typeof Phaser.Scene> = { '#maquette-eveils': MaquetteEveils };
const maquette = MAQUETTES[location.hash];
if (maquette) document.getElementById('jeu')!.style.width = 'calc(100% - min(380px, 42vw))';
const scenes = maquette ? [maquette] : location.hash === '#vitrine' ? [VitrineScene, CombatScene] : [CombatScene, VitrineScene];

const jeu = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'jeu',
  backgroundColor: '#0e1916',
  // Les planches et les arènes viennent du R2 de Diablofus : images demandées en CORS
  loader: { crossOrigin: 'anonymous' },
  // Paysage uniquement (maquette « Combat : » 5A) : écran de 1280 × 720 mis à l'échelle
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280, height: 720 },
  scene: scenes,
});

// Accès depuis la console du navigateur (débogage) : window.game.scene.getScene('combat')
(window as unknown as { game: Phaser.Game }).game = jeu;
