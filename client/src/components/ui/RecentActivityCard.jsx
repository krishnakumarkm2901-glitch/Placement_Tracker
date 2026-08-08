import { useMemo } from 'react';
import { HiOutlineChartBar, HiOutlineClock } from 'react-icons/hi2';
import Card from './Card';
import { getProblemUrl } from '../../utils/problemUtils';

function parseToTimestamp(timeInput) {
  if (!timeInput) return 0;

  if (typeof timeInput === 'number') {
    return timeInput > 1e11 ? timeInput : timeInput * 1000;
  }

  const str = String(timeInput).trim();
  if (!str) return 0;

  // 1. Check relative time strings like "2 hours ago", "1 day ago", "15 mins ago", "10 sec ago"
  const relMatch = /^(\d+)\s+(sec|second|min|minute|hour|day|week|month|year)s?\s+ago$/i.exec(str);
  if (relMatch) {
    const val = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    const now = Date.now();
    if (unit.startsWith('sec')) return now - val * 1000;
    if (unit.startsWith('min')) return now - val * 60000;
    if (unit.startsWith('hour')) return now - val * 3600000;
    if (unit.startsWith('day')) return now - val * 86400000;
    if (unit.startsWith('week')) return now - val * 7 * 86400000;
    if (unit.startsWith('month')) return now - val * 30 * 86400000;
    if (unit.startsWith('year')) return now - val * 365 * 86400000;
  }

  // 2. Check "HH:MM AM/PM DD/MM/YY" or "HH:MM AM/PM DD/MM/YYYY" (e.g. "09:34 PM 13/07/26")
  const timeDateMatch = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s+(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/i.exec(str);
  if (timeDateMatch) {
    let hour = parseInt(timeDateMatch[1], 10);
    const min = parseInt(timeDateMatch[2], 10);
    const ampm = timeDateMatch[3].toUpperCase();
    const day = parseInt(timeDateMatch[4], 10);
    const month = parseInt(timeDateMatch[5], 10) - 1;
    let year = parseInt(timeDateMatch[6], 10);
    if (year < 100) year += 2000;

    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    return Date.UTC(year, month, day, hour, min);
  }

  // 3. Check "DD/MM/YY HH:MM AM/PM" or "DD/MM/YYYY HH:MM AM/PM"
  const dateTimeMatch = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(str);
  if (dateTimeMatch) {
    const day = parseInt(dateTimeMatch[1], 10);
    const month = parseInt(dateTimeMatch[2], 10) - 1;
    let year = parseInt(dateTimeMatch[3], 10);
    if (year < 100) year += 2000;
    let hour = parseInt(dateTimeMatch[4], 10);
    const min = parseInt(dateTimeMatch[5], 10);
    const ampm = dateTimeMatch[6].toUpperCase();

    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;

    return Date.UTC(year, month, day, hour, min);
  }

  // 4. Standard Date.parse for ISO strings or RFC dates
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return parsed;
  }

  return 0;
}

function formatTimeAgo(timeInput) {
  const tsMs = parseToTimestamp(timeInput);
  if (!tsMs) return 'Recently';

  const timeDiffMins = Math.max(0, Math.floor((Date.now() - tsMs) / 60000));
  if (timeDiffMins < 1) return 'Just now';
  if (timeDiffMins < 60) return `${timeDiffMins} min${timeDiffMins > 1 ? 's' : ''} ago`;
  if (timeDiffMins < 1440) {
    const hours = Math.floor(timeDiffMins / 60);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  const days = Math.floor(timeDiffMins / 1440);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export default function RecentActivityCard({ platform = 'leetcode', students = [], singleProfile = null, className = '' }) {
  const activityFeed = useMemo(() => {
    const liveItems = [];
    const seenKeys = new Set();
    const p = platform.toLowerCase();

    const studentList = singleProfile
      ? [{ id: 'single', name: singleProfile.name || 'Student', platform_profiles: { [p]: singleProfile } }]
      : students;

    (studentList || []).forEach((student) => {
      const profile = student.platform_profiles?.[p] || {};
      const raw = profile.raw || {};
      const studentName = student.name || 'Student';
      const studentId = student.id || student._id || studentName;

      if (p === 'leetcode') {
        const recent = raw.recent_submissions || [];
        recent.forEach((sub) => {
          if (sub.statusDisplay && sub.statusDisplay !== 'Accepted') return;

          const problemKey = (sub.titleSlug || sub.title || '').toLowerCase().trim();
          const uniqueKey = `${studentId}-${problemKey}`;
          if (seenKeys.has(uniqueKey)) return;
          seenKeys.add(uniqueKey);

          const tsSeconds = Number(sub.timestamp) || 0;
          const tsMs = tsSeconds * 1000 || Date.now();
          const diffUpper = (sub.difficulty || 'MEDIUM').toUpperCase();
          const targetUrl = sub.url || getProblemUrl(sub.titleSlug || sub.title, 'leetcode');

          liveItems.push({
            id: `${studentId}-${problemKey}-${tsSeconds}`,
            studentName,
            problemTitle: sub.title,
            problemUrl: targetUrl,
            timeAgo: formatTimeAgo(tsSeconds),
            rawTimestamp: tsMs,
            badgeText: diffUpper,
            badgeType: diffUpper,
          });
        });
      } else if (p === 'codechef') {
        const recent = raw.recent_activity || [];
        recent.forEach((act, idx) => {
          const statusStr = (act.status || '').toLowerCase();
          const resultStr = (act.result || '').toLowerCase();
          const isAccepted = statusStr === 'accepted' || resultStr.includes('accepted') || (act.score && Number(act.score) > 0);

          // Filter out non-accepted submissions so activity log only shows solved problems
          if (!isAccepted) return;

          const problemKey = (act.problem || `p-${idx}`).toLowerCase().trim();
          const uniqueKey = `${studentId}-${problemKey}`;
          if (seenKeys.has(uniqueKey)) return;
          seenKeys.add(uniqueKey);

          const targetUrl = act.problem_url || getProblemUrl(act.problem, 'codechef');
          const tsMs = parseToTimestamp(act.time) || (Date.now() - idx * 3600000);
          const badgeText = act.result && act.result.includes('Accepted') ? 'ACCEPTED' : (act.language || 'ACCEPTED').toUpperCase();

          liveItems.push({
            id: `${studentId}-${problemKey}-${idx}`,
            studentName,
            problemTitle: act.problem,
            problemUrl: targetUrl,
            timeAgo: formatTimeAgo(act.time),
            rawTimestamp: tsMs,
            badgeText: badgeText.length > 14 ? `${badgeText.slice(0, 14)}…` : badgeText,
            badgeType: 'EASY',
          });
        });
      } else if (p === 'hackerrank') {
        const recent = raw.recent_challenges || [];
        recent.forEach((item, idx) => {
          const problemKey = (item.slug || item.title || `h-${idx}`).toLowerCase().trim();
          const uniqueKey = `${studentId}-${problemKey}`;
          if (seenKeys.has(uniqueKey)) return;
          seenKeys.add(uniqueKey);

          const targetUrl = item.url || getProblemUrl(item.slug || item.title, 'hackerrank');
          const category = (item.category || item.difficulty || 'SOLVED').toUpperCase();
          const tsMs = parseToTimestamp(item.created_at) || (Date.now() - idx * 3600000);

          liveItems.push({
            id: `${studentId}-${problemKey}-${idx}`,
            studentName,
            problemTitle: item.title,
            problemUrl: targetUrl,
            timeAgo: formatTimeAgo(item.created_at),
            rawTimestamp: tsMs,
            badgeText: category.length > 14 ? `${category.slice(0, 14)}…` : category,
            badgeType: 'EASY',
          });
        });
      }
    });

    return liveItems.sort((a, b) => b.rawTimestamp - a.rawTimestamp).slice(0, 10);
  }, [platform, students, singleProfile]);

  const platformName = platform === 'codechef' ? 'CodeChef' : platform === 'hackerrank' ? 'HackerRank' : 'LeetCode';

  return (
    <Card className={`shadow-sm border border-surface-200/80 dark:border-surface-700/80 rounded-2xl bg-white dark:bg-surface-900 p-5 sm:p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-5">
        <HiOutlineChartBar className="w-6 h-6 text-teal-500" />
        <h2 className="text-xl sm:text-2xl font-black text-surface-900 dark:text-white tracking-tight">
          Recent Activity Feed
        </h2>
      </div>

      <div className="space-y-3">
        {activityFeed.length === 0 ? (
          <div className="p-8 text-center text-sm text-surface-500 dark:text-surface-400 bg-surface-50/50 dark:bg-surface-800/20 rounded-xl border border-dashed border-surface-200 dark:border-surface-700">
            No recent {platformName} activity recorded yet.
          </div>
        ) : (
          activityFeed.map((item) => {
            const badgeTone = item.badgeType;
            const borderColor =
              badgeTone === 'HARD' ? 'border-l-rose-500' :
              badgeTone === 'MEDIUM' ? 'border-l-orange-500' :
              'border-l-teal-500';

            const badgeBg =
              badgeTone === 'HARD' ? 'bg-rose-500 text-white' :
              badgeTone === 'MEDIUM' ? 'bg-orange-500 text-white' :
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
                    {item.problemUrl ? (
                      <a
                        href={item.problemUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-extrabold text-surface-900 dark:text-white hover:text-teal-500 dark:hover:text-teal-400 transition-colors underline-offset-2 hover:underline"
                      >
                        {item.problemTitle}
                      </a>
                    ) : (
                      <span className="font-extrabold text-surface-900 dark:text-white">{item.problemTitle}</span>
                    )}
                  </p>
                  <p className="text-xs text-surface-400 mt-0.5 flex items-center gap-1">
                    <HiOutlineClock className="w-3.5 h-3.5" />
                    {item.timeAgo}
                  </p>
                </div>

                <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shrink-0 ${badgeBg}`}>
                  {item.badgeText}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
