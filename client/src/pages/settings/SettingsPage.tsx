import { useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Moon, Sun, Bell, Shield, Palette, ChevronRight } from 'lucide-react';
import { usersApi, NotificationPrefs } from '../../api/usersApi';
import { authApi } from '../../api/authApi';
import { Page, PageHeader } from '../../components/ui/Page';
import { Tabs } from '../../components/ui/Tabs';
import { ConfirmDialog } from '../../components/ui/Modal';
import { TwoFactorSection } from '../../components/settings/TwoFactorSection';
import { Avatar } from '../../components/ui/Avatar';
import { ImageCropper } from '../../components/ui/ImageCropper';
import { BillingSection } from '../../components/billing/BillingSection';
import { keys } from '../../constants/queryKeys';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../utils/cn';

const apiMessage = (e: unknown, fallback: string): string =>
  (e as { response?: { data?: { message?: string; errors?: Array<{ message: string }> } } })?.response?.data
    ?.errors?.[0]?.message ??
  (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
  fallback;

const ACCENT_COLORS = [
  { name: 'Terracotta', value: '#C2410C' },
  { name: 'Sienna', value: '#9A3412' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Ochre', value: '#D97706' },
  { name: 'Moss', value: '#16A34A' },
  { name: 'Stone', value: '#78716C' },
];

type Section = 'profile' | 'appearance' | 'notifications' | 'billing' | 'security';

const MENU: { id: Section; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'profile', label: 'Profile', icon: User, desc: 'Your account information' },
  { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Theme and display preferences' },
  { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alert preferences' },
  { id: 'billing', label: 'Billing', icon: Shield, desc: 'Plan and payments' },
  { id: 'security', label: 'Security', icon: Shield, desc: 'Password and access' },
];

// The cropper re-encodes to a 512px PNG, so what reaches the server is always small. This
// ceiling only bounds how large an image we are willing to decode in the browser.
const AVATAR_SOURCE_MAX_MB = 10;
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function AvatarField() {
  const { user, updateUser } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Held between picking a file and confirming the crop; nothing is uploaded until then.
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const upload = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: (updated) => { updateUser(updated); setError(''); setPendingFile(null); },
    onError: (e) => { setError(apiMessage(e, 'Could not upload that image')); setPendingFile(null); },
  });

  const remove = useMutation({
    mutationFn: () => usersApi.removeAvatar(),
    onSuccess: (updated) => { updateUser(updated); setError(''); },
    onError: (e) => setError(apiMessage(e, 'Could not remove your photo')),
  });

  const pick = (file: File | undefined) => {
    if (!file) return;
    // Checked here too so the common mistakes fail instantly instead of after an upload.
    if (!AVATAR_TYPES.includes(file.type)) return setError('Use a PNG, JPEG, WebP or GIF image.');
    if (file.size > AVATAR_SOURCE_MAX_MB * 1024 * 1024) {
      return setError(`Pick an image under ${AVATAR_SOURCE_MAX_MB}MB.`);
    }
    setError('');
    setPendingFile(file);
  };

  const busy = upload.isPending || remove.isPending;

  return (
    <div className="flex items-center gap-4">
      <Avatar name={user?.displayName} src={user?.avatarUrl} size="xl" />
      <div className="space-y-1.5">
        <div>
          <p className="font-semibold">{user?.displayName}</p>
          <p className="text-sm text-ink-muted">{user?.email}</p>
          <span className="mt-1 inline-block rounded bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
            {user?.globalRole}
          </span>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button onClick={() => inputRef.current?.click()} disabled={busy} className="btn-secondary text-sm py-1.5">
            {upload.isPending ? 'Uploading...' : user?.avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>
          {user?.avatarUrl && (
            <button onClick={() => setConfirmRemove(true)} disabled={busy} className="btn-ghost text-sm py-1.5 text-ink-muted">
              {remove.isPending ? 'Removing...' : 'Remove'}
            </button>
          )}
        </div>
        <p className="text-xs text-ink-subtle">PNG, JPEG, WebP or GIF. You choose the crop next.</p>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_TYPES.join(',')}
        className="hidden"
        onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }}
      />

      {pendingFile && (
        <ImageCropper
          file={pendingFile}
          busy={upload.isPending}
          onCancel={() => setPendingFile(null)}
          onCropped={(cropped) => upload.mutate(cropped)}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title="Remove your photo?"
          message="The image is deleted from storage, so you would need the original file to put it back."
          confirmLabel="Remove photo"
          loading={remove.isPending}
          onConfirm={() => {
            remove.mutate();
            setConfirmRemove(false);
          }}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </div>
  );
}

function ProfileSection() {
  const { user, updateUser } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => usersApi.updateMe({ displayName: displayName.trim(), username: username.trim() }),
    onSuccess: (updated) => {
      updateUser(updated);
      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => setError(apiMessage(e, 'Could not save your profile')),
  });

  const dirty = displayName.trim() !== user?.displayName || username.trim() !== user?.username;
  const handleSave = () => {
    if (dirty && displayName.trim()) save();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Profile</h2>
        <p className="mt-1 text-small text-ink-muted">Manage your account information.</p>
      </div>

      <AvatarField />

      <div className="space-y-4 mt-6 border-t border-line-soft pt-6">
        <div>
          <label className="label">Display Name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input max-w-sm"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input value={user?.email ?? ''} readOnly className="input max-w-sm bg-sunken cursor-not-allowed" />
          <p className="text-xs text-ink-subtle mt-1">Email cannot be changed.</p>
        </div>
        <div>
          <label className="label">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input max-w-sm"
            placeholder="username"
          />
          <p className="text-xs text-ink-subtle mt-1">
            Letters, numbers and underscore. This is your @handle in comments.
          </p>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSave} disabled={!dirty || isPending || !displayName.trim()} className="btn-primary">
            {isPending ? 'Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
          {saved && <span className="text-xs text-green-600">Changes saved successfully.</span>}
        </div>
      </div>
    </div>
  );
}

function AppearanceSection() {
  const { theme, toggleTheme } = useUIStore();
  const [selectedColor, setSelectedColor] = useState(ACCENT_COLORS[0].value);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Appearance</h2>
        <p className="mt-1 text-small text-ink-muted">Customize how the app looks.</p>
      </div>

      <div className="space-y-4 mt-6 border-t border-line-soft pt-6">
        <div>
          <label className="label">Theme</label>
          <div className="flex gap-3 mt-1">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  if (theme !== t) toggleTheme();
                }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all',
                  theme === t
                    ? 'border-primary bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'border-line text-ink-muted hover:border-line-strong',
                )}
              >
                {t === 'light' ? <Sun size={15} /> : <Moon size={15} />}
                {t.charAt(0).toUpperCase() + t.slice(1)} Mode
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Accent Color</label>
          <div className="flex gap-2 mt-1 flex-wrap">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.name}
                onClick={() => setSelectedColor(c.value)}
                className={cn(
                  'h-8 w-8 rounded-full border-2 transition-transform',
                  selectedColor === c.value ? 'border-line dark:border-white scale-110' : 'border-transparent',
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <p className="text-xs text-ink-subtle mt-2">Accent color preference is saved locally.</p>
        </div>
      </div>
    </div>
  );
}

const PREF_ITEMS: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: 'taskAssigned', label: 'Task Assigned', desc: 'When a task is assigned to you' },
  { key: 'taskUpdated', label: 'Task Updated', desc: "When a task you're on is updated" },
  { key: 'taskCommented', label: 'Comments', desc: 'When someone comments on a task you own' },
  { key: 'mentioned', label: 'Mentions', desc: 'When someone @mentions you' },
  { key: 'deadlineApproaching', label: 'Deadline Approaching', desc: '24h before a task is due' },
  { key: 'projectInvite', label: 'Project Invites', desc: "When you're added to a project" },
  { key: 'fileUploaded', label: 'File Uploads', desc: 'When files are added to your tasks' },
  { key: 'emailEnabled', label: 'Email Notifications', desc: 'Also send the above by email' },
];

function NotificationsSection() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: prefs, isLoading } = useQuery({
    queryKey: keys.users.notificationPrefs,
    queryFn: () => usersApi.getNotificationPrefs(),
  });

  const { mutate: save } = useMutation({
    mutationFn: (patch: Partial<NotificationPrefs>) => usersApi.updateNotificationPrefs(patch),
    // Flip the switch immediately; the server is the one that actually enforces it.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: keys.users.notificationPrefs });
      const previous = queryClient.getQueryData<NotificationPrefs>(keys.users.notificationPrefs);
      if (previous) queryClient.setQueryData(keys.users.notificationPrefs, { ...previous, ...patch });
      return { previous };
    },
    onError: (e, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(keys.users.notificationPrefs, ctx.previous);
      setError(apiMessage(e, 'Could not save your preferences'));
    },
    onSuccess: () => setError(''),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Notifications</h2>
        <p className="mt-1 text-small text-ink-muted">Choose what you want to be notified about.</p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="space-y-1 mt-6 border-t border-line-soft pt-6">
        {isLoading || !prefs ? (
          <p className="text-sm text-ink-muted py-4">Loading preferences...</p>
        ) : (
          PREF_ITEMS.map(({ key, label, desc }) => (
            <div
              key={key}
              className={cn(
                'flex items-center justify-between py-3 px-1 rounded-lg hover:bg-ink/[0.04]',
                key === 'emailEnabled' && 'border-t border-line-soft mt-2 pt-4',
              )}
            >
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-ink-muted">{desc}</p>
              </div>
              <button
                role="switch"
                aria-checked={prefs[key]}
                aria-label={label}
                onClick={() => save({ [key]: !prefs[key] })}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors relative shrink-0',
                  prefs[key] ? 'bg-primary' : 'bg-ink-subtle/60',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-raised shadow transition-all',
                    prefs[key] ? 'left-5' : 'left-0.5',
                  )}
                />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SecuritySection() {
  const navigate = useNavigate();
  const { clearAuth } = useAuthStore();
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: () => usersApi.changePassword({ currentPassword: current, newPassword: newPass }),
    onSuccess: () => {
      setMsg('Password changed successfully!');
      setCurrent('');
      setNewPass('');
      setConfirm('');
      setTimeout(() => {
        setShowForm(false);
        setMsg('');
      }, 1500);
    },
    onError: (e) => setMsg(apiMessage(e, 'Could not change your password.')),
  });

  // The current session's refresh token dies with the rest, so drop local auth and send them
  // to sign-in rather than leaving a shell that 401s on its next request.
  const { mutate: logoutEverywhere, isPending: loggingOutAll } = useMutation({
    mutationFn: () => authApi.logoutAll(),
    onSettled: () => {
      clearAuth();
      navigate('/login', { replace: true });
    },
  });

  const handleChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirm) {
      setMsg('Passwords do not match.');
      return;
    }
    if (newPass.length < 8) {
      setMsg('Password must be at least 8 characters.');
      return;
    }
    changePassword();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Security</h2>
        <p className="mt-1 text-small text-ink-muted">Manage your password and security settings.</p>
      </div>

      <div className="mt-6 border-t border-line-soft pt-6 space-y-4">
        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-sunken">
          <div>
            <p className="text-sm font-medium">Password</p>
            <p className="text-xs text-ink-muted">Changing it signs you out on your other devices.</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-secondary text-sm py-1.5">
            {showForm ? 'Cancel' : 'Change'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleChange} className="space-y-3 px-1">
            {msg && (
              <div
                className={cn(
                  'text-sm px-3 py-2 rounded-lg',
                  msg.includes('success')
                    ? 'bg-green-50 text-green-700 dark:bg-green-900/20'
                    : 'bg-red-50 text-red-700 dark:bg-red-900/20',
                )}
              >
                {msg}
              </div>
            )}
            <div>
              <label className="label">Current Password</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="input max-w-sm"
                required
              />
            </div>
            <div>
              <label className="label">New Password</label>
              <input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                className="input max-w-sm"
                minLength={8}
                required
              />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="input max-w-sm"
                required
              />
            </div>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        )}

        <TwoFactorSection />

        <div className="flex items-center justify-between gap-4 rounded-lg bg-sunken px-4 py-3">
          <div>
            <p className="text-sm font-medium">Sign out everywhere</p>
            <p className="text-xs text-ink-muted">
              Revokes every signed-in device, including this one. Use it if you signed in somewhere
              you no longer trust.
            </p>
          </div>
          <button onClick={() => setConfirmLogoutAll(true)} className="btn-secondary shrink-0 py-1.5 text-sm">
            Sign out all
          </button>
        </div>

        {confirmLogoutAll && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] px-4 py-3">
            <p className="text-sm font-medium">Sign out of every device?</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              You will be returned to the sign-in page and will need your password again.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => logoutEverywhere()}
                disabled={loggingOutAll}
                className="btn-primary py-1.5 text-sm"
              >
                {loggingOutAll ? 'Signing out...' : 'Yes, sign out everywhere'}
              </button>
              <button onClick={() => setConfirmLogoutAll(false)} className="btn-ghost py-1.5 text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab') as Section | null;
  const [active, setActive] = useState<Section>(
    requested && MENU.some((m) => m.id === requested) ? requested : 'profile',
  );

  const selectTab = (id: Section) => {
    setActive(id);
    setSearchParams(id === 'profile' ? {} : { tab: id }, { replace: true });
  };

  const sections: Record<Section, React.ReactNode> = {
    profile: <ProfileSection />,
    appearance: <AppearanceSection />,
    notifications: <NotificationsSection />,
    billing: <BillingSection />,
    security: <SecuritySection />,
  };

  return (
    <Page width="narrow">
      <PageHeader title="Settings" description="Manage your account and preferences." />

      <Tabs
        items={MENU.map((m) => ({ id: m.id, label: m.label }))}
        value={active}
        onChange={(id) => selectTab(id as Section)}
        className="mb-6"
      />

      <div className="card">{sections[active]}</div>
    </Page>
  );
}
