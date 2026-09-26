import { useId } from 'react';

/**
 * Daily sign-ups over the window the API returns. Inline SVG rather than a chart library, and
 * the same two-series palette the reports use: #0066cc in light, #3f8fe1 in dark, both validated
 * for contrast. Every bar keeps its value label — the fill alone sits under 3:1 on this surface,
 * so the number is what makes it readable.
 */
export function SignupChart({ data }: { data: { date: string; count: number }[] }) {
  const gradientId = useId();
  if (!data.length) return null;

  const W = 640;
  const H = 160;
  const PAD = { top: 16, right: 8, bottom: 26, left: 8 };
  const max = Math.max(1, ...data.map((d) => d.count));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(28, slot * 0.6);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-40 w-full"
      role="img"
      aria-label={`Sign-ups per day over the last ${data.length} days`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="[stop-color:#0066cc] dark:[stop-color:#3f8fe1]" stopOpacity="0.95" />
          <stop offset="100%" className="[stop-color:#0066cc] dark:[stop-color:#3f8fe1]" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <line
        x1={PAD.left}
        y1={PAD.top + innerH}
        x2={W - PAD.right}
        y2={PAD.top + innerH}
        className="stroke-ink/[0.12]"
        strokeWidth="1"
      />

      {data.map((d, i) => {
        const h = d.count === 0 ? 2 : Math.max(3, (d.count / max) * innerH);
        const x = PAD.left + i * slot + (slot - barW) / 2;
        const y = PAD.top + innerH - h;
        const day = new Date(d.date + 'T00:00:00');
        return (
          <g key={d.date}>
            <rect x={x} y={y} width={barW} height={h} rx="3" fill={`url(#${gradientId})`} />
            {d.count > 0 && (
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                className="fill-ink text-[10px] font-semibold tabular-nums"
              >
                {d.count}
              </text>
            )}
            <text
              x={x + barW / 2}
              y={H - 8}
              textAnchor="middle"
              className="fill-ink-subtle text-[9px] tabular-nums"
            >
              {day.getDate()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
