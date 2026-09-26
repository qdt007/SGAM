/**
 * Regenerates src/constants/phosphorIcons.json from the `ph:` icon names used in src/.
 *
 * Run after adding a new Phosphor icon: `npm run icons`. Without this the icon renders as an
 * empty box for anyone whose network cannot reach api.iconify.design at runtime.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';
const OUT = 'src/constants/phosphorIcons.json';

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const names = new Set();
for (const file of walk(SRC)) {
  if (!/\.tsx?$/.test(file)) continue;
  for (const [, name] of readFileSync(file, 'utf8').matchAll(/['"]ph:([a-z0-9-]+)['"]/g)) {
    names.add(name);
  }
}

const wanted = [...names].sort();
if (!wanted.length) throw new Error('No ph: icons found — has the naming changed?');

const res = await fetch(`https://api.iconify.design/ph.json?icons=${wanted.join(',')}`);
if (!res.ok) throw new Error(`Iconify API returned ${res.status}`);
const data = await res.json();

const missing = wanted.filter((n) => !data.icons?.[n]);
if (missing.length) throw new Error(`Iconify has no such icons: ${missing.join(', ')}`);

// Only the fields addCollection reads; the API's metadata would just inflate the bundle.
writeFileSync(OUT, JSON.stringify({ prefix: data.prefix, width: data.width, height: data.height, icons: data.icons }));
console.log(`${wanted.length} icons -> ${OUT} (${(statSync(OUT).size / 1024).toFixed(0)}KB)`);
