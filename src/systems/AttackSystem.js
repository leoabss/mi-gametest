import Phaser from 'phaser';
import { computeDamage } from './Combat.js';

// Ejecuta automáticamente los ataques del jugador según su descriptor (proyectil / golpe en área / onda).
export class AttackSystem {
  constructor(scene, player, enemies) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
    this.projectiles = scene.physics.add.group();
    scene.physics.add.overlap(this.projectiles, enemies, (proj, enemy) => this.onProjectileHit(proj, enemy));
  }

  nearestEnemy(maxDist) {
    let best = null, bestD = maxDist * maxDist;
    for (const e of this.enemies.getChildren()) {
      if (e.dead) continue;
      const d = (e.x - this.player.x) ** 2 + (e.y - this.player.y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  enemiesInRadius(x, y, r) {
    const r2 = r * r;
    return this.enemies.getChildren().filter((e) => !e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 <= r2 + e.bodyRadius ** 2);
  }

  update(time) {
    const p = this.player;
    if (p.hp <= 0) return;
    for (const slot of p.slots) {
      if (time < slot.nextAt) continue;
      const a = slot.attack;
      const reach = a.kind === 'projectile' ? a.range : a.radius + 24;
      const target = this.nearestEnemy(reach);
      if (!target) { slot.nextAt = time + 120; continue; }
      slot.nextAt = time + a.cooldown;

      p.faceVector(target.x - p.x, target.y - p.y);
      p.playOnce(a.kind === 'projectile' ? 'Shoot' : 'Attack', 450);

      for (let i = 0; i < a.hits; i++) {
        this.scene.time.delayedCall(i * 110, () => {
          if (p.hp <= 0) return;
          if (a.kind === 'projectile') this.fireProjectile(a, target);
          else if (a.kind === 'melee') this.melee(a, target);
          else this.nova(a);
        });
      }
    }
    for (const proj of this.projectiles.getChildren()) {
      if (time > proj.dieAt) proj.destroy();
    }
  }

  fireProjectile(a, target) {
    const p = this.player;
    const tx = target.active ? target.x : p.x + Math.cos(p.lastAngle ?? 0);
    const ty = target.active ? target.y : p.y + Math.sin(p.lastAngle ?? 0);
    // Regla de precisión: menos precisión → más dispersión.
    const spread = Phaser.Math.DegToRad((100 - a.accuracy) * 0.8 + 4) * (Math.random() - 0.5);
    const ang = Math.atan2(ty - p.y, tx - p.x) + spread;
    p.lastAngle = ang;
    const proj = this.projectiles.create(p.x, p.y - 4, `proj-${a.type}`);
    proj.setScale(a.size / 5).setDepth(10000).setRotation(ang);
    proj.body.setCircle(6, 2, 2);
    proj.setVelocity(Math.cos(ang) * a.speed, Math.sin(ang) * a.speed);
    proj.attack = a;
    proj.pierceLeft = a.pierce;
    proj.hitSet = new Set();
    proj.dieAt = this.scene.time.now + (a.range / a.speed) * 1000;
  }

  onProjectileHit(proj, enemy) {
    if (!proj.active || enemy.dead || proj.hitSet.has(enemy)) return;
    proj.hitSet.add(enemy);
    this.hit(enemy, proj.attack, proj.x, proj.y);
    if (proj.pierceLeft-- <= 0) proj.destroy();
  }

  melee(a, target) {
    const p = this.player;
    const ang = Math.atan2(target.y - p.y, target.x - p.x);
    const cx = p.x + Math.cos(ang) * a.radius * 0.5;
    const cy = p.y + Math.sin(ang) * a.radius * 0.5;
    const fx = this.scene.add.graphics().setDepth(10000);
    fx.lineStyle(3, a.color, 0.9).beginPath();
    fx.arc(0, 0, a.radius * 0.8, ang - 1.1, ang + 1.1).strokePath();
    fx.fillStyle(a.color, 0.18).fillCircle(Math.cos(ang) * a.radius * 0.5, Math.sin(ang) * a.radius * 0.5, a.radius);
    fx.setPosition(p.x, p.y);
    this.scene.tweens.add({ targets: fx, alpha: 0, scale: 1.15, duration: 220, onComplete: () => fx.destroy() });
    for (const e of this.enemiesInRadius(cx, cy, a.radius)) this.hit(e, a, p.x, p.y);
  }

  nova(a) {
    const p = this.player;
    const ring = this.scene.add.circle(p.x, p.y, a.radius, a.color, 0.15).setStrokeStyle(3, a.color, 0.9).setDepth(10000);
    ring.setScale(0.2);
    this.scene.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 320, onComplete: () => ring.destroy() });
    for (const e of this.enemiesInRadius(p.x, p.y, a.radius)) this.hit(e, a, p.x, p.y);
  }

  hit(enemy, a, fromX, fromY) {
    const p = this.player;
    const { damage, eff, crit } = computeDamage(p, enemy, a);
    for (const e of a.effects) if (Math.random() < e.chance) enemy.applyStatus(e.status, { sourceDamage: damage });
    if (a.drain > 0) p.heal(damage * a.drain);
    this.scene.events.emit('damage-dealt', enemy, damage, { eff, crit });
    enemy.takeHit(damage, { knockback: a.knockback, fromX, fromY });
  }
}
