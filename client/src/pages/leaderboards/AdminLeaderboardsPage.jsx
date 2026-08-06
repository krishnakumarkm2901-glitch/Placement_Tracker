import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';
import studentsAPI from '../../api/students';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import { TableSkeleton } from '../../components/feedback/Skeleton';
import LeetCodeLeaderboardPage from './LeetCodeLeaderboardPage';

const platforms = [
  { key: 'github', name: 'GitHub', icon: VscGithubInverted, sortKey: 'total_contributions', metrics: [['Contributions', 'total_contributions'], ['Repositories', 'total_repos'], ['Commits', 'total_commits']], route: '/github-tracker' },
  { key: 'leetcode', name: 'LeetCode', icon: SiLeetcode },
  { key: 'codechef', name: 'CodeChef', icon: SiCodechef, sortKey: 'problems_solved', metrics: [['Rating', 'rating'], ['Stars', 'stars'], ['Problems Solved', 'problems_solved'], ['Global Rank', 'global_rank'], ['Country Rank', 'country_rank']], route: '/codechef' },
  { key: 'hackerrank', name: 'HackerRank', icon: SiHackerrank, sortKey: 'badges', metrics: [['Badges', 'badges'], ['Certificates', 'certificates'], ['Followers', 'followers']], route: '/hackerrank' },
];

function PlatformLeaderboard({ config }) {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['admin-platform-leaderboard', config.key], queryFn: () => studentsAPI.getPublicPlatform(config.key), select: (response) => response.data.students || [], refetchInterval: 60000 });
  const rows = useMemo(() => (data || []).filter((student) => {
    const username = config.key === 'github' ? student.github_username : student.platform_usernames?.[config.key];
    return username;
  }).sort((a, b) => {
    const aMetrics = config.key === 'github' ? a : a.platform_profiles?.[config.key]?.metrics || {};
    const bMetrics = config.key === 'github' ? b : b.platform_profiles?.[config.key]?.metrics || {};
    return (Number(bMetrics[config.sortKey]) || 0) - (Number(aMetrics[config.sortKey]) || 0);
  }), [data, config]);

  return <div>
    <div className="mb-6"><h1 className="page-title">{config.name} Leaderboard</h1><p className="page-subtitle">Rank students using synchronized {config.name} activity</p></div>
    {isLoading ? <TableSkeleton rows={8} /> : <Card padding={false} className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead className="bg-surface-50 dark:bg-surface-800/70 text-xs uppercase tracking-wider text-surface-500"><tr><th className="px-5 py-4">Rank</th><th className="px-5 py-4">Student</th>{config.metrics.map(([label]) => <th key={label} className="px-5 py-4 text-center">{label}</th>)}</tr></thead><tbody className="divide-y divide-surface-200 dark:divide-surface-700">{rows.map((student, index) => { const metrics = config.key === 'github' ? student : student.platform_profiles?.[config.key]?.metrics || {}; const avatar = config.key === 'github' ? student.avatar_url : student.platform_profiles?.[config.key]?.raw?.avatar_url || student.avatar_url; return <tr key={student.id} onClick={() => navigate(`${config.route}/${student.id}`)} className="cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800/40"><td className="px-5 py-5 text-lg font-bold">{index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${index + 1}`}</td><td className="px-5 py-5"><div className="flex items-center gap-3"><Avatar src={avatar} name={student.name} size="sm" /><div><p className="font-bold text-surface-900 dark:text-white">{student.name}</p><p className="text-sm text-surface-500">{student.department} · Year {student.year}</p></div></div></td>{config.metrics.map(([, key]) => <td key={key} className="px-5 py-5 text-center font-semibold">{Number(metrics[key] || 0).toLocaleString()}</td>)}</tr>; })}{!rows.length && <tr><td colSpan={config.metrics.length + 2} className="py-14 text-center text-surface-500">No {config.name} profiles match the filters.</td></tr>}</tbody></table></div></Card>}
  </div>;
}

export default function AdminLeaderboardsPage() {
  const [platform, setPlatform] = useState('github');
  const selected = platforms.find((item) => item.key === platform);
  return <div className="page-container">
    <div className="flex flex-wrap gap-2 mb-7 border-b border-surface-200 dark:border-surface-700 pb-4">{platforms.map((item) => { const Icon = item.icon; return <button key={item.key} type="button" onClick={() => setPlatform(item.key)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold transition-colors ${platform === item.key ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300' : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800'}`}><Icon className="w-5 h-5" />{item.name}</button>; })}</div>
    {platform === 'leetcode' ? <LeetCodeLeaderboardPage adminView embedded hideFilters /> : <PlatformLeaderboard config={selected} />}
  </div>;
}
