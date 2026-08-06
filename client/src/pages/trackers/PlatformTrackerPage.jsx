import { useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import dailyTasksAPI from '../../api/dailyTasks';
import DailyTasksModal from '../../components/ui/DailyTasksModal';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';
import { HiOutlineArrowTopRightOnSquare, HiOutlineArrowPath } from 'react-icons/hi2';
import { toast } from 'react-toastify';
import studentsAPI from '../../api/students';
import githubAPI from '../../api/github';
import Card from '../../components/ui/Card';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/feedback/EmptyState';
import { TableSkeleton } from '../../components/feedback/Skeleton';

const platforms = {
  github: {
    name: 'GitHub',
    icon: VscGithubInverted,
    description: 'Monitor repositories, commits, scores, and sync status for every student.',
    metrics: [['Score', 'github_score'], ['Repositories', 'total_repos'], ['Commits', 'total_commits']],
  },
  leetcode: {
    name: 'LeetCode',
    icon: SiLeetcode,
    description: 'Track student problem-solving progress and contest performance.',
    metrics: [['Problems Solved', 'solved'], ['Easy', 'easy'], ['Medium', 'medium'], ['Hard', 'hard']],
  },
  codechef: {
    name: 'CodeChef',
    icon: SiCodechef,
    description: 'Monitor coding performance, rating, and ranking.',
    metrics: [['Rating', 'rating'], ['Stars', 'stars'], ['Problems Solved', 'problems_solved'], ['Global Rank', 'global_rank'], ['Country Rank', 'country_rank']],
  },
  hackerrank: {
    name: 'HackerRank',
    icon: SiHackerrank,
    description: 'Review student skills, badges, and challenge activity.',
    metrics: [['Badges', 'badges'], ['Certificates', 'certificates'], ['Followers', 'followers']],
  },
};

export default function PlatformTrackerPage({ platform }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const config = platforms[platform] || platforms.github;
  const Icon = config.icon;
  const isGitHub = platform === 'github';
  const search = useMemo(() => new URLSearchParams(location.search).get('search')?.trim().toLowerCase() || '', [location.search]);

  const { data, isLoading } = useQuery({
    queryKey: ['tracker-students', platform],
    queryFn: () => isGitHub
      ? studentsAPI.getAll({ page: 1, limit: 100, sort_by: 'github_score', sort_order: 'desc' })
      : studentsAPI.getPublicPlatform(platform),
    select: (response) => response.data,
  });

  const students = useMemo(() => {
    return (data?.students || [])
      .filter((student) => isGitHub || student.platform_usernames?.[platform])
      .filter((student) => {
        if (!search) return true;
        const studentName = student.name?.toLowerCase() || '';
        const username = (isGitHub ? student.github_username : student.platform_usernames?.[platform])?.toLowerCase() || '';
        return studentName.includes(search) || username.includes(search);
      });
  }, [data?.students, isGitHub, platform, search]);

  const syncMutation = useMutation({
    mutationFn: () => githubAPI.syncPlatform(platform),
    onSuccess: () => {
      toast.success(`${config.name} sync started.`);
      queryClient.invalidateQueries({ queryKey: ['tracker-students', platform] });
    },
    onError: (error) => toast.error(error.response?.data?.error || `Failed to start ${config.name} sync`),
  });

  const { user, isAdmin } = useAuth();
  const [tasksOpen, setTasksOpen] = useState(false);
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const { data: todayTasks } = useQuery({
    queryKey: ['daily-tasks', 'today', platform, todayDateStr],
    queryFn: () => dailyTasksAPI.getToday(platform),
    enabled: platform === 'leetcode',
    select: (res) => res.data,
  });

  return (
    <>
      <div className="page-container">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="page-title">{config.name}</h1>
            <p className="page-subtitle">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={() => syncMutation.mutate()}
            loading={syncMutation.isLoading}
            icon={HiOutlineArrowPath}
            size="sm"
          >
            Sync {config.name}
          </Button>
          {isAdmin && platform === 'leetcode' && (
            <Button variant="primary" onClick={() => setTasksOpen(true)} size="sm">Edit Today's Tasks</Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={8} />
      ) : students.length ? (
        <Card padding={false} className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 dark:bg-surface-800/70 text-left text-surface-500 dark:text-surface-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Student</th>
                  {config.metrics.map(([label, key]) => <th key={key} className="px-5 py-3 font-medium">{label}</th>)}
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                {students.map((student) => {
                  const profile = student.platform_profiles?.[platform];
                  const metrics = isGitHub ? student : profile?.metrics || {};
                  const username = isGitHub ? student.github_username : student.platform_usernames?.[platform];
                  const status = isGitHub ? student.sync_status : profile?.status || 'pending';
                  const detailPath = isGitHub ? `/github-tracker/${student.id}` : `/${platform}/${student.id}`;
                  return <tr key={student.id} onClick={() => navigate(detailPath)} className="hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer">
                    <td className="px-5 py-4">
                      <button type="button" className="flex items-center gap-3 text-left">
                        <Avatar src={student.avatar_url} name={student.name} size="sm" />
                        <span><span className="block font-medium text-surface-900 dark:text-white">{student.name}</span><span className="text-xs text-surface-400">@{username}</span></span>
                      </button>
                    </td>
                    {config.metrics.map(([, key]) => <td key={key} className="px-5 py-4 font-medium">{key === 'github_score' ? `${metrics[key] || 0}/100` : metrics[key]?.toLocaleString?.() ?? metrics[key] ?? 0}</td>)}
                    <td className="px-5 py-4"><Badge variant={status === 'synced' ? 'success' : status === 'failed' ? 'danger' : 'warning'} dot>{status}</Badge></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card><EmptyState icon={Icon} title={`No ${config.name} profiles found`} description={`No student ${config.name} profiles are available yet.`} /></Card>
      )}
      </div>
      {isAdmin && platform === 'leetcode' && (
      <DailyTasksModal
        isOpen={tasksOpen}
        onClose={() => setTasksOpen(false)}
        initial={todayTasks}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['daily-tasks', 'today', platform] })}  // invalidates all date variants
        platform={platform}
      />
      )}
    </>
  );
}
