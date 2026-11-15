// Acceso a los datos generados por scripts/fetch-data.mjs. El juego NUNCA llama a PokeAPI en vivo.
import pokemonJson from '../../data/pokemon.json';
import movesJson from '../../data/moves.json';
import typesJson from '../../data/types.json';

export const POKEMON = pokemonJson.pokemon;
export const MOVES = movesJson.moves;
export const TYPES = typesJson.types;

export const getPokemon = (id) => POKEMON[id];
export const getMove = (key) => MOVES[key];
export const typeName = (t) => TYPES[t]?.name ?? t;

export const STARTERS = Object.values(POKEMON).filter((p) => p.role === 'starter');
export const ENEMIES = Object.values(POKEMON).filter((p) => p.role === 'enemy');

export const baseStatTotal = (p) => Object.values(p.stats).reduce((a, b) => a + b, 0);

// Regla de juego: las inmunidades (x0) se suavizan a x0.25 para que ningún ataque sea inútil en tiempo real.
export const IMMUNITY_MULT = 0.25;
export function typeMultiplier(atkType, defTypes) {
  const t = TYPES[atkType];
  if (!t) return 1;
  let m = 1;
  for (const d of defTypes) {
    if (t.zero.includes(d)) m *= IMMUNITY_MULT;
    else if (t.double.includes(d)) m *= 2;
    else if (t.half.includes(d)) m *= 0.5;
  }
  return m;
}

// Fórmulas de stats de los juegos principales (sin IV/EV/naturaleza).
export function statsAt(p, level) {
  const calc = (b) => Math.floor((2 * b * level) / 100) + 5;
  return {
    hp: Math.floor((2 * p.stats.hp * level) / 100) + level + 10,
    attack: calc(p.stats.attack),
    defense: calc(p.stats.defense),
    spAttack: calc(p.stats.spAttack),
    spDefense: calc(p.stats.spDefense),
    speed: calc(p.stats.speed),
  };
}

// Movimientos con daño que aprende por nivel, en orden de nivel (sin duplicados).
export function damagingLearnset(p) {
  const seen = new Set();
  return p.learnset.moves
    .filter(({ key }) => MOVES[key]?.power > 0 && !seen.has(key) && seen.add(key))
    .map(({ key, level }) => ({ move: MOVES[key], level }));
}

// Curva de experiencia "media rápida": n^3.
export const xpForLevel = (level) => level ** 3;
