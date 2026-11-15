// Descarga SOLO las carpetas de sprites necesarias de PMD SpriteCollab (sin clonar el repo)
// y genera CREDITS.md. Uso: npm run fetch:sprites
// Repo: https://github.com/PMDCollab/SpriteCollab — licencia CC BY-NC 4.0
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { ensureProxy, getText, getBuffer, mapLimit } from './net.mjs';
import { POKEMON } from './pokemon-list.mjs';

ensureProxy();

const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
// Animaciones que usa el juego. El cargador del juego lee AnimData.xml completo,
// pero solo descargamos las hojas PNG de estas (resolviendo <CopyOf>).
const WANTED_ANIMS = ['Walk', 'Idle', 'Attack', 'Shoot', 'Hurt', 'Faint'];

const pad = (id) => String(id).padStart(4, '0');

function parseAnimData(xml) {
  const anims = {};
  for (const block of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const tag = (t) => block[1].match(new RegExp(`<${t}>([^<]*)</${t}>`))?.[1];
    anims[tag('Name')] = { copyOf: tag('CopyOf') ?? null };
  }
  return anims;
}

// credit_names.txt: Name \t Discord \t Contact  (los autores en credits.txt aparecen por nombre o por id de Discord)
function parseCreditNames(txt) {
  const map = new Map();
  for (const line of txt.split('\n').slice(1)) {
    const [name, discord, contact] = line.split('\t').map((s) => s?.trim());
    if (!name) continue;
    const entry = { name, contact: contact || '' };
    map.set(name, entry);
    if (discord) map.set(discord, entry);
  }
  return map;
}

// credits.txt: fecha \t autor \t estado \t licencia \t animaciones(csv)
function parseCredits(txt, names) {
  const authors = new Map();
  for (const line of txt.split('\n')) {
    const [, who, , , anims] = line.split('\t');
    if (!who) continue;
    const info = names.get(who.trim()) ?? { name: who.trim(), contact: '' };
    const a = authors.get(info.name) ?? { ...info, anims: new Set() };
    (anims ?? '').split(',').filter(Boolean).forEach((x) => a.anims.add(x.trim()));
    authors.set(info.name, a);
  }
  return [...authors.values()];
}

async function main() {
  const pokemonData = JSON.parse(await readFile(new URL('../data/pokemon.json', import.meta.url), 'utf8')).pokemon;
  const names = parseCreditNames(await getText(`${RAW}/credit_names.txt`));
  const manifest = {};
  const creditSections = [];

  for (const { id } of POKEMON) {
    const dir = pad(id);
    const outDir = new URL(`../public/sprites/${dir}/`, import.meta.url);
    await mkdir(outDir, { recursive: true });

    const xml = await getText(`${RAW}/sprite/${dir}/AnimData.xml`);
    if (!xml) throw new Error(`No hay AnimData.xml para ${dir}`);
    await writeFile(new URL('AnimData.xml', outDir), xml);
    const anims = parseAnimData(xml);

    const files = new Set();
    const available = [];
    for (const name of WANTED_ANIMS) {
      if (!anims[name]) continue;
      const src = anims[name].copyOf ?? name;
      files.add(src);
      available.push(name);
    }
    await mapLimit([...files], 4, async (src) => {
      const png = await getBuffer(`${RAW}/sprite/${dir}/${src}-Anim.png`);
      if (!png) throw new Error(`Falta ${dir}/${src}-Anim.png`);
      await writeFile(new URL(`${src}-Anim.png`, outDir), png);
    });

    const creditsTxt = (await getText(`${RAW}/sprite/${dir}/credits.txt`)) ?? '';
    await writeFile(new URL('credits.txt', outDir), creditsTxt);
    const authors = parseCredits(creditsTxt, names);

    manifest[id] = { folder: dir, anims: available };
    const pname = pokemonData[id]?.name ?? `#${id}`;
    creditSections.push({ id, dir, pname, authors, files: [...files] });
    console.log(`  ✓ ${dir} ${pname}: ${[...files].map((f) => f + '-Anim.png').join(', ')} — autores: ${authors.map((a) => a.name).join(', ')}`);
  }

  await writeFile(new URL('../public/sprites/manifest.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');

  const md = [
    '# Créditos',
    '',
    'Fangame **no comercial** hecho por fans. Pokémon y todos los nombres relacionados son marcas de',
    'Nintendo, Game Freak, Creatures Inc. y The Pokémon Company. Este proyecto no está afiliado ni respaldado por ellos.',
    '',
    '## Sprites — PMD SpriteCollab',
    '',
    'Sprites de [PMDCollab/SpriteCollab](https://github.com/PMDCollab/SpriteCollab), bajo licencia',
    '[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Usados sin modificar.',
    'Archivo generado automáticamente por `scripts/fetch-sprites.mjs` a partir de `credits.txt` de cada carpeta.',
    '',
    ...creditSections.flatMap(({ dir, pname, authors, files }) => [
      `### ${pname} (\`sprite/${dir}\`)`,
      '',
      `Archivos usados: ${files.map((f) => `\`${f}-Anim.png\``).join(', ')}, \`AnimData.xml\``,
      '',
      ...authors.map((a) => {
        const used = [...a.anims].filter((x) => files.includes(x));
        const who = a.contact && /^https?:/.test(a.contact) ? `[${a.name}](${a.contact})` : a.name;
        return `- ${who}${used.length ? ` — ${used.join(', ')}` : ''}`;
      }),
      '',
    ]),
    '## Datos — PokeAPI',
    '',
    'Estadísticas, tipos y movimientos de [PokeAPI](https://pokeapi.co) ([api-data](https://github.com/PokeAPI/api-data)).',
    '',
    '## Motor',
    '',
    '[Phaser 3](https://phaser.io) (MIT) y [Vite](https://vitejs.dev) (MIT).',
    '',
  ].join('\n');
  await writeFile(new URL('../CREDITS.md', import.meta.url), md);
  console.log('Listo: public/sprites/, public/sprites/manifest.json, CREDITS.md');
}

main().catch((e) => { console.error(e); process.exit(1); });
