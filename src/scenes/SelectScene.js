import Phaser from 'phaser';
import { STARTERS, ENEMIES, damagingLearnset, typeName } from '../data/index.js';
import { animKey, SpriteLoader } from '../systems/SpriteLoader.js';
import { moveToAttack, describeAttack } from '../systems/MoveRules.js';
import { text, TYPE_COLORS_CSS } from '../ui/style.js';
import { onKeys } from '../ui/keys.js';

const STAT_LABELS = { hp: 'PS', attack: 'Ataque', defense: 'Defensa', spAttack: 'At. Esp.', spDefense: 'Def. Esp.', speed: 'Velocidad' };

export class SelectScene extends Phaser.Scene {
  constructor() { super('Select'); }

  create() {
    this.index = 0;
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.build, this));

    this.started = false;
    onKeys(this, ['LEFT', 'A'], () => this.move(-1));
    onKeys(this, ['RIGHT', 'D'], () => this.move(1));
    onKeys(this, ['ENTER', 'SPACE'], () => this.start());
  }

  move(d) { this.index = Phaser.Math.Wrap(this.index + d, 0, STARTERS.length); this.refresh(); }

  start() {
    if (this.started) return;
    this.started = true;
    this.scene.start('Game', { starterId: STARTERS[this.index].id });
  }

  build() {
    this.children.removeAll(true);
    const { width: W, height: H } = this.scale;
    const s = Math.min(1, W / 900, H / 640);
    this.add.text(W / 2, 40 * s + 10, 'POKÉMON SURVIVORS', text(Math.round(40 * s), '#ffd84a')).setOrigin(0.5);
    this.add.text(W / 2, 80 * s + 14, 'Elige tu Pokémon inicial', text(Math.round(20 * s))).setOrigin(0.5);

    const cw = Math.min(260, (W - 60) / 3), ch = 380 * s;
    const top = H * 0.17 + 10;
    this.cards = STARTERS.map((p, i) => {
      const x = W / 2 + (i - 1) * (cw + 16);
      const y0 = top; // borde superior de la tarjeta
      const bg = this.add.rectangle(x, y0 + ch / 2, cw, ch, 0x1d2433, 0.95).setStrokeStyle(3, 0x3a4560).setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => { this.index = i; this.refresh(); });
      bg.on('pointerdown', () => { this.index = i; this.start(); });

      const sprite = this.add.sprite(x, y0 + 70 * s, SpriteLoader.firstFrame(p.id, 'Idle').texture).setScale(3 * s);
      sprite.play(animKey(p.id, SpriteLoader.resolve(p.id, 'Idle'), 0));
      this.add.text(x, y0 + 140 * s, p.name, text(Math.round(24 * s))).setOrigin(0.5);
      const types = p.types.map((t) => typeName(t)).join(' / ');
      this.add.text(x, y0 + 168 * s, types, text(Math.round(15 * s), TYPE_COLORS_CSS[p.types[0]])).setOrigin(0.5);

      const lines = Object.entries(p.stats).map(([k, v]) => `${STAT_LABELS[k].padEnd(10)} ${String(v).padStart(3)}`);
      this.add.text(x, y0 + 186 * s, lines.join('\n'), text(Math.round(13 * s), '#cfd6e6', { fontFamily: 'monospace', align: 'left' })).setOrigin(0.5, 0);

      const first = damagingLearnset(p).filter((m) => m.level <= 5);
      const pick = first.find((m) => p.types.includes(m.move.type)) ?? first[0];
      const atk = moveToAttack(pick.move);
      this.add.text(x, y0 + 340 * s, `${pick.move.name}\n${describeAttack(atk)}`, text(Math.round(12 * s), '#ffd84a', { align: 'center', wordWrap: { width: cw - 16 } })).setOrigin(0.5);
      return { bg, sprite, p };
    });

    const ey = top + ch + 26 * s;
    this.add.text(W / 2, ey, 'Enemigos salvajes:', text(Math.round(14 * s), '#9aa6c0')).setOrigin(0.5);
    ENEMIES.forEach((p, i) => {
      const x = W / 2 + (i - (ENEMIES.length - 1) / 2) * 70 * s;
      const sp = this.add.sprite(x, ey + 34 * s, SpriteLoader.firstFrame(p.id).texture).setScale(1.5 * s);
      sp.play(animKey(p.id, 'Walk', 0));
    });
    this.add.text(W / 2, H - 22, '← → / A D para elegir · Enter o clic para empezar · WASD para moverse', text(Math.round(13 * s), '#9aa6c0')).setOrigin(0.5);
    this.add.text(W - 8, H - 6, 'Fangame no comercial · Sprites: PMD SpriteCollab (CC BY-NC 4.0) · Datos: PokeAPI', text(10, '#6b7590')).setOrigin(1, 1);
    this.refresh();
  }

  refresh() {
    this.cards?.forEach((c, i) => {
      const on = i === this.index;
      c.bg.setStrokeStyle(3, on ? 0xffd84a : 0x3a4560);
      const walkOrIdle = on ? 'Walk' : SpriteLoader.resolve(c.p.id, 'Idle');
      const key = animKey(c.p.id, walkOrIdle, 0);
      if (c.sprite.anims.currentAnim?.key !== key) c.sprite.play(key);
    });
  }
}
