import { useQuery } from '@tanstack/react-query';
import Modal from './Modal';
import dailyTasksAPI from '../../api/dailyTasks';

export default function DailyTasksHistoryModal({ isOpen, onClose, platform = 'leetcode' }) {
  const { data, isLoading } = useQuery({
    queryKey: ['daily-tasks', 'history', platform],
    queryFn: () => dailyTasksAPI.getHistory(platform, 20, 0),
    enabled: isOpen,
    select: (res) => res.data,
  });

  const items = data?.items || [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${platform} - Tasks History`} size="lg">
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-surface-500">Loading...</p>}
        {!isLoading && items.length === 0 && <p className="text-sm text-surface-500">No history available.</p>}
        {!isLoading && items.map((entry) => (
          <div key={entry.date} className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{entry.date}</h4>
              <div className="text-sm text-surface-500">{entry.platform}</div>
            </div>
            <ol className="mt-2 list-decimal list-inside space-y-1">
              {(entry.problems || []).map((p, i) => (
                <li key={i} className="text-sm">
                  {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">{p.title}</a> : <span>{p.title}</span>}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </Modal>
  );
}
