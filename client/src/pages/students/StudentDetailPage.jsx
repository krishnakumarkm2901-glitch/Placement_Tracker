import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import studentsAPI from '../../api/students';
import githubAPI from '../../api/github';
import Card, { CardHeader } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import ProgressBar from '../../components/ui/ProgressBar';
import Tabs from '../../components/ui/Tabs';
import ContributionHeatmap from '../../components/charts/ContributionHeatmap';
import RadarScoreChart from '../../components/charts/RadarScoreChart';
import LanguagePieChart from '../../components/charts/LanguagePieChart';
import { ProfileSkeleton } from '../../components/feedback/Skeleton';
import { FullPageSpinner } from '../../components/feedback/LoadingSpinner';
import {
  HiOutlineArrowLeft, HiOutlineArrowPath,
  HiOutlineMapPin, HiOutlineBriefcase, HiOutlineLink,
} from 'react-icons/hi2';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';

export default function StudentDetailPage({ publicView = false, backPath = '/students', studentId }) {
  const { id: routeId } = useParams();
  const id = studentId || routeId;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => publicView ? studentsAPI.getPublicById(id) : studentsAPI.getById(id),
    select: (res) => res.data.student,
    refetchInterval: 2000,
  });

  const syncMutation = useMutation({
    mutationFn: () => githubAPI.syncStudent(id),
    onSuccess: () => {
      toast.success('Sync started for this student');
      qc.invalidateQueries(['student', id]);
    },
    onError: () => toast.error('Sync failed'),
  });

  if (isLoading) return <FullPageSpinner />;
  if (!student) return <div className="page-container"><p>Student not found</p></div>;

  const profile = student.github_profile || {};
  const analytics = student.analytics || {};
  const scores = student.scores || {};
  const repos = student.repositories || [];
  const savedLanguages = analytics.languages || {};
  const languages = Object.keys(savedLanguages).length
    ? savedLanguages
    : repos.reduce((totals, repo) => {
        if (repo.language) totals[repo.language] = (totals[repo.language] || 0) + Math.max(Number(repo.size) || 0, 1);
        return totals;
      }, {});
  const langData = Object.entries(languages).map(([lang, bytes]) => ({
    language: lang,
    percentage: 0,
    bytes,
  }));
  const totalBytes = langData.reduce((s, l) => s + l.bytes, 0) || 1;
  langData.forEach((l) => { l.percentage = (l.bytes / totalBytes) * 100; });
  langData.sort((a, b) => b.percentage - a.percentage);

  const githubProfileUrl = profile.html_url || `https://github.com/${student.github_username}`;

  const tabs = [
    {
      key: 'overview',
      label: 'Overview',
      content: (
        <div className="space-y-6">
          {/* Score Radar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader title="GitHub Score Breakdown" subtitle={`Total: ${student.github_score}/100`} />
              <RadarScoreChart scores={scores} />
              <div className="mt-4 space-y-2">
                {[
                  { label: 'Repositories', value: scores.repositories, max: 25 },
                  { label: 'Commits', value: scores.commits, max: 35 },
                  { label: 'Pull Requests', value: scores.pull_requests, max: 20 },
                  { label: 'Good README', value: scores.readme, max: 10 },
                  { label: 'Profile Completion', value: scores.profile_completion, max: 10 },
                ].map((s) => (
                  <ProgressBar key={s.label} label={`${s.label} (${s.value || 0}/${s.max})`} value={s.value || 0} max={s.max} color="primary" size="sm" />
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Language Distribution" />
              <LanguagePieChart data={langData.slice(0, 8)} />
            </Card>
          </div>

          {/* Contribution Heatmap */}
          <Card>
            <CardHeader title="Contribution Activity" subtitle={`${analytics.total_contributions || 0} contributions in the last year`} />
            <ContributionHeatmap data={analytics.contribution_data || []} />
          </Card>

        </div>
      ),
    },
    {
      key: 'repos',
      label: `Repositories (${repos.length})`,
      content: (
        <div className="space-y-4">
          {repos.map((repo) => (
            <Card key={repo.id} hover className="group">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-primary-600 dark:text-primary-400 hover:underline">
                    {repo.name}
                  </a>
                  {repo.description && <p className="text-sm text-surface-500 mt-1 line-clamp-2">{repo.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {repo.language && <Badge variant="info">{repo.language}</Badge>}
                    {repo.topics?.slice(0, 4).map((t) => (
                      <Badge key={t} variant="default">{t}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-surface-500 flex-shrink-0">
                  <span className="flex items-center gap-1">⭐ {repo.stars}</span>
                  <span className="flex items-center gap-1">🍴 {repo.forks}</span>
                  <span className="flex items-center gap-1">Commits {repo.commit_count || 0}</span>
                  <span className="flex items-center gap-1">📊 {repo.quality_score}%</span>
                </div>
              </div>
              {repo.suggestions?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-700">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Improvement Suggestions:</p>
                  <ul className="text-xs text-surface-500 space-y-0.5">
                    {repo.suggestions.map((s, i) => <li key={i}>• {s}</li>)}
                  </ul>
                </div>
              )}
            </Card>
          ))}
          {!repos.length && <p className="text-center text-surface-500 py-8">No repositories found. Sync this student&apos;s GitHub data.</p>}
        </div>
      ),
    },
    {
      key: 'achievements',
      label: 'Achievements',
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(student.achievements || []).map((ach, i) => (
            <Card key={i}>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{ach.icon}</span>
                <div>
                  <p className="font-semibold text-surface-900 dark:text-white">{ach.title}</p>
                  <p className="text-xs text-surface-400">Earned {ach.earned_at ? new Date(ach.earned_at).toLocaleDateString() : ''}</p>
                </div>
              </div>
            </Card>
          ))}
          {!student.achievements?.length && <p className="text-surface-500 col-span-full text-center py-8">No achievements yet. Keep coding! 🚀</p>}
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      {publicView && <div className="mb-6"><Button variant="ghost" onClick={() => navigate('/')} icon={HiOutlineArrowLeft} size="sm">Back to Dashboard</Button></div>}
      {/* Back + Actions */}
      {isAdmin && !publicView && <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate(backPath)} icon={HiOutlineArrowLeft} size="sm">Back</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => syncMutation.mutate()} loading={syncMutation.isPending} icon={HiOutlineArrowPath} size="sm">
            Sync
          </Button>
        </div>
      </div>}

      {/* Profile Header */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <a href={githubProfileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${student.github_username} on GitHub`}>
            <Avatar src={profile.avatar_url} name={student.name} size="xl" className="hover:ring-primary-500 transition-all" />
          </a>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <a href={githubProfileUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary-500 transition-colors">
                <h1 className="text-2xl font-bold text-surface-900 dark:text-white font-display">{student.name}</h1>
              </a>
              <Badge variant="primary">{student.department}</Badge>
              <Badge variant="default">Year {student.year}</Badge>
            </div>
            <a href={githubProfileUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-surface-500 hover:text-primary-500 hover:underline">
              @{profile.login || student.github_username}
            </a>
            {profile.bio && <p className="text-sm text-surface-600 dark:text-surface-400 mt-2">{profile.bio}</p>}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-surface-500">
              {profile.company && <span className="flex items-center gap-1"><HiOutlineBriefcase className="w-4 h-4" />{profile.company}</span>}
              {profile.location && <span className="flex items-center gap-1"><HiOutlineMapPin className="w-4 h-4" />{profile.location}</span>}
              {profile.blog && <a href={profile.blog.startsWith('http') ? profile.blog : `https://${profile.blog}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-500 hover:underline"><HiOutlineLink className="w-4 h-4" />{profile.blog}</a>}
            </div>
            <div className="flex items-center gap-6 mt-4">
              <span className="text-sm"><strong className="text-surface-900 dark:text-white">{profile.followers || 0}</strong> <span className="text-surface-500">followers</span></span>
              <span className="text-sm"><strong className="text-surface-900 dark:text-white">{profile.following || 0}</strong> <span className="text-surface-500">following</span></span>
              <span className="text-sm"><strong className="text-surface-900 dark:text-white">{profile.public_repos || 0}</strong> <span className="text-surface-500">repos</span></span>
            </div>
          </div>
          <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center self-stretch sm:self-auto gap-3 p-4 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
            <p className="text-3xl font-bold gradient-text font-display">{student.github_score}/100</p>
            <p className="text-xs text-surface-500 mt-1">GitHub Score</p>
            {student.last_synced && <p className="text-[10px] text-surface-400 text-center">Synced {new Date(student.last_synced).toLocaleString()}</p>}
          </div>
        </div>
      </Card>

      {/* Tabbed Content */}
      <Tabs
        tabs={tabs.filter((tab) => tab.key !== 'achievements')}
        defaultTab="overview"
        trailingContent={(
          <>
            <span>Weekly Contrib <strong className="text-surface-900 dark:text-white">{analytics.weekly_contributions || 0}</strong></span>
            <span>Monthly Contrib <strong className="text-surface-900 dark:text-white">{analytics.monthly_contributions || 0}</strong></span>
          </>
        )}
      />
    </div>
  );
}
