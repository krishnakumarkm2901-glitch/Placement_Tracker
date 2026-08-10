import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HiOutlineArrowPath } from 'react-icons/hi2';
import { toast } from 'react-toastify';
import analyticsAPI from '../../api/analytics';
import githubAPI from '../../api/github';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';

const platformCharts = [
  { key: 'github', title: 'GitHub Activity', subtitle: 'Repositories, commits, and contributions', bars: [['repositories', 'Repositories', '#0969da'], ['commits', 'Commits', '#8250df'], ['contributions', 'Contributions', '#1f883d']] },
  { key: 'leetcode', title: 'LeetCode Activity', subtitle: 'Solved problems by difficulty', bars: [['easy', 'Easy', '#22c55e'], ['medium', 'Medium', '#eab308'], ['hard', 'Hard', '#ef4444']] },
  { key: 'codechef', title: 'CodeChef Activity', subtitle: 'Rating, stars, solved problems and ranks', bars: [['rating', 'Rating', '#f59e0b'], ['stars', 'Stars', '#16a34a'], ['problems_solved', 'Problems Solved', '#0ea5e9'], ['global_rank', 'Global Rank', '#8250df']] },
  { key: 'hackerrank', title: 'HackerRank Activity', subtitle: 'Badges, certificates, and followers', bars: [['badges', 'Badges', '#16a34a'], ['certificates', 'Certificates', '#2563eb'], ['followers', 'Followers', '#8b5cf6']] },
];

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [platformSync, setPlatformSync] = useState('github');

  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsAPI.getDashboard(),
    select: (res) => res.data,
  });
  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => githubAPI.getStatus(),
    select: (res) => res.data,
    refetchInterval: 10000,
  });

  const syncPlatformMutation = useMutation({
    mutationFn: (platform) => githubAPI.syncPlatform(platform),
    onSuccess: (_, platform) => {
      toast.success(`${platform.charAt(0).toUpperCase() + platform.slice(1)} sync started.`);
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error) => toast.error(error.response?.data?.error || 'Failed to start platform sync'),
  });

  const handleSync = async () => {
    try {
      await githubAPI.syncAll();
      toast.info('GitHub, LeetCode, CodeChef, and HackerRank sync started.');
    } catch {
      toast.error('Failed to start platform sync');
    }
  };

  return <div className="page-container">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div><h1 className="page-title">Dashboard</h1><p className="page-subtitle">Overview of GitHub, LeetCode, CodeChef, and HackerRank activity</p></div>
      <div className="flex flex-wrap items-center gap-3">
        {dashData?.total_students > 0 && syncStatus?.is_syncing && <Badge variant="warning" dot>Syncing {syncStatus.progress}/{syncStatus.total}</Badge>}
        {syncStatus?.last_sync && <span className="text-xs text-surface-400 hidden sm:block">Last sync: {new Date(syncStatus.last_sync).toLocaleString()}</span>}
        {dashData?.total_students > 0 && <Button onClick={handleSync} loading={syncStatus?.is_syncing} icon={HiOutlineArrowPath} size="sm"><span className="hidden xs:inline">Sync All Platforms</span></Button>}
        {dashData?.total_students > 0 && <select
          value={platformSync}
          onChange={(event) => setPlatformSync(event.target.value)}
          className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:border-primary-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200"
        >
          <option value="github">GitHub</option>
          <option value="leetcode">LeetCode</option>
          <option value="codechef">CodeChef</option>
          <option value="hackerrank">HackerRank</option>
        </select>}
        {dashData?.total_students > 0 && <Button
          onClick={() => syncPlatformMutation.mutate(platformSync)}
          loading={syncPlatformMutation.isLoading}
          icon={HiOutlineArrowPath}
          size="sm"
        >
          <span className="hidden xs:inline">Sync {platformSync.charAt(0).toUpperCase() + platformSync.slice(1)}</span>
        </Button>}
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {!dashData ? (
        <div className="col-span-full">
          <LoadingSpinner message="Loading dashboard statistics..." />
        </div>
      ) : (
        platformCharts
          .filter((platform) => (dashData?.platform_charts?.[platform.key] || []).length > 0)
          .map((platform) => {
            const data = dashData?.platform_charts?.[platform.key] || [];
            return (
              <Card key={platform.key}>
                <CardHeader title={platform.title} subtitle={platform.subtitle} />
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.slice(0, 15)} margin={{ top: 5, right: 5, left: -15, bottom: 35 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                      {platform.bars.map(([key, label, color]) => (
                        <Bar key={key} dataKey={key} name={label} fill={color} radius={[4, 4, 0, 0]} maxBarSize={34} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            );
          })
      )}
    </div>
  </div>;
}
