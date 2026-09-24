import { useState, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { useUIStore } from '../../stores/uiStore';
import { BurndownReport } from '../../types';

/* Series colors validated for CVD separation and contrast against each surface. */
const SERIES = {
  light: { remaining: '#C2410C', ideal: '#A8A29E', grid: 'rgba(28,25,23,0.08)', ink: '#78716C' },
  dark: { remaining: '#EA580C', ideal: '#78716C', grid: 'rgba(250,250,249,0.10)', ink: '#A8A29E' },
};

const W = 720;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 26, left: 34 };

export function BurndownChart({ report }: { report: BurndownReport }) {
  const { theme } = useUIStore();
  const c = SERIES[theme === 'dark' ? 'dark' : 'light'];
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const points = report.points;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxY = useMemo(() => Math.max(1, ...points.map((p) => Math.max(p.remaining ?? 0, p.ideal))), [points]);

  const x = (i: number) => PAD.left + (points.length <= 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - (v / maxY) * plotH;

  const line = (key: 'remaining' | 'ideal') =>
    points
      .map((p, i) => {
        const v = key === 'ideal' ? p.ideal : p.remaining;
        return v === null ? null : `${x(i)},${y(v)}`;
      })
      .filter(Boolean)
      .join(' ');

  const actualPoints = points.filter((p) => p.remaining !== null);
  const lastActual = actualPoints[actualPoints.length - 1];

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - PAD.left) / plotW) * (points.length - 1));
    setHover(i >= 0 && i < points.length ? i : null);
  };

  const ticks = [0, 0.5, 1].map((f) => Math.round(maxY * f));
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));
  const hovered = hover !== null ? points[hover] : null;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-ink">Burndown</h3>
          <p className="text-xs text-ink-muted">
            {format(parseISO(report.from), 'MMM d')} – {format(parseISO(report.to), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: c.remaining }} />
            Remaining
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <svg width="16" height="2" aria-hidden>
              <line x1="0" y1="1" x2="16" y2="1" stroke={c.ideal} strokeWidth="2" strokeDasharray="3 3" />
            </svg>
            Ideal
          </span>
        </div>
      </figcaption>

      <div className="relative overflow-x-auto">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[420px]"
          style={{ height: H }}
          role="img"
          aria-label={`Burndown: ${report.completed} of ${report.total} tasks completed`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={c.grid} strokeWidth="1" />
              <text x={PAD.left - 7} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill={c.ink}>
                {t}
              </text>
            </g>
          ))}

          {points.map((p, i) =>
            i % labelEvery === 0 ? (
              <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={c.ink}>
                {format(parseISO(p.date), 'MMM d')}
              </text>
            ) : null,
          )}

          <polyline
            points={line('ideal')}
            fill="none"
            stroke={c.ideal}
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeLinecap="round"
          />
          <polyline
            points={line('remaining')}
            fill="none"
            stroke={c.remaining}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {lastActual && (
            <circle
              cx={x(points.indexOf(lastActual))}
              cy={y(lastActual.remaining ?? 0)}
              r="4"
              fill={c.remaining}
              stroke={theme === 'dark' ? '#292524' : '#ffffff'}
              strokeWidth="2"
            />
          )}

          {hovered && (
            <g>
              <line x1={x(hover!)} x2={x(hover!)} y1={PAD.top} y2={PAD.top + plotH} stroke={c.grid} strokeWidth="2" />
              {hovered.remaining !== null && (
                <circle
                  cx={x(hover!)}
                  cy={y(hovered.remaining)}
                  r="5"
                  fill={c.remaining}
                  stroke={theme === 'dark' ? '#292524' : '#ffffff'}
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-black/[0.06] bg-raised px-2.5 py-1.5 text-xs shadow-card"
            style={{ left: `calc(${(x(hover!) / W) * 100}% - 52px)` }}
          >
            <p className="font-medium text-ink">{format(parseISO(hovered.date), 'MMM d')}</p>
            <p className="text-ink-muted">
              {hovered.remaining === null ? 'Not reached yet' : `${hovered.remaining} remaining`}
            </p>
            <p className="text-ink-muted">Ideal {hovered.ideal}</p>
          </div>
        )}
      </div>
    </figure>
  );
}
