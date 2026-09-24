import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi, formatVnd, BillingCycle, PlanDefinition } from '../../api/billingApi';
import { planKeys, usePlan } from '../../hooks/usePlan';
import { Modal } from '../ui/Modal';
import { InlineError, Skeleton } from '../ui/States';
import { PlanBadge } from './UpgradePrompt';
import { formatDate } from '../../utils/dateUtils';
import { cn } from '../../utils/cn';

const apiMessage = (e: unknown, fallback: string) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/* ─── Checkout ───────────────────────────────────── */
function CheckoutModal({ cycle, onClose }: { cycle: BillingCycle; onClose: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');

  // Step 1 opens the pending payment, step 2 stands in for the gateway callback.
  const session = useQuery({
    queryKey: ['billing', 'checkout', cycle],
    queryFn: () => billingApi.checkout(cycle),
    retry: false,
  });

  const confirm = useMutation({
    mutationFn: (ref: string) => billingApi.confirm(ref),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: planKeys.me });
      qc.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
    onError: (e) => setError(apiMessage(e, 'Không hoàn tất được thanh toán')),
  });

  const amount = session.data?.amount ?? 0;

  return (
    <Modal
      title="Xác nhận thanh toán"
      description={cycle === 'YEARLY' ? 'Gói Pro theo năm' : 'Gói Pro theo tháng'}
      onClose={onClose}
      size="sm"
    >
      <div className="space-y-4">
        <InlineError message={error || (session.isError ? apiMessage(session.error, 'Không mở được phiên thanh toán') : null)} />

        <div className="rounded-xl border border-line bg-sunken p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-small text-ink-muted">Số tiền</span>
            {session.isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <span className="font-display text-subhead font-bold text-ink">{formatVnd(amount)}</span>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-small text-ink-muted">Chu kỳ</span>
            <span className="text-small text-ink">{cycle === 'YEARLY' ? '12 tháng' : '1 tháng'}</span>
          </div>
          {session.data && (
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-small text-ink-muted">Mã giao dịch</span>
              <span className="font-mono text-caption text-ink-subtle">{session.data.providerRef.slice(0, 20)}…</span>
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/[0.07] px-3 py-2.5 text-caption text-warning">
          <Icon icon="ph:info-fill" width={14} className="mt-px shrink-0" aria-hidden />
          <span>
            Đây là thanh toán <b>mô phỏng</b> cho mục đích demo. Không có cổng thanh toán thật và không có tiền nào
            được trừ. Để dùng thật cần tích hợp VNPay/MoMo và xác thực callback từ cổng.
          </span>
        </div>

        <div className="modal-footer">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            Huỷ
          </button>
          <button
            type="button"
            disabled={!session.data || confirm.isPending}
            onClick={() => session.data && confirm.mutate(session.data.providerRef)}
            className="btn-primary btn-sm"
          >
            {confirm.isPending && <Icon icon="ph:circle-notch" width={14} className="animate-spin" aria-hidden />}
            Thanh toán {session.data ? formatVnd(amount) : ''}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ─── Plan card ──────────────────────────────────── */
function PlanCard({
  plan,
  cycle,
  current,
  onChoose,
  savingPercent,
}: {
  plan: PlanDefinition;
  cycle: BillingCycle;
  current: boolean;
  onChoose: () => void;
  savingPercent: number;
}) {
  const isPro = plan.tier === 'PRO';
  const price = cycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;

  return (
    <div className={cn('card flex flex-col', isPro && 'border-primary/40')}>
      <div className="flex items-center gap-2">
        <h3 className="font-display text-subhead font-bold text-ink">{plan.name}</h3>
        {current && <span className="badge badge-success">Đang dùng</span>}
        {isPro && !current && cycle === 'YEARLY' && savingPercent > 0 && (
          <span className="badge bg-primary/12 text-primary">-{savingPercent}%</span>
        )}
      </div>
      <p className="mt-1 text-small text-ink-muted">{plan.tagline}</p>

      <p className="mt-4">
        <span className="font-display text-section font-bold text-ink">{price === 0 ? 'Miễn phí' : formatVnd(price)}</span>
        {price > 0 && <span className="text-small text-ink-muted"> / {cycle === 'YEARLY' ? 'năm' : 'tháng'}</span>}
      </p>

      <ul className="mt-5 flex-1 space-y-2">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-small text-ink-muted">
            <Icon
              icon={isPro ? 'ph:check-circle-fill' : 'ph:check'}
              width={15}
              className={cn('mt-0.5 shrink-0', isPro ? 'text-success' : 'text-ink-subtle')}
              aria-hidden
            />
            {f}
          </li>
        ))}
      </ul>

      {isPro && (
        <button onClick={onChoose} disabled={current} className="btn-primary mt-6 w-full">
          {current ? 'Gói hiện tại' : 'Nâng cấp lên Pro'}
        </button>
      )}
      {!isPro && (
        <div className="mt-6 text-center text-caption text-ink-subtle">
          {current ? 'Gói mặc định của bạn' : 'Áp dụng khi hết hạn Pro'}
        </div>
      )}
    </div>
  );
}

/* ─── Section ────────────────────────────────────── */
export function BillingSection() {
  const qc = useQueryClient();
  const [cycle, setCycle] = useState<BillingCycle>('YEARLY');
  const [checkout, setCheckout] = useState<BillingCycle | null>(null);
  const [error, setError] = useState('');

  const { isPro, tier, subscription, usage, payments, isLoading } = usePlan();
  const { data: catalogue } = useQuery({ queryKey: planKeys.plans, queryFn: billingApi.plans });

  const cancel = useMutation({
    mutationFn: billingApi.cancel,
    onSuccess: () => qc.invalidateQueries({ queryKey: planKeys.me }),
    onError: (e) => setError(apiMessage(e, 'Không huỷ được gói')),
  });
  const resume = useMutation({
    mutationFn: billingApi.resume,
    onSuccess: () => qc.invalidateQueries({ queryKey: planKeys.me }),
    onError: (e) => setError(apiMessage(e, 'Không khôi phục được gói')),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Gói và thanh toán</h2>
        <p className="mt-1 text-small text-ink-muted">Quản lý gói đăng ký và xem lịch sử thanh toán.</p>
      </div>

      <InlineError message={error} />

      {/* Current plan */}
      <div className="rounded-xl border border-line bg-sunken p-4">
        {isLoading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-small font-semibold text-ink">Gói hiện tại</span>
                <PlanBadge tier={tier} />
              </div>
              <p className="mt-1 text-caption text-ink-muted">
                {isPro && subscription?.currentPeriodEnd ? (
                  subscription.cancelAtPeriodEnd ? (
                    <>Đã huỷ — dùng được đến {formatDate(subscription.currentPeriodEnd)}</>
                  ) : (
                    <>Gia hạn ngày {formatDate(subscription.currentPeriodEnd)} · chu kỳ {subscription.cycle === 'YEARLY' ? 'năm' : 'tháng'}</>
                  )
                ) : (
                  <>
                    {usage?.ownedProjects ?? 0}/{usage?.maxOwnedProjects ?? '∞'} project · Reports và Gantt cần gói Pro
                  </>
                )}
              </p>
            </div>

            {isPro && !subscription?.cancelAtPeriodEnd && (
              <button onClick={() => cancel.mutate()} disabled={cancel.isPending} className="btn-secondary btn-sm">
                Huỷ gia hạn
              </button>
            )}
            {isPro && subscription?.cancelAtPeriodEnd && (
              <button onClick={() => resume.mutate()} disabled={resume.isPending} className="btn-primary btn-sm">
                Tiếp tục gia hạn
              </button>
            )}
          </div>
        )}
      </div>

      {/* Cycle switch */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-lg border border-line bg-raised p-0.5">
          {(['MONTHLY', 'YEARLY'] as BillingCycle[]).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-small font-semibold transition-colors duration-150',
                cycle === c ? 'bg-primary text-ink-onAccent' : 'text-ink-muted hover:text-ink',
              )}
            >
              {c === 'MONTHLY' ? 'Theo tháng' : 'Theo năm'}
            </button>
          ))}
        </div>
        {cycle === 'YEARLY' && catalogue && catalogue.yearlySavingPercent > 0 && (
          <span className="text-caption text-success">Tiết kiệm {catalogue.yearlySavingPercent}%</span>
        )}
      </div>

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-2">
        {catalogue?.plans.map((p) => (
          <PlanCard
            key={p.tier}
            plan={p}
            cycle={cycle}
            current={p.tier === tier}
            savingPercent={catalogue.yearlySavingPercent}
            onChoose={() => setCheckout(cycle)}
          />
        ))}
      </div>

      {/* Invoices */}
      <div>
        <h3 className="section-title mb-3">Lịch sử thanh toán</h3>
        {payments.length === 0 ? (
          <p className="text-small text-ink-muted">Chưa có giao dịch nào.</p>
        ) : (
          <div className="card-flush overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Gói</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{formatDate(p.paidAt ?? p.createdAt)}</td>
                    <td className="whitespace-nowrap">Pro · {p.cycle === 'YEARLY' ? 'năm' : 'tháng'}</td>
                    <td className="whitespace-nowrap tabular-nums">{formatVnd(p.amount)}</td>
                    <td>
                      <span
                        className={cn(
                          p.status === 'PAID' ? 'badge badge-success' : p.status === 'PENDING' ? 'badge badge-warning' : 'badge badge-neutral',
                        )}
                      >
                        {p.status === 'PAID' ? 'Đã thanh toán' : p.status === 'PENDING' ? 'Chờ thanh toán' : p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {checkout && <CheckoutModal cycle={checkout} onClose={() => setCheckout(null)} />}
    </div>
  );
}
