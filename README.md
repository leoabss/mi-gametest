# Pokémon Survivors (fangame)

Fangame web **no comercial** estilo Vampire Survivors / Survivor.io con Pokémon, hecho con Phaser 3 + Vite.

## Jugar

- **WASD / flechas**: moverse (en móvil: arrastrar en la pantalla).
- Los ataques son **automáticos**. Recoge gemas de XP para subir de nivel y elegir una mejora.
- **Esc / P**: pausa.

## Desarrollo

```bash
npm install
npm run dev        # servidor local
npm run build      # build de producción en dist/
```

Datos y sprites ya están en el repo. Para regenerarlos (o tras añadir un Pokémon en `scripts/pokemon-list.mjs`):

```bash
npm run fetch:all  # = fetch:data (PokeAPI → data/) + fetch:sprites (SpriteCollab → public/sprites/ + CREDITS.md)
```

## Publicación

`.github/workflows/deploy.yml` publica en GitHub Pages en cada push a `main`
(o a mano desde la pestaña Actions). Requiere **Settings → Pages → Source: GitHub Actions**.

## Créditos y licencia

Ver [CREDITS.md](CREDITS.md). Sprites de PMD SpriteCollab (CC BY-NC 4.0), datos de PokeAPI.
Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc. / The Pokémon Company. Proyecto sin ánimo de lucro, no afiliado.
