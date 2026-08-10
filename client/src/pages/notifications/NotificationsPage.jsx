import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import notificationsAPI from '../../api/notifications';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/feedback/EmptyState';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';
import {
  HiOutlineBellAlert, HiOutlineCheckCircle, HiOutlineTrash, HiOutlineCheck,
} from 'react-icons/hi2';
import { toast } from 'react-toastify';

const TYPE_STYLES = {
  sync_completed: { color: 'success', icon: '✅' },
  sync_failed: { color: 'danger', icon: '❌' },
  invalid_username: { color: 'warning', icon: '⚠️' },
  new_achievement: { color: 'primary', icon: '🏆' },
  student_inactive: { color: 'warning', icon: '😴' },
  repo_created: { color: 'info', icon: '📦' },
  repo_deleted: { color: 'danger', icon: '🗑️' },
  info: { color: 'default', icon: 'ℹ️' },
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications-page'],
    queryFn: () => notificationsAPI.getAll({ limit: 50 }),
    select: (res) => res.data,
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => notificationsAPI.markRead(id),
    onSuccess: () => qc.invalidateQueries(['notifications']),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries(['notifications']);
      toast.success('All notifications marked as read');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => notificationsAPI.delete(id),
    onSuccess: () => {
      qc.invalidateQueries(['notifications']);
      toast.success('Notification deleted');
    },
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unread_count || 0;

  return (
    <div className="page-container max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={() => markAllReadMutation.mutate()} icon={HiOutlineCheckCircle} size="sm">
            Mark All Read
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner message="Loading notifications..." />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={HiOutlineBellAlert}
          title="No notifications"
          description="You'll see sync status, achievements, and alerts here."
        />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {notifications.map((notif) => {
              const style = TYPE_STYLES[notif.type] || TYPE_STYLES.info;
              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className={`glass-card-solid p-4 flex items-start gap-3 group ${
                    !notif.read ? 'border-l-4 border-l-primary-500' : ''
                  }`}
                >
                  <span className="text-xl mt-0.5 flex-shrink-0">{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-surface-900 dark:text-white">{notif.title}</h4>
                      {!notif.read && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                    </div>
                    <p className="text-sm text-surface-500 mt-0.5">{notif.message}</p>
                    <p className="text-xs text-surface-400 mt-1">
                      {notif.created_at ? new Date(notif.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {!notif.read && (
                      <button
                        onClick={() => markReadMutation.mutate(notif.id)}
                        className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700"
                        title="Mark as read"
                      >
                        <HiOutlineCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this notification?')) {
                          deleteMutation.mutate(notif.id);
                        }
                      }}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500"
                      title="Delete"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
