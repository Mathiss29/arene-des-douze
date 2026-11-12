import Phaser from 'phaser';
import { VitrineScene } from './render/VitrineScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'jeu',
  backgroundColor: '#0e1916',
  // Les planches viennent du R2 de Diablofus : images demandées en CORS
  loader: { crossOrigin: 'anonymous' },
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  scene: [VitrineScene],
});
