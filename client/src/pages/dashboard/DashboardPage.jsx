import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { HiOutlineArrowPath, HiOutlineFire, HiOutlineSparkles, HiOutlineClock } from 'react-icons/hi2';
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

  const { data: dashData, isLoading: isDashLoading } = useQuery({
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
      toast.info('Continuous sync started across all platforms.');
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch {
      toast.error('Failed to start platform sync');
    }
  };

  const studentStreaks = dashData?.student_streaks || [];

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of GitHub, LeetCode, CodeChef, and HackerRank activity</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {dashData?.total_students > 0 && syncStatus?.is_syncing && (
            <Badge variant="warning" dot>
              Syncing {syncStatus.progress}/{syncStatus.total}
            </Badge>
          )}
          {syncStatus?.last_sync && (
            <span className="text-xs text-surface-400 hidden sm:block">
              Last sync: {new Date(syncStatus.last_sync).toLocaleString()}
            </span>
          )}
          {dashData?.total_students > 0 && (
            <Button onClick={handleSync} loading={syncStatus?.is_syncing} icon={HiOutlineArrowPath} size="sm">
              <span className="hidden xs:inline">Sync All Platforms</span>
            </Button>
          )}
          {dashData?.total_students > 0 && (
            <select
              value={platformSync}
              onChange={(event) => setPlatformSync(event.target.value)}
              className="rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700 focus:border-primary-500 focus:outline-none dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 cursor-pointer"
            >
              <option value="github">GitHub</option>
              <option value="leetcode">LeetCode</option>
              <option value="codechef">CodeChef</option>
              <option value="hackerrank">HackerRank</option>
            </select>
          )}
          {dashData?.total_students > 0 && (
            <Button
              onClick={() => syncPlatformMutation.mutate(platformSync)}
              loading={syncPlatformMutation.isPending}
              icon={HiOutlineArrowPath}
              size="sm"
            >
              <span className="hidden xs:inline">Sync {platformSync.charAt(0).toUpperCase() + platformSync.slice(1)}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Real Student Streaks & Daily Activity Card */}
      {isDashLoading ? (
        <LoadingSpinner message="Loading dashboard statistics..." />
      ) : (
        <div className="space-y-8">
          {studentStreaks.length > 0 && (
            <Card padding={false} className="overflow-hidden border border-surface-200 dark:border-surface-700 shadow-sm">
              <div className="p-5 border-b border-surface-200 dark:border-surface-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-50/50 dark:bg-surface-800/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <HiOutlineFire className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-surface-900 dark:text-white">
                      Student Streaks & Today's Activity
                    </h2>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Calculated from IST date boundaries counting backwards from today.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-surface-500">
                  <HiOutlineClock className="w-4 h-4 text-surface-400" />
                  <span>Live IST Date: <strong>{new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</strong></span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-100/70 dark:bg-surface-800/60 text-surface-600 dark:text-surface-300 border-b border-surface-200 dark:border-surface-700 uppercase tracking-wider font-extrabold">
                      <th className="py-3 px-4 min-w-[160px]">Student</th>
                      <th className="py-3 px-3 text-center">LeetCode Today</th>
                      <th className="py-3 px-3 text-center">HackerRank Today</th>
                      <th className="py-3 px-3 text-center">CodeChef Today</th>
                      <th className="py-3 px-3 text-center">Current Streak 🔥</th>
                      <th className="py-3 px-3 text-center">Last Active</th>
                      <th className="py-3 px-4 text-right">Last Synced</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                    {studentStreaks.map((s) => (
                      <tr key={s.student_id} className="hover:bg-surface-50/60 dark:hover:bg-surface-800/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-surface-900 dark:text-white whitespace-nowrap">
                          {s.name}
                          <span className="block text-[10px] font-normal text-surface-400">{s.department} · Year {s.year}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold">
                          {s.leetcode_today > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                              +{s.leetcode_today}
                            </span>
                          ) : (
                            <span className="text-surface-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-bold">
                          {s.hackerrank_today > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                              +{s.hackerrank_today}
                            </span>
                          ) : (
                            <span className="text-surface-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-bold">
                          {s.codechef_today > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                              +{s.codechef_today}
                            </span>
                          ) : (
                            <span className="text-surface-400">0</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-extrabold text-sm">
                          {s.current_streak > 0 ? (
                            <span className="text-orange-600 dark:text-orange-400 inline-flex items-center gap-0.5">
                              {s.current_streak} <HiOutlineFire className="w-4 h-4 text-orange-500" />
                            </span>
                          ) : (
                            <span className="text-surface-400 font-medium">0 🔥</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center text-surface-600 dark:text-surface-400 font-medium">
                          {s.last_activity_date || 'No activity'}
                        </td>
                        <td className="py-3 px-4 text-right text-surface-400 whitespace-nowrap">
                          {s.last_updated ? new Date(s.last_updated).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {platformCharts
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
              })}
          </div>
        </div>
      )}
    </div>
  );
}
