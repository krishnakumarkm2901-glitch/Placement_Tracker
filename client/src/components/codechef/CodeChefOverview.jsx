import SubmissionsHeatMap from '../charts/SubmissionsHeatMap';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

function PathSection({ title, paths }) {
  const count = paths?.length || 0;
  return (
    <div>
      <h3 className="text-base font-semibold text-surface-800 dark:text-surface-100 mb-3">
        {title} <span className="text-surface-500 font-medium">({count})</span>
      </h3>
      {!count ? (
        <p className="text-sm text-surface-400">None</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {paths.map((path) => (
            <a
              key={`${path.url}-${path.title}`}
              href={path.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-3 hover:border-primary-300 dark:hover:border-primary-500/40 transition-colors"
            >
              {path.icon ? (
                <img src={path.icon} alt="" className="w-10 h-10 rounded-lg object-contain bg-amber-50 dark:bg-amber-500/10 p-1.5 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-surface-100 dark:bg-surface-800 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary-600 dark:text-primary-400 truncate">{path.title}</p>
                <div className="mt-2 h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, Number(path.progress) || 0)}%` }} />
                </div>
                <p className="text-[11px] text-surface-400 mt-1">{Number(path.progress) || 0}%</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function resultTone(status) {
  if (status === 'accepted') return 'success';
  if (!status || status === 'unknown') return 'default';
  return 'danger';
}

export default function CodeChefOverview({ profile, metrics }) {
  const raw = profile?.raw || {};
  const learningPaths = raw.learning_paths || [];
  const practicePaths = raw.practice_paths || [];
  const contests = raw.contests || [];
  const recent = raw.recent_activity || [];
  const totalSolved = metrics?.problems_solved ?? 0;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-surface-900 dark:text-white">Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ['Rating', metrics?.rating],
          ['Stars', metrics?.stars],
          ['Problems Solved', totalSolved],
          ['Global Rank', metrics?.global_rank],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm text-surface-500">{label}</p>
            <p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{value?.toLocaleString?.() ?? value ?? 0}</p>
          </Card>
        ))}
      </div>

      <Card className="space-y-8">
        <PathSection title="Learning Paths" paths={learningPaths} />
        <PathSection title="Practice Paths" paths={practicePaths} />
        <PathSection title="Contests" paths={contests} />
        <div>
          <h3 className="text-base font-semibold text-surface-800 dark:text-surface-100">
            Total Problems Solved: <span className="text-surface-900 dark:text-white">{Number(totalSolved).toLocaleString()}</span>
          </h3>
        </div>
      </Card>

      <Card>
        <SubmissionsHeatMap calendar={raw.submission_calendar || {}} />
      </Card>

      <Card>
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-surface-900 dark:text-white inline-block border-b-2 border-surface-800 dark:border-surface-200 pb-1">
            Recent Activity
          </h3>
        </div>
        <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-700">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-200">
                {['Time', 'Problem', 'Result', 'Lang', 'Solution'].map((header) => (
                  <th key={header} className="text-left font-semibold px-4 py-3 whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
              {recent.map((item, index) => (
                <tr key={`${item.problem}-${item.time}-${index}`} className="bg-white dark:bg-surface-900">
                  <td className="px-4 py-3 text-surface-500 whitespace-nowrap">{item.time || '—'}</td>
                  <td className="px-4 py-3">
                    {item.problem_url ? (
                      <a href={item.problem_url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-600 dark:text-primary-400 hover:underline">
                        {item.problem}
                      </a>
                    ) : (
                      <span className="font-medium text-surface-900 dark:text-white">{item.problem || '—'}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={resultTone(item.status)}>{item.result || '—'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-surface-700 dark:text-surface-300 whitespace-nowrap">{item.language || '—'}</td>
                  <td className="px-4 py-3">
                    {item.solution_url ? (
                      <a href={item.solution_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-primary-400 hover:underline">
                        View
                      </a>
                    ) : (
                      <span className="text-surface-400">View</span>
                    )}
                  </td>
                </tr>
              ))}
              {!recent.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-surface-500">No recent activity is public.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
