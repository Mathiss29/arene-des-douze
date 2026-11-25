import Phaser from 'phaser';
import { CombatScene } from './render/CombatScene';
import { PreparationScene } from './render/PreparationScene';
import { CercleScene } from './render/CercleScene';
import { IleScene } from './render/IleScene';
import { ZaapScene } from './render/ZaapScene';
import { InvocationScene } from './render/InvocationScene';
import { MissionsScene } from './render/MissionsScene';
import { ReceptionScene } from './render/ReceptionScene';
import { MonstreScene } from './render/MonstreScene';
import { DonjonsScene } from './render/DonjonsScene';
import { CheminScene } from './render/CheminScene';
import { BestiaireScene } from './render/BestiaireScene';
import { VitrineScene } from './render/VitrineScene';
import { MaquetteEveils } from './render/maquettes/MaquetteEveils';
import { MaquetteEcrans } from './render/maquettes/MaquetteEcrans';
import { camerasNettes, facteurNettete, textesNets } from './render/nettete';
import { OptionsScene } from './render/OptionsScene';
import { MonstresScene } from './render/MonstresScene';
import { jouerMusique, pisteDe } from './render/musique';
import { noterErreur } from './render/sauvegarde';

// erreurs gardées pour « Signaler un bug » (Options)
window.addEventListener('error', (e) => noterErreur(`${e.message} @ ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => noterErreur(`promesse : ${String(e.reason)}`));
const erreurConsole = console.error.bind(console);
console.error = (...a: unknown[]) => { noterErreur(a.map(String).join(' ')); erreurConsole(...a); };

// Polices de Dofus 3 (Lexend pour l'interface, Rowdies pour les chiffres), chargées avant le premier texte
await Promise.all(['400 16px Fredoka', '600 16px Fredoka', '400 16px Lexend', '600 16px Lexend', '16px Rowdies'].map((f) => document.fonts.load(f).catch(() => undefined)));

// #vitrine : vitrine des planches ; #maquette-<nom> : maquette jouable avec son panneau de questions ; sinon l'île d'Incarnam
const MAQUETTES: Record<string, typeof Phaser.Scene> = { '#maquette-eveils': MaquetteEveils, '#maquette-ecrans': MaquetteEcrans };
const maquette = MAQUETTES[location.hash];
if (maquette) document.getElementById('jeu')!.style.width = 'calc(100% - min(380px, 42vw))';
const scenes = maquette ? [maquette] : location.hash === '#vitrine' ? [VitrineScene, IleScene, ZaapScene, InvocationScene, MissionsScene, PreparationScene, CombatScene, CercleScene] : [IleScene, ZaapScene, InvocationScene, MissionsScene, ReceptionScene, MonstreScene, DonjonsScene, CheminScene, BestiaireScene, OptionsScene, MonstresScene, PreparationScene, CombatScene, CercleScene, VitrineScene];

// Netteté : canevas à la taille réelle de l'écran (voir nettete.ts)
const K = facteurNettete(document.getElementById('jeu')!);
textesNets(K);

const jeu = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'jeu',
  backgroundColor: '#0e1916',
  // Les planches et les arènes viennent du R2 de Diablofus : images demandées en CORS
  loader: { crossOrigin: 'anonymous' },
  // Paysage uniquement (maquette « Combat : » 5A) : écran de 1280 × 720 mis à l'échelle
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: 1280 * K, height: 720 * K },
  scene: scenes,
});

// Accès depuis la console du navigateur (débogage) : window.game.scene.getScene('combat')
camerasNettes(jeu, K);

(window as unknown as { game: Phaser.Game }).game = jeu;

// Musique : chaque écran lance sa piste en s'ouvrant (fondu ; rien ne change si c'est déjà la bonne). Pas dans les maquettes.
if (!maquette) jeu.events.once(Phaser.Core.Events.READY, () => {
  for (const s of jeu.scene.getScenes(false)) s.events.on(Phaser.Scenes.Events.CREATE, () => jouerMusique(s, pisteDe(s.scene.key)));
});
