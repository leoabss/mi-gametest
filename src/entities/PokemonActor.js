import Phaser from 'phaser';
import { SpriteLoader, animKey, dirFromVector } from '../systems/SpriteLoader.js';
import { STATUS_INFO } from '../systems/MoveRules.js';
import { getPokemon } from '../data/index.js';

// Actor genérico: cualquier Pokémon con animación en 8 direcciones, cuerpo físico circular y estados alterados.
export class PokemonActor extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, pokemonId, { scale = 1 } = {}) {
    const first = SpriteLoader.firstFrame(pokemonId);
    super(scene, x, y, first.texture, first.frame);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.pokemonId = Number(pokemonId);
    this.data_ = getPokemon(pokemonId);
    this.types = this.data_.types;
    this.dir = 0;
    this.lockAnimUntil = 0;
    this.statuses = {};
    this.setScale(scale);

    const base = SpriteLoader.baseSize(pokemonId);
    this.bodyRadius = Math.max(6, Math.min(base.width, base.height) * 0.28);

    const shadowW = (8 + 6 * (SpriteLoader.info(pokemonId)?.shadowSize ?? 1)) * scale;
    this.shadow = scene.add.ellipse(x, y, shadowW, shadowW * 0.45, 0x000000, 0.28);

    // Las hojas PMD tienen tamaños de frame distintos por animación: recolocamos el cuerpo al cambiar de frame.
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.syncBody, this);
    this.on(Phaser.Animations.Events.ANIMATION_START, this.syncBody, this);
    this.syncBody();
    this.playAnim('Idle');
  }

  syncBody() {
    if (!this.body) return;
    const r = this.bodyRadius;
    this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r + this.height * 0.12);
  }

  faceVector(vx, vy) {
    const d = dirFromVector(vx, vy);
    if (d !== null) this.dir = d;
  }

  // Reproduce una animación en la dirección actual, conservando el frame si solo cambia la dirección.
  playAnim(name, { once = false } = {}) {
    const resolved = SpriteLoader.resolve(this.pokemonId, name);
    if (!resolved) return null;
    const key = animKey(this.pokemonId, resolved, this.dir);
    const cur = this.anims.currentAnim;
    if (cur?.key === key && this.anims.isPlaying) return resolved;
    let startFrame = 0;
    if (!once && cur && this.anims.isPlaying && cur.key.startsWith(`pkmn-${this.pokemonId}-${resolved}-`)) {
      startFrame = (this.anims.currentFrame?.index ?? 1) - 1;
    }
    this.play({ key, startFrame: Math.min(startFrame, this.scene.anims.get(key).frames.length - 1) });
    return resolved;
  }

  // Animación de una sola vez (ataque, daño) que bloquea las de movimiento mientras dura.
  playOnce(name, maxMs = 600) {
    const resolved = this.playAnim(name, { once: true });
    if (!resolved) return;
    const anim = this.scene.anims.get(animKey(this.pokemonId, resolved, this.dir));
    this.lockAnimUntil = this.scene.time.now + Math.min(maxMs, anim.duration);
  }

  // ---- Estados alterados ----
  applyStatus(status, { sourceDamage = 0 } = {}) {
    const info = STATUS_INFO[status];
    if (!info) return;
    const now = this.scene.time.now;
    const s = this.statuses[status];
    if (s) { s.until = now + info.duration; return; }
    const tickDamage = Math.max(1, Math.round(sourceDamage * (status === 'burn' ? 0.2 : 0.15)));
    this.statuses[status] = { until: now + info.duration, nextTick: now + 500, tickDamage };
    if (status !== 'flinch') this.scene.events.emit('status-applied', this, status);
  }

  hasStatus(s) { return !!this.statuses[s]; }

  // Multiplicador de velocidad por estados (0 = inmóvil).
  statusSpeedMult() {
    const s = this.statuses;
    if (s.freeze || s.sleep || s.flinch) return 0;
    let m = 1;
    if (s.paralysis) m *= 0.45;
    if (s.slow) m *= 0.5;
    return m;
  }

  // Devuelve el daño por estados de este frame (el llamador lo aplica).
  updateStatuses(now) {
    let dot = 0;
    let tint = null;
    for (const [name, s] of Object.entries(this.statuses)) {
      if (now >= s.until) { delete this.statuses[name]; continue; }
      if ((name === 'burn' || name === 'poison') && now >= s.nextTick) {
        dot += s.tickDamage;
        s.nextTick += 500;
      }
      tint ??= STATUS_INFO[name].tint;
    }
    if (!this.flashing) tint !== null ? this.setTint(tint) : this.clearTint();
    return dot;
  }

  flash(color = 0xffffff, ms = 70) {
    this.flashing = true;
    this.setTintFill(color);
    this.scene.time.delayedCall(ms, () => { this.flashing = false; this.clearTint(); });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y + this.displayHeight * 0.14);
    this.shadow.setDepth(this.y - 1000);
  }

  destroy(fromScene) {
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
