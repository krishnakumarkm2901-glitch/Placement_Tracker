import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HiOutlineFunnel, HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import studentsAPI from '../../api/students';
import Avatar from '../../components/ui/Avatar';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';

const modes = [
  ['overall', 'Overall'], ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'],
  ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['streak', 'Streak'],
];

const dateKey = (date) => date.toISOString().slice(0, 10);
const calendarCount = (calendar, start) => Object.entries(calendar || {}).reduce((sum, [timestamp, count]) => {
  const day = new Date(Number(timestamp) * 1000);
  return day >= start ? sum + (Number(count) || 0) : sum;
}, 0);

export default function LeetCodeLeaderboardPage({ adminView = false, embedded = false, hideFilters = false }) {
  const navigate = useNavigate();
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');
  const [appliedYear, setAppliedYear] = useState('');
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('overall');
  const { data, isLoading } = useQuery({
    queryKey: ['leetcode-leaderboard'],
    queryFn: () => studentsAPI.getPublicPlatform('leetcode', { live: 1 }),
    select: (response) => response.data.students || [],
    refetchInterval: 60000,
  });

  const departments = useMemo(() => [...new Set((data || []).map((student) => student.department).filter(Boolean))].sort(), [data]);
  const years = useMemo(() => [...new Set((data || []).map((student) => student.year).filter(Boolean))].sort(), [data]);
  const students = useMemo(() => {
    const now = new Date();
    const today = new Date(`${dateKey(now)}T00:00:00Z`);
    const week = new Date(today); week.setUTCDate(week.getUTCDate() - 6);
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rows = (data || []).filter((student) => student.platform_usernames?.leetcode).map((student) => {
      const profile = student.platform_profiles?.leetcode || {};
      const metrics = profile.metrics || {};
      const calendar = profile.raw?.submission_calendar || {};
      const todaySolves = calendarCount(calendar, today);
      const weekSolves = calendarCount(calendar, week);
      const monthSolves = calendarCount(calendar, month);
      const sortValue = mode === 'today' ? todaySolves : mode === 'week' ? weekSolves : mode === 'month' ? monthSolves : Number(metrics[mode === 'overall' ? 'solved' : mode === 'streak' ? 'current_streak' : mode] || 0);
      return { ...student, profile, metrics, todaySolves, weekSolves, monthSolves, sortValue };
    });
    const query = search.trim().toLowerCase();
    return rows.filter((student) =>
      (!appliedDepartment || student.department === appliedDepartment) &&
      (!appliedYear || String(student.year) === appliedYear) &&
      (!query || student.name.toLowerCase().includes(query) || student.platform_usernames.leetcode.toLowerCase().includes(query))
    ).sort((a, b) => b.sortValue - a.sortValue || (b.metrics.solved || 0) - (a.metrics.solved || 0));
  }, [data, search, appliedDepartment, appliedYear, mode]);

  const profilePath = (id) => adminView ? `/leetcode/${id}` : `/platform/leetcode/profile/${id}`;
  return <div className={embedded ? '' : adminView ? 'page-container' : 'max-w-7xl mx-auto px-4 sm:px-6 py-8'}>
    <div className="mb-7"><h1 className="page-title">LeetCode Leaderboard</h1><p className="page-subtitle">Rank students using synchronized LeetCode problem-solving activity</p></div>
    <Card className="mb-5">
      {!hideFilters && <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-end gap-3"><span className="flex items-center gap-2 font-semibold text-surface-500 pb-2"><HiOutlineFunnel className="w-5 h-5" />Filters:</span><Select label="Department" placeholder="All" value={department} onChange={(event) => setDepartment(event.target.value)} options={departments.map((value) => ({ value, label: value }))} /><Select label="Year" placeholder="All" value={year} onChange={(event) => setYear(event.target.value)} options={years.map((value) => ({ value: String(value), label: `Year ${value}` }))} /><Button onClick={() => { setAppliedDepartment(department); setAppliedYear(year); }}>Apply</Button></div>
        <div className="w-full xl:w-80"><Input icon={HiOutlineMagnifyingGlass} placeholder="Search student name..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
      </div>}
      <div className={`flex flex-wrap gap-2 ${hideFilters ? '' : 'mt-5'}`}>{modes.map(([key, label]) => <button key={key} type="button" onClick={() => setMode(key)} className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${mode === key ? 'bg-teal-500 border-teal-500 text-white' : 'border-surface-200 dark:border-surface-700 text-surface-500 hover:border-teal-400'}`}>{label}</button>)}</div>
    </Card>

    {isLoading ? <LoadingSpinner message="Loading LeetCode leaderboard..." /> : <Card padding={false} className="overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left">
        <thead className="bg-surface-50 dark:bg-surface-800/70 text-xs uppercase tracking-wider text-surface-500"><tr><th className="px-5 py-4">Rank</th><th className="px-5 py-4">Name</th><th className="px-4 py-4 text-center">Total</th><th className="px-4 py-4 text-center">Easy</th><th className="px-4 py-4 text-center">Medium</th><th className="px-4 py-4 text-center">Hard</th><th className="px-4 py-4 text-center">Acceptance</th><th className="px-4 py-4 text-center">Streak Points</th><th className="px-4 py-4 text-center">Today&apos;s Solves</th><th className="px-5 py-4 text-center">Last Updated</th></tr></thead>
        <tbody className="divide-y divide-surface-200 dark:divide-surface-700">{students.map((student, index) => <tr key={student.id} onClick={() => navigate(profilePath(student.id))} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer">
          <td className="px-5 py-5 font-bold text-lg">{index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}</td>
          <td className="px-5 py-5"><div className="flex items-center gap-3"><Avatar src={student.profile.raw?.avatar_url || student.avatar_url} name={student.name} size="sm" /><div><p className="font-bold text-surface-900 dark:text-white">{student.name}</p><p className="text-sm text-surface-500">@{student.platform_usernames.leetcode} · {student.department} · Year {student.year}</p></div></div></td>
          <td className="px-4 py-5 text-center font-semibold text-teal-500">{student.metrics.solved || 0}</td><td className="px-4 py-5 text-center text-cyan-500">{student.metrics.easy || 0}</td><td className="px-4 py-5 text-center text-orange-500">{student.metrics.medium || 0}</td><td className="px-4 py-5 text-center text-rose-500">{student.metrics.hard || 0}</td><td className="px-4 py-5 text-center font-medium">{Number(student.metrics.acceptance_rate || 0).toFixed(1)}%</td><td className="px-4 py-5 text-center font-semibold">{student.metrics.current_streak || 0} pts{student.metrics.current_streak > 0 ? ' 🔥' : ''}</td><td className="px-4 py-5 text-center font-semibold text-green-600">{student.todaySolves ? `+${student.todaySolves}` : '0'}</td><td className="px-5 py-5 text-center text-sm text-surface-500">{student.profile.last_synced ? new Date(student.profile.last_synced).toLocaleString() : 'Not synced'}</td>
        </tr>)}{!students.length && <tr><td colSpan="10" className="px-5 py-14 text-center text-surface-500">No LeetCode students match the selected filters.</td></tr>}</tbody>
      </table></div>
    </Card>}
  </div>;
}
