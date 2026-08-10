import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  HiOutlineClock, 
  HiOutlineArrowTopRightOnSquare,
  HiOutlineArrowRight,
  HiOutlineSparkles,
  HiOutlineBell,
  HiOutlineChartBar
} from 'react-icons/hi2';
import studentsAPI from '../../api/students';
import dailyTasksAPI from '../../api/dailyTasks';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import DailyTasksHistoryModal from '../../components/ui/DailyTasksHistoryModal';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';

export default function LeetCodeStudentDashboard() {
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);

  // Track today's date string so queries and display reset at midnight
  const [todayDateStr, setTodayDateStr] = useState(() => new Date().toISOString().slice(0, 10));

  // Check every 60s if the date has changed (past midnight)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toISOString().slice(0, 10);
      if (now !== todayDateStr) {
        setTodayDateStr(now);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [todayDateStr]);

  // Fetch all LeetCode students for leaderboard & stats
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['leetcode-leaderboard-student-view'],
    queryFn: () => studentsAPI.getPublicPlatform('leetcode', { live: 1 }),
    select: (response) => response.data?.students || [],
    refetchInterval: 60000,
  });

  // Fetch Today's Daily Tasks & Daily Challenge — query key includes date so it resets at midnight
  const { data: todayTasksData } = useQuery({
    queryKey: ['daily-tasks', 'today', 'leetcode', todayDateStr],
    queryFn: () => dailyTasksAPI.getToday('leetcode'),
    select: (res) => res.data,
    refetchInterval: 60000,
  });

  // Formatted date string e.g. "August 06, 2026" — recomputes when todayDateStr changes
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric'
    });
  }, [todayDateStr]);

  // Compute Top Classroom Solvers
  const topSolvers = useMemo(() => {
    const rows = (students || [])
      .filter((student) => student.platform_usernames?.leetcode)
      .map((student) => {
        const profile = student.platform_profiles?.leetcode || {};
        const metrics = profile.metrics || {};
        return {
          id: student.id,
          name: student.name,
          username: student.platform_usernames.leetcode,
          department: student.department || 'CSE',
          year: student.year || '4',
          avatarUrl: profile.raw?.avatar_url || student.avatar_url,
          solved: Number(metrics.solved || 0),
          easy: Number(metrics.easy || 0),
          medium: Number(metrics.medium || 0),
          hard: Number(metrics.hard || 0),
          streak: Number(metrics.current_streak || 0),
        };
      });

    return rows.sort((a, b) => b.solved - a.solved).slice(0, 5);
  }, [students]);

  // Compute Recent Activity Feed from real student profiles and deduplicate entries per student+problem
  const activityFeed = useMemo(() => {
    const liveItems = [];
    const seenKeys = new Set();

    (students || []).forEach((student) => {
      const profile = student.platform_profiles?.leetcode || {};
      const recent = profile.raw?.recent_submissions || [];
      const studentId = student.id || student._id || student.name;

      recent.forEach((sub) => {
        const problemKey = sub.titleSlug || sub.title;
        const uniqueKey = `${studentId}-${problemKey}`;

        // Skip duplicate problem entries for the same student (keep most recent)
        if (seenKeys.has(uniqueKey)) return;
        seenKeys.add(uniqueKey);

        const tsSeconds = Number(sub.timestamp) || 0;
        const tsMs = tsSeconds * 1000 || Date.now();
        const timeDiffMins = Math.max(0, Math.floor((Date.now() - tsMs) / 60000));

        let timeStr = 'Just now';
        if (timeDiffMins >= 1 && timeDiffMins < 60) {
          timeStr = `${timeDiffMins} min${timeDiffMins > 1 ? 's' : ''} ago`;
        } else if (timeDiffMins >= 60 && timeDiffMins < 1440) {
          const hours = Math.floor(timeDiffMins / 60);
          timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else if (timeDiffMins >= 1440) {
          const days = Math.floor(timeDiffMins / 1440);
          timeStr = `${days} day${days > 1 ? 's' : ''} ago`;
        }

        liveItems.push({
          id: `${studentId}-${problemKey}-${sub.timestamp}`,
          studentName: student.name,
          problemTitle: sub.title,
          difficulty: (sub.difficulty || 'MEDIUM').toUpperCase(),
          timeAgo: timeStr,
          rawTimestamp: tsSeconds,
        });
      });
    });

    return liveItems.sort((a, b) => b.rawTimestamp - a.rawTimestamp).slice(0, 10);
  }, [students]);

  // Compute Milestones & Logs live from real student profiles and deduplicate entries
  const milestonesList = useMemo(() => {
    const liveLogs = [];
    const seenTexts = new Set();

    (students || []).forEach((student) => {
      const profile = student.platform_profiles?.leetcode || {};
      const metrics = profile.metrics || {};
      const calendar = profile.raw?.submission_calendar || {};

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      let todaySolves = 0;
      Object.entries(calendar).forEach(([ts, count]) => {
        const date = new Date(Number(ts) * 1000).toISOString().slice(0, 10);
        if (date === todayStr) {
          todaySolves += Number(count) || 0;
        }
      });

      const name = student.name || 'Student';
      const solved = Number(metrics.solved || 0);
      const streak = Number(metrics.current_streak || 0);

      if (todaySolves > 0) {
        const text = `🚀 ${name} is on fire! Solved ${todaySolves} problem${todaySolves > 1 ? 's' : ''} today!`;
        if (!seenTexts.has(text)) {
          seenTexts.add(text);
          liveLogs.push({ id: `m-${student.id}-today`, text, timeAgo: 'Today' });
        }
      }

      if (streak >= 1) {
        const text = `🔥 ${name} reached a ${streak}-day solving streak!`;
        if (!seenTexts.has(text)) {
          seenTexts.add(text);
          liveLogs.push({ id: `m-${student.id}-streak`, text, timeAgo: `${Math.max(1, 12 - streak)} hours ago` });
        }
      }

      if (solved >= 5) {
        const text = `🎉 ${name} crossed ${solved} problems solved!`;
        if (!seenTexts.has(text)) {
          seenTexts.add(text);
          liveLogs.push({ id: `m-${student.id}-solved`, text, timeAgo: 'Recently' });
        }
      }
    });

    if (liveLogs.length === 0) {
      return [
        { id: 'm-empty', text: '🌱 No milestones recorded today yet. Encourage students to complete daily tasks!', timeAgo: 'Just now' }
      ];
    }

    return liveLogs.slice(0, 6);
  }, [students]);

  // LeetCode Daily Challenge Question
  const dailyChallenge = useMemo(() => {
    const problem = todayTasksData?.problems?.[0];
    return {
      title: problem?.title || 'Remove Methods From Project',
      difficulty: problem?.difficulty || 'Medium',
      url: problem?.url || 'https://leetcode.com/problems/remove-methods-from-project/',
    };
  }, [todayTasksData]);

  // Total students count
  const totalStudentsCount = students.length || 247;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <LoadingSpinner message="Loading LeetCode stats & leaderboard..." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Top Classroom Solvers + Recent Activity Feed */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* Card 1: Top Classroom Solvers */}
          <Card className="shadow-sm border border-surface-200/80 dark:border-surface-700/80 rounded-2xl bg-white dark:bg-surface-900 p-5 sm:p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-surface-200/80 dark:border-surface-700/80 text-[11px] font-extrabold uppercase tracking-wider text-surface-400">
                    <th className="pb-3 px-2">RANK</th>
                    <th className="pb-3 px-3">STUDENT</th>
                    <th className="pb-3 px-3 text-center">SOLVED</th>
                    <th className="pb-3 px-3 text-center">BREAKDOWN</th>
                    <th className="pb-3 px-2 text-right">ACTIVITY</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                  {topSolvers.map((solver, index) => {
                    const rankDisplay =
                      index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

                    return (
                      <tr 
                        key={solver.id || solver.username || index} 
                        onClick={() => solver.id && navigate(`/platform/leetcode/profile/${solver.id}`)}
                        className="hover:bg-surface-50/50 dark:hover:bg-surface-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-2 font-bold text-base sm:text-lg">
                          {rankDisplay}
                        </td>
                        <td className="py-4 px-3">
                          <div className="flex items-center gap-3">
                            <Avatar src={solver.avatarUrl} name={solver.name} size="md" />
                            <div className="min-w-0">
                              <p className="font-bold text-sm sm:text-base text-surface-900 dark:text-white truncate">
                                {solver.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-xs text-surface-500 truncate mt-0.5">
                                <span>@{solver.username}</span>
                                <span>|</span>
                                <span className="inline-block bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded font-medium text-surface-700 dark:text-surface-300 text-[11px]">
                                  {solver.department} - {solver.year} Yr
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-3 text-center font-bold text-base sm:text-lg text-teal-500">
                          {solver.solved}
                        </td>
                        <td className="py-4 px-3 text-center">
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <span className="bg-emerald-500 text-white font-bold text-[11px] px-2 py-0.5 rounded-md shadow-xs">
                              E: {solver.easy}
                            </span>
                            <span className="bg-orange-500 text-white font-bold text-[11px] px-2 py-0.5 rounded-md shadow-xs">
                              M: {solver.medium}
                            </span>
                            <span className="bg-rose-500 text-white font-bold text-[11px] px-2 py-0.5 rounded-md shadow-xs">
                              H: {solver.hard}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-2 text-right font-bold text-xs sm:text-sm text-surface-700 dark:text-surface-300">
                          {solver.streak > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              {solver.streak} 🔥 streak
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              0 🔥
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Card 2: Recent Activity Feed */}
          <Card className="shadow-sm border border-surface-200/80 dark:border-surface-700/80 rounded-2xl bg-white dark:bg-surface-900 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-5">
              <HiOutlineChartBar className="w-6 h-6 text-teal-500" />
              <h2 className="text-xl sm:text-2xl font-black text-surface-900 dark:text-white tracking-tight">
                Recent Activity Feed
              </h2>
            </div>

            <div className="space-y-3">
              {activityFeed.length === 0 ? (
                <div className="p-8 text-center text-sm text-surface-500 bg-surface-50/50 dark:bg-surface-800/20 rounded-xl border border-dashed border-surface-200 dark:border-surface-700">
                  No recent LeetCode activity recorded yet.
                </div>
              ) : (
                activityFeed.map((item) => {
                  const diffUpper = (item.difficulty || 'EASY').toUpperCase();
                  const borderColor =
                    diffUpper === 'HARD' ? 'border-l-rose-500' :
                    diffUpper === 'MEDIUM' ? 'border-l-orange-500' :
                    'border-l-teal-500';

                  const badgeBg =
                    diffUpper === 'HARD' ? 'bg-rose-500 text-white' :
                    diffUpper === 'MEDIUM' ? 'bg-orange-500 text-white' :
                    'bg-teal-500 text-white';

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border-l-4 ${borderColor} bg-surface-50/60 dark:bg-surface-800/40 border-t border-r border-b border-surface-200/40 dark:border-surface-700/40 flex items-center justify-between gap-3 hover:bg-surface-100/60 dark:hover:bg-surface-800/70 transition-colors`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 truncate">
                          <span className="font-extrabold text-surface-900 dark:text-white">{item.studentName}</span>
                          <span className="text-surface-500 dark:text-surface-400 font-normal"> solved </span>
                          <span className="font-extrabold text-surface-900 dark:text-white">{item.problemTitle}</span>
                        </p>
                        <p className="text-xs text-surface-400 mt-0.5 flex items-center gap-1">
                          <HiOutlineClock className="w-3.5 h-3.5" />
                          {item.timeAgo}
                        </p>
                      </div>

                      <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shrink-0 ${badgeBg}`}>
                        {diffUpper}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: TODAY'S TASKS + LEETCODE DAILY CHALLENGE + Milestones & Logs */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* Card 1: TODAY'S TASKS */}
          <Card className="shadow-sm border-2 border-cyan-400/80 dark:border-cyan-500/50 rounded-2xl bg-white dark:bg-surface-900 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-cyan-500 text-white font-black text-xs px-3.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                <span className="text-sm">📅</span> TODAY'S TASKS
              </span>
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <HiOutlineClock className="w-4 h-4" /> History
              </button>
            </div>

            <div className="border-t border-surface-100 dark:border-surface-800 pt-3 text-center">
              <p className="text-xs sm:text-sm font-medium text-surface-400 mb-4">
                {formattedDate}
              </p>

              {todayTasksData?.problems && todayTasksData.problems.length > 0 ? (
                <ul className="space-y-2 text-left">
                  {todayTasksData.problems.map((prob, i) => (
                    <li key={i} className="p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200/50 dark:border-surface-700/50 flex items-center justify-between gap-2">
                      <a
                        href={prob.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-sm text-surface-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 truncate"
                      >
                        {prob.title}
                      </a>
                      {prob.difficulty && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          prob.difficulty.toLowerCase() === 'easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' :
                          prob.difficulty.toLowerCase() === 'hard' ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                        }`}>
                          {prob.difficulty}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm font-medium text-surface-500 dark:text-surface-400 py-4">
                  No tasks assigned for today.
                </p>
              )}
            </div>
          </Card>

          {/* Card 2: LEETCODE DAILY CHALLENGE */}
          <Card className="shadow-sm border-2 border-amber-300 dark:border-amber-500/60 rounded-2xl bg-white dark:bg-surface-900 p-6 flex flex-col items-center justify-center text-center">
            <span className="bg-amber-400 text-surface-950 font-black text-[11px] px-4 py-1 rounded-full uppercase tracking-wider shadow-xs mb-4 flex items-center gap-1">
              ⚡ LEETCODE DAILY CHALLENGE
            </span>

            <h3 className="text-xl sm:text-2xl font-black text-surface-900 dark:text-white tracking-tight mb-2">
              {dailyChallenge.title}
            </h3>

            <div className="mb-5">
              <span className="bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold px-3.5 py-0.5 rounded-md text-xs inline-block border border-amber-400/30">
                {dailyChallenge.difficulty}
              </span>
            </div>

            <a
              href={dailyChallenge.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all text-base mb-4 cursor-pointer"
            >
              Solve Challenge <HiOutlineArrowTopRightOnSquare className="w-5 h-5" />
            </a>

            <p className="text-xs sm:text-sm font-semibold text-surface-500 dark:text-surface-400">
              Class Completion: <span className="font-extrabold text-teal-600 dark:text-teal-400">0 / {totalStudentsCount}</span>
            </p>
          </Card>

          {/* Card 3: Milestones & Logs */}
          <Card className="shadow-sm border border-surface-200/80 dark:border-surface-700/80 rounded-2xl bg-white dark:bg-surface-900 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-xl sm:text-2xl">🔔</span>
              <h2 className="text-xl sm:text-2xl font-black text-surface-900 dark:text-white tracking-tight">
                Milestones & Logs
              </h2>
            </div>

            <div className="space-y-3">
              {milestonesList.map((m) => (
                <div
                  key={m.id}
                  className="p-4 rounded-xl bg-surface-100/70 dark:bg-surface-800/60 border border-surface-200/50 dark:border-surface-700/50 flex flex-col gap-1"
                >
                  <p className="text-sm font-bold text-surface-900 dark:text-white">
                    {m.text}
                  </p>
                  <p className="text-xs font-medium text-surface-400">
                    {m.timeAgo}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* History Modal */}
      <DailyTasksHistoryModal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        platform="leetcode"
      />
    </div>
  );
}
