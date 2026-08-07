import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';
import { HiOutlineArrowLeft, HiOutlineArrowPath, HiOutlineArrowTopRightOnSquare } from 'react-icons/hi2';
import { toast } from 'react-toastify';
import studentsAPI from '../../api/students';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/feedback/EmptyState';
import { ProfileSkeleton } from '../../components/feedback/Skeleton';
import CodeChefOverview from '../../components/codechef/CodeChefOverview';
import HackerRankOverview from '../../components/hackerrank/HackerRankOverview';
import { useAuth } from '../../contexts/AuthContext';

const configs = {
  github: { name: 'GitHub', icon: VscGithubInverted, metrics: [['Repositories', 'total_repos'], ['Commits', 'total_commits'], ['Contributions', 'total_contributions'], ['Current Streak', 'current_streak']] },
  leetcode: { name: 'LeetCode', icon: SiLeetcode, metrics: [['Problems Solved', 'solved'], ['Easy', 'easy'], ['Medium', 'medium'], ['Hard', 'hard'], ['Global Ranking', 'ranking'], ['Contest Rating', 'contest_rating'], ['Contests', 'contests']] },
  codechef: { name: 'CodeChef', icon: SiCodechef, metrics: [['Rating', 'rating'], ['Stars', 'stars'], ['Problems Solved', 'problems_solved'], ['Global Rank', 'global_rank'], ['Country Rank', 'country_rank']] },
  hackerrank: { name: 'HackerRank', icon: SiHackerrank, metrics: [['Badges', 'badges'], ['Certificates', 'certificates'], ['Followers', 'followers']] },
};

function LeetCodeOverview({ profile, metrics }) {
  const raw = profile?.raw || {};
  const calendar = raw.submission_calendar || {};
  const calendarByDate = Object.fromEntries(Object.entries(calendar).map(([timestamp, count]) => [new Date(Number(timestamp) * 1000).toISOString().slice(0, 10), Number(count || 0)]));
  const today = new Date();
  const endUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + (6 - today.getUTCDay()));
  const startUtc = endUtc - (370 * 24 * 60 * 60 * 1000);
  const days = Array.from({ length: 371 }, (_, index) => {
    const time = startUtc + (index * 24 * 60 * 60 * 1000);
    const timestamp = String(Math.floor(time / 1000));
    const date = new Date(time);
    return { timestamp, count: calendarByDate[date.toISOString().slice(0, 10)] || 0, date };
  });
  const maxCount = Math.max(1, ...days.map((day) => day.count));
  const yearlySubmissions = Object.values(calendar).reduce((total, count) => total + (Number(count) || 0), 0);
  const currentMonthUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1);
  const monthMarkers = days.reduce((markers, day, index) => {
    if ((index === 0 || day.date.getUTCDate() === 1) && day.date.getTime() < currentMonthUtc) {
      const key = `${day.date.getUTCFullYear()}-${day.date.getUTCMonth()}`;
      if (!markers.some((marker) => marker.key === key)) {
        markers.push({ key, label: day.date.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' }), column: Math.floor(index / 7) + 1 });
      }
    }
    return markers;
  }, []);
  const recent = raw.recent_submissions || [];
  const skills = raw.skills || {};
  const heatColor = (count) => count === 0 ? '#ebedf0' : count / maxCount > .66 ? '#216e39' : count / maxCount > .33 ? '#30a14e' : '#40c463';
  return <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
    <aside className="space-y-5">
      <Card><div className="space-y-2 text-sm"><p><strong>Rank</strong> {Number(metrics.ranking || 0).toLocaleString()}</p>{raw.company && <p className="text-surface-500">{raw.company}</p>}{raw.country && <p className="text-surface-500">{raw.country}</p>}{raw.school && <p className="text-surface-500">{raw.school}</p>}</div></Card>
      <Card><h3 className="font-semibold text-surface-900 dark:text-white mb-3">Languages</h3><div className="space-y-3">{(raw.languages || []).map((item) => <div key={item.languageName} className="flex items-center justify-between text-sm"><Badge>{item.languageName}</Badge><span><strong>{item.problemsSolved}</strong> solved</span></div>)}</div></Card>
      <Card><h3 className="font-semibold text-surface-900 dark:text-white mb-4">Skills</h3>{['advanced', 'intermediate', 'fundamental'].map((level) => <div key={level} className="mb-4 last:mb-0"><p className="text-xs font-semibold capitalize text-surface-500 mb-2">{level}</p><div className="flex flex-wrap gap-2">{(skills[level] || []).slice(0, 8).map((skill) => <Badge key={skill.tagSlug}>{skill.tagName} ×{skill.problemsSolved}</Badge>)}</div></div>)}</Card>
    </aside>
    <div className="space-y-5 min-w-0">
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        <Card><div className="flex h-full flex-col items-center justify-center gap-6"><div className="py-3 flex flex-col items-center justify-center text-center"><div><span className="text-4xl font-bold text-surface-900 dark:text-white">{Number(metrics.solved || 0).toLocaleString()}</span></div><span className="text-base text-surface-500 mt-2">Problems Solved</span><span className="text-sm text-surface-400 mt-3">{metrics.submissions || 0} submissions</span></div><div className="grid grid-cols-3 gap-2 w-full">{[['Easy', metrics.easy, metrics.total_easy, 'text-cyan-500'], ['Med.', metrics.medium, metrics.total_medium, 'text-amber-500'], ['Hard', metrics.hard, metrics.total_hard, 'text-red-500']].map(([label, value, total, cls]) => <div key={label} className="min-w-0 rounded-lg bg-surface-100 dark:bg-surface-800 px-2 py-3 text-center"><p className={`text-xs font-semibold ${cls}`}>{label}</p><p className="font-bold text-sm sm:text-base whitespace-nowrap">{value || 0}/{total || 0}</p></div>)}</div></div></Card>
        <Card><p className="text-sm text-surface-500">Badges</p><p className="text-3xl font-bold mt-1">{metrics.badges || 0}</p>{raw.badges?.[0] ? <div className="mt-8"><p className="text-xs text-surface-500">Latest badge</p><p className="font-semibold mt-1">{raw.badges[0].displayName}</p></div> : <p className="text-sm text-surface-400 mt-8">No public badges yet</p>}</Card>
        <Card><p className="text-sm text-surface-500">Current Streak Points</p><div className="flex items-center gap-2 mt-2"><p className="text-4xl font-bold text-orange-500">{metrics.current_streak || 0}</p><span className="text-2xl">🔥</span></div><p className="text-sm text-surface-500 mt-3">Live LeetCode streak</p><p className="text-xs text-surface-400 mt-5">{metrics.active_days || 0} total active days</p></Card>
      </div>
      <Card><div className="flex flex-wrap items-center justify-between gap-3 mb-5"><h3 className="font-semibold text-surface-900 dark:text-white"><span className="text-2xl">{yearlySubmissions || metrics.yearly_submissions || 0}</span> <span className="font-normal text-surface-500">submissions in the past one year</span> <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-surface-400 text-[10px] text-surface-500 align-middle">i</span></h3><div className="flex items-center gap-4 text-sm text-surface-500"><span>Total active days: <strong className="text-surface-900 dark:text-white">{metrics.active_days || 0}</strong></span><span>Max streak: <strong className="text-surface-900 dark:text-white">{metrics.longest_streak ?? metrics.streak ?? 0}</strong></span></div></div><div className="overflow-x-auto pb-1"><div style={{ minWidth: 760 }}><div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 11px)', gridTemplateColumns: 'repeat(53, 11px)', gridAutoFlow: 'column', justifyContent: 'space-between', rowGap: 4 }}>{days.map((day) => <div key={day.timestamp} title={`${day.date.toLocaleDateString()}: ${day.count} submissions`} className="rounded-[3px]" style={{ width: 11, height: 11, backgroundColor: heatColor(day.count) }} />)}</div><div className="text-sm text-surface-500 mt-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(53, minmax(0, 1fr))' }}>{monthMarkers.map((marker) => <span key={marker.key} style={{ gridColumn: `${marker.column} / span 4` }}>{marker.label}</span>)}</div></div></div></Card>
      <Card><div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-surface-900 dark:text-white">Recent Accepted Submissions</h3><span className="text-xs text-surface-500">{recent.length} recent</span></div><div className="divide-y divide-surface-200 dark:divide-surface-700">{recent.map((item, index) => <a key={`${item.titleSlug}-${item.timestamp}-${index}`} href={`https://leetcode.com/problems/${item.titleSlug}/`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 py-3 px-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800"><span className="font-medium text-sm text-surface-900 dark:text-white">{item.title}</span><span className="text-xs text-surface-500 whitespace-nowrap">{new Date(Number(item.timestamp) * 1000).toLocaleDateString()}</span></a>)}{!recent.length && <p className="text-sm text-surface-500 py-6 text-center">No recent accepted submissions are public.</p>}</div></Card>
    </div>
  </div>;
}

export default function PlatformProfileOverviewPage({ platform: platformProp }) {
  const { id, platform: routePlatform } = useParams();
  const platform = platformProp || routePlatform || 'github';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const config = configs[platform] || configs.github;
  const Icon = config.icon;
  const { data: student, isLoading } = useQuery({ queryKey: ['public-platform-profile', id], queryFn: () => studentsAPI.getPublicById(id), select: (response) => response.data.student, staleTime: 0, refetchOnMount: 'always' });
  const syncMutation = useMutation({ mutationFn: () => studentsAPI.syncPlatforms(id), onSuccess: () => { toast.success(`${config.name} profile synced`); queryClient.invalidateQueries({ queryKey: ['public-platform-profile', id] }); queryClient.invalidateQueries({ queryKey: ['tracker-students', platform] }); }, onError: (error) => toast.error(error.response?.data?.error || 'Platform sync failed') });
  if (isLoading) return <div className="max-w-7xl mx-auto p-6"><ProfileSkeleton /></div>;
  if (!student) return <div className="max-w-7xl mx-auto p-6"><EmptyState title="Student profile not found" /></div>;
  const profile = platform === 'github' ? student.github_profile || {} : student.platform_profiles?.[platform];
  const username = platform === 'github' ? student.github_username : student.platform_usernames?.[platform];
  const metrics = platform === 'github' ? student.analytics || {} : profile?.metrics || {};
  const status = platform === 'github' ? student.sync_status : profile?.status || 'pending';
  const avatar = platform === 'github'
    ? (student.avatar_url || student.github_profile?.avatar_url)
    : (profile?.avatar_url || profile?.raw?.avatar_url || profile?.raw?.userAvatar || student.avatar_url || student.github_profile?.avatar_url);
  const backPath = isAdmin ? ({ github: '/github-tracker', leetcode: '/leetcode', codechef: '/codechef', hackerrank: '/hackerrank' }[platform]) : `/platform/${platform}`;
  return <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
    <div className="flex items-center justify-between mb-5"><Button variant="ghost" icon={HiOutlineArrowLeft} onClick={() => navigate(backPath)} size="sm">Back to {config.name}</Button>{isAdmin && <Button variant="secondary" icon={HiOutlineArrowPath} onClick={() => syncMutation.mutate()} loading={syncMutation.isPending} size="sm">Sync</Button>}</div>
    <Card className="mb-6"><div className="flex flex-col sm:flex-row sm:items-center gap-5"><Avatar src={avatar} name={student.name} size="xl" /><div className="flex-1"><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold text-surface-900 dark:text-white">{platform === 'leetcode' ? profile?.raw?.real_name || student.name : student.name}</h1><Badge variant={status === 'synced' ? 'success' : status === 'failed' ? 'danger' : 'warning'} dot>{status}</Badge></div><p className="text-surface-500 mt-1">{student.department} · Year {student.year}</p><a href={profile?.profile_url || `https://github.com/${username}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-500 hover:underline mt-2">@{username}<HiOutlineArrowTopRightOnSquare className="w-4 h-4" /></a></div><div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-500/15 text-primary-600 dark:text-primary-300 flex items-center justify-center"><Icon className="w-7 h-7" /></div></div></Card>
    {status === 'failed' ? <Card><EmptyState icon={Icon} title={`${config.name} profile could not be fetched`} description={profile?.error || 'The profile may be private or the username may be incorrect.'} /></Card> : platform === 'leetcode' ? <LeetCodeOverview profile={profile} metrics={metrics} /> : platform === 'codechef' ? <><CodeChefOverview profile={profile} metrics={metrics} />{profile?.last_synced && <p className="text-xs text-surface-400 mt-5">Last synced {new Date(profile.last_synced).toLocaleString()}</p>}</> : platform === 'hackerrank' ? <><HackerRankOverview profile={profile} username={username} />{profile?.last_synced && <p className="text-xs text-surface-400 mt-5">Last synced {new Date(profile.last_synced).toLocaleString()}</p>}</> : <><h2 className="text-xl font-semibold text-surface-900 dark:text-white mb-4">Overview</h2><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{config.metrics.map(([label, key]) => <Card key={key}><p className="text-sm text-surface-500">{label}</p><p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{metrics[key]?.toLocaleString?.() ?? metrics[key] ?? 0}</p></Card>)}</div>{profile?.last_synced && <p className="text-xs text-surface-400 mt-5">Last synced {new Date(profile.last_synced).toLocaleString()}</p>}</>}
  </div>;
}
