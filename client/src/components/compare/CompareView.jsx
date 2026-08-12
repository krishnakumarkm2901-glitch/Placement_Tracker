import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';
import {
  HiOutlineArrowsRightLeft,
  HiOutlineUserGroup,
  HiOutlineAcademicCap,
  HiOutlineChartBar,
  HiOutlineTrophy,
  HiOutlineClipboardDocumentCheck,
  HiOutlineSquares2X2,
} from 'react-icons/hi2';
import {
  BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell,
} from 'recharts';
import studentsAPI from '../../api/students';
import attendanceAPI from '../../api/attendance';
import Avatar from '../ui/Avatar';
import Card, { CardHeader } from '../ui/Card';
import Select from '../ui/Select';
import Badge from '../ui/Badge';
import LoadingSpinner from '../feedback/LoadingSpinner';

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#0969da', '#16a34a', '#8b5cf6'];

const PLATFORMS = [
  { key: 'all', name: 'All Platforms', icon: HiOutlineSquares2X2 },
  { key: 'leetcode', name: 'LeetCode', icon: SiLeetcode, color: 'text-amber-500' },
  { key: 'codechef', name: 'CodeChef', icon: SiCodechef, color: 'text-amber-700 dark:text-amber-400' },
  { key: 'hackerrank', name: 'HackerRank', icon: SiHackerrank, color: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'github', name: 'GitHub', icon: VscGithubInverted, color: 'text-slate-800 dark:text-white' },
];

export default function CompareView({ initialPlatform = 'all' }) {
  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'department' | 'college'
  const selectedPlatform = initialPlatform || 'all';

  // Fetch student summaries
  const { data: studentsRes, isLoading: loadingStudents } = useQuery({
    queryKey: ['public-students-compare'],
    queryFn: studentsAPI.getPublic,
    select: (res) => res.data.students || [],
    staleTime: 60 * 1000,
  });

  // Fetch attendance data
  const { data: attendanceRes, isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance-compare'],
    queryFn: () => attendanceAPI.getAll({ month: new Date().getMonth() + 1, year: new Date().getFullYear() }),
    select: (res) => res.data.students || [],
    staleTime: 2 * 60 * 1000,
  });

  const students = studentsRes || [];
  const attendanceList = attendanceRes || [];

  // Map student ID to attendance object
  const attendanceMap = useMemo(() => {
    const map = {};
    attendanceList.forEach((att) => {
      map[att.student_id] = att;
      map[att.name?.toLowerCase()] = att;
    });
    return map;
  }, [attendanceList]);

  if (loadingStudents || loadingAttendance) {
    return <LoadingSpinner message="Loading comparison data across platforms..." />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header Tabs */}
      <div className="flex items-center border-b border-surface-200 dark:border-surface-700 pb-4">
        {/* Main Mode Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('students')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'students'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}
          >
            <HiOutlineArrowsRightLeft className="w-5 h-5" />
            Student vs Student
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('department')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              activeTab === 'department'
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300 shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}
          >
            <HiOutlineUserGroup className="w-5 h-5" />
            Department Comparison
          </button>
        </div>
      </div>

      {/* Active Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'students' && (
          <StudentCompareSection
            students={students}
            attendanceMap={attendanceMap}
            platform={selectedPlatform}
          />
        )}
        {activeTab === 'department' && (
          <DepartmentCompareSection
            students={students}
            attendanceMap={attendanceMap}
            platform={selectedPlatform}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 1. Student vs Student Comparison ──────────────────────────────────────────
function StudentCompareSection({ students, attendanceMap, platform }) {
  const [deptFilter, setDeptFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');

  const departments = useMemo(() => [...new Set(students.map((s) => s.department).filter(Boolean))].sort(), [students]);
  const years = useMemo(() => [...new Set(students.map((s) => s.year).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [students]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (deptFilter && s.department !== deptFilter) return false;
      if (yearFilter && String(s.year) !== yearFilter) return false;
      if (platform !== 'all') {
        const u = platform === 'github' ? s.github_username : (s.platform_usernames?.[platform] || s[`${platform}_username`]);
        if (!u || !String(u).trim()) return false;
      }
      return true;
    });
  }, [students, deptFilter, yearFilter, platform]);

  const firstStudent = students.find((s) => String(s.id) === firstId);
  const secondStudent = students.find((s) => String(s.id) === secondId);

  const firstAtt = firstStudent ? (attendanceMap[firstStudent.id] || attendanceMap[firstStudent.name?.toLowerCase()] || {}) : {};
  const secondAtt = secondStudent ? (attendanceMap[secondStudent.id] || attendanceMap[secondStudent.name?.toLowerCase()] || {}) : {};

  const firstMetrics = getStudentAllMetrics(firstStudent, firstAtt);
  const secondMetrics = getStudentAllMetrics(secondStudent, secondAtt);

  const firstOptions = filteredStudents
    .filter((s) => String(s.id) !== secondId)
    .map((s) => ({ value: String(s.id), label: `${s.name} (@${s.github_username || 'user'})` }));

  const secondOptions = filteredStudents
    .filter((s) => String(s.id) !== firstId)
    .map((s) => ({ value: String(s.id), label: `${s.name} (@${s.github_username || 'user'})` }));

  const platformTitle = platform === 'all' ? 'All Platforms' : platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
    <motion.div key={platform} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Student Selector Card */}
      <section className="glass-card-solid p-5 sm:p-7 shadow-xl">
        <div className="flex items-start gap-3 mb-6">
          <div className="rounded-xl bg-primary-500/10 p-2.5 text-primary-500">
            <HiOutlineArrowsRightLeft className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-surface-900 dark:text-white">Compare {platformTitle} Student Profiles</h2>
            <p className="text-sm text-surface-500 mt-0.5">
              Select two students to compare side-by-side on {platform === 'all' ? 'all 4 platforms' : platformTitle}, Solving Attendance, and Daily Tasks.
            </p>
          </div>
        </div>

        {/* Filter inputs */}
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mb-6">
          <Select
            label="Filter Department"
            placeholder="All Departments"
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setFirstId(''); setSecondId(''); }}
            options={departments.map((d) => ({ value: d, label: d }))}
          />
          <Select
            label="Filter Year"
            placeholder="All Years"
            value={yearFilter}
            onChange={(e) => { setYearFilter(e.target.value); setFirstId(''); setSecondId(''); }}
            options={years.map((y) => ({ value: String(y), label: `Year ${y}` }))}
          />
        </div>

        {/* Student Selectors */}
        <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
          <Select
            label="Student A"
            placeholder="-- Select First Student --"
            value={firstId}
            onChange={(e) => setFirstId(e.target.value)}
            options={firstOptions}
          />
          <div className="hidden md:flex w-10 h-10 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700 font-bold text-surface-500 text-sm">
            VS
          </div>
          <div className="md:hidden text-center font-bold text-surface-500 my-1">VS</div>
          <Select
            label="Student B"
            placeholder="-- Select Second Student --"
            value={secondId}
            onChange={(e) => setSecondId(e.target.value)}
            options={secondOptions}
          />
        </div>
      </section>

      {/* Comparison Results */}
      {firstStudent && secondStudent && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
          {/* Header Card with Avatars */}
          <Card>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center text-center">
              <div className="space-y-2">
                <Avatar src={firstStudent.avatar_url} name={firstStudent.name} size="lg" className="mx-auto" />
                <h3 className="font-bold text-lg text-surface-900 dark:text-white truncate">{firstStudent.name}</h3>
                <p className="text-xs text-surface-400">{firstStudent.department} • Year {firstStudent.year}</p>
                <Badge variant="primary">@{firstStudent.github_username}</Badge>
              </div>
              <div className="px-4 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-center">
                <span className="text-xs font-semibold text-surface-500 uppercase block">Comparison</span>
                <span className="text-lg font-bold text-primary-600 dark:text-primary-400">VS</span>
              </div>
              <div className="space-y-2">
                <Avatar src={secondStudent.avatar_url} name={secondStudent.name} size="lg" className="mx-auto" />
                <h3 className="font-bold text-lg text-surface-900 dark:text-white truncate">{secondStudent.name}</h3>
                <p className="text-xs text-surface-400">{secondStudent.department} • Year {secondStudent.year}</p>
                <Badge variant="primary">@{secondStudent.github_username}</Badge>
              </div>
            </div>
          </Card>

          {/* LeetCode Focused View */}
          {(platform === 'leetcode' || platform === 'all') && (
            <MetricComparisonCard
              title="LeetCode Performance"
              icon={SiLeetcode}
              color="text-amber-500"
              rows={[
                ['Total Solved', firstMetrics.leetcode_solved, secondMetrics.leetcode_solved],
                ['Easy Problems', firstMetrics.leetcode_easy, secondMetrics.leetcode_easy],
                ['Medium Problems', firstMetrics.leetcode_medium, secondMetrics.leetcode_medium],
                ['Hard Problems', firstMetrics.leetcode_hard, secondMetrics.leetcode_hard],
                ['Contest Rating', firstMetrics.leetcode_contest_rating, secondMetrics.leetcode_contest_rating],
                ['Global Ranking', firstMetrics.leetcode_ranking || '—', secondMetrics.leetcode_ranking || '—'],
              ]}
            />
          )}

          {/* CodeChef Focused View */}
          {(platform === 'codechef' || platform === 'all') && (
            <MetricComparisonCard
              title="CodeChef Performance"
              icon={SiCodechef}
              color="text-amber-700 dark:text-amber-400"
              rows={[
                ['Rating', firstMetrics.codechef_rating, secondMetrics.codechef_rating],
                ['Stars', `${firstMetrics.codechef_stars}★`, `${secondMetrics.codechef_stars}★`],
                ['Problems Solved', firstMetrics.codechef_solved, secondMetrics.codechef_solved],
                ['Global Rank', firstMetrics.codechef_global_rank || '—', secondMetrics.codechef_global_rank || '—'],
              ]}
            />
          )}

          {/* HackerRank Focused View */}
          {(platform === 'hackerrank' || platform === 'all') && (
            <MetricComparisonCard
              title="HackerRank Performance"
              icon={SiHackerrank}
              color="text-emerald-600 dark:text-emerald-400"
              rows={[
                ['Badges', firstMetrics.hackerrank_badges, secondMetrics.hackerrank_badges],
                ['Certificates', firstMetrics.hackerrank_certificates, secondMetrics.hackerrank_certificates],
                ['Solved Problems', firstMetrics.hackerrank_solved, secondMetrics.hackerrank_solved],
                ['Followers', firstMetrics.hackerrank_followers, secondMetrics.hackerrank_followers],
              ]}
            />
          )}

          {/* GitHub Focused View */}
          {(platform === 'github' || platform === 'all') && (
            <MetricComparisonCard
              title="GitHub Activity & Score"
              icon={VscGithubInverted}
              color="text-slate-800 dark:text-white"
              rows={[
                ['GitHub Score', firstMetrics.github_score, secondMetrics.github_score, '/100'],
                ['Repositories', firstMetrics.total_repos, secondMetrics.total_repos],
                ['Commits', firstMetrics.total_commits, secondMetrics.total_commits],
                ['Current Streak', `${firstMetrics.current_streak} days`, `${secondMetrics.current_streak} days`],
              ]}
            />
          )}

          {/* Attendance & Tasks */}
          <MetricComparisonCard
            title="Solving Attendance & Daily Tasks"
            icon={HiOutlineClipboardDocumentCheck}
            color="text-teal-600 dark:text-teal-400"
            rows={[
              ['Attendance Rate', `${firstMetrics.attendance_rate}%`, `${secondMetrics.attendance_rate}%`],
              ['Present Days (Solves)', firstMetrics.attendance_solves, secondMetrics.attendance_solves],
              ['Total Tracked Days', firstMetrics.attendance_total_days, secondMetrics.attendance_total_days],
            ]}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

// ── 2. Department Comparison ────────────────────────────────────────────────
function DepartmentCompareSection({ students, attendanceMap, platform }) {
  // Aggregate stats per department
  const deptStats = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      const d = s.department || 'Other';
      if (!map[d]) {
        map[d] = {
          dept: d,
          count: 0,
          github_score: 0,
          commits: 0,
          leetcode_solved: 0,
          leetcode_easy: 0,
          leetcode_medium: 0,
          leetcode_hard: 0,
          leetcode_rating: 0,
          codechef_solved: 0,
          codechef_rating: 0,
          codechef_stars: 0,
          hackerrank_badges: 0,
          hackerrank_certificates: 0,
          hackerrank_solved: 0,
          attendance_rate_sum: 0,
        };
      }
      const att = attendanceMap[s.id] || attendanceMap[s.name?.toLowerCase()] || {};
      const profiles = s.platform_profiles || {};

      const lc = profiles.leetcode?.metrics || {};
      const cc = profiles.codechef?.metrics || {};
      const hr = profiles.hackerrank?.metrics || {};

      map[d].count += 1;
      map[d].github_score += s.github_score || 0;
      map[d].commits += s.total_commits || 0;

      map[d].leetcode_solved += lc.solved || 0;
      map[d].leetcode_easy += lc.easy || 0;
      map[d].leetcode_medium += lc.medium || 0;
      map[d].leetcode_hard += lc.hard || 0;
      map[d].leetcode_rating += lc.contest_rating || 0;

      map[d].codechef_solved += cc.problems_solved || 0;
      map[d].codechef_rating += cc.rating || 0;
      map[d].codechef_stars += cc.stars || 0;

      map[d].hackerrank_badges += hr.badges || 0;
      map[d].hackerrank_certificates += hr.certificates || 0;
      map[d].hackerrank_solved += hr.solved || 0;

      map[d].attendance_rate_sum += att.rate || 0;
    });

    return Object.values(map).map((d) => ({
      ...d,
      avg_github: Math.round(d.github_score / d.count),
      avg_commits: Math.round(d.commits / d.count),

      avg_leetcode: Math.round(d.leetcode_solved / d.count),
      avg_leetcode_easy: Math.round(d.leetcode_easy / d.count),
      avg_leetcode_medium: Math.round(d.leetcode_medium / d.count),
      avg_leetcode_hard: Math.round(d.leetcode_hard / d.count),
      avg_leetcode_rating: Math.round(d.leetcode_rating / d.count),

      avg_codechef: Math.round(d.codechef_solved / d.count),
      avg_codechef_rating: Math.round(d.codechef_rating / d.count),
      avg_codechef_stars: (d.codechef_stars / d.count).toFixed(1),

      avg_hackerrank_badges: Math.round(d.hackerrank_badges / d.count),
      avg_hackerrank_solved: Math.round(d.hackerrank_solved / d.count),
      avg_hackerrank_certificates: (d.hackerrank_certificates / d.count).toFixed(1),

      avg_attendance: Math.round(d.attendance_rate_sum / d.count),
      total_solves: d.leetcode_solved + d.codechef_solved + d.hackerrank_solved,
    })).sort((a, b) => b.total_solves - a.total_solves);
  }, [students, attendanceMap]);

  const platformTitle = platform === 'all' ? 'All Platforms' : platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
    <motion.div key={platform} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Chart 1 */}
        <Card>
          <CardHeader
            title={
              platform === 'leetcode' ? 'Department LeetCode Output'
              : platform === 'codechef' ? 'Department CodeChef Rating'
              : platform === 'hackerrank' ? 'Department HackerRank Badges'
              : platform === 'github' ? 'Department GitHub Score'
              : 'Department Solving Output'
            }
            subtitle={`Average ${platformTitle} metrics per student by department`}
          />
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptStats} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {platform === 'leetcode' && <Bar dataKey="avg_leetcode" name="Avg LeetCode Solved" fill="#f59e0b" radius={[4, 4, 0, 0]} />}
                {platform === 'leetcode' && <Bar dataKey="avg_leetcode_easy" name="Avg Easy" fill="#10b981" radius={[4, 4, 0, 0]} />}
                {platform === 'leetcode' && <Bar dataKey="avg_leetcode_medium" name="Avg Medium" fill="#eab308" radius={[4, 4, 0, 0]} />}
                {platform === 'leetcode' && <Bar dataKey="avg_leetcode_hard" name="Avg Hard" fill="#ef4444" radius={[4, 4, 0, 0]} />}
                {platform === 'codechef' && <Bar dataKey="avg_codechef_rating" name="Avg Rating" fill="#f59e0b" radius={[4, 4, 0, 0]} />}
                {platform === 'codechef' && <Bar dataKey="avg_codechef" name="Avg Solved" fill="#16a34a" radius={[4, 4, 0, 0]} />}
                {platform === 'hackerrank' && <Bar dataKey="avg_hackerrank_badges" name="Avg Badges" fill="#16a34a" radius={[4, 4, 0, 0]} />}
                {platform === 'hackerrank' && <Bar dataKey="avg_hackerrank_solved" name="Avg Solved" fill="#8b5cf6" radius={[4, 4, 0, 0]} />}
                {platform === 'github' && <Bar dataKey="avg_github" name="Avg GitHub Score" fill="#0969da" radius={[4, 4, 0, 0]} />}
                {platform === 'github' && <Bar dataKey="avg_commits" name="Avg Commits" fill="#8250df" radius={[4, 4, 0, 0]} />}
                {platform === 'all' && <Bar dataKey="avg_leetcode" name="LeetCode Solved" fill="#f59e0b" radius={[4, 4, 0, 0]} />}
                {platform === 'all' && <Bar dataKey="avg_codechef" name="CodeChef Solved" fill="#16a34a" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Chart 2: Attendance vs Platform */}
        <Card>
          <CardHeader title="Department Attendance Comparison" subtitle="Average attendance rate % by department" />
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptStats} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dept" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="avg_attendance" name="Avg Attendance %" fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Department Summary Table */}
      <Card padding={false}>
        <div className="p-4 sm:p-5 border-b border-surface-200 dark:border-surface-700">
          <h3 className="font-bold text-lg text-surface-900 dark:text-white">{platformTitle} Department Comparative Matrix</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 dark:bg-surface-800/70 text-xs font-semibold text-surface-500 uppercase">
              <tr>
                <th className="px-5 py-3.5 text-left">Department</th>
                <th className="px-4 py-3.5 text-center">Students</th>
                <th className="px-4 py-3.5 text-center">Avg Attendance</th>
                {(platform === 'leetcode' || platform === 'all') && <th className="px-4 py-3.5 text-center">Avg LeetCode</th>}
                {(platform === 'leetcode' || platform === 'all') && <th className="px-4 py-3.5 text-center">Avg Easy/Med/Hard</th>}
                {(platform === 'codechef' || platform === 'all') && <th className="px-4 py-3.5 text-center">Avg CodeChef Rating</th>}
                {(platform === 'codechef' || platform === 'all') && <th className="px-4 py-3.5 text-center">Avg CodeChef Solved</th>}
                {(platform === 'hackerrank' || platform === 'all') && <th className="px-4 py-3.5 text-center">Avg HackerRank Badges</th>}
                {(platform === 'github' || platform === 'all') && <th className="px-4 py-3.5 text-center">Avg GitHub Score</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-700">
              {deptStats.map((d) => (
                <tr key={d.dept} className="hover:bg-surface-50/80 dark:hover:bg-surface-800/40">
                  <td className="px-5 py-3.5 font-semibold text-surface-900 dark:text-white">{d.dept}</td>
                  <td className="px-4 py-3.5 text-center font-medium">{d.count}</td>
                  <td className="px-4 py-3.5 text-center font-bold text-teal-600 dark:text-teal-400">{d.avg_attendance}%</td>
                  {(platform === 'leetcode' || platform === 'all') && <td className="px-4 py-3.5 text-center font-bold text-amber-500">{d.avg_leetcode}</td>}
                  {(platform === 'leetcode' || platform === 'all') && (
                    <td className="px-4 py-3.5 text-center text-xs tabular-nums">
                      <span className="text-emerald-600">{d.avg_leetcode_easy}</span> /{' '}
                      <span className="text-amber-500">{d.avg_leetcode_medium}</span> /{' '}
                      <span className="text-red-500">{d.avg_leetcode_hard}</span>
                    </td>
                  )}
                  {(platform === 'codechef' || platform === 'all') && <td className="px-4 py-3.5 text-center font-bold text-amber-700 dark:text-amber-400">{d.avg_codechef_rating}</td>}
                  {(platform === 'codechef' || platform === 'all') && <td className="px-4 py-3.5 text-center font-bold text-emerald-600">{d.avg_codechef}</td>}
                  {(platform === 'hackerrank' || platform === 'all') && <td className="px-4 py-3.5 text-center font-bold text-purple-600">{d.avg_hackerrank_badges}</td>}
                  {(platform === 'github' || platform === 'all') && <td className="px-4 py-3.5 text-center font-bold text-primary-600">{d.avg_github}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}

// ── 3. Overall College Comparison ──────────────────────────────────────────
function CollegeCompareSection({ students, attendanceMap, platform }) {
  const collegeMetrics = useMemo(() => {
    const totalStudents = students.length || 1;
    let totalLeetCode = 0;
    let totalLeetCodeEasy = 0;
    let totalLeetCodeMedium = 0;
    let totalLeetCodeHard = 0;

    let totalCodeChef = 0;
    let totalCodeChefRating = 0;

    let totalHackerRank = 0;
    let totalHackerRankBadges = 0;

    let totalGitHubScore = 0;
    let totalAttendanceRate = 0;

    students.forEach((s) => {
      const profiles = s.platform_profiles || {};
      const lc = profiles.leetcode?.metrics || {};
      const cc = profiles.codechef?.metrics || {};
      const hr = profiles.hackerrank?.metrics || {};

      totalLeetCode += lc.solved || 0;
      totalLeetCodeEasy += lc.easy || 0;
      totalLeetCodeMedium += lc.medium || 0;
      totalLeetCodeHard += lc.hard || 0;

      totalCodeChef += cc.problems_solved || 0;
      totalCodeChefRating += cc.rating || 0;

      totalHackerRank += hr.solved || 0;
      totalHackerRankBadges += hr.badges || 0;

      totalGitHubScore += s.github_score || 0;
      const att = attendanceMap[s.id] || attendanceMap[s.name?.toLowerCase()] || {};
      totalAttendanceRate += att.rate || 0;
    });

    const totalProblems = totalLeetCode + totalCodeChef + totalHackerRank;

    return {
      totalStudents,
      avgAttendance: Math.round(totalAttendanceRate / totalStudents),
      avgLeetCode: Math.round(totalLeetCode / totalStudents),
      avgCodeChef: Math.round(totalCodeChef / totalStudents),
      avgCodeChefRating: Math.round(totalCodeChefRating / totalStudents),
      avgHackerRankBadges: Math.round(totalHackerRankBadges / totalStudents),
      avgGitHub: Math.round(totalGitHubScore / totalStudents),
      totalProblems,
      totalLeetCode,
      totalCodeChef,
      totalHackerRank,

      // Pie chart data for difficulty (LeetCode) or platform
      difficultyPie: [
        { name: 'Easy', value: totalLeetCodeEasy },
        { name: 'Medium', value: totalLeetCodeMedium },
        { name: 'Hard', value: totalLeetCodeHard },
      ],
      platformPie: [
        { name: 'LeetCode', value: totalLeetCode },
        { name: 'CodeChef', value: totalCodeChef },
        { name: 'HackerRank', value: totalHackerRank },
      ],
    };
  }, [students, attendanceMap]);

  const platformTitle = platform === 'all' ? 'All Platforms' : platform.charAt(0).toUpperCase() + platform.slice(1);

  return (
    <motion.div key={platform} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* College Benchmark Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tracked Students" value={collegeMetrics.totalStudents} icon="🎓" color="blue" />
        <StatCard label="College Avg Attendance" value={`${collegeMetrics.avgAttendance}%`} icon="📊" color="teal" />
        {platform === 'leetcode' ? (
          <StatCard label="Total LeetCode Solved" value={collegeMetrics.totalLeetCode.toLocaleString()} icon="🟡" color="amber" />
        ) : platform === 'codechef' ? (
          <StatCard label="Total CodeChef Solved" value={collegeMetrics.totalCodeChef.toLocaleString()} icon="🟤" color="amber" />
        ) : platform === 'hackerrank' ? (
          <StatCard label="Total HackerRank Badges" value={collegeMetrics.totalHackerRank.toLocaleString()} icon="🟢" color="emerald" />
        ) : (
          <StatCard label="Total Solved Problems" value={collegeMetrics.totalProblems.toLocaleString()} icon="⚡" color="amber" />
        )}
        <StatCard label="College Avg GitHub Score" value={`${collegeMetrics.avgGitHub}/100`} icon="⭐" color="violet" />
      </div>

      {/* College Platform Distribution / Difficulty */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader
            title={platform === 'leetcode' ? 'LeetCode Difficulty Breakdown' : `${platformTitle} Solving Distribution`}
            subtitle={platform === 'leetcode' ? 'Share of Easy, Medium, and Hard problems solved across college' : 'Share of problems solved per platform'}
          />
          <div className="h-[260px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={platform === 'leetcode' ? collegeMetrics.difficultyPie : collegeMetrics.platformPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {(platform === 'leetcode' ? collegeMetrics.difficultyPie : collegeMetrics.platformPie).map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* College Performance Highlights */}
        <Card>
          <CardHeader title={`${platformTitle} College Benchmarks`} subtitle="Average metrics across all registered students" />
          <div className="space-y-4 pt-2">
            <BenchmarkRow label="Average LeetCode Solved per Student" value={collegeMetrics.avgLeetCode} color="bg-amber-500" />
            <BenchmarkRow label="Average CodeChef Solved per Student" value={collegeMetrics.avgCodeChef} color="bg-amber-700" />
            <BenchmarkRow label="Average HackerRank Badges per Student" value={collegeMetrics.avgHackerRankBadges} color="bg-emerald-600" />
            <BenchmarkRow label="Average GitHub Score" value={`${collegeMetrics.avgGitHub}/100`} color="bg-blue-600" />
            <BenchmarkRow label="Overall Solving Attendance Rate" value={`${collegeMetrics.avgAttendance}%`} color="bg-teal-600" />
          </div>
        </Card>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, icon, color }) {
  const bgMap = {
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400',
    teal: 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20 text-teal-700 dark:text-teal-400',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
    violet: 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20 text-purple-700 dark:text-purple-400',
  };

  return (
    <Card className={`border ${bgMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{icon}</span>
        <span className="text-xs font-semibold text-surface-500 dark:text-surface-400">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </Card>
  );
}

function BenchmarkRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-800">
      <div className="flex items-center gap-2.5">
        <span className={`w-3 h-3 rounded-full ${color}`} />
        <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{label}</span>
      </div>
      <span className="text-base font-bold text-surface-900 dark:text-white tabular-nums">{value}</span>
    </div>
  );
}

function getStudentAllMetrics(student, attendanceRecord) {
  if (!student) return {};
  const profiles = student.platform_profiles || {};
  const lc = profiles.leetcode?.metrics || {};
  const cc = profiles.codechef?.metrics || {};
  const hr = profiles.hackerrank?.metrics || {};
  const gh = profiles.github?.metrics || {};

  return {
    github_score: student.github_score || gh.github_score || 0,
    total_repos: student.total_repos || gh.total_repos || 0,
    total_commits: student.total_commits || gh.total_commits || 0,
    current_streak: student.current_streak || gh.current_streak || 0,

    leetcode_solved: lc.solved || 0,
    leetcode_easy: lc.easy || 0,
    leetcode_medium: lc.medium || 0,
    leetcode_hard: lc.hard || 0,
    leetcode_contest_rating: lc.contest_rating || 0,
    leetcode_ranking: lc.ranking || 0,

    codechef_rating: cc.rating || 0,
    codechef_stars: cc.stars || 0,
    codechef_solved: cc.problems_solved || 0,
    codechef_global_rank: cc.global_rank || 0,

    hackerrank_badges: hr.badges || 0,
    hackerrank_certificates: hr.certificates || 0,
    hackerrank_solved: hr.solved || 0,
    hackerrank_followers: hr.followers || 0,

    attendance_solves: attendanceRecord?.solves || 0,
    attendance_total_days: attendanceRecord?.total_days || 0,
    attendance_rate: attendanceRecord?.rate || 0,
  };
}
