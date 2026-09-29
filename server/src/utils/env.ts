/**
 * Reads an environment variable with surrounding whitespace removed.
 *
 * Credentials are pasted into hosting dashboards by hand, and a copied value routinely brings a
 * trailing newline or tab with it. The value then looks correct in the dashboard and fails at the
 * far end: Cloudinary answered "Invalid api_key \t\n412788781755979" for exactly this, and a
 * VNPay secret with a stray newline would produce "Sai chữ ký" with nothing to show why.
 *
 * Empty after trimming counts as unset, so `FOO=` and a forgotten variable behave the same.
 */
export function env(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}
