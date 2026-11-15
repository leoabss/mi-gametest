import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { SelectScene } from './scenes/SelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { UIScene } from './scenes/UIScene.js';
import { LevelUpScene } from './scenes/LevelUpScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';

// Expuesto en window para depuración desde la consola del navegador.
window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#10141c',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, SelectScene, GameScene, UIScene, LevelUpScene, GameOverScene],
});
