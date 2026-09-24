import { Icon } from '@iconify/react';
import { useUIStore } from '../../stores/uiStore';
import { WorkloadReport } from '../../types';

const SERIES = {
  light: { open: '#C2410C', done: '#16A34A' },
  dark: { open: '#EA580C', done: '#16A34A' },
};

/**
 * Per-member load. The bar carries the comparison, the numbers beside it carry the
 * exact value — the fills sit below 3:1 against the surface, so labels are required.
 */
export function WorkloadTable({ report }: { report: WorkloadReport }) {
  const { theme } = useUIStore();
  const c = SERIES[theme === 'dark' ? 'dark' : 'light'];
  const max = Math.max(1, ...report.rows.map((r) => r.total));

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex items-baseline justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-ink">Workload by member</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: c.open }} /> Open
          </span>
          <span className="inline-flex items-center gap-1.5 text-ink-muted">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: c.done }} /> Done
          </span>
        </div>
      </figcaption>

      {report.rows.length === 0 ? (
        <p className="text-sm text-ink-muted">No members yet.</p>
      ) : (
        <div className="space-y-3">
          {report.rows.map((r) => (
            <div key={r.user.id} className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-6 w-6 rounded-full bg-primary text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {r.user.displayName?.[0]?.toUpperCase()}
                </div>
                <span className="text-ink truncate">{r.user.displayName}</span>
                <span className="text-xs text-ink-muted">{r.role}</span>
                {r.overdue > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
                    <Icon icon="ph:warning-circle-fill" width={13} />
                    {r.overdue} overdue
                  </span>
                )}
                <span className="ml-auto text-xs text-ink-muted tabular-nums shrink-0">
                  {r.open} open · {r.done} done · {r.loggedHrs}h logged
                </span>
              </div>

              <div className="flex h-2.5 w-full items-stretch gap-[2px]" role="presentation">
                <div
                  className="rounded-l-[4px] rounded-r-[4px]"
                  style={{ width: `${(r.open / max) * 100}%`, backgroundColor: c.open }}
                />
                <div
                  className="rounded-l-[4px] rounded-r-[4px]"
                  style={{ width: `${(r.done / max) * 100}%`, backgroundColor: c.done }}
                />
              </div>
            </div>
          ))}

          {report.unassigned.total > 0 && (
            <p className="pt-1 text-xs text-ink-muted">
              {report.unassigned.open} unassigned open task{report.unassigned.open === 1 ? '' : 's'} (
              {report.unassigned.total} total)
            </p>
          )}
        </div>
      )}
    </figure>
  );
}
