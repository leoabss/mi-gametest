// Texturas generadas por código (no hay assets de efectos todavía).
import { TYPE_RULES } from '../systems/MoveRules.js';

export function createTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Proyectil por tipo: núcleo claro + halo del color del tipo.
  for (const [type, rule] of Object.entries(TYPE_RULES)) {
    g.clear();
    g.fillStyle(rule.color, 0.35).fillCircle(8, 8, 8);
    g.fillStyle(rule.color, 1).fillCircle(8, 8, 5);
    g.fillStyle(0xffffff, 0.9).fillCircle(7, 7, 2);
    g.generateTexture(`proj-${type}`, 16, 16);
  }

  // Gemas de XP (3 tamaños).
  const gems = [['gem-s', 0x5ad1ff, 4], ['gem-m', 0x7cff6a, 5], ['gem-l', 0xff6ad5, 6]];
  for (const [key, color, r] of gems) {
    g.clear();
    g.fillStyle(color, 1).fillPoints([{ x: r, y: 0 }, { x: r * 2, y: r }, { x: r, y: r * 2 }, { x: 0, y: r }], true);
    g.fillStyle(0xffffff, 0.8).fillRect(r - 1, 2, 2, 2);
    g.generateTexture(key, r * 2, r * 2);
  }

  // Baya Aranja (curación).
  g.clear();
  g.fillStyle(0x2f6fd8, 1).fillCircle(6, 7, 5);
  g.fillStyle(0x5aa0ff, 1).fillCircle(5, 6, 2);
  g.fillStyle(0x3a9a3a, 1).fillRect(5, 0, 2, 3);
  g.generateTexture('berry', 12, 12);

  // Suelo: tile de hierba con matas y flores.
  const T = 64;
  g.clear();
  g.fillStyle(0x4f8f3a, 1).fillRect(0, 0, T, T);
  const rnd = mulberry32(7);
  for (let i = 0; i < 90; i++) {
    g.fillStyle(rnd() < 0.5 ? 0x467f33 : 0x5a9c44, 1).fillRect(Math.floor(rnd() * T), Math.floor(rnd() * T), 2, 2);
  }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rnd() * (T - 6)), y = Math.floor(rnd() * (T - 6));
    g.fillStyle(0x3b7029, 1).fillRect(x, y + 2, 1, 3).fillRect(x + 2, y, 1, 5).fillRect(x + 4, y + 2, 1, 3);
  }
  for (let i = 0; i < 3; i++) {
    const x = Math.floor(rnd() * (T - 3)), y = Math.floor(rnd() * (T - 3));
    g.fillStyle(rnd() < 0.5 ? 0xf5e663 : 0xf2f2f2, 1).fillRect(x, y, 2, 2);
  }
  g.generateTexture('grass', T, T);
  g.destroy();
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
