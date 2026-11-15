import Phaser from 'phaser';
import { text, TYPE_COLORS_CSS } from '../ui/style.js';
import { MAX_RANK } from '../entities/Player.js';

const fmtTime = (ms) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  init(data) { this.gameScene = data.game; }

  create() {
    this.g = this.add.graphics();
    this.levelText = this.add.text(0, 0, '', text(16));
    this.timeText = this.add.text(0, 0, '', text(22)).setOrigin(0.5, 0);
    this.killText = this.add.text(0, 0, '', text(14)).setOrigin(1, 0);
    this.hpText = this.add.text(0, 0, '', text(12));
    this.movesText = this.add.text(0, 0, '', text(13, '#ffffff', { lineSpacing: 4 }));
    this.pauseText = this.add.text(0, 0, 'PAUSA\nEsc / P para continuar', text(28, '#ffffff', { align: 'center' })).setOrigin(0.5).setVisible(false);
    this.announceText = this.add.text(0, 0, '', text(20, '#ffd84a')).setOrigin(0.5).setAlpha(0);

    this.gameScene.events.on('announce', this.announce, this);
    this.gameScene.events.once('shutdown', () => this.scene.stop());
  }

  announce(msg) {
    this.announceText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.announceText);
    this.tweens.add({ targets: this.announceText, alpha: 0, delay: 2200, duration: 600 });
  }

  update() {
    const gs = this.gameScene;
    const p = gs.player;
    if (!p) return;
    const { width: W, height: H } = this.scale;
    const g = this.g.clear();

    // Barra de XP arriba (ancho completo).
    g.fillStyle(0x000000, 0.6).fillRect(0, 0, W, 10);
    g.fillStyle(0x5ad1ff, 1).fillRect(0, 0, W * p.xpProgress(), 10);
    this.levelText.setPosition(10, 14).setText(`${p.data_.name}  Nv. ${p.level}`);

    // Barra de PS.
    const hw = 200, hx = 10, hy = 38;
    const ratio = Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1);
    g.fillStyle(0x000000, 0.6).fillRect(hx - 2, hy - 2, hw + 4, 14);
    g.fillStyle(ratio > 0.5 ? 0x4ade5a : ratio > 0.2 ? 0xffc83a : 0xff4a4a, 1).fillRect(hx, hy, hw * ratio, 10);
    this.hpText.setPosition(hx + hw + 8, hy - 3).setText(`${Math.ceil(p.hp)}/${p.maxHp}`);

    this.timeText.setPosition(W / 2, 14).setText(fmtTime(gs.elapsed));
    this.killText.setPosition(W - 10, 14).setText(`Derrotados: ${gs.kills}`);

    // Movimientos con indicador de recarga.
    const now = gs.time.now;
    let y = H - 14 - p.slots.length * 22;
    p.slots.forEach((s) => {
      const left = Phaser.Math.Clamp((s.nextAt - now) / s.attack.cooldown, 0, 1);
      g.fillStyle(Phaser.Display.Color.HexStringToColor(TYPE_COLORS_CSS[s.move.type] ?? '#888').color, 1).fillRect(10, y + 2, 14, 14);
      g.fillStyle(0x000000, 0.6).fillRect(10, y + 2, 14, 14 * left);
      y += 22;
    });
    this.movesText.setPosition(30, H - 14 - p.slots.length * 22)
      .setText(p.slots.map((s) => `${s.move.name}${s.rank > 1 ? ` +${s.rank - 1}` : ''}${s.rank >= MAX_RANK ? ' (máx)' : ''}`).join('\n'));

    this.pauseText.setPosition(W / 2, H / 2).setVisible(!!gs.paused && !gs.scene.isActive('LevelUp') && !gs.over);
    this.announceText.setPosition(W / 2, H * 0.22);
  }
}
