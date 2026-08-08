import Card from './Card';
import { HiOutlineClock, HiCheckCircle, HiExclamationCircle, HiArrowTopRightOnSquare } from 'react-icons/hi2';
import { getProblemUrl } from '../../utils/problemUtils';

function normalizeStr(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function checkIsSolved(problem, studentProfile, platform) {
  if (!studentProfile) return false;

  const p = (platform || 'leetcode').toLowerCase();

  // Find raw object or profile object
  const profiles = studentProfile.platform_profiles || {};
  const targetProf = profiles[p] || studentProfile;
  const raw = targetProf.raw || targetProf;

  let rawTitle = '';
  let rawUrl = '';
  if (typeof problem === 'string') {
    if (problem.startsWith('http')) {
      rawUrl = problem;
    } else {
      rawTitle = problem;
    }
  } else if (problem && typeof problem === 'object') {
    rawTitle = problem.title || problem.name || '';
    rawUrl = problem.url || problem.link || '';
  }

  let urlSlug = '';
  if (rawUrl) {
    try {
      const parts = new URL(rawUrl).pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        let last = parts[parts.length - 1];
        if (last === 'problem' && parts.length > 1) last = parts[parts.length - 2];
        urlSlug = last;
      }
    } catch (_) {}
  }

  const targetTitleNorm = normalizeStr(rawTitle);
  const targetSlugNorm = normalizeStr(urlSlug);

  if (!targetTitleNorm && !targetSlugNorm) return false;

  const matchesAny = (candidateStr) => {
    if (!candidateStr) return false;
    const candNorm = normalizeStr(candidateStr);
    if (!candNorm) return false;
    if (targetTitleNorm && (candNorm === targetTitleNorm || candNorm.includes(targetTitleNorm) || targetTitleNorm.includes(candNorm))) {
      return true;
    }
    if (targetSlugNorm && (candNorm === targetSlugNorm || candNorm.includes(targetSlugNorm) || targetSlugNorm.includes(candNorm))) {
      return true;
    }
    return false;
  };

  // 1. Check recent_submissions (LeetCode)
  const recentSubmissions = raw.recent_submissions || targetProf.recent_submissions || [];
  if (Array.isArray(recentSubmissions)) {
    const found = recentSubmissions.some((sub) => {
      if (!sub) return false;
      const status = String(sub.statusDisplay || sub.status || '').toLowerCase();
      const isAccepted = !status || status === 'accepted';
      if (!isAccepted) return false;

      return matchesAny(sub.title) || matchesAny(sub.titleSlug) || matchesAny(sub.name);
    });
    if (found) return true;
  }

  // 2. Check recent_activity (CodeChef / HackerRank / LeetCode)
  const recentActivity = raw.recent_activity || targetProf.recent_activity || [];
  if (Array.isArray(recentActivity)) {
    const found = recentActivity.some((act) => {
      if (!act) return false;
      const status = String(act.status || act.result || '').toLowerCase();
      const isAccepted = !status || status.includes('accepted') || (act.score && Number(act.score) > 0);
      if (!isAccepted) return false;

      return matchesAny(act.problem) || matchesAny(act.title) || matchesAny(act.problem_url);
    });
    if (found) return true;
  }

  // 3. Check recent_challenges (HackerRank)
  const recentChallenges = raw.recent_challenges || targetProf.recent_challenges || [];
  if (Array.isArray(recentChallenges)) {
    const found = recentChallenges.some((item) => {
      if (!item) return false;
      return matchesAny(item.title) || matchesAny(item.slug) || matchesAny(item.name) || matchesAny(item.url);
    });
    if (found) return true;
  }

  return false;
}

export default function DailyTasksCard({ date, problems = [], platform, studentProfile = null, onOpenHistory, className = '' }) {
  const platformLabel = platform ? platform.toUpperCase() : '';
  const headerText = platformLabel ? `📅 TODAY'S ${platformLabel} TASKS` : `📅 TODAY'S TASKS`;

  const totalTasks = problems ? problems.length : 0;
  
  // Calculate completion status per problem if studentProfile is available
  const taskStatusList = (problems || []).map((p) => {
    const targetUrl = p.url || getProblemUrl(p.title || p, platform);
    const displayTitle = p.title || p.url || p;
    const isDone = studentProfile ? checkIsSolved(p, studentProfile, platform) : false;

    return {
      raw: p,
      title: displayTitle,
      url: targetUrl,
      difficulty: p.difficulty,
      isDone,
    };
  });

  const completedCount = taskStatusList.filter((t) => t.isDone).length;
  const pendingTasks = taskStatusList.filter((t) => !t.isDone);
  const isAllCompleted = studentProfile && totalTasks > 0 && completedCount === totalTasks;

  return (
    <Card className={`${className} ${isAllCompleted ? 'border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10' : 'border-cyan-200 dark:border-cyan-500/50'}`}>
      <div className="flex items-start justify-between">
        <div>
          <span className={`inline-block px-3 py-1 rounded-full font-semibold text-xs shadow-xs ${isAllCompleted ? 'bg-emerald-600 text-white' : 'bg-cyan-500 text-white'}`}>
            {headerText}
          </span>
        </div>
        <div>
          {onOpenHistory && (
            <button type="button" onClick={onOpenHistory} className="text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 flex items-center gap-1.5 cursor-pointer">
              <HiOutlineClock className="w-4 h-4" />History
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-surface-200 dark:border-surface-700 pt-4">
        <p className="text-sm text-surface-400 dark:text-surface-500 text-center">{date || new Date().toISOString().slice(0, 10)}</p>

        {/* Student Completion Banner */}
        {studentProfile && totalTasks > 0 && (
          <div className="mt-3">
            {isAllCompleted ? (
              <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 flex items-center gap-3">
                <HiCheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <p className="font-extrabold text-sm">Completed All Today's Questions! 🎉</p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">You completed {completedCount}/{totalTasks} assigned tasks.</p>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200 flex items-center gap-3">
                <HiExclamationCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0" />
                <div>
                  <p className="font-extrabold text-sm">{completedCount}/{totalTasks} Completed · {pendingTasks.length} Pending</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">Solve remaining questions below to finish today's tasks.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending Questions Alert Section */}
        {studentProfile && totalTasks > 0 && !isAllCompleted && pendingTasks.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-2">
              ⚠️ Questions You Need To Complete ({pendingTasks.length}):
            </p>
            <div className="space-y-1.5">
              {pendingTasks.map((t, idx) => (
                <a
                  key={idx}
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-200 bg-white/60 dark:bg-surface-800/80 p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                >
                  <span className="truncate">{t.title}</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 shrink-0">
                    Solve <HiArrowTopRightOnSquare className="w-3.5 h-3.5" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Task List */}
        <div className="mt-4 text-left">
          {taskStatusList && taskStatusList.length > 0 ? (
            <ol className="space-y-2.5 list-decimal list-inside">
              {taskStatusList.map((t, i) => (
                <li
                  key={i}
                  className={`text-sm p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                    t.isDone
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700/50'
                      : 'bg-surface-50 dark:bg-surface-800/60 border-surface-200/50 dark:border-surface-700/50'
                  }`}
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2 truncate">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-surface-900 dark:text-white hover:text-primary-500 dark:hover:text-primary-400 truncate"
                    >
                      {t.title}
                    </a>
                    {t.difficulty && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                        t.difficulty.toLowerCase() === 'easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                        t.difficulty.toLowerCase() === 'hard' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                      }`}>
                        {t.difficulty}
                      </span>
                    )}
                  </div>

                  {studentProfile && (
                    <div className="shrink-0">
                      {t.isDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full">
                          <HiCheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-surface-500 dark:text-surface-400 text-center py-2">No tasks assigned for today.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
