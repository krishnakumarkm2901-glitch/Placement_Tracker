import Card from './Card';
import { HiOutlineClock } from 'react-icons/hi2';

export default function DailyTasksCard({ date, problems = [], onOpenHistory, className = '' }) {
  return (
    <Card className={`${className} border-cyan-200`}>
      <div className="flex items-start justify-between">
        <div>
          <span className="inline-block bg-cyan-400 text-white px-3 py-1 rounded-full font-semibold text-xs">📅 TODAY'S TASKS</span>
        </div>
        <div>
          <button onClick={onOpenHistory} className="text-sm text-surface-500 hover:text-surface-700 flex items-center gap-2"><HiOutlineClock className="w-4 h-4" />History</button>
        </div>
      </div>

      <div className="mt-4 border-t border-surface-200 pt-4 text-center">
        <p className="text-sm text-surface-400">{date}</p>
        <div className="mt-6">
          {problems && problems.length > 0 ? (
            <ol className="space-y-3 list-decimal list-inside">
              {problems.map((p, i) => (
                <li key={i} className="text-sm">
                  {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-surface-900 hover:text-primary-500">{p.title}</a> : <span className="font-semibold text-surface-900">{p.title}</span>}
                  <div className="text-xs text-surface-400 mt-1">{p.id ? `Problem #${p.id}` : `(Problem #${i+1}.)`}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-surface-500">No tasks assigned for today.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
