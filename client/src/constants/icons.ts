import { addCollection } from '@iconify/react';
import phosphor from './phosphorIcons.json';

/**
 * Registers every Phosphor icon the app uses, from a file in the bundle.
 *
 * @iconify/react otherwise fetches icon data from api.iconify.design at runtime and renders an
 * empty box until it arrives — or forever, if the network blocks it. That is not a hypothetical:
 * it is why the back button and the row actions shipped invisible. Bundling costs ~40KB and
 * removes the dependency entirely.
 *
 * Adding a new `ph:` icon means regenerating this file; `npm run icons` does it.
 */
export function registerIcons(): void {
  addCollection(phosphor);
}
