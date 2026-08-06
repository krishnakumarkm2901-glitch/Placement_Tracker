import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import leaderboardsAPI from '../../api/leaderboards';
import studentsAPI from '../../api/students';
import Avatar from '../../components/ui/Avatar';
import Select from '../../components/ui/Select';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import { TableSkeleton } from '../../components/feedback/Skeleton';
import { HiOutlineTrophy } from 'react-icons/hi2';

const SORT_OPTIONS = [
  { value: 'github_score', label: 'GitHub Score' },
  { value: 'commits', label: 'Total Commits' },
  { value: 'repos', label: 'Repositories' },
  { value: 'contributions', label: 'Contributions' },
  { value: 'stars', label: 'Stars Earned' },
];

const MEDAL_COLORS = ['from-yellow-400 to-amber-500', 'from-gray-300 to-gray-400', 'from-amber-600 to-amber-700'];

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState('github_score');
  const [department, setDepartment] = useState('');
  const [year, setYear] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', sortBy, department, year],
    queryFn: () => leaderboardsAPI.getLeaderboard({ sort_by: sortBy, department, year, limit: 50 }),
    select: (res) => [...res.data.leaderboard].sort((a, b) => a.rank - b.rank),
  });

  const { data: depts } = useQuery({
    queryKey: ['dept-filter'],
    queryFn: () => studentsAPI.getDepartments(),
    select: (res) => res.data.departments,
  });

  const { data: years } = useQuery({
    queryKey: ['year-filter'],
    queryFn: () => studentsAPI.getYears(),
    select: (res) => res.data.years,
  });

  return (
    <div className="page-container">
      <div className="mb-8">
        <h1 className="page-title flex items-center gap-3">
          <HiOutlineTrophy className="w-8 h-8 text-amber-500" />
          Placement_Tracker Leaderboard
        </h1>
        <p className="page-subtitle">Rankings based on GitHub activity and performance</p>
      </div>

      {/* Filters */}
      <div className="glass-card-solid p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)} options={SORT_OPTIONS} />
          <Select placeholder="All Departments" value={department} onChange={(e) => setDepartment(e.target.value)} options={(depts || []).map((d) => ({ value: d, label: d }))} />
          <Select placeholder="All Years" value={year} onChange={(e) => setYear(e.target.value)} options={(years || []).map((y) => ({ value: y, label: `Year ${y}` }))} />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={10} />
      ) : (
        <div className="space-y-3">
          {/* Top 3 Podium */}
          {data && data.length >= 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[0, 1, 2].map((idx) => {
                const student = data[idx];
                if (!student) return null;
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => navigate(`/students/${student.id}`)}
                    className={`glass-card-solid p-5 text-center cursor-pointer hover:shadow-card-hover transition-all ${idx === 0 ? 'sm:scale-105' : ''}`}
                  >
                    <div className={`w-10 h-10 mx-auto rounded-full bg-gradient-to-br ${MEDAL_COLORS[student.rank - 1]} flex items-center justify-center text-white font-bold mb-3`}>
                      {student.rank}
                    </div>
                    <Avatar src={student.avatar_url} name={student.name} size="lg" className="mx-auto" />
                    <h3 className="text-base font-bold text-surface-900 dark:text-white mt-3">{student.name}</h3>
                    <p className="text-xs text-surface-400">@{student.github_username}</p>
                    <p className="text-2xl font-bold gradient-text mt-2 font-display">{student.github_score}/100</p>
                    <p className="text-xs text-surface-500">GitHub Score</p>
                    <div className="flex justify-center gap-3 mt-3 text-xs text-surface-500">
                      <span>{student.total_repos} repos</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Rest of leaderboard */}
          {data?.slice(data.length >= 3 ? 3 : 0).map((student) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => navigate(`/students/${student.id}`)}
              className="glass-card-solid p-4 flex items-center gap-4 cursor-pointer hover:shadow-card-hover transition-all group"
            >
              <span className="w-8 h-8 rounded-full bg-surface-100 dark:bg-surface-700 flex items-center justify-center text-sm font-bold text-surface-500 flex-shrink-0">
                {student.rank}
              </span>
              <Avatar src={student.avatar_url} name={student.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-surface-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {student.name}
                </p>
                <p className="text-xs text-surface-400">@{student.github_username} · {student.department}</p>
              </div>
              <div className="flex items-center gap-4 text-sm flex-shrink-0">
                <span className="hidden sm:block text-surface-500">{student.total_repos} repos</span>
                <span className="font-bold text-primary-600 dark:text-primary-400 text-lg">{student.github_score}/100</span>
              </div>
            </motion.div>
          ))}
          {data?.length === 0 && (
            <div className="glass-card-solid py-14 px-5 text-center">
              <HiOutlineTrophy className="w-10 h-10 text-surface-400 mx-auto mb-3" />
              <h2 className="font-semibold text-surface-900 dark:text-white">No students found</h2>
              <p className="text-sm text-surface-500 mt-1">Try another department, year, or ranking metric.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
