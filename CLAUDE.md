# Pokémon Survivors (fangame)

Fangame web **no comercial** estilo Vampire Survivors / Survivor.io con Pokémon.
Stack: **Phaser 3 + Vite** (JavaScript, ES modules). Publicado en GitHub Pages vía GitHub Actions.

## Principios de arquitectura

### Sprites — PMD SpriteCollab
- Fuente: https://github.com/PMDCollab/SpriteCollab (carpeta `sprite/<dex 4 dígitos>/`).
- Cada Pokémon tiene hojas de animación (`Walk-Anim.png`, `Idle-Anim.png`, `Attack-Anim.png`, …)
  y un `AnimData.xml` con `FrameWidth`, `FrameHeight` y `Durations` por animación.
- Las hojas tienen **8 filas = 8 direcciones** (orden PMD: S, SE, E, NE, N, NW, W, SW) y una columna por frame.
- Hay **UN solo cargador genérico** que lee `AnimData.xml` y crea las animaciones de Phaser
  para cualquier Pokémon en 8 direcciones. Nunca código específico por Pokémon.
- Nunca clonar el repo completo de SpriteCollab: descargar solo las carpetas necesarias con el script.

### Datos — PokeAPI
- Un script de Node en `scripts/` descarga los datos **una sola vez** y genera JSON en `/data`
  (stats, tipos, movimientos).
- El juego lee esos JSON. **Nunca** llama a PokeAPI en tiempo de ejecución.

### Ataques — conversión por reglas
- Los movimientos por turnos se convierten en ataques en tiempo real mediante **reglas generales**,
  no ataque por ataque. Ejemplos:
  - Especial con daño → proyectil a distancia.
  - Físico de contacto → golpe en área cercana (melee AoE).
  - Tipo Fuego → puede quemar (daño en el tiempo); Eléctrico → paraliza/ralentiza; etc.
  - Potencia → daño; precisión/PP → cadencia.
- Las reglas viven en un único módulo (motor de reglas) para poder añadir Pokémon sin tocar código.

### Licencia
- SpriteCollab es **CC BY-NC 4.0** → el proyecto es no comercial y se mantiene `CREDITS.md`
  con los créditos de cada sprite usado (generado por `scripts/fetch-sprites.mjs` a partir de `credits.txt` + `credit_names.txt`).
- Pokémon es propiedad de Nintendo / Game Freak / The Pokémon Company. Fangame sin ánimo de lucro.

## Estructura
```
scripts/pokemon-list.mjs   Lista única de Pokémon (id + rol starter/enemy)
scripts/fetch-data.mjs     PokeAPI → data/{pokemon,moves,types}.json (fallback: espejo PokeAPI/api-data en GitHub)
scripts/fetch-sprites.mjs  SpriteCollab → public/sprites/<dex>/ + manifest.json + CREDITS.md
src/data/index.js          Acceso a los JSON + fórmulas de stats/tipos
src/systems/SpriteLoader.js  Cargador genérico AnimData.xml → anims `pkmn-<id>-<Anim>-<dir 0..7>`
src/systems/MoveRules.js   Motor de reglas movimiento → ataque (TYPE_RULES, forma, cadencia, estados)
src/systems/Combat.js      Fórmula de daño (STAB, eficacia, crítico)
src/systems/AttackSystem.js  Ejecuta proyectiles / golpes en área / ondas
src/systems/WaveDirector.js  Oleadas por reglas (menor suma de stats base aparece antes)
src/entities/              PokemonActor (genérico) → Player, Enemy
src/scenes/                Boot → Select → Game (+ UI, LevelUp, GameOver)
```

## Notas técnicas
- La red del entorno de Claude Code puede bloquear pokeapi.co; `fetch-data.mjs` cae al espejo estático
  `raw.githubusercontent.com/PokeAPI/api-data` (mismos JSON). Los scripts relanzan Node con
  `NODE_USE_ENV_PROXY=1` si hay `HTTPS_PROXY`.
- Teclado: registrar teclas con `onKeys()` (src/ui/keys.js), que deduplica eventos nativos repetidos.
- `window.game` expone la instancia de Phaser para depurar.

## Convenciones
- Añadir un Pokémon = añadirlo a la lista del script, re-ejecutar los scripts, listo.
- Assets descargados van en `public/sprites/`, datos en `data/`. Ambos se versionan en git
  (el build de CI no descarga nada).
