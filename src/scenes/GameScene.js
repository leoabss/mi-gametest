import Phaser from 'phaser';
import { Player } from '../entities/Player.js';
import { AttackSystem } from '../systems/AttackSystem.js';
import { WaveDirector } from '../systems/WaveDirector.js';
import { computeDamage } from '../systems/Combat.js';
import { text } from '../ui/style.js';
import { onKeys } from '../ui/keys.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    this.starterId = data.starterId;
    this.elapsed = 0;
    this.kills = 0;
    this.pendingLevelUps = 0;
    this.over = false;
  }

  create() {
    this.ground = this.add.tileSprite(0, 0, 10, 10, 'grass').setOrigin(0).setDepth(-1e6);

    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.player = new Player(this, 0, 0, this.starterId);
    this.attacks = new AttackSystem(this, this.player, this.enemies);
    this.waves = new WaveDirector(this, this.player, this.enemies);
    this.pickups = this.physics.add.group();

    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => this.onContact(e));
    this.physics.add.overlap(this.player, this.pickups, (_p, item) => this.collect(item));

    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.15, 0.15);
    this.applyZoom();
    this.scale.on('resize', this.applyZoom, this);

    this.events.on('enemy-died', this.onEnemyDied, this);
    this.events.on('damage-dealt', this.showDamage, this);
    // Phaser solo borra los listeners de this.events al destruir la escena, no al reiniciarla.
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.applyZoom, this);
      for (const ev of ['enemy-died', 'damage-dealt', 'announce', 'status-applied']) this.events.off(ev);
    });

    onKeys(this, ['ESC', 'P'], () => this.togglePause());

    this.scene.launch('UI', { game: this });
    this.events.emit('announce', `¡Adelante, ${this.player.data_.name}!`);
  }

  applyZoom() {
    const { width, height } = this.scale;
    this.cameras.main.setZoom(Phaser.Math.Clamp(Math.floor(Math.min(width / 420, height / 260)), 1, 4));
  }

  togglePause() {
    if (this.over || this.scene.isActive('LevelUp')) return;
    if (this.physics.world.isPaused) {
      this.physics.resume(); this.time.paused = false; this.anims.resumeAll(); this.tweens.resumeAll();
      this.paused = false;
    } else {
      this.physics.pause(); this.time.paused = true; this.anims.pauseAll(); this.tweens.pauseAll();
      this.paused = true;
    }
  }

  update(time, delta) {
    if (this.paused || this.over) return;
    const dt = Math.min(delta, 50);
    this.elapsed += dt;

    const view = this.cameras.main.worldView;
    const gx = Math.floor(view.x) - 16, gy = Math.floor(view.y) - 16;
    this.ground.setPosition(gx, gy).setSize(Math.ceil(view.width) + 32, Math.ceil(view.height) + 32);
    this.ground.setTilePosition(gx, gy);

    this.player.update(time, dt);
    for (const e of this.enemies.getChildren()) e.update(time, this.player);
    this.attacks.update(time);
    this.waves.update(this.elapsed);
    this.updatePickups(view);

    // Despawn de enemigos muy lejanos (se regeneran cerca).
    const far = (Math.max(view.width, view.height) * 1.6) ** 2;
    for (const e of this.enemies.getChildren()) {
      if (!e.dead && !e.elite && (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2 > far) e.destroy();
    }

    if (this.player.hp <= 0) this.gameOver();
  }

  onContact(enemy) {
    if (enemy.dead || this.player.hp <= 0) return;
    const now = this.time.now;
    if (now < this.player.invulnUntil) return;
    const { damage } = computeDamage(enemy, this.player, { power: enemy.contactPower, type: enemy.types[0], damageClass: 'physical' });
    if (this.player.hurt(damage, now)) {
      this.showDamage(this.player, damage, { eff: 1, crit: false, toPlayer: true });
      enemy.faceVector(this.player.x - enemy.x, this.player.y - enemy.y);
      enemy.playOnce('Attack', 400);
    }
  }

  onEnemyDied(enemy) {
    this.kills++;
    const xp = enemy.xpValue;
    const key = xp >= 60 ? 'gem-l' : xp >= 20 ? 'gem-m' : 'gem-s';
    this.spawnPickup(enemy.x, enemy.y, key, { xp });
    if (enemy.elite || Math.random() < 0.02) this.spawnPickup(enemy.x + 8, enemy.y, 'berry', { heal: 0.25 });
  }

  spawnPickup(x, y, key, props) {
    const item = this.pickups.create(x, y, key).setDepth(y - 500);
    Object.assign(item, props);
    this.tweens.add({ targets: item, y: y - 3, yoyo: true, repeat: -1, duration: 500 + Math.random() * 200 });
  }

  updatePickups(view) {
    const p = this.player;
    const r2 = p.magnetRadius ** 2;
    const limit = (Math.max(view.width, view.height) * 2) ** 2;
    for (const item of this.pickups.getChildren()) {
      const dx = p.x - item.x, dy = p.y - item.y, d2 = dx * dx + dy * dy;
      if (item.magnet || d2 < r2) {
        item.magnet = true;
        this.tweens.killTweensOf(item);
        const d = Math.sqrt(d2) || 1;
        const spd = 140 + (item.speedBoost = (item.speedBoost ?? 0) + 6);
        item.body.setVelocity((dx / d) * spd, (dy / d) * spd);
      } else if (d2 > limit) {
        item.destroy();
      }
    }
  }

  collect(item) {
    if (!item.active) return;
    if (item.xp) {
      const ups = this.player.gainXp(item.xp);
      if (ups) { this.pendingLevelUps += ups; this.openLevelUp(); }
    }
    if (item.heal) this.player.heal(this.player.maxHp * item.heal);
    item.destroy();
  }

  openLevelUp() {
    if (this.scene.isActive('LevelUp') || this.pendingLevelUps <= 0 || this.over) return;
    this.pendingLevelUps--;
    this.physics.pause(); this.time.paused = true; this.anims.pauseAll(); this.tweens.pauseAll();
    this.paused = true;
    this.scene.launch('LevelUp', { game: this });
  }

  closeLevelUp() {
    this.physics.resume(); this.time.paused = false; this.anims.resumeAll(); this.tweens.resumeAll();
    this.paused = false;
    if (this.pendingLevelUps > 0) this.time.delayedCall(150, () => this.openLevelUp());
  }

  showDamage(target, damage, { eff = 1, crit = false, toPlayer = false } = {}) {
    const color = toPlayer ? '#ff6a6a' : eff > 1 ? '#ffd84a' : eff < 1 ? '#a0a8b8' : '#ffffff';
    const t = this.add.text(target.x + Phaser.Math.Between(-6, 6), target.y - target.displayHeight * 0.4, `${damage}${crit ? '!' : ''}`,
      text(crit || eff > 1 ? 9 : 7, color, { strokeThickness: 2, resolution: 4 })).setOrigin(0.5).setDepth(20000);
    this.tweens.add({ targets: t, y: t.y - 14, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  gameOver() {
    this.over = true;
    this.physics.pause();
    this.player.setAlpha(1).clearTint();
    this.player.playAnim('Faint', { once: true }) ?? this.player.playAnim('Hurt', { once: true });
    this.time.delayedCall(1200, () => {
      this.scene.launch('GameOver', {
        name: this.player.data_.name, level: this.player.level, kills: this.kills, time: this.elapsed,
      });
    });
  }
}
