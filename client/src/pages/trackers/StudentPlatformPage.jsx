import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';
import { useAuth } from '../../contexts/AuthContext';
import studentsAPI from '../../api/students';
import dailyTasksAPI from '../../api/dailyTasks';
import DailyTasksCard from '../../components/ui/DailyTasksCard';
import DailyTasksHistoryModal from '../../components/ui/DailyTasksHistoryModal';
import { useState } from 'react';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeleton';
import CodeChefOverview from '../../components/codechef/CodeChefOverview';
import HackerRankOverview from '../../components/hackerrank/HackerRankOverview';
import StudentDetailPage from '../students/StudentDetailPage';
import LeetCodeStudentDashboard from './LeetCodeStudentDashboard';
import RecentActivityCard from '../../components/ui/RecentActivityCard';

const platforms = {
  github: { name: 'GitHub', icon: VscGithubInverted, description: 'Your repositories, commits, and GitHub score.', metrics: [] },
  leetcode: { name: 'LeetCode', icon: SiLeetcode, description: 'Your problem-solving and contest activity.', metrics: [['Solved', 'solved'], ['Easy', 'easy'], ['Medium', 'medium'], ['Hard', 'hard'], ['Ranking', 'ranking'], ['Contest Rating', 'contest_rating']] },
  codechef: { name: 'CodeChef', icon: SiCodechef, description: 'Your rating, stars, solved problems and ranking.', metrics: [['Rating', 'rating'], ['Stars', 'stars'], ['Problems Solved', 'problems_solved'], ['Global Rank', 'global_rank'], ['Country Rank', 'country_rank']] },
  hackerrank: { name: 'HackerRank', icon: SiHackerrank, description: 'Your skills, badges, and challenge activity.', metrics: [['Badges', 'badges'], ['Certificates', 'certificates'], ['Followers', 'followers']] },
};

export default function StudentPlatformPage({ platform }) {
  const { user } = useAuth();
  const config = platforms[platform] || platforms.github;
  const Icon = config.icon;
  const isGitHub = platform === 'github';
  const { data: student, isLoading } = useQuery({
    queryKey: ['student-platform-profile', user?.student_id],
    queryFn: () => studentsAPI.getPublicById(user.student_id),
    select: (response) => response.data.student,
    enabled: Boolean(user?.student_id),
  });
  const platformProfile = student?.platform_profiles?.[platform];
  const platformUsername = student?.platform_usernames?.[platform];

  const { data: todayTasks } = useQuery({
    queryKey: ['daily-tasks', 'today', platform],
    queryFn: () => dailyTasksAPI.getToday(platform),
    enabled: ['leetcode', 'codechef', 'hackerrank'].includes(platform) && Boolean(platformUsername),
    select: (res) => res.data,
  });
  const [historyOpen, setHistoryOpen] = useState(false);

  if (platform === 'leetcode') {
    return <LeetCodeStudentDashboard />;
  }

  if (isGitHub && user?.student_id) {
    return <StudentDetailPage publicView studentId={user.student_id} />;
  }

  return (
    <div className="page-container">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center"><Icon className="w-6 h-6" /></div>
        <div><h1 className="page-title">{config.name}</h1><p className="page-subtitle">{config.description}</p></div>
      </div>
      {!user?.student_id ? (
        <Card><EmptyState icon={Icon} title={`${config.name} profile not linked`} description={`Ask an administrator to link your student account with your ${config.name} username.`} /></Card>
      ) : isLoading ? <TableSkeleton rows={4} /> : student && !isGitHub && !platformUsername ? (
        <Card><EmptyState icon={Icon} title={`${config.name} profile not connected`} description={`Ask an administrator to add your ${config.name} username.`} /></Card>
      ) : student && !isGitHub && platformProfile?.status === 'failed' ? (
        <Card><EmptyState icon={Icon} title={`${config.name} data could not be synced`} description={platformProfile.error || 'Try syncing the profile again later.'} /></Card>
      ) : student && !isGitHub && platformProfile ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
            <div className="space-y-5">
              <Card><h2 className="text-xl font-bold text-surface-900 dark:text-white">{student.name}</h2><a className="text-primary-500 hover:underline" href={platformProfile.profile_url} target="_blank" rel="noopener noreferrer">@{platformUsername}</a>{platformProfile.last_synced && <p className="text-xs text-surface-400 mt-2">Last synced {new Date(platformProfile.last_synced).toLocaleString()}</p>}</Card>
              {platform === 'codechef' ? (
                <CodeChefOverview profile={platformProfile} metrics={platformProfile.metrics || {}} />
              ) : platform === 'hackerrank' ? (
                <HackerRankOverview profile={platformProfile} username={platformUsername} />
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{config.metrics.map(([label, key]) => <Card key={key}><p className="text-sm text-surface-500">{label}</p><p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{platformProfile.metrics?.[key] ?? 0}</p></Card>)}</div>
              )}
              <RecentActivityCard platform={platform} singleProfile={{ ...platformProfile, name: student.name }} />
            </div>
            <div>
              <DailyTasksCard platform={platform} date={todayTasks?.date} problems={todayTasks?.problems} studentProfile={platformProfile} onOpenHistory={() => setHistoryOpen(true)} />
            </div>
          </div>
          <DailyTasksHistoryModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} platform={platform} />
        </div>
      ) : student && isGitHub ? (
        <div className="space-y-5">
          <Card><div className="flex items-center gap-4"><Avatar src={student.avatar_url || student.github_profile?.avatar_url} name={student.name} size="lg" /><div><h2 className="text-xl font-bold text-surface-900 dark:text-white">{student.name}</h2><a className="text-primary-500 hover:underline" href={`https://github.com/${student.github_username}`} target="_blank" rel="noopener noreferrer">@{student.github_username}</a></div></div></Card>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['GitHub Score', `${student.github_score || 0}/100`],
              ['Repositories', student.analytics?.total_repos || 0],
              ['Commits', (student.analytics?.total_commits || 0).toLocaleString()],
              ['Current Streak', `${student.analytics?.current_streak || 0} days`],
            ].map(([label, value]) => <Card key={label}><p className="text-sm text-surface-500">{label}</p><p className="text-2xl font-bold text-surface-900 dark:text-white mt-1">{value}</p></Card>)}
          </div>
        </div>
      ) : <Card><EmptyState icon={Icon} title="Profile data is syncing" description="Your username is connected. Refresh shortly to see the latest activity." /></Card>}
    </div>
  );
}
