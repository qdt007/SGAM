/**
 * Validates the theme's colour pairs against WCAG, and the two chart series against each other
 * under the common colour-blindness simulations.
 *
 * CLAUDE.md requires the chart palette to be re-validated rather than eyeballed whenever it
 * changes. This is that check, kept in the repo so the next change can run it too.
 *
 * Run: npm run check:contrast
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'src', 'index.css'), 'utf8');

/** Pulls `--name: r g b;` pairs out of the :root and .dark blocks. */
function readTokens(selector) {
  const block = css.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\n  \\}`));
  if (!block) throw new Error(`Could not find the ${selector} block in index.css`);
  const tokens = {};
  for (const [, name, r, g, b] of block[1].matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    tokens[name] = [Number(r), Number(g), Number(b)];
  }
  return tokens;
}

const srgb = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]) => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);

function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('');

/**
 * Brettel/Viénot-style channel mixing. Not a colorimetric simulation — enough to catch two
 * series collapsing into the same colour, which is the failure that matters on a chart.
 */
const BLINDNESS = {
  deuteranopia: ([r, g, b]) => [0.625 * r + 0.375 * g, 0.7 * r + 0.3 * g, 0.3 * g + 0.7 * b],
  protanopia: ([r, g, b]) => [0.567 * r + 0.433 * g, 0.558 * r + 0.442 * g, 0.242 * g + 0.758 * b],
  tritanopia: ([r, g, b]) => [0.95 * r + 0.05 * g, 0.433 * g + 0.567 * b, 0.475 * g + 0.525 * b],
};

/** Euclidean distance in sRGB. Crude, but the threshold below is calibrated against it. */
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

let failures = 0;
let warnings = 0;

/**
 * `advisory` marks a pair where falling short is a judgement call rather than a defect, so the
 * run still reports it but does not fail. Hairlines are decoration, not controls, and the two
 * chart series are told apart by their value labels — CLAUDE.md says so explicitly. Treating
 * those as hard failures would only teach the next person to ignore this script.
 */
const check = (label, value, min, { unit = ':1', advisory = false } = {}) => {
  const ok = value >= min;
  if (!ok) advisory ? warnings++ : failures++;
  const tag = ok ? 'PASS' : advisory ? 'WARN' : 'FAIL';
  const shown = unit === ':1' ? value.toFixed(2) : Math.round(value);
  console.log(`  ${tag}  ${label.padEnd(44)} ${shown}${unit}  (min ${min}${unit})`);
};

for (const [theme, selector] of [['light', ':root'], ['dark', '\\.dark']]) {
  const t = readTokens(selector);
  console.log(`\n${theme.toUpperCase()}  accent ${hex(t.accent)}  page ${hex(t.page)}  ink ${hex(t.ink)}`);

  // Body text and anything that has to be read.
  check('ink on page', contrast(t.ink, t.page), 4.5);
  check('ink on surface', contrast(t.ink, t.surface), 4.5);
  check('ink on raised', contrast(t.ink, t.raised), 4.5);
  check('ink-muted on page', contrast(t['ink-muted'], t.page), 4.5);
  check('ink-muted on surface', contrast(t['ink-muted'], t.surface), 4.5);
  // Subtle text is metadata — large or incidental, so the 3:1 large-text floor applies.
  check('ink-subtle on page', contrast(t['ink-subtle'], t.page), 3);

  // The accent carries links and primary buttons, so it is read as text both ways.
  check('accent on page', contrast(t.accent, t.page), 4.5);
  check('accent on surface', contrast(t.accent, t.surface), 4.5);
  check('ink-on-accent on accent', contrast(t['ink-on-accent'], t.accent), 4.5);
  check('accent-hover on page', contrast(t['accent-hover'], t.page), 4.5);

  // Status colours appear as text on tinted chips, which sit on the page.
  for (const s of ['success', 'warning', 'danger']) {
    check(`${s} on page`, contrast(t[s], t.page), 3);
  }

  // A hairline separates, it does not identify a control, so WCAG 1.4.11 does not bind it.
  check('line-strong on page', contrast(t['line-strong'], t.page), 3, { advisory: true });
}

/* ── Charts ───────────────────────────────────────────────────────────────
   These are the pairs the code actually draws, read from BurndownChart.tsx so this cannot drift
   away from it the way CLAUDE.md's description did. The fills sit below 3:1 against the surface
   on purpose — the value labels are what make them legible — so what is checked here is that the
   two series stay apart from each other, including for a colour-blind reader. */
const chartSrc = readFileSync(join(here, '..', 'src', 'components', 'reports', 'BurndownChart.tsx'), 'utf8');

/**
 * Plain string scanning, no regex. A regex literal here would need an escape, and an escape is
 * the one character that does not reliably survive this file being written by a tool — it was
 * silently eaten once already and the check passed while reading nothing.
 */
function readSeries(theme) {
  const start = chartSrc.indexOf(theme + ': {');
  if (start < 0) throw new Error('Could not find the ' + theme + ' series in BurndownChart.tsx');
  const row = chartSrc.slice(start, chartSrc.indexOf('}', start));
  const pick = (key) => {
    const marker = key + ": '#";
    const i = row.indexOf(marker);
    if (i < 0) throw new Error('Could not read ' + theme + '.' + key);
    const n = parseInt(row.slice(i + marker.length, i + marker.length + 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  return { a: pick('remaining'), b: pick('ideal') };
}

for (const [theme, selector] of [['light', ':root'], ['dark', '[.]dark']]) {
  const { a, b } = readSeries(theme);
  const surface = readTokens(selector).surface;
  console.log('');
  console.log('CHART ' + theme.toUpperCase() + '  remaining ' + hex(a) + ' vs ideal ' + hex(b) + '  on ' + hex(surface));
  for (const [name, sim] of Object.entries(BLINDNESS)) {
    // Blue against grey holds up under all three here. Tritanopia stays advisory because a
    // palette built on one hue can always lose to it, and the value labels carry the chart.
    check('separated under ' + name, distance(sim(a), sim(b)), 60, { unit: '', advisory: name === 'tritanopia' });
  }
  check('remaining vs surface', contrast(a, surface), 1.6);
  check('ideal vs surface', contrast(b, surface), 1.6);
}

console.log(failures === 0 ? '\nAll contrast checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
