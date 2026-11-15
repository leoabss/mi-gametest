import { typeMultiplier } from '../data/index.js';

// Fórmula de daño de los juegos principales, simplificada (sin objetos/habilidades/clima).
export function computeDamage(attacker, defender, { power, type, damageClass, critChance = 1 / 24 }) {
  const special = damageClass === 'special';
  const A = special ? attacker.stats.spAttack : attacker.stats.attack;
  const D = special ? defender.stats.spDefense : defender.stats.defense;
  const L = attacker.level;
  const base = (((2 * L) / 5 + 2) * power * (A / D)) / 50 + 2;
  const stab = attacker.types.includes(type) ? 1.5 : 1;
  const eff = typeMultiplier(type, defender.types);
  const crit = Math.random() < critChance;
  const rand = 0.85 + Math.random() * 0.15;
  const damage = Math.max(1, Math.round(base * stab * eff * (crit ? 1.5 : 1) * rand * (attacker.damageMult ?? 1)));
  return { damage, eff, crit };
}
