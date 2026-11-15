// Cargador GENÉRICO de sprites PMD SpriteCollab.
// Lee AnimData.xml de cada Pokémon y crea animaciones de Phaser en 8 direcciones para cualquier Pokémon.
// No hay código específico por Pokémon: añadir uno nuevo = descargar su carpeta con scripts/fetch-sprites.mjs.
import Phaser from 'phaser';

// Orden de las filas en las hojas PMD.
export const DIRS = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
const TICK_MS = 1000 / 60; // Las duraciones de AnimData.xml están en ticks de 60 fps.
const LOOPING = new Set(['Walk', 'Idle']);
// Si un Pokémon no tiene una animación, se usa otra parecida.
const FALLBACK = { Shoot: 'Attack', Idle: 'Walk', Attack: 'Walk', Hurt: 'Idle' };

const MANIFEST_KEY = 'sprite-manifest';
const xmlKey = (id) => `animdata-${id}`;
export const sheetKey = (id, anim) => `pkmn-${id}-${anim}`;
export const animKey = (id, anim, dir) => `pkmn-${id}-${anim}-${dir}`;

// Info por Pokémon una vez parseado: { anims: { Walk: { sheet, frameWidth, frameHeight, durations, rows } }, shadowSize }
const registry = new Map();

export const SpriteLoader = {
  // Llamar en preload(). Encadena: manifest.json → AnimData.xml → hojas PNG (con el tamaño de frame del XML).
  preload(scene, ids) {
    const load = scene.load;
    load.json(MANIFEST_KEY, 'sprites/manifest.json');
    load.once(`filecomplete-json-${MANIFEST_KEY}`, (_k, _t, manifest) => {
      for (const id of ids) {
        const entry = manifest[id];
        if (!entry) { console.warn(`Sin sprites para #${id}`); continue; }
        load.xml(xmlKey(id), `sprites/${entry.folder}/AnimData.xml`);
        load.once(`filecomplete-xml-${xmlKey(id)}`, (_k2, _t2, xml) => {
          const info = parseAnimData(xml, entry.anims);
          registry.set(Number(id), info);
          const sheets = new Set();
          for (const a of Object.values(info.anims)) {
            if (sheets.has(a.sheet)) continue;
            sheets.add(a.sheet);
            load.spritesheet(sheetKey(id, a.sheet), `sprites/${entry.folder}/${a.sheet}-Anim.png`, {
              frameWidth: a.frameWidth, frameHeight: a.frameHeight,
            });
          }
        });
      }
    });
  },

  // Llamar en create(), cuando todo está cargado. Crea `pkmn-<id>-<Anim>-<dir>` para las 8 direcciones.
  createAnimations(scene) {
    for (const [id, info] of registry) {
      for (const [name, a] of Object.entries(info.anims)) {
        const tex = scene.textures.get(sheetKey(id, a.sheet));
        const cols = Math.floor(tex.source[0].width / a.frameWidth);
        const rows = Math.floor(tex.source[0].height / a.frameHeight);
        a.rows = rows;
        for (let dir = 0; dir < 8; dir++) {
          const row = rows >= 8 ? dir : 0; // hojas de 1 sola fila = misma animación en todas direcciones
          const key = animKey(id, name, dir);
          if (scene.anims.exists(key)) continue;
          scene.anims.create({
            key,
            frames: a.durations.map((ticks, i) => ({
              key: sheetKey(id, a.sheet),
              frame: row * cols + Math.min(i, cols - 1),
              duration: ticks * TICK_MS,
            })),
            frameRate: 60, // ignorado: cada frame lleva su propia duración
            repeat: LOOPING.has(name) ? -1 : 0,
          });
        }
      }
    }
  },

  has(id, anim) { return !!registry.get(Number(id))?.anims[anim]; },

  // Devuelve el nombre de animación disponible más cercano (o null si no hay ninguna).
  resolve(id, anim) {
    let a = anim;
    for (let i = 0; i < 4 && a; i++) {
      if (this.has(id, a)) return a;
      a = FALLBACK[a];
    }
    return null;
  },

  info(id) { return registry.get(Number(id)); },

  // Tamaño de referencia del Pokémon (frame de Walk).
  baseSize(id) {
    const w = registry.get(Number(id))?.anims.Walk;
    return w ? { width: w.frameWidth, height: w.frameHeight } : { width: 32, height: 32 };
  },

  firstFrame(id, anim = 'Walk') {
    const name = this.resolve(id, anim);
    return { texture: sheetKey(id, registry.get(Number(id)).anims[name].sheet), frame: 0 };
  },
};

// Vector de movimiento → índice de dirección PMD (0=S … 4=N … 6=W). Eje Y hacia abajo.
export function dirFromVector(vx, vy) {
  if (vx === 0 && vy === 0) return null;
  const deg = Phaser.Math.RadToDeg(Math.atan2(vy, vx));
  return Phaser.Math.Wrap(Math.round((90 - deg) / 45), 0, 8);
}

function parseAnimData(xml, wanted) {
  const byName = {};
  for (const node of xml.querySelectorAll('Anims > Anim')) {
    const get = (t) => node.querySelector(t)?.textContent;
    byName[get('Name')] = {
      copyOf: get('CopyOf') ?? null,
      frameWidth: Number(get('FrameWidth')),
      frameHeight: Number(get('FrameHeight')),
      durations: [...node.querySelectorAll('Durations > Duration')].map((d) => Number(d.textContent)),
    };
  }
  const anims = {};
  for (const name of wanted) {
    let src = name;
    let def = byName[src];
    while (def?.copyOf) { src = def.copyOf; def = byName[src]; } // <CopyOf> apunta a otra animación
    if (!def || !def.durations.length) continue;
    anims[name] = { sheet: src, frameWidth: def.frameWidth, frameHeight: def.frameHeight, durations: def.durations };
  }
  return { anims, shadowSize: Number(xml.querySelector('ShadowSize')?.textContent ?? 1) };
}
