import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';
import { HiOutlineArrowsRightLeft, HiOutlineTrophy } from 'react-icons/hi2';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import studentsAPI from '../../api/students';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import dailyTasksAPI from '../../api/dailyTasks';
import DailyTasksCard from '../../components/ui/DailyTasksCard';
import RecentActivityCard from '../../components/ui/RecentActivityCard';
import DailyTasksHistoryModal from '../../components/ui/DailyTasksHistoryModal';
import LeetCodeChallengeCard from '../../components/ui/LeetCodeChallengeCard';
import Select from '../../components/ui/Select';
import EmptyState from '../../components/feedback/EmptyState';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';
import LeetCodeStudentDashboard from '../trackers/LeetCodeStudentDashboard';

import CompareView from '../../components/compare/CompareView';

const configs = {
  github: { name: 'GitHub', icon: VscGithubInverted, scoreKey: 'github_score', metrics: [['Score', 'github_score'], ['Repositories', 'total_repos'], ['Commits', 'total_commits']], listMetrics: [['Repositories', 'total_repos'], ['Commits', 'total_commits']] },
  leetcode: { name: 'LeetCode', icon: SiLeetcode, scoreKey: 'solved', metrics: [['Solved', 'solved'], ['Easy', 'easy'], ['Medium', 'medium'], ['Hard', 'hard'], ['Ranking', 'ranking'], ['Contest Rating', 'contest_rating']], listMetrics: [['Problems Solved', 'solved'], ['Easy', 'easy'], ['Medium', 'medium'], ['Hard', 'hard']] },
  codechef: { name: 'CodeChef', icon: SiCodechef, scoreKey: 'problems_solved', metrics: [['Rating', 'rating'], ['Stars', 'stars'], ['Problems Solved', 'problems_solved'], ['Global Rank', 'global_rank'], ['Country Rank', 'country_rank']], listMetrics: [['Rating', 'rating'], ['Stars', 'stars'], ['Problems Solved', 'problems_solved']] },
  hackerrank: { name: 'HackerRank', icon: SiHackerrank, scoreKey: 'badges', metrics: [['Badges', 'badges'], ['Certificates', 'certificates'], ['Followers', 'followers']], listMetrics: [['Badges', 'badges'], ['Certificates', 'certificates'], ['Followers', 'followers']] },
};

function getMetrics(student, platform) {
  if (!student) return {};
  return platform === 'github' ? student : (student.platform_profiles?.[platform]?.metrics || {});
}

function ProfileMetrics({ student, platform, config }) {
  if (!student) return null;
  const profile = student.platform_profiles?.[platform];
  const metrics = getMetrics(student, platform);
  const username = platform === 'github' ? student.github_username : student.platform_usernames?.[platform];
  const displayName = student.name || 'Unknown';
  return <Card hover>
    <div className="flex items-center gap-3 mb-4"><Avatar src={student.avatar_url} name={displayName} size="sm" /><div className="min-w-0"><p className="font-semibold text-surface-900 dark:text-white truncate">{displayName}</p><a href={profile?.profile_url || `https://github.com/${username || ''}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-500 hover:underline">@{username || 'user'}</a></div></div>
    {profile?.status === 'failed' ? <p className="text-sm text-red-500">Sync failed: {profile.error}</p> : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{config.metrics.map(([label, key]) => <div key={key} className="rounded-lg bg-surface-50 dark:bg-surface-800 p-2 text-center"><p className="font-bold text-surface-900 dark:text-white">{metrics[key] ?? 0}</p><p className="text-[10px] text-surface-500">{label}</p></div>)}</div>}
  </Card>;
}

export default function PublicPlatformPage({ platform }) {
  const location = useLocation();
  const navigate = useNavigate();
  const config = configs[platform] || configs.github;
  const Icon = config.icon;
  const search = new URLSearchParams(location.search).get('search')?.trim().toLowerCase() || '';
  const mode = location.pathname.endsWith('/compare') ? 'compare' : location.pathname.endsWith('/leaderboard') ? 'leaderboard' : 'dashboard';

  // All hooks must be called before any early return (React rules of hooks)
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['public-platform', platform], queryFn: () => studentsAPI.getPublicPlatform(platform), select: (response) => response.data, refetchInterval: 60000 });
  const departments = useMemo(() => [...new Set((data?.students || []).map((student) => student?.department).filter(Boolean))].sort(), [data]);
  const years = useMemo(() => [...new Set((data?.students || []).map((student) => student?.year).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [data]);
  const profiles = useMemo(() => {
    const available = (data?.students || []).filter((student) => {
      if (!student) return false;
      const username = platform === 'github' ? student.github_username : (student.platform_usernames?.[platform] || student[`${platform}_username`]);
      if (!username || !String(username).trim()) return false;
      const sName = student.name || '';
      return (!search || sName.toLowerCase().includes(search) || String(username).toLowerCase().includes(search)) &&
        (!department || student.department === department) &&
        (!year || String(student.year) === String(year));
    });
    return mode === 'leaderboard' ? available.sort((a, b) => (getMetrics(b, platform)[config.scoreKey] || 0) - (getMetrics(a, platform)[config.scoreKey] || 0)) : available;
  }, [data, platform, mode, config.scoreKey, search, department, year]);
  const first = profiles.find((student) => student?.id === firstId);
  const second = profiles.find((student) => student?.id === secondId);
  const options = profiles.map((student) => ({ value: student.id, label: `${student.name || 'Unknown'} (@${(platform === 'github' ? student.github_username : student.platform_usernames?.[platform]) || 'user'})` }));
  const chartData = useMemo(() => profiles.slice(0, 12).map((student) => {
    const metrics = getMetrics(student, platform);
    const sName = student.name || 'Unknown';
    return { name: sName.length > 12 ? `${sName.slice(0, 12)}…` : sName, ...metrics };
  }), [profiles, platform]);
  const dashboardStats = useMemo(() => {
    const metricTotals = config.metrics.slice(0, 3).map(([label, key]) => ({
      label,
      value: profiles.reduce((total, student) => total + (Number(getMetrics(student, platform)[key]) || 0), 0),
      caption: `Total ${label.toLowerCase()}`,
    }));
    const primaryTotal = profiles.reduce((total, student) => total + (Number(getMetrics(student, platform)[config.scoreKey]) || 0), 0);
    return [
      { label: 'Students', value: profiles.length, caption: 'Tracked profiles' },
      ...metricTotals.slice(0, 2),
      { label: `Average ${config.metrics.find(([, key]) => key === config.scoreKey)?.[0] || 'Score'}`, value: profiles.length ? (primaryTotal / profiles.length).toFixed(1) : '0.0', caption: `Across ${config.name} profiles` },
    ];
  }, [profiles, platform, config]);
  const { data: todayTasks } = useQuery({
    queryKey: ['daily-tasks', 'today', platform],
    queryFn: () => dailyTasksAPI.getToday(platform),
    enabled: ['leetcode', 'codechef', 'hackerrank'].includes(platform),
    select: (res) => res.data,
  });

  const { data: leetcodeDailyChallenge } = useQuery({
    queryKey: ['leetcode-daily-challenge-public'],
    queryFn: () => dailyTasksAPI.getLeetCodeDaily(),
    enabled: platform === 'leetcode',
    select: (res) => res.data,
  });

  const leetcodeDailyDoneCount = useMemo(() => {
    if (platform !== 'leetcode' || !leetcodeDailyChallenge?.titleSlug || !profiles.length) return 0;
    const targetSlug = leetcodeDailyChallenge.titleSlug.toLowerCase();
    
    return profiles.filter((student) => {
      const profile = student.platform_profiles?.leetcode || {};
      const raw = profile.raw || {};
      const submissions = raw.recent_submissions || [];
      return submissions.some((sub) => {
        const status = String(sub.statusDisplay || sub.status || '').toLowerCase();
        const isAccepted = !status || status === 'accepted';
        if (!isAccepted) return false;
        return String(sub.titleSlug || '').toLowerCase() === targetSlug;
      });
    }).length;
  }, [platform, leetcodeDailyChallenge, profiles]);

  // Early return AFTER all hooks have been called
  if (platform === 'leetcode' && mode === 'dashboard') {
    return <LeetCodeStudentDashboard />;
  }

  const profilePath = (student) => (platform === 'github' ? `/profile/${student.id}` : `/platform/${platform}/profile/${student.id}`);

  return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
    <div className="flex items-center gap-3 mb-7"><div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300 flex items-center justify-center"><Icon className="w-6 h-6" /></div><div><h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white flex items-center gap-2">{mode === 'leaderboard' && <HiOutlineTrophy className="w-7 h-7 text-amber-500" />}{config.name} {mode === 'leaderboard' ? 'Leaderboard' : mode === 'compare' ? 'Comparison' : 'Dashboard'}</h1><p className="text-surface-500">{mode === 'compare' ? `Compare two students using ${config.name} activity.` : `Latest public ${config.name} activity for tracked students.`}</p></div></div>
    {isLoading ? <LoadingSpinner message={`Loading ${config.name} dashboard...`} /> : !profiles.length ? <Card><EmptyState icon={Icon} title={`No ${config.name} profiles yet`} description={`Add students' ${config.name} usernames in the admin panel to fetch their public activity.`} /></Card> : mode === 'compare' ? <CompareView initialPlatform={platform} /> : mode === 'leaderboard' ? <Card padding={false} className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-surface-50 dark:bg-surface-800 text-sm text-surface-500"><tr><th className="px-5 py-4">Rank</th><th className="px-5 py-4">Student</th>{config.metrics.map(([label, key]) => <th key={key} className="px-5 py-4">{label}</th>)}</tr></thead><tbody>{profiles.map((student, index) => { const metrics = getMetrics(student, platform); return <tr key={student.id} onClick={() => navigate(profilePath(student))} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); navigate(profilePath(student)); } }} role="button" tabIndex={0} className="border-t border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer"><td className="px-5 py-4 text-lg font-bold text-primary-500">#{index + 1}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar src={student.avatar_url} name={student.name} size="sm" /><button type="button" onClick={(event) => { event.stopPropagation(); navigate(profilePath(student)); }} className="font-semibold text-left text-surface-900 dark:text-white hover:text-primary-500">{student.name}</button></div></td>{config.metrics.map(([, key]) => <td key={key} className="px-5 py-4">{metrics[key] ?? 0}</td>)}</tr>; })}</tbody></table></div></Card> : <div className="space-y-6">
      <div className="flex items-center justify-between gap-3"><p className="text-sm text-surface-500">Overview across every tracked {config.name} profile</p><span className="inline-flex items-center gap-2 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-500/15 dark:text-green-300 px-3 py-1.5 rounded-full"><span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-60 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-green-600" /></span>Live · 60s refresh</span></div>
      {['codechef', 'hackerrank'].includes(platform) ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card><div className="mb-4"><h2 className="font-semibold text-surface-900 dark:text-white">{config.name} {config.metrics.find(([, key]) => key === config.scoreKey)?.[0] || 'Score'}</h2><p className="text-xs text-surface-500">Top student results from synced profile data</p></div><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" opacity={0.35} /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-18} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, color: '#f0f6fc' }} /><Bar dataKey={config.scoreKey} name={config.metrics.find(([, key]) => key === config.scoreKey)?.[0]} fill="#0969da" radius={[5, 5, 0, 0]} maxBarSize={48} /></BarChart></ResponsiveContainer></div></Card>
              <Card><div className="mb-4"><h2 className="font-semibold text-surface-900 dark:text-white">Coding Activity</h2><p className="text-xs text-surface-500">Comparison of key {config.name} activity metrics</p></div><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" opacity={0.35} /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-18} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, color: '#f0f6fc' }} /><Legend wrapperStyle={{ fontSize: 12 }} />{config.metrics.filter(([, key]) => key !== config.scoreKey).slice(0, 3).map(([label, key], index) => <Bar key={key} dataKey={key} name={label} fill={['#1f883d', '#8250df', '#d29922'][index]} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer></div></Card>
            </div>
            <RecentActivityCard platform={platform} students={profiles} />
          </div>
          <div>
            <DailyTasksCard platform={platform} date={todayTasks?.date} problems={todayTasks?.problems} onOpenHistory={() => setHistoryOpen(true)} />
          </div>
        </div>
      ) : platform !== 'leetcode' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card><div className="mb-4"><h2 className="font-semibold text-surface-900 dark:text-white">{config.name} {config.metrics.find(([, key]) => key === config.scoreKey)?.[0] || 'Score'}</h2><p className="text-xs text-surface-500">Top student results from synced profile data</p></div><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" opacity={0.35} /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-18} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, color: '#f0f6fc' }} /><Bar dataKey={config.scoreKey} name={config.metrics.find(([, key]) => key === config.scoreKey)?.[0]} fill="#0969da" radius={[5, 5, 0, 0]} maxBarSize={48} /></BarChart></ResponsiveContainer></div></Card>
          <Card><div className="mb-4"><h2 className="font-semibold text-surface-900 dark:text-white">Coding Activity</h2><p className="text-xs text-surface-500">Comparison of key {config.name} activity metrics</p></div><div className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" opacity={0.35} /><XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-18} textAnchor="end" height={60} /><YAxis tick={{ fontSize: 11 }} /><Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, color: '#f0f6fc' }} /><Legend wrapperStyle={{ fontSize: 12 }} />{config.metrics.filter(([, key]) => key !== config.scoreKey).slice(0, 3).map(([label, key], index) => <Bar key={key} dataKey={key} name={label} fill={['#1f883d', '#8250df', '#d29922'][index]} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer></div></Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
          <div />
          <div className="space-y-4">
            <DailyTasksCard platform={platform} date={todayTasks?.date} problems={todayTasks?.problems} onOpenHistory={() => setHistoryOpen(true)} />
            <LeetCodeChallengeCard problem={leetcodeDailyChallenge} className="max-w-md ml-auto w-full" classCompletion={{ done: leetcodeDailyDoneCount, total: profiles.length }} />
            <div className="glass-card-solid p-4 sm:p-5 max-w-md ml-auto">
              <h4 className="font-semibold text-surface-900">Milestones & Logs</h4>
              <ul className="mt-3 text-sm text-surface-600 space-y-2">
                <li className="flex items-start gap-2"><span className="text-xs text-surface-400">•</span> No milestones yet — encourage students to complete daily tasks.</li>
                <li className="flex items-start gap-2"><span className="text-xs text-surface-400">•</span> Sync logs available in admin panel.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
      <div><h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">Student Profiles</h2><Card padding={false} className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-surface-50 dark:bg-surface-800/70 text-xs uppercase tracking-wider text-surface-500"><tr><th className="px-5 py-4">Student</th><th className="px-5 py-4">Department</th><th className="px-5 py-4">Year</th>{config.listMetrics.map(([label, key]) => <th key={key} className="px-5 py-4">{label}</th>)}<th className="px-5 py-4">Status</th></tr></thead><tbody className="divide-y divide-surface-200 dark:divide-surface-700">{profiles.map((student) => { const metrics = getMetrics(student, platform); const profile = student.platform_profiles?.[platform]; const username = platform === 'github' ? student.github_username : student.platform_usernames?.[platform]; const status = platform === 'github' ? student.sync_status : profile?.status || 'pending'; return <tr key={student.id} onClick={() => navigate(`/platform/${platform}/profile/${student.id}`)} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer"><td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar src={student.avatar_url} name={student.name} size="sm" /><div><button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/platform/${platform}/profile/${student.id}`); }} className="font-semibold text-left text-surface-900 dark:text-white hover:text-primary-500">{student.name}</button><a href={profile?.profile_url || `https://github.com/${username}`} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="block text-xs text-surface-400 hover:text-primary-500 hover:underline">@{username}</a></div></div></td><td className="px-5 py-4">{student.department || '—'}</td><td className="px-5 py-4">{student.year || '—'}</td>{config.listMetrics.map(([, key]) => <td key={key} className="px-5 py-4 font-medium">{metrics[key]?.toLocaleString?.() ?? metrics[key] ?? 0}</td>)}<td className="px-5 py-4"><Badge variant={status === 'synced' ? 'success' : status === 'failed' ? 'danger' : 'warning'} dot>{status}</Badge></td></tr>; })}</tbody></table></div></Card></div>
      <DailyTasksHistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} platform={platform} />
    </div>}
  </div>;
}
