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
  con los créditos de cada sprite usado (generado por el script a partir de `credits.txt` / `tracker.json`).
- Pokémon es propiedad de Nintendo / Game Freak / The Pokémon Company. Fangame sin ánimo de lucro.

## Convenciones
- Añadir un Pokémon = añadirlo a la lista del script, re-ejecutar los scripts, listo.
- Assets descargados van en `public/sprites/`, datos en `data/`. Ambos se versionan en git
  (el build de CI no descarga nada).
