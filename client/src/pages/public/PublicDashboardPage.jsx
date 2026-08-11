import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import studentsAPI from '../../api/students';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { TableSkeleton } from '../../components/feedback/Skeleton';
import { HiOutlineMagnifyingGlass, HiOutlineArrowTopRightOnSquare, HiOutlineArrowsRightLeft, HiOutlineChartBar, HiOutlineFunnel, HiOutlineTrophy } from 'react-icons/hi2';
import {
  BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import CompareView from '../../components/compare/CompareView';

const metrics = [
  ['GitHub Score', 'github_score'], ['Repositories', 'total_repos'],
  ['Commits', 'total_commits'],
];

export default function PublicDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const mode = location.pathname.endsWith('/compare') ? 'compare' : location.pathname.endsWith('/leaderboard') ? 'leaderboard' : 'dashboard';
  const [search, setSearch] = useState('');
  const [showAllStudents, setShowAllStudents] = useState(false);
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');
  const [appliedDepartment, setAppliedDepartment] = useState('');
  const [appliedYear, setAppliedYear] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['public-students'],
    queryFn: studentsAPI.getPublic,
    select: (response) => response.data,
    refetchInterval: 15000,
  });
  const students = useMemo(() => {
    const list = [...(data?.students || [])];
    if (mode === 'leaderboard') list.sort((a, b) => b.github_score - a.github_score);
    const query = search.toLowerCase();
    return list.filter((student) =>
      (!query || student.name.toLowerCase().includes(query) || student.github_username.toLowerCase().includes(query)) &&
      (mode !== 'leaderboard' || !appliedDepartment || student.department === appliedDepartment) &&
      (mode !== 'leaderboard' || !appliedYear || String(student.year) === appliedYear)
    );
  }, [data, mode, search, appliedDepartment, appliedYear]);
  const displayedStudents = mode === 'dashboard' && !showAllStudents
    ? students.slice(0, 5)
    : students;
  const departments = useMemo(() => [...new Set((data?.students || []).map((student) => student.department).filter(Boolean))].sort(), [data]);
  const years = useMemo(() => [...new Set((data?.students || []).map((student) => student.year).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))), [data]);
  const totals = useMemo(() => {
    const all = data?.students || [];
    return {
      students: all.length,
      repos: all.reduce((sum, student) => sum + (student.total_repos || 0), 0),
      commits: all.reduce((sum, student) => sum + (student.total_commits || 0), 0),
      average: all.length ? (all.reduce((sum, student) => sum + (student.github_score || 0), 0) / all.length).toFixed(1) : 0,
    };
  }, [data]);
  const chartData = useMemo(() => (data?.students || []).slice(0, 10).map((student) => ({
    name: student.github_username.length > 12 ? `${student.github_username.slice(0, 12)}…` : student.github_username,
    score: student.github_score || 0,
    repositories: student.total_repos || 0,
    commits: student.total_commits || 0,
  })), [data]);

  if (isLoading) return <div className="max-w-7xl mx-auto p-6"><TableSkeleton rows={6} /></div>;
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {mode !== 'dashboard' && <div className="mb-7">
        <p className="text-sm font-semibold text-primary-500">Comprehensive Student Comparison</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white font-display mt-1 flex items-center gap-2">{mode === 'leaderboard' && <HiOutlineTrophy className="w-8 h-8 text-[#d29922]" />}{mode === 'compare' ? 'Placement_Tracker Analytics Comparison' : mode === 'leaderboard' ? 'Placement_Tracker Leaderboard' : 'Student Dashboard'}</h1>
        <p className="text-surface-500 mt-2">Compare performance across GitHub, LeetCode, CodeChef, HackerRank, Attendance, and Department analytics.</p>
      </div>}
      {mode === 'compare' ? (
        <CompareView />
      ) : (
        <>
          {false && mode === 'dashboard' && (
            <div className="mb-8 space-y-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-surface-500">Overview across every tracked GitHub profile</p>
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[#1f883d] bg-[#dafbe1] dark:bg-[#1f883d]/15 px-3 py-1.5 rounded-full">
                  <span className="relative flex w-2 h-2"><span className="absolute inline-flex w-full h-full rounded-full bg-[#2da44e] opacity-60 animate-ping" /><span className="relative inline-flex w-2 h-2 rounded-full bg-[#1f883d]" /></span>
                  Live · 15s refresh
                </span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {[
                  ['Students', totals.students, 'Tracked profiles'],
                  ['Repositories', totals.repos.toLocaleString(), 'Public projects'],
                  ['Commits', totals.commits.toLocaleString(), 'Authored commits'],
                  ['Average Score', totals.average, 'Out of 100'],
                ].map(([label, value, caption]) => (
                  <div key={label} className="glass-card-solid p-4 sm:p-5 relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-primary-500/10" />
                    <p className="text-xs sm:text-sm text-surface-500">{label}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white mt-1">{value}</p>
                    <p className="text-[11px] text-surface-400 mt-1">{caption}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <div className="mb-4"><h2 className="font-semibold text-surface-900 dark:text-white">GitHub Score</h2><p className="text-xs text-surface-500">Top student scores from live profile data</p></div>
                  <div className="h-[260px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#30363d" opacity={0.35} /><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8c959f' }} interval={0} angle={-18} textAnchor="end" height={55} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#8c959f' }} /><Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc' }} /><Bar dataKey="score" fill="#0969da" radius={[5, 5, 0, 0]} maxBarSize={42} /></BarChart></ResponsiveContainer>
                  </div>
                </Card>
                <Card>
                  <div className="mb-4"><h2 className="font-semibold text-surface-900 dark:text-white">Coding Activity</h2><p className="text-xs text-surface-500">Repository and authored commit totals</p></div>
                  <div className="h-[260px] sm:h-[300px]">
                    <ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="#30363d" opacity={0.35} /><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8c959f' }} interval={0} angle={-18} textAnchor="end" height={55} /><YAxis tick={{ fontSize: 11, fill: '#8c959f' }} /><Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 6, color: '#f0f6fc' }} /><Legend wrapperStyle={{ fontSize: 12 }} /><Bar dataKey="repositories" fill="#1f883d" radius={[4, 4, 0, 0]} /><Bar dataKey="commits" fill="#8250df" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
                  </div>
                </Card>
              </div>
            </div>
          )}
          {mode === 'leaderboard' ? (
            <div className="glass-card-solid p-4 sm:p-5 mb-5 flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-surface-600 dark:text-surface-300 lg:pb-3"><HiOutlineFunnel className="w-5 h-5 text-primary-500" />Filters</div>
              <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 flex-1 lg:max-w-3xl items-end">
                <Select label="Department" placeholder="All Departments" value={department} onChange={(event) => setDepartment(event.target.value)} options={departments.map((value) => ({ value, label: value }))} />
                <Select label="Year" placeholder="All Years" value={year} onChange={(event) => setYear(event.target.value)} options={years.map((value) => ({ value: String(value), label: String(value).toLowerCase().includes('year') ? value : `Year ${value}` }))} />
                <button type="button" onClick={() => { setAppliedDepartment(department); setAppliedYear(year); }} className="btn-primary px-7">Apply</button>
              </div>
              <div className="w-full lg:w-[360px] lg:ml-auto"><Input label="Search Students" icon={HiOutlineMagnifyingGlass} placeholder="Search student name or username..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
            </div>
          ) : <div className="flex items-end gap-3 max-w-2xl mb-5">{mode === 'dashboard' && students.length > 5 && <button type="button" onClick={() => setShowAllStudents((current) => !current)} className="btn-secondary whitespace-nowrap px-5 min-h-[44px]">{showAllStudents ? 'Show Less' : 'View All'}</button>}<div className="flex-1"><Input icon={HiOutlineMagnifyingGlass} placeholder="Search GitHub name or username..." value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>}
          <div className="grid gap-3 md:hidden">
            {displayedStudents.map((student, index) => (
              <div key={student.id} onClick={() => navigate(`/profile/${student.id}`)} role="link" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && navigate(`/profile/${student.id}`)} className="glass-card-solid p-4 text-left min-w-0 active:bg-primary-50 dark:active:bg-primary-500/10 cursor-pointer">
                <div className="flex items-center gap-3 min-w-0">
                  {mode === 'leaderboard' && <span className="text-lg font-bold text-primary-500 flex-shrink-0">#{index + 1}</span>}
                  <a href={`https://github.com/${student.github_username}`} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}><Avatar src={student.avatar_url} name={student.name} size="sm" /></a>
                  <div className="flex-1 min-w-0"><button type="button" onClick={(event) => { event.stopPropagation(); navigate(`/profile/${student.id}`); }} className="font-semibold truncate block text-left text-surface-900 dark:text-white hover:text-primary-500">{student.name}</button><a href={`https://github.com/${student.github_username}`} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} className="text-xs text-surface-400 truncate block hover:text-primary-500 hover:underline">@{student.github_username}</a></div>
                  <span className="text-lg font-bold text-primary-500">{student.github_score}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t text-center text-xs text-surface-500"><span><strong className="block text-sm text-surface-900 dark:text-white">{student.total_repos}</strong>Repos</span><span><strong className="block text-sm text-surface-900 dark:text-white">{student.total_commits}</strong>Commits</span></div>
              </div>
            ))}
          </div>
          <div className="hidden md:block glass-card-solid overflow-hidden">
            <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-xs uppercase tracking-wider text-surface-500 border-b border-surface-200 dark:border-surface-700"><tr><th className="px-5 py-4">{mode === 'leaderboard' ? 'Rank' : 'Student'}</th>{mode === 'leaderboard' && <th className="px-5 py-4">Student</th>}<th className="px-5 py-4">Score</th><th className="px-5 py-4">Repos</th><th className="px-5 py-4">Commits</th><th className="px-5 py-4" /></tr></thead><tbody>{displayedStudents.map((student, index) => <tr key={student.id} onClick={() => navigate(`/profile/${student.id}`)} className="border-b last:border-0 border-surface-200 dark:border-surface-700 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 cursor-pointer">{mode === 'leaderboard' && <td className="px-5 py-4 text-xl font-bold text-primary-500">#{index + 1}</td>}<td className="px-5 py-4"><div className="flex items-center gap-3"><Avatar src={student.avatar_url} name={student.name} size="sm" /><div><p className="font-semibold text-surface-900 dark:text-white">{student.name}</p><p className="text-xs text-surface-400">@{student.github_username}</p></div></div></td><td className="px-5 py-4 font-bold text-primary-500">{student.github_score}</td><td className="px-5 py-4">{student.total_repos}</td><td className="px-5 py-4">{student.total_commits}</td><td className="px-5 py-4"><HiOutlineArrowTopRightOnSquare className="w-4 h-4 text-surface-400" /></td></tr>)}</tbody></table></div>
          </div>
        </>
      )}
    </div>
  );
}
