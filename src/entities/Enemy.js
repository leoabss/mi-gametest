import Phaser from 'phaser';
import { PokemonActor } from './PokemonActor.js';
import { statsAt } from '../data/index.js';
import { SpriteLoader } from '../systems/SpriteLoader.js';

export class Enemy extends PokemonActor {
  constructor(scene, x, y, pokemonId, level, { elite = false } = {}) {
    super(scene, x, y, pokemonId, { scale: elite ? 1.6 : 1 });
    this.level = level;
    this.elite = elite;
    this.stats = statsAt(this.data_, level);
    // Regla: enemigos más débiles que el jugador en PS (es un survivors), los élite mucho más resistentes.
    this.maxHp = Math.round(this.stats.hp * (elite ? 6 : 0.7));
    this.hp = this.maxHp;
    this.speed = (25 + this.data_.stats.speed * 0.35) * (elite ? 0.85 : 1);
    this.contactPower = elite ? 45 : 25;
    this.dead = false;
    this.body.setBounce(0);
    this.playAnim('Walk');
  }

  // Regla de XP de los juegos (experiencia base × nivel / 7), x2 para un ritmo de survivors.
  get xpValue() {
    return Math.max(1, Math.floor(((this.data_.baseExperience ?? 50) * this.level * 2) / 7) * (this.elite ? 5 : 1));
  }

  update(time, player) {
    if (this.dead) return;
    const dot = this.updateStatuses(time);
    if (dot) this.takeHit(dot, { silent: true });
    if (this.dead) return;

    let dx = player.x - this.x;
    let dy = player.y - this.y;
    if (this.statuses.confusion) {
      const a = time / 300 + this.x;
      dx = Math.cos(a); dy = Math.sin(a);
    }
    const len = Math.hypot(dx, dy) || 1;
    const spd = this.speed * this.statusSpeedMult();
    // Suavizado: no sobreescribe de golpe el empuje (knockback).
    const tx = (dx / len) * spd, ty = (dy / len) * spd;
    this.body.velocity.x += (tx - this.body.velocity.x) * 0.15;
    this.body.velocity.y += (ty - this.body.velocity.y) * 0.15;

    if (time >= this.lockAnimUntil && spd > 0) {
      this.faceVector(dx, dy);
      this.playAnim('Walk');
    } else if (spd === 0) {
      this.anims.pause();
    }
    if (spd > 0 && this.anims.isPaused) this.anims.resume();
  }

  takeHit(damage, { knockback = 0, fromX, fromY, silent = false } = {}) {
    if (this.dead) return false;
    this.hp -= damage;
    if (this.statuses.sleep) delete this.statuses.sleep; // recibir daño despierta
    if (!silent) this.flash();
    if (knockback && fromX !== undefined) {
      const a = Math.atan2(this.y - fromY, this.x - fromX);
      const kb = knockback * (this.elite ? 0.3 : 1);
      this.body.velocity.x += Math.cos(a) * kb * 2;
      this.body.velocity.y += Math.sin(a) * kb * 2;
    }
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  die() {
    this.dead = true;
    this.body.enable = false;
    this.clearTint();
    this.scene.events.emit('enemy-died', this);
    const fade = () => this.scene.tweens.add({
      targets: [this, this.shadow], alpha: 0, duration: 250, onComplete: () => this.destroy(),
    });
    if (SpriteLoader.has(this.pokemonId, 'Faint')) {
      this.anims.resume();
      this.playAnim('Faint', { once: true });
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, fade);
    } else {
      this.anims.pause();
      this.scene.tweens.add({ targets: this, scaleY: this.scaleY * 0.3, duration: 200 });
      fade();
    }
  }
}
