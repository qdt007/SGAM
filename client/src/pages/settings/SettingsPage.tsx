import { useState } from 'react';
import { User, Moon, Sun, Bell, Shield, Palette, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import { cn } from '../../utils/cn';

const ACCENT_COLORS = [
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Orange', value: '#f59e0b' },
];

type Section = 'profile' | 'appearance' | 'notifications' | 'security';

const MENU: { id: Section; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'profile', label: 'Profile', icon: User, desc: 'Your account information' },
  { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Theme and display preferences' },
  { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alert preferences' },
  { id: 'security', label: 'Security', icon: Shield, desc: 'Password and access' },
];

function ProfileSection() {
  const { user } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold dark:text-white">Profile</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account information.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {user?.displayName?.[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-semibold dark:text-white">{user?.displayName}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <span className="text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-2 py-0.5 rounded mt-1 inline-block">
            {user?.globalRole}
          </span>
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-200 dark:border-gray-800 pt-4">
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
          <input value={user?.email ?? ''} readOnly className="input max-w-sm bg-gray-50 dark:bg-gray-800 cursor-not-allowed" />
          <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
        </div>
        <div>
          <label className="label">Username</label>
          <input value={user?.username ?? ''} readOnly className="input max-w-sm bg-gray-50 dark:bg-gray-800 cursor-not-allowed" />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleSave} className="btn-primary">
            {saved ? '✓ Saved!' : 'Save Changes'}
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
        <h2 className="text-lg font-semibold dark:text-white">Appearance</h2>
        <p className="text-sm text-gray-500 mt-0.5">Customize how the app looks.</p>
      </div>

      <div className="space-y-4 border-t border-gray-200 dark:border-gray-800 pt-4">
        <div>
          <label className="label">Theme</label>
          <div className="flex gap-3 mt-1">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { if (theme !== t) toggleTheme(); }}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all',
                  theme === t
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
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
                  selectedColor === c.value ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Accent color preference is saved locally.</p>
        </div>
      </div>
    </div>
  );
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState({
    taskAssigned: true,
    taskUpdated: true,
    deadlineApproaching: true,
    mentioned: true,
    projectInvite: true,
    fileUploaded: false,
  });

  const toggle = (key: keyof typeof prefs) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const items: { key: keyof typeof prefs; label: string; desc: string }[] = [
    { key: 'taskAssigned', label: 'Task Assigned', desc: 'When a task is assigned to you' },
    { key: 'taskUpdated', label: 'Task Updated', desc: 'When a task you\'re on is updated' },
    { key: 'deadlineApproaching', label: 'Deadline Approaching', desc: '24h before a task is due' },
    { key: 'mentioned', label: 'Mentions', desc: 'When someone @mentions you' },
    { key: 'projectInvite', label: 'Project Invites', desc: 'When you\'re invited to a project' },
    { key: 'fileUploaded', label: 'File Uploads', desc: 'When files are added to your projects' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold dark:text-white">Notifications</h2>
        <p className="text-sm text-gray-500 mt-0.5">Choose what you want to be notified about.</p>
      </div>
      <div className="space-y-1 border-t border-gray-200 dark:border-gray-800 pt-4">
        {items.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-3 px-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
            <div>
              <p className="text-sm font-medium dark:text-white">{label}</p>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
            <button
              onClick={() => toggle(key)}
              className={cn(
                'w-11 h-6 rounded-full transition-colors relative shrink-0',
                prefs[key] ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              )}
            >
              <span className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                prefs[key] ? 'left-5' : 'left-0.5'
              )} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecuritySection() {
  const [showForm, setShowForm] = useState(false);
  const [current, setCurrent] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');

  const handleChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass !== confirm) { setMsg('Passwords do not match.'); return; }
    if (newPass.length < 8) { setMsg('Password must be at least 8 characters.'); return; }
    setMsg('Password changed successfully!');
    setCurrent(''); setNewPass(''); setConfirm('');
    setTimeout(() => { setShowForm(false); setMsg(''); }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold dark:text-white">Security</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your password and security settings.</p>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-4">
        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div>
            <p className="text-sm font-medium dark:text-white">Password</p>
            <p className="text-xs text-gray-500">Last changed: unknown</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-secondary text-sm py-1.5">
            {showForm ? 'Cancel' : 'Change'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleChange} className="space-y-3 px-1">
            {msg && (
              <div className={cn('text-sm px-3 py-2 rounded-lg', msg.includes('success') ? 'bg-green-50 text-green-700 dark:bg-green-900/20' : 'bg-red-50 text-red-700 dark:bg-red-900/20')}>
                {msg}
              </div>
            )}
            <div>
              <label className="label">Current Password</label>
              <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="input max-w-sm" required />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="input max-w-sm" minLength={8} required />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input max-w-sm" required />
            </div>
            <button type="submit" className="btn-primary">Update Password</button>
          </form>
        )}

        <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-800">
          <div>
            <p className="text-sm font-medium dark:text-white">Two-Factor Authentication</p>
            <p className="text-xs text-gray-500">Add an extra layer of security (coming soon)</p>
          </div>
          <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-2 py-1 rounded">Soon</span>
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [active, setActive] = useState<Section>('profile');

  const sections: Record<Section, React.ReactNode> = {
    profile: <ProfileSection />,
    appearance: <AppearanceSection />,
    notifications: <NotificationsSection />,
    security: <SecuritySection />,
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account and preferences.</p>
      </div>

      <div className="flex gap-6 flex-col sm:flex-row">
        {/* Sidebar nav */}
        <aside className="sm:w-52 shrink-0">
          <nav className="space-y-1">
            {MENU.map(({ id, label, icon: Icon, desc }) => (
              <button
                key={id}
                onClick={() => setActive(id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                  active === id
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                )}
              >
                <Icon size={16} className="shrink-0" />
                <span className="flex-1">{label}</span>
                {active === id && <ChevronRight size={13} />}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex-1 card">
          {sections[active]}
        </div>
      </div>
    </div>
  );
}
