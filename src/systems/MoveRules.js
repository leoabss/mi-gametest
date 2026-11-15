// Motor de reglas: convierte un movimiento por turnos (datos de PokeAPI) en un ataque en tiempo real.
// Todo sale de REGLAS GENERALES (clase de daño, objetivo, tipo, PP, potencia…). Nunca hay código por movimiento.

// Regla por TIPO: color, efecto secundario por defecto y modificadores de forma.
export const TYPE_RULES = {
  normal:   { color: 0xe8e4d0, knockback: 40 },
  fire:     { color: 0xff7a2a, status: 'burn', chance: 0.3 },
  water:    { color: 0x4aa8ff, knockback: 90 },
  grass:    { color: 0x5cd65c, drain: 0.1 },
  electric: { color: 0xffe14a, status: 'paralysis', chance: 0.25 },
  ice:      { color: 0xa8f0ff, status: 'freeze', chance: 0.15 },
  fighting: { color: 0xd0542a, knockback: 110 },
  poison:   { color: 0xb45cd6, status: 'poison', chance: 0.35 },
  ground:   { color: 0xd8b860, areaMult: 1.3 },
  flying:   { color: 0xb8d0ff, speedMult: 1.35, pierce: 1 },
  psychic:  { color: 0xff5ca8, status: 'confusion', chance: 0.2 },
  bug:      { color: 0xa8c83a, extraHits: 1 },
  rock:     { color: 0xb8a058, status: 'flinch', chance: 0.25, knockback: 60 },
  ghost:    { color: 0x7a5cb0, pierce: 2 },
  dragon:   { color: 0x7058f8, areaMult: 1.15 },
  dark:     { color: 0x6a5848, status: 'flinch', chance: 0.2 },
  steel:    { color: 0xb8b8d0, knockback: 70 },
  fairy:    { color: 0xf0a8e0, drain: 0.05 },
};

// Estados alterados de PokeAPI (meta.ailment) → estados del juego.
const AILMENTS = {
  burn: 'burn', paralysis: 'paralysis', poison: 'poison', freeze: 'freeze',
  sleep: 'sleep', confusion: 'confusion', trap: 'slow', 'leech-seed': 'poison',
};

export const STATUS_INFO = {
  burn:      { name: 'Quemadura', tint: 0xff9a5a, duration: 3000 },
  poison:    { name: 'Veneno',    tint: 0xc890f0, duration: 4000 },
  paralysis: { name: 'Parálisis', tint: 0xfff07a, duration: 2500 },
  freeze:    { name: 'Congelación', tint: 0x9ae8ff, duration: 1500 },
  sleep:     { name: 'Sueño',     tint: 0x9aa0c0, duration: 2500 },
  confusion: { name: 'Confusión', tint: 0xff9ad0, duration: 2000 },
  slow:      { name: 'Atrapado',  tint: 0xc0b090, duration: 2000 },
  flinch:    { name: 'Retroceso', tint: null,     duration: 350 },
};

// Objetivos que golpean a "todos" → onda expansiva alrededor del usuario.
const SPREAD_TARGETS = new Set(['all-opponents', 'all-other-pokemon', 'all-pokemon', 'entire-field', 'opponents-field']);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * @returns descriptor de ataque, o null si el movimiento no es convertible (p. ej. de estado).
 */
export function moveToAttack(move) {
  if (!move?.power) return null; // Regla: los movimientos de estado aún no se convierten.
  const t = TYPE_RULES[move.type] ?? TYPE_RULES.normal;

  // Regla de FORMA: objetivo múltiple → onda; especial → proyectil; físico → golpe en área cercana.
  const kind = SPREAD_TARGETS.has(move.target) ? 'nova' : move.damageClass === 'special' ? 'projectile' : 'melee';

  // Regla de golpes múltiples (Doble Patada, Pin Misil…) + bonus de tipo.
  const baseHits = move.maxHits ? Math.round((move.minHits + move.maxHits) / 2) : 1;
  const hits = baseHits + (kind === 'projectile' ? (t.extraHits ?? 0) : 0);

  // Regla de cadencia: más PP → más rápido. La potencia alta lo ralentiza un poco.
  const cooldown = clamp(2200 - move.pp * 40 + move.power * 4, 600, 2800) * (kind === 'nova' ? 1.35 : 1);

  // Regla de efecto: si el movimiento tiene estado propio se usa (con probabilidad aumentada x2);
  // si no, el efecto por defecto de su tipo (p. ej. Fuego → quemadura).
  const effects = [];
  const own = AILMENTS[move.ailment];
  if (own && move.ailmentChance > 0) effects.push({ status: own, chance: clamp((move.ailmentChance / 100) * 2, 0.1, 1) });
  else if (own && move.ailmentChance === 0 && move.damageClass !== 'status') effects.push({ status: own, chance: 0.5 });
  else if (t.status) effects.push({ status: t.status, chance: t.chance });
  if (move.flinchChance > 0) effects.push({ status: 'flinch', chance: clamp((move.flinchChance / 100) * 2, 0.1, 1) });

  const area = t.areaMult ?? 1;
  return {
    key: move.key,
    name: move.name,
    type: move.type,
    damageClass: move.damageClass,
    kind,
    color: t.color,
    power: move.power,
    hits,
    cooldown,
    accuracy: move.accuracy ?? 100,
    critChance: move.critRate > 0 ? 0.125 : 1 / 24,
    effects,
    drain: Math.max(0, (move.drain ?? 0) / 100) + (t.drain ?? 0),
    knockback: t.knockback ?? (kind === 'melee' ? 30 : 0),
    // Proyectil
    speed: 210 * (t.speedMult ?? 1) * (1 + Math.max(0, move.priority) * 0.25),
    range: 230,
    size: 3 + move.power / 25,
    pierce: (t.pierce ?? 0) + (move.power >= 90 ? 1 : 0),
    // Melee / onda
    radius: (kind === 'nova' ? 70 : 30 + move.power / 8) * area,
  };
}

export const KIND_LABEL = { projectile: 'Proyectil', melee: 'Golpe en área', nova: 'Onda' };

export function describeAttack(a) {
  const parts = [KIND_LABEL[a.kind], `Pot. ${Math.round(a.power)}`];
  if (a.hits > 1) parts.push(`x${a.hits}`);
  for (const e of a.effects) parts.push(`${STATUS_INFO[e.status].name} ${Math.round(e.chance * 100)}%`);
  if (a.drain > 0) parts.push('Absorbe');
  return parts.join(' · ');
}
