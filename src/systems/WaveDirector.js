import { ENEMIES, baseStatTotal } from '../data/index.js';
import { Enemy } from '../entities/Enemy.js';

const MAX_ALIVE = 220;

// Genera oleadas por reglas: los Pokémon más débiles (menor suma de stats base) aparecen primero.
export class WaveDirector {
  constructor(scene, player, enemies) {
    this.scene = scene;
    this.player = player;
    this.enemies = enemies;
    this.pool = [...ENEMIES].sort((a, b) => baseStatTotal(a) - baseStatTotal(b));
    this.nextSpawn = 0;
    this.nextBurst = 30000;
    this.nextElite = 60000;
  }

  // Nivel de los enemigos: sube 1 cada 20 s.
  enemyLevel(t) { return Math.floor(3 + t / 20000); }

  // Un tipo nuevo de enemigo cada 40 s.
  unlocked(t) { return this.pool.slice(0, Math.min(this.pool.length, 2 + Math.floor(t / 40000))); }

  pick(t) {
    const list = this.unlocked(t);
    // Peso mayor para el último desbloqueado, para que se note la novedad.
    const weights = list.map((_, i) => (i === list.length - 1 ? 2 : 1));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((r -= weights[i]) <= 0) return list[i];
    return list[0];
  }

  spawnPoint(extra = 0) {
    const view = this.scene.cameras.main.worldView;
    const dist = Math.hypot(view.width, view.height) / 2 + 20 + extra;
    const a = Math.random() * Math.PI * 2;
    return { x: this.player.x + Math.cos(a) * dist, y: this.player.y + Math.sin(a) * dist, a };
  }

  spawn(p, level, x, y, opts) {
    if (this.enemies.countActive() >= MAX_ALIVE && !opts?.elite) return;
    this.enemies.add(new Enemy(this.scene, x, y, p.id, level, opts));
  }

  update(elapsed) {
    const level = this.enemyLevel(elapsed);
    if (elapsed >= this.nextSpawn) {
      const interval = Math.max(260, 1300 - elapsed / 160);
      this.nextSpawn = elapsed + interval;
      const batch = 1 + Math.floor(elapsed / 45000);
      for (let i = 0; i < batch; i++) {
        const { x, y } = this.spawnPoint(Math.random() * 40);
        this.spawn(this.pick(elapsed), level, x, y);
      }
    }
    // Oleada en anillo cada 30 s.
    if (elapsed >= this.nextBurst) {
      this.nextBurst += 30000;
      const p = this.pick(elapsed);
      const n = 12 + Math.floor(elapsed / 20000);
      const { a } = this.spawnPoint();
      const view = this.scene.cameras.main.worldView;
      const dist = Math.hypot(view.width, view.height) / 2 + 10;
      for (let i = 0; i < n; i++) {
        const ang = a + (i / n) * Math.PI * 2;
        this.spawn(p, level, this.player.x + Math.cos(ang) * dist, this.player.y + Math.sin(ang) * dist);
      }
      this.scene.events.emit('announce', `¡Una horda de ${p.name} os rodea!`);
    }
    // Élite cada 60 s: el más fuerte desbloqueado, +3 niveles.
    if (elapsed >= this.nextElite) {
      this.nextElite += 60000;
      const list = this.unlocked(elapsed);
      const p = list[list.length - 1];
      const { x, y } = this.spawnPoint();
      this.spawn(p, level + 3, x, y, { elite: true });
      this.scene.events.emit('announce', `¡Un ${p.name} salvaje dominante aparece!`);
    }
  }
}

