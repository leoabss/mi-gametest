// Descarga UNA vez los datos de PokeAPI y genera JSON en /data.
// Uso: npm run fetch:data
// Fuente: https://pokeapi.co (si no es accesible, usa el espejo estático oficial PokeAPI/api-data en GitHub).
import { mkdir, writeFile } from 'node:fs/promises';
import { ensureProxy, getJSON, mapLimit } from './net.mjs';
import { POKEMON } from './pokemon-list.mjs';

ensureProxy();

const SOURCES = [
  'https://pokeapi.co',
  'https://raw.githubusercontent.com/PokeAPI/api-data/master/data',
];
// Grupos de versión preferidos para los movimientos aprendidos por nivel (el primero que tenga datos).
const VERSION_PREFERENCE = [
  'scarlet-violet', 'sword-shield', 'ultra-sun-ultra-moon', 'sun-moon',
  'omega-ruby-alpha-sapphire', 'x-y', 'black-2-white-2', 'black-white',
  'heartgold-soulsilver', 'platinum', 'diamond-pearl',
  'firered-leafgreen', 'emerald', 'ruby-sapphire', 'crystal', 'gold-silver', 'yellow', 'red-blue',
];
const STAT_KEYS = {
  hp: 'hp', attack: 'attack', defense: 'defense',
  'special-attack': 'spAttack', 'special-defense': 'spDefense', speed: 'speed',
};

let base;
async function pickSource() {
  for (const s of SOURCES) {
    try {
      const url = s.includes('api-data') ? `${s}/api/v2/pokemon/1/index.json` : `${s}/api/v2/pokemon/1`;
      if (await getJSON(url)) return s;
    } catch { /* probar la siguiente */ }
    console.warn(`  · ${s} no accesible, probando siguiente fuente…`);
  }
  throw new Error('Ninguna fuente de PokeAPI es accesible');
}

// Acepta rutas tipo "/api/v2/move/33/" o URLs absolutas de pokeapi.co.
function api(path) {
  const p = path.replace(/^https?:\/\/pokeapi\.co/, '').replace(/\/?$/, '/');
  return base.includes('api-data') ? `${base}${p}index.json` : `${base}${p}`;
}

const nameIn = (names, lang) => names.find((n) => n.language.name === lang)?.name;
const idFromUrl = (url) => Number(url.match(/\/(\d+)\/?$/)[1]);

function levelUpMoves(pokemon) {
  for (const vg of VERSION_PREFERENCE) {
    const list = [];
    for (const m of pokemon.moves) {
      const d = m.version_group_details.find(
        (x) => x.version_group.name === vg && x.move_learn_method.name === 'level-up',
      );
      if (d) list.push({ key: m.move.name, url: m.move.url, level: d.level_learned_at });
    }
    if (list.length) return { versionGroup: vg, list: list.sort((a, b) => a.level - b.level) };
  }
  return { versionGroup: null, list: [] };
}

async function main() {
  base = await pickSource();
  console.log(`Fuente de datos: ${base}`);

  const pokemonOut = {};
  const moveRefs = new Map();

  for (const { id, role } of POKEMON) {
    const p = await getJSON(api(`/api/v2/pokemon/${id}/`));
    const species = await getJSON(api(`/api/v2/pokemon-species/${id}/`));
    const { versionGroup, list } = levelUpMoves(p);
    list.forEach((m) => moveRefs.set(m.key, m.url));

    const stats = {};
    for (const s of p.stats) stats[STAT_KEYS[s.stat.name]] = s.base_stat;

    pokemonOut[id] = {
      id,
      key: p.name,
      name: nameIn(species.names, 'es') ?? nameIn(species.names, 'en') ?? p.name,
      role,
      types: p.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
      stats,
      height: p.height, // decímetros
      weight: p.weight, // hectogramos
      baseExperience: p.base_experience,
      captureRate: species.capture_rate,
      learnset: { versionGroup, moves: list.map(({ key, level }) => ({ key, level })) },
    };
    console.log(`  ✓ #${id} ${pokemonOut[id].name} (${pokemonOut[id].types.join('/')}) — ${list.length} movs por nivel [${versionGroup}]`);
  }

  console.log(`Descargando ${moveRefs.size} movimientos…`);
  const moveEntries = await mapLimit([...moveRefs], 6, async ([key, url]) => {
    const m = await getJSON(api(new URL(url, 'https://pokeapi.co').pathname));
    const effect = m.effect_entries.find((e) => e.language.name === 'en');
    return [key, {
      key,
      id: idFromUrl(url),
      name: nameIn(m.names, 'es') ?? nameIn(m.names, 'en') ?? key,
      type: m.type.name,
      damageClass: m.damage_class.name, // physical | special | status
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      priority: m.priority,
      target: m.target.name,
      ailment: m.meta?.ailment?.name ?? 'none',
      ailmentChance: m.meta?.ailment_chance ?? 0,
      flinchChance: m.meta?.flinch_chance ?? 0,
      critRate: m.meta?.crit_rate ?? 0,
      drain: m.meta?.drain ?? 0,
      healing: m.meta?.healing ?? 0,
      minHits: m.meta?.min_hits ?? null,
      maxHits: m.meta?.max_hits ?? null,
      statChanges: m.stat_changes.map((s) => ({ stat: s.stat.name, change: s.change })),
      statChance: m.meta?.stat_chance ?? 0,
      shortEffect: effect?.short_effect?.replace(/\$effect_chance/g, m.effect_chance ?? '') ?? '',
    }];
  });
  const movesOut = Object.fromEntries(moveEntries.sort(([a], [b]) => a.localeCompare(b)));

  // Tabla de tipos (multiplicadores atacante → defensor) para los tipos que aparecen en juego.
  const typeNames = new Set([
    ...Object.values(pokemonOut).flatMap((p) => p.types),
    ...Object.values(movesOut).map((m) => m.type),
  ]);
  const typeIndex = await getJSON(api('/api/v2/type/'));
  const typeUrl = Object.fromEntries(typeIndex.results.map((t) => [t.name, t.url]));
  const typesOut = {};
  for (const t of [...typeNames].sort()) {
    const tj = await getJSON(api(new URL(typeUrl[t], 'https://pokeapi.co').pathname));
    const r = tj.damage_relations;
    typesOut[t] = {
      name: nameIn(tj.names, 'es') ?? t,
      double: r.double_damage_to.map((x) => x.name),
      half: r.half_damage_to.map((x) => x.name),
      zero: r.no_damage_to.map((x) => x.name),
    };
  }

  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  const meta = { source: base, generatedAt: new Date().toISOString(), license: 'Datos de PokeAPI (https://pokeapi.co)' };
  const write = (f, obj) => writeFile(new URL(`../data/${f}`, import.meta.url), JSON.stringify(obj, null, 2) + '\n');
  await write('pokemon.json', { meta, pokemon: pokemonOut });
  await write('moves.json', { meta, moves: movesOut });
  await write('types.json', { meta, types: typesOut });
  console.log(`Listo: data/pokemon.json (${POKEMON.length}), data/moves.json (${Object.keys(movesOut).length}), data/types.json (${Object.keys(typesOut).length})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
