// Utilidades de red compartidas por los scripts de descarga.
import { spawnSync } from 'node:child_process';

// El fetch nativo de Node ignora HTTPS_PROXY salvo que NODE_USE_ENV_PROXY=1 (Node >= 22.21).
// Si hay proxy y no está activado, relanzamos el script con la variable puesta (portable, sin cross-env).
export function ensureProxy() {
  const hasProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (hasProxy && process.env.NODE_USE_ENV_PROXY !== '1') {
    const r = spawnSync(process.execPath, ['--no-warnings', ...process.argv.slice(1)], {
      stdio: 'inherit',
      env: { ...process.env, NODE_USE_ENV_PROXY: '1' },
    });
    process.exit(r.status ?? 1);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, kind, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (kind === 'json') return await res.json();
      if (kind === 'text') return await res.text();
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i >= tries) throw new Error(`${url}: ${err.message}`);
      await sleep(500 * 2 ** i);
    }
  }
}

export const getJSON = (url) => get(url, 'json');
export const getText = (url) => get(url, 'text');
export const getBuffer = (url) => get(url, 'buffer');

// Ejecuta tareas async con concurrencia limitada.
export async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}
