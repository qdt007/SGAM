import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Icon } from '@iconify/react';
import { registerIcons } from '../constants/icons';
import phosphor from '../constants/phosphorIcons.json';

/**
 * Guards the bundled icon set. @iconify/react otherwise fetches icon data over the network and
 * renders an empty box while it waits — which is how the back button and the row actions both
 * shipped invisible. These assert that the icons resolve with no network at all.
 */
beforeAll(() => registerIcons());

const CRITICAL = ['ph:user', 'ph:calendar-blank', 'ph:dots-three-bold', 'ph:plus', 'ph:check-circle-fill'];

describe('bundled icons', () => {
  it.each(CRITICAL)('%s renders real SVG content', (name) => {
    const { container } = render(<Icon icon={name} />);
    const svg = container.querySelector('svg');
    expect(svg, `${name} rendered no <svg>`).not.toBeNull();
    // An unresolved Iconify icon still emits an <svg>, just an empty one.
    expect(svg!.innerHTML.length, `${name} rendered an empty <svg>`).toBeGreaterThan(0);
  });

  it('covers every ph: icon referenced in the source', async () => {
    const modules = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
    const used = new Set<string>();
    for (const [path, source] of Object.entries(modules)) {
      if (path.includes('phosphorIcons.json')) continue;
      for (const [, n] of String(source).matchAll(/['"]ph:([a-z0-9-]+)['"]/g)) used.add(n);
    }

    const bundled = new Set(Object.keys((phosphor as { icons: Record<string, unknown> }).icons));
    const missing = [...used].filter((n) => !bundled.has(n));
    expect(missing, `run "npm run icons" — these are not bundled: ${missing.join(', ')}`).toEqual([]);
  });
});
