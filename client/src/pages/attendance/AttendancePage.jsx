import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { HiOutlineClipboardDocumentCheck, HiOutlineFunnel } from 'react-icons/hi2';
import attendanceAPI from '../../api/attendance';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';
import EmptyState from '../../components/feedback/EmptyState';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AttendancePage() {
  const now = new Date();
  const [filters, setFilters] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    department: 'All',
    student_year: 'All',
  });
  const [applied, setApplied] = useState({ ...filters });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance-admin', applied],
    queryFn: () => attendanceAPI.getAll(applied),
    select: (res) => res.data,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const students = data?.students || [];
  const daysInMonth = data?.days_in_month || 31;
  const departments = data?.filters?.departments || [];
  const years = data?.filters?.years || [];

  const handleApply = () => setApplied({ ...filters });

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

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect label="Dept" value={filters.department} onChange={(v) => setFilters((p) => ({ ...p, department: v }))} options={['All', ...departments]} />
          <FilterSelect label="Year" value={filters.student_year} onChange={(v) => setFilters((p) => ({ ...p, student_year: v }))} options={['All', ...years]} />
          <FilterSelect label="Month" value={filters.month} onChange={(v) => setFilters((p) => ({ ...p, month: Number(v) }))} options={MONTHS.map((m, i) => ({ label: m, value: i + 1 }))} />
          <FilterSelect label="Cal Year" value={filters.year} onChange={(v) => setFilters((p) => ({ ...p, year: Number(v) }))} options={Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i)} />
          <button
            onClick={handleApply}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/25 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Table */}
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
                    <th className="sticky left-0 z-10 bg-surface-50 dark:bg-surface-800/70 px-4 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider min-w-[160px] border-r border-surface-200 dark:border-surface-700">
                      Student
                    </th>
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <th key={i + 1} className="px-1 py-3 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 min-w-[32px]">
                        {i + 1}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 border-l border-surface-200 dark:border-surface-700 min-w-[55px]">
                      Solves
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 min-w-[55px]">
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
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}


function AttendanceRow({ student, daysInMonth, index }) {
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
      <td className="sticky left-0 z-10 bg-white dark:bg-surface-800 px-4 py-3 font-semibold text-surface-900 dark:text-white border-r border-surface-200 dark:border-surface-700 whitespace-nowrap">
        {student.name}
      </td>
      {student.daily.map((d) => (
        <td key={d.day} className="px-1 py-3 text-center">
          <StatusIcon status={d.status} />
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


function StatusIcon({ status }) {
  if (status === 'present') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/15" title="Present">
        <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  if (status === 'absent') {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-500/15" title="Absent">
        <svg className="w-3.5 h-3.5 text-red-500 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </span>
    );
  }
  // future / no data
  return (
    <span className="inline-flex items-center justify-center w-5 h-5" title="No data">
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
