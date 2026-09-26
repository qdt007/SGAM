import { describe, it, expect } from 'vitest';
// Read from disk: Vite intercepts CSS imports, so `?raw` hands back an empty string here.
import { readFileSync } from 'node:fs';

/**
 * The button colour variants each do `@apply btn`, which copies the base height and horizontal
 * padding into them. Size modifiers carry the same specificity, so whichever is declared last
 * wins — and if the sizes come first, `btn-ghost btn-icon-sm` ends up 40px tall with 16px of
 * padding inside a 32px width. The padding consumes the whole box and the icon renders into
 * zero width, which is how the row's edit and delete buttons appeared as blank grey squares.
 */


const css = readFileSync('src/index.css', 'utf8');

const VARIANTS = ['.btn-primary', '.btn-secondary', '.btn-ghost', '.btn-danger', '.btn-quiet-danger'];
const SIZES = ['.btn-xs', '.btn-sm', '.btn-lg', '.btn-icon', '.btn-icon-sm'];

describe('button class ordering', () => {
  const lastVariant = Math.max(...VARIANTS.map((v) => css.indexOf(`${v} {`)));

  it('declares every colour variant', () => {
    for (const v of VARIANTS) expect(css.indexOf(`${v} {`), `${v} is missing`).toBeGreaterThan(-1);
  });

  it.each(SIZES)('%s is declared after the colour variants so it is not overridden', (size) => {
    const at = css.indexOf(`${size} {`);
    expect(at, `${size} is missing`).toBeGreaterThan(-1);
    expect(at, `${size} must come after the colour variants or @apply btn overrides it`).toBeGreaterThan(lastVariant);
  });
});
