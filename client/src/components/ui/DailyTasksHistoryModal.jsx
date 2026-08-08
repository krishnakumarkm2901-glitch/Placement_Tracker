import { useQuery } from '@tanstack/react-query';
import Modal from './Modal';
import dailyTasksAPI from '../../api/dailyTasks';
import { getProblemUrl } from '../../utils/problemUtils';

const platformNames = {
  leetcode: 'LeetCode',
  codechef: 'CodeChef',
  hackerrank: 'HackerRank',
  github: 'GitHub',
};

export default function DailyTasksHistoryModal({ isOpen, onClose, platform = 'leetcode' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['daily-tasks', 'history', platform],
    queryFn: () => dailyTasksAPI.getHistory(platform, 20, 0),
    enabled: isOpen,
    select: (res) => res.data,
  });

  const items = data?.items || [];
  const platformTitle = platformNames[platform?.toLowerCase()] || (platform.charAt(0).toUpperCase() + platform.slice(1));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${platformTitle} - Daily Tasks History`} size="lg">
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-surface-500 dark:text-surface-400">Loading history...</p>}
        {!isLoading && items.length === 0 && <p className="text-sm text-surface-500 dark:text-surface-400">No daily task history available yet for {platformTitle}.</p>}
        {!isLoading && items.map((entry) => (
          <div key={entry.date} className="border border-surface-200 dark:border-surface-700 rounded-xl p-4 bg-surface-50/50 dark:bg-surface-800/40">
            <div className="flex items-center justify-between pb-2 border-b border-surface-200/60 dark:border-surface-700/60">
              <h4 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
                <span>📅</span> {entry.date}
              </h4>
              <span className="text-xs uppercase tracking-wider font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-2.5 py-0.5 rounded-full">
                {platformTitle}
              </span>
            </div>
            <ol className="mt-3 list-decimal list-inside space-y-1.5">
              {(entry.problems || []).map((p, i) => {
                const targetUrl = (typeof p === 'object' && p.url) ? p.url : getProblemUrl(p.title || p, platform);
                const displayTitle = (typeof p === 'object' && p.title) ? p.title : String(p);
                return (
                  <li key={i} className="text-sm text-surface-800 dark:text-surface-200">
                    <a href={targetUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                      {displayTitle}
                    </a>
                    {p.difficulty && (
                      <span className="ml-2 text-[10px] font-extrabold opacity-75">({p.difficulty})</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </Modal>
  );
}
