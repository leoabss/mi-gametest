import Phaser from 'phaser';
import { text } from '../ui/style.js';
import { onKeys } from '../ui/keys.js';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create({ name, level, kills, time }) {
    const { width: W, height: H } = this.scale;
    const s = Math.floor(time / 1000);
    this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0);
    this.add.text(W / 2, H * 0.3, `¡${name} se ha debilitado!`, text(32, '#ff6a6a')).setOrigin(0.5);
    this.add.text(W / 2, H * 0.46,
      `Tiempo: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}\nNivel alcanzado: ${level}\nDerrotados: ${kills}`,
      text(20, '#ffffff', { align: 'center', lineSpacing: 8 })).setOrigin(0.5);
    this.add.text(W / 2, H * 0.66, 'Enter o clic para volver a jugar', text(16, '#ffd84a')).setOrigin(0.5);

    let done = false;
    const restart = () => {
      if (done) return;
      done = true;
      this.scene.stop('UI');
      this.scene.stop('Game');
      this.scene.start('Select');
    };
    this.time.delayedCall(400, () => {
      onKeys(this, ['ENTER', 'SPACE'], restart);
      this.input.once('pointerdown', restart);
    });
  }
}
