import Phaser from 'phaser';
import { PokemonActor } from './PokemonActor.js';
import { statsAt, xpForLevel, damagingLearnset } from '../data/index.js';
import { moveToAttack } from '../systems/MoveRules.js';

export const MAX_MOVES = 4;
export const MAX_RANK = 5;

export class Player extends PokemonActor {
  constructor(scene, x, y, pokemonId) {
    super(scene, x, y, pokemonId);
    this.level = 5;
    this.xp = xpForLevel(this.level);
    this.passives = { hp: 0, speed: 0, power: 0, magnet: 0, regen: 0 };
    this.recalcStats();
    this.hp = this.maxHp;
    this.invulnUntil = 0;
    this.moving = false;
    this.slots = [];

    // Movimiento inicial (regla): el movimiento con daño de su tipo (STAB) aprendido a menor nivel; si no hay, el primero.
    const learnable = damagingLearnset(this.data_).filter((m) => m.level <= this.level);
    const pool = learnable.length ? learnable : damagingLearnset(this.data_).slice(0, 1);
    const stab = pool.find((m) => this.types.includes(m.move.type));
    this.learnMove((stab ?? pool[0]).move);

    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    this.setupTouch();
  }

  setupTouch() {
    // Joystick virtual: arrastrar en cualquier parte de la pantalla.
    this.touch = null;
    const input = this.scene.input;
    input.on('pointerdown', (p) => { this.touch = { x: p.x, y: p.y, dx: 0, dy: 0 }; });
    input.on('pointermove', (p) => { if (this.touch && p.isDown) { this.touch.dx = p.x - this.touch.x; this.touch.dy = p.y - this.touch.y; } });
    input.on('pointerup', () => { this.touch = null; });
  }

  recalcStats() {
    this.stats = statsAt(this.data_, this.level);
    const oldMax = this.maxHp ?? 0;
    // Regla survivors: el jugador aguanta mucho más que en un combate por turnos (PS x4).
    this.maxHp = Math.round(this.stats.hp * 4 * (1 + 0.15 * this.passives.hp));
    if (oldMax) this.hp = Math.min(this.maxHp, this.hp + Math.max(0, this.maxHp - oldMax));
    this.damageMult = 1 + 0.12 * this.passives.power;
    this.speed = (52 + this.data_.stats.speed * 0.3) * (1 + 0.1 * this.passives.speed);
    this.magnetRadius = 40 * (1 + 0.4 * this.passives.magnet);
  }

  learnMove(move) {
    const attack = moveToAttack(move);
    if (!attack) return;
    this.slots.push({ move, attack, rank: 1, nextAt: 0 });
  }

  upgradeMove(key) {
    const slot = this.slots.find((s) => s.move.key === key);
    if (!slot || slot.rank >= MAX_RANK) return;
    slot.rank++;
    const base = moveToAttack(slot.move);
    // Regla de mejora: +20% potencia, -8% recarga, +15% área por rango; cada 2 rangos, +1 golpe.
    const r = slot.rank - 1;
    slot.attack = {
      ...base,
      power: base.power * (1 + 0.2 * r),
      cooldown: base.cooldown * (1 - 0.08 * r),
      radius: base.radius * (1 + 0.15 * r),
      hits: base.hits + Math.floor(r / 2),
      pierce: base.pierce + Math.floor(r / 2),
    };
  }

  // Devuelve cuántos niveles se subieron.
  gainXp(amount) {
    this.xp += amount;
    let ups = 0;
    while (this.level < 100 && this.xp >= xpForLevel(this.level + 1)) {
      this.level++;
      ups++;
    }
    if (ups) this.recalcStats();
    return ups;
  }

  xpProgress() {
    const a = xpForLevel(this.level);
    const b = xpForLevel(this.level + 1);
    return Phaser.Math.Clamp((this.xp - a) / (b - a), 0, 1);
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  hurt(damage, now) {
    if (now < this.invulnUntil || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.invulnUntil = now + 600;
    this.flash(0xff4040, 90);
    return true;
  }

  update(time, delta) {
    if (this.hp <= 0) { this.setVelocity(0, 0); return; }
    let vx = 0, vy = 0;
    const k = this.keys;
    if (k.A.isDown || k.LEFT.isDown) vx -= 1;
    if (k.D.isDown || k.RIGHT.isDown) vx += 1;
    if (k.W.isDown || k.UP.isDown) vy -= 1;
    if (k.S.isDown || k.DOWN.isDown) vy += 1;
    if (this.touch && Math.hypot(this.touch.dx, this.touch.dy) > 10) { vx = this.touch.dx; vy = this.touch.dy; }

    const len = Math.hypot(vx, vy);
    this.moving = len > 0;
    const spd = this.speed * this.statusSpeedMult();
    this.setVelocity(this.moving ? (vx / len) * spd : 0, this.moving ? (vy / len) * spd : 0);

    if (time >= this.lockAnimUntil) {
      if (this.moving) this.faceVector(vx, vy);
      this.playAnim(this.moving ? 'Walk' : 'Idle');
    }

    const dot = this.updateStatuses(time);
    if (dot) this.hp = Math.max(1, this.hp - dot);
    if (this.passives.regen) this.heal((this.maxHp * 0.006 * this.passives.regen * delta) / 1000);
    this.setAlpha(time < this.invulnUntil && Math.floor(time / 80) % 2 ? 0.55 : 1);
  }
}
