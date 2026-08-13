import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HiOutlineClipboardDocumentCheck,
  HiOutlineArrowPath,
  HiOutlineUser,
  HiXMark,
  HiOutlineCalendarDays,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { toast } from 'react-toastify';
import attendanceAPI from '../../api/attendance';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';
import EmptyState from '../../components/feedback/EmptyState';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [filters, setFilters] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    department: 'All',
    student_year: 'All',
  });
  const [applied, setApplied] = useState({ ...filters });
  const [selectedStudent, setSelectedStudent] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance-admin', applied],
    queryFn: () => attendanceAPI.getAll(applied),
    select: (res) => res.data,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const refreshMutation = useMutation({
    mutationFn: () => attendanceAPI.refresh(),
    onSuccess: () => {
      toast.success('Attendance recalculated & cache refreshed!');
      queryClient.invalidateQueries({ queryKey: ['attendance-admin'] });
      refetch();
    },
    onError: (err) => {
      toast.error(err.response?.data?.error || 'Failed to refresh attendance');
    },
  });

  const students = data?.students || [];
  const daysInMonth = data?.days_in_month || 31;
  const departments = data?.filters?.departments || [];
  const years = data?.filters?.years || [];

  const handleApply = () => setApplied({ ...filters });

  // Summary Metrics
  const totalStudents = students.length;
  const avgRate = totalStudents > 0
    ? roundToOneDecimal(students.reduce((acc, s) => acc + (s.rate || 0), 0) / totalStudents)
    : 0;
  const totalSolvesMonth = students.reduce((acc, s) => acc + (s.solves || 0), 0);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
            <HiOutlineClipboardDocumentCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="page-title">Daily Solving Attendance</h1>
            <p className="page-subtitle">
              Track student solving consistency day-by-day for{' '}
              <strong>{MONTHS[applied.month - 1]} {applied.year}</strong>.
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Dept" value={filters.department} onChange={(v) => setFilters((p) => ({ ...p, department: v }))} options={['All', ...departments]} />
          <FilterSelect label="Year" value={filters.student_year} onChange={(v) => setFilters((p) => ({ ...p, student_year: v }))} options={['All', ...years]} />
          <FilterSelect label="Month" value={filters.month} onChange={(v) => setFilters((p) => ({ ...p, month: Number(v) }))} options={MONTHS.map((m, i) => ({ label: m, value: i + 1 }))} />
          <FilterSelect label="Cal Year" value={filters.year} onChange={(v) => setFilters((p) => ({ ...p, year: Number(v) }))} options={Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i)} />

          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/25 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            Apply
          </button>

          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-all cursor-pointer disabled:opacity-50"
            title="Recalculate and fetch latest platform attendance"
          >
            <HiOutlineArrowPath className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin text-teal-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {!isLoading && !isError && students.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="!py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Total Students</p>
                <p className="text-2xl font-bold text-surface-900 dark:text-white mt-0.5">{totalStudents}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <HiOutlineUser className="w-5 h-5" />
              </div>
            </div>
          </Card>
          <Card className="!py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Avg Attendance Rate</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{avgRate}%</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <HiOutlineSparkles className="w-5 h-5" />
              </div>
            </div>
          </Card>
          <Card className="!py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-surface-500 dark:text-surface-400">Monthly Solves (All Students)</p>
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-0.5">{totalSolvesMonth.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <HiOutlineCalendarDays className="w-5 h-5" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Main Table */}
      {isError ? (
        <Card className="p-8 border border-red-100 dark:border-red-500/20 bg-red-50/20 dark:bg-red-500/5 rounded-2xl shadow-sm">
          <div className="flex flex-col items-center justify-center text-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center text-xl font-bold">
              ⚠️
            </div>
            <h3 className="text-base font-semibold text-red-800 dark:text-red-400">Failed to load attendance data</h3>
            <p className="text-sm text-red-600/80 dark:text-red-400/60 max-w-md">
              There was a problem connecting to the server. A database query may have timed out or failed. Please try again.
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 px-5 py-2 text-sm font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/10 hover:shadow-lg transition-all"
            >
              Retry
            </button>
          </div>
        </Card>
      ) : isLoading ? (
        <LoadingSpinner message="Computing attendance data..." />
      ) : students.length === 0 ? (
        <Card>
          <EmptyState
            icon={HiOutlineClipboardDocumentCheck}
            title="No attendance data"
            description="No students found for the selected filters. Try a different department or year."
          />
        </Card>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <Card padding={false} className="overflow-hidden">
            <div className="overflow-x-auto attendance-scroll">
              <table className="w-full text-sm border-collapse" id="attendance-table">
                {/* Header */}
                <thead>
                  <tr className="bg-surface-50 dark:bg-surface-800/70 border-b border-surface-200 dark:border-surface-700">
                    <th className="sticky left-0 z-10 bg-surface-50 dark:bg-surface-800/70 px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider min-w-[170px] border-r border-surface-200 dark:border-surface-700">
                      Student
                    </th>
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <th key={i + 1} className="px-1 py-3 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 min-w-[32px]">
                        {i + 1}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 border-l border-surface-200 dark:border-surface-700 min-w-[65px]">
                      Solves
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 min-w-[65px]">
                      Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100 dark:divide-surface-700/50">
                  {students.map((student, idx) => (
                    <AttendanceRow
                      key={student.student_id}
                      student={student}
                      daysInMonth={daysInMonth}
                      index={idx}
                      onSelect={() => setSelectedStudent(student)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Student Detail Modal */}
      <AnimatePresence>
        {selectedStudent && (
          <StudentDetailModal
            student={selectedStudent}
            month={applied.month}
            year={applied.year}
            onClose={() => setSelectedStudent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


function AttendanceRow({ student, daysInMonth, index, onSelect }) {
  const rateColor = student.rate >= 75
    ? 'text-emerald-600 dark:text-emerald-400'
    : student.rate >= 50
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-500 dark:text-red-400';

  const solvesColor = student.solves > 0
    ? 'text-teal-600 dark:text-teal-400'
    : 'text-surface-400 dark:text-surface-500';

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.5) }}
      className="hover:bg-surface-50/80 dark:hover:bg-surface-800/40 transition-colors"
    >
      <td
        onClick={onSelect}
        className="sticky left-0 z-10 bg-white dark:bg-surface-800 px-4 py-3 font-semibold text-surface-900 dark:text-white border-r border-surface-200 dark:border-surface-700 whitespace-nowrap cursor-pointer hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        title="Click to view full student attendance breakdown"
      >
        <div className="flex flex-col">
          <span>{student.name}</span>
          <span className="text-[10px] font-normal text-surface-400">{student.department} · Year {student.year}</span>
        </div>
      </td>
      {student.daily.map((d) => (
        <td key={d.day} className="px-1 py-3 text-center">
          <StatusIcon
            day={d.day}
            month={d.month}
            status={d.status}
            leetcode={d.leetcode}
            codechef={d.codechef}
            hackerrank={d.hackerrank}
            dailyTask={d.daily_task}
            platformSolved={d.platform_solved}
            onClick={onSelect}
          />
        </td>
      ))}
      <td className={`px-3 py-3 text-center font-bold tabular-nums ${solvesColor}`}>
        {student.solves}
      </td>
      <td className={`px-3 py-3 text-center font-bold tabular-nums ${rateColor}`}>
        {student.rate}%
      </td>
    </motion.tr>
  );
}


function StatusIcon({ day, status, leetcode = 0, codechef = 0, hackerrank = 0, dailyTask = false, platformSolved = 0, onClick }) {
  const buildTooltip = () => {
    if (status === 'future') return `Day ${day}: Upcoming`;
    const parts = [`Day ${day} (${status.toUpperCase()})`];
    if (leetcode > 0) parts.push(`LeetCode: ${leetcode}`);
    if (hackerrank > 0) parts.push(`HackerRank: ${hackerrank}`);
    if (codechef > 0) parts.push(`CodeChef: ${codechef}`);
    if (dailyTask) parts.push('Daily Task: ✓ Completed');
    if (leetcode === 0 && hackerrank === 0 && codechef === 0 && !dailyTask) {
      parts.push('No activity recorded');
    }
    parts.push(`Total Solved: ${platformSolved}`);
    return parts.join('\n');
  };

  if (status === 'present') {
    return (
      <span
        onClick={onClick}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/15 cursor-pointer hover:scale-110 transition-transform"
        title={buildTooltip()}
      >
        <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  if (status === 'absent') {
    return (
      <span
        onClick={onClick}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-500/15 cursor-pointer hover:scale-110 transition-transform"
        title={buildTooltip()}
      >
        <svg className="w-3.5 h-3.5 text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5" title={`Day ${day}: Future`}>
      <svg className="w-4 h-4 text-surface-300 dark:text-surface-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="6" />
      </svg>
    </span>
  );
}


function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-surface-500 dark:text-surface-400">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-1.5 text-sm text-surface-700 dark:text-surface-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 focus:outline-none transition-all cursor-pointer"
      >
        {options.map((opt) => {
          const val = typeof opt === 'object' ? opt.value : opt;
          const lab = typeof opt === 'object' ? opt.label : opt;
          return <option key={val} value={val}>{lab}</option>;
        })}
      </select>
    </div>
  );
}


function StudentDetailModal({ student, month, year, onClose }) {
  const monthName = MONTHS[month - 1];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 15 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 15 }}
        className="bg-white dark:bg-surface-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between bg-surface-50/50 dark:bg-surface-800/50">
          <div>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white">{student.name}</h3>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {student.department} · Year {student.year} — Attendance Breakdown for {monthName} {year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <HiXMark className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Metrics */}
        <div className="grid grid-cols-3 gap-3 p-5 border-b border-surface-100 dark:border-surface-800 bg-white dark:bg-surface-900">
          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 text-center">
            <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">Monthly Solves</span>
            <p className="text-xl font-bold text-teal-700 dark:text-teal-300 mt-0.5">{student.solves}</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-center">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Present Days</span>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{student.present_days} / {student.total_days}</p>
          </div>
          <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 text-center">
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Attendance Rate</span>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-300 mt-0.5">{student.rate}%</p>
          </div>
        </div>

        {/* Modal Breakdown Table */}
        <div className="p-5 overflow-y-auto flex-1">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 border-b border-surface-200 dark:border-surface-700">
                <th className="py-2.5 px-3 text-left font-semibold">Date</th>
                <th className="py-2.5 px-3 text-center font-semibold">Status</th>
                <th className="py-2.5 px-3 text-center font-semibold">LeetCode</th>
                <th className="py-2.5 px-3 text-center font-semibold">HackerRank</th>
                <th className="py-2.5 px-3 text-center font-semibold">CodeChef</th>
                <th className="py-2.5 px-3 text-center font-semibold">Daily Task</th>
                <th className="py-2.5 px-3 text-center font-semibold">Total Solved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {student.daily.map((d) => (
                <tr key={d.day} className={d.status === 'present' ? 'bg-emerald-50/20 dark:bg-emerald-500/5' : ''}>
                  <td className="py-2 px-3 font-medium text-surface-900 dark:text-white">
                    {monthName} {d.day}, {year}
                  </td>
                  <td className="py-2 px-3 text-center font-semibold">
                    {d.status === 'present' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px]">✅ Present</span>
                    ) : d.status === 'absent' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-[11px]">❌ Absent</span>
                    ) : (
                      <span className="text-surface-400">○ Future</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center font-semibold text-surface-700 dark:text-surface-300">{d.leetcode}</td>
                  <td className="py-2 px-3 text-center font-semibold text-surface-700 dark:text-surface-300">{d.hackerrank}</td>
                  <td className="py-2 px-3 text-center font-semibold text-surface-700 dark:text-surface-300">{d.codechef}</td>
                  <td className="py-2 px-3 text-center">
                    {d.daily_task ? (
                      <span className="text-emerald-600 font-bold">Completed</span>
                    ) : (
                      <span className="text-surface-400">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-teal-600 dark:text-teal-400">{d.platform_solved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

function roundToOneDecimal(num) {
  return Math.round(num * 10) / 10;
}
