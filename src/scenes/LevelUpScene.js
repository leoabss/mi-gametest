import Phaser from 'phaser';
import { damagingLearnset, typeName } from '../data/index.js';
import { moveToAttack, describeAttack } from '../systems/MoveRules.js';
import { MAX_MOVES, MAX_RANK } from '../entities/Player.js';
import { text, TYPE_COLORS_CSS } from '../ui/style.js';
import { onKeys } from '../ui/keys.js';

const PASSIVES = [
  { id: 'hp', name: 'Más PS', desc: '+15% PS máximos y cura', max: 5 },
  { id: 'power', name: 'Más fuerza', desc: '+12% daño de todos los ataques', max: 5 },
  { id: 'speed', name: 'Agilidad', desc: '+10% velocidad de movimiento', max: 5 },
  { id: 'magnet', name: 'Imán', desc: '+40% radio de recogida de XP', max: 3 },
  { id: 'regen', name: 'Restos', desc: 'Recupera PS poco a poco', max: 3 },
];

// Genera las opciones de subida de nivel a partir del learnset (reglas, no listas fijas).
export function buildOptions(player) {
  const known = new Set(player.slots.map((s) => s.move.key));
  const opts = [];

  if (player.slots.length < MAX_MOVES) {
    // Movimientos que ya podría haber aprendido por nivel; se prioriza el de nivel más alto (el más nuevo).
    const learnable = damagingLearnset(player.data_)
      .filter((m) => m.level <= player.level && !known.has(m.move.key))
      .reverse()
      .slice(0, 3);
    for (const { move } of learnable) {
      opts.push({ weight: 3, title: `Aprender ${move.name}`, color: TYPE_COLORS_CSS[move.type],
        desc: `${typeName(move.type)} · ${describeAttack(moveToAttack(move))}`, apply: (p) => p.learnMove(move) });
    }
  }
  for (const s of player.slots) {
    if (s.rank >= MAX_RANK) continue;
    opts.push({ weight: 2, title: `${s.move.name} +${s.rank}`, color: TYPE_COLORS_CSS[s.move.type],
      desc: '+20% potencia, -8% recarga, +área; cada 2 mejoras +1 golpe', apply: (p) => p.upgradeMove(s.move.key) });
  }
  for (const ps of PASSIVES) {
    if (player.passives[ps.id] >= ps.max) continue;
    opts.push({ weight: 1, title: `${ps.name} (${player.passives[ps.id] + 1}/${ps.max})`, color: '#cfd6e6', desc: ps.desc,
      apply: (p) => { p.passives[ps.id]++; p.recalcStats(); if (ps.id === 'hp') p.heal(p.maxHp * 0.3); } });
  }

  // 3 opciones ponderadas sin repetir.
  const chosen = [];
  while (chosen.length < 3 && opts.length) {
    let r = Math.random() * opts.reduce((a, o) => a + o.weight, 0);
    const i = opts.findIndex((o) => (r -= o.weight) <= 0);
    chosen.push(...opts.splice(i < 0 ? 0 : i, 1));
  }
  if (!chosen.length) chosen.push({ title: 'Baya Aranja', desc: 'Recupera 30% de PS', color: '#5aa0ff', apply: (p) => p.heal(p.maxHp * 0.3) });
  return chosen;
}

export class LevelUpScene extends Phaser.Scene {
  constructor() { super('LevelUp'); }

  init(data) { this.gameScene = data.game; }

  create() {
    const p = this.gameScene.player;
    const { width: W, height: H } = this.scale;
    this.options = buildOptions(p);
    this.index = 0;

    this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0);
    this.add.text(W / 2, H * 0.18, `¡${p.data_.name} subió al nivel ${p.level}!`, text(28, '#ffd84a')).setOrigin(0.5);

    const cw = Math.min(280, (W - 40) / 3 - 12), ch = 150;
    this.cards = this.options.map((o, i) => {
      const x = W / 2 + (i - (this.options.length - 1) / 2) * (cw + 14), y = H * 0.48;
      const bg = this.add.rectangle(x, y, cw, ch, 0x1d2433, 0.98).setStrokeStyle(3, 0x3a4560).setInteractive({ useHandCursor: true });
      this.add.rectangle(x, y - ch / 2 + 4, cw, 8, Phaser.Display.Color.HexStringToColor(o.color ?? '#ffffff').color);
      this.add.text(x, y - 34, `${i + 1}. ${o.title}`, text(17, '#ffffff', { align: 'center', wordWrap: { width: cw - 16 } })).setOrigin(0.5);
      this.add.text(x, y + 22, o.desc, text(13, '#cfd6e6', { align: 'center', wordWrap: { width: cw - 20 } })).setOrigin(0.5);
      bg.on('pointerover', () => { this.index = i; this.refresh(); });
      bg.on('pointerdown', () => this.choose(i));
      return bg;
    });
    this.add.text(W / 2, H * 0.48 + ch / 2 + 30, '1 / 2 / 3, flechas + Enter, o clic', text(13, '#9aa6c0')).setOrigin(0.5);

    ['ONE', 'TWO', 'THREE'].forEach((k, i) => onKeys(this, [k, `NUMPAD_${k}`], () => this.choose(i)));
    onKeys(this, ['LEFT', 'A'], () => this.step(-1));
    onKeys(this, ['RIGHT', 'D'], () => this.step(1));
    onKeys(this, ['ENTER', 'SPACE'], () => this.choose(this.index));
    this.refresh();
    this.ready = false;
    this.time.delayedCall(250, () => { this.ready = true; }); // evita elegir por accidente
  }

  step(d) { this.index = Phaser.Math.Wrap(this.index + d, 0, this.options.length); this.refresh(); }

  refresh() { this.cards.forEach((c, i) => c.setStrokeStyle(3, i === this.index ? 0xffd84a : 0x3a4560)); }

  choose(i) {
    if (!this.ready || !this.options[i]) return;
    this.ready = false;
    this.options[i].apply(this.gameScene.player);
    this.scene.stop();
    this.gameScene.closeLevelUp();
  }
}
