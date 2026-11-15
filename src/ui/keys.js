// Registra teclas en una escena ignorando eventos nativos repetidos.
// En frames con retraso, Phaser puede despachar el mismo KeyboardEvent dos veces; aquí se deduplica.
const seen = new WeakSet();

export function onKeys(scene, names, fn) {
  for (const name of [].concat(names)) {
    scene.input.keyboard.on(`keydown-${name}`, (event) => {
      if (event && (seen.has(event) || event.repeat)) return;
      if (event) seen.add(event);
      fn(event);
    });
  }
}
