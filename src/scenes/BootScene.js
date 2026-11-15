import Phaser from 'phaser';
import { POKEMON } from '../data/index.js';
import { SpriteLoader } from '../systems/SpriteLoader.js';
import { createTextures } from '../ui/textures.js';
import { text } from '../ui/style.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 150, height / 2, 0, 10, 0xffd84a).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2, 304, 14).setStrokeStyle(2, 0xffffff);
    this.add.text(width / 2, height / 2 - 30, 'Cargando…', text(18)).setOrigin(0.5);
    this.load.on('progress', (v) => { bar.width = 300 * v; });
    SpriteLoader.preload(this, Object.keys(POKEMON));
  }

  create() {
    SpriteLoader.createAnimations(this);
    createTextures(this);
    this.scene.start('Select');
  }
}
