import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Testing Library only auto-cleans when vitest runs with `globals: true`.
 * This config does not, so without this every render stays mounted and later
 * tests query the previous test's DOM — which fails in confusing ways.
 */
afterEach(() => cleanup());
