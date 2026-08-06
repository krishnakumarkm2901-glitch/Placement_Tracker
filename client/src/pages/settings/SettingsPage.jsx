import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { HiOutlineSun, HiOutlineMoon, HiOutlineArrowRightOnRectangle } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import githubAPI from '../../api/github';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: syncStatus } = useQuery({
    queryKey: ['settings-sync-status'],
    queryFn: () => githubAPI.getStatus(),
    select: (res) => res.data,
  });

  const themeOptions = [
    { key: 'light', label: 'Light', icon: HiOutlineSun },
    { key: 'dark', label: 'Dark', icon: HiOutlineMoon },
  ];

  return (
    <div className="page-container max-w-3xl">
      <div className="mb-8">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your preferences and account</p>
      </div>

      {/* Theme */}
      <Card className="mb-6">
        <CardHeader title="Appearance" subtitle="Choose your preferred theme" />
        <div className="grid grid-cols-1 xs:grid-cols-3 gap-3">
          {themeOptions.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTheme(key)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                theme === key
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-500/10'
                  : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
              }`}
            >
              <Icon className={`w-6 h-6 ${theme === key ? 'text-primary-600 dark:text-primary-400' : 'text-surface-500'}`} />
              <span className={`text-sm font-medium ${theme === key ? 'text-primary-700 dark:text-primary-300' : 'text-surface-600 dark:text-surface-400'}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Sync Info */}
      <Card className="mb-6">
        <CardHeader title="GitHub Sync" subtitle="Automatic synchronization status" />
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2 py-2">
            <span className="text-sm text-surface-600 dark:text-surface-400">Sync Interval</span>
            <span className="text-sm font-medium text-surface-900 dark:text-white">Every 12 hours</span>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2 py-2">
            <span className="text-sm text-surface-600 dark:text-surface-400">Last Sync</span>
            <span className="text-sm font-medium text-surface-900 dark:text-white">
              {syncStatus?.last_sync ? new Date(syncStatus.last_sync).toLocaleString() : 'Never'}
            </span>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2 py-2">
            <span className="text-sm text-surface-600 dark:text-surface-400">Status</span>
            <span className={`text-sm font-medium ${
              syncStatus?.last_status === 'completed' ? 'text-emerald-600' :
              syncStatus?.last_status === 'in_progress' ? 'text-amber-600' : 'text-surface-500'
            }`}>
              {syncStatus?.last_status || 'idle'}
            </span>
          </div>
        </div>
      </Card>

      {/* Account */}
      <Card className="mb-6">
        <CardHeader title="Account" subtitle="Your account information" />
        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2 py-2">
            <span className="text-sm text-surface-600 dark:text-surface-400">Name</span>
            <span className="text-sm font-medium text-surface-900 dark:text-white">{user?.name}</span>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2 py-2">
            <span className="text-sm text-surface-600 dark:text-surface-400">Email</span>
            <span className="text-sm font-medium text-surface-900 dark:text-white break-all text-right">{user?.email}</span>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-2 py-2">
            <span className="text-sm text-surface-600 dark:text-surface-400">Role</span>
            <span className="text-sm font-medium text-surface-900 dark:text-white capitalize">{user?.role}</span>
          </div>
        </div>
        <div className="mt-6 pt-4 border-t border-surface-200 dark:border-surface-700">
          <Button
            variant="danger"
            onClick={() => { logout(); navigate('/login'); }}
            icon={HiOutlineArrowRightOnRectangle}
          >
            Sign Out
          </Button>
        </div>
      </Card>

      {/* About */}
      <Card>
        <CardHeader title="About Placement_Tracker" />
        <div className="space-y-2 text-sm text-surface-600 dark:text-surface-400">
          <p><strong className="text-surface-900 dark:text-white">Version:</strong> 1.0.0</p>
          <p><strong className="text-surface-900 dark:text-white">Stack:</strong> React + Vite + Tailwind CSS / Flask + MongoDB</p>
          <p className="text-xs mt-4 text-surface-400">Placement_Tracker — GitHub Analytics & Student Performance Management System</p>
        </div>
      </Card>
    </div>
  );
}
