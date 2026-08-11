import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { SiLeetcode, SiCodechef, SiHackerrank } from 'react-icons/si';
import {
  HiOutlineDocumentChartBar,
  HiOutlineCalendarDays,
  HiOutlineMagnifyingGlass,
  HiOutlineArrowPath,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineDocumentArrowDown,
} from 'react-icons/hi2';
import { toast } from 'react-toastify';
import dailyTaskReportsAPI from '../../api/dailyTaskReports';
import Card, { CardHeader } from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';
import EmptyState from '../../components/feedback/EmptyState';

const PLATFORMS = [
  { key: 'leetcode', name: 'LeetCode', icon: SiLeetcode, color: 'text-amber-500' },
  { key: 'codechef', name: 'CodeChef', icon: SiCodechef, color: 'text-amber-700 dark:text-amber-400' },
  { key: 'hackerrank', name: 'HackerRank', icon: SiHackerrank, color: 'text-emerald-600 dark:text-emerald-400' },
];

export default function DailyTaskReportPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [platform, setPlatform] = useState('leetcode');
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Debounce search
  const searchTimeout = useMemo(() => {
    return (value) => {
      const id = setTimeout(() => setDebouncedSearch(value), 300);
      return () => clearTimeout(id);
    };
  }, []);

  const handleSearchChange = (value) => {
    setSearch(value);
    searchTimeout(value);
  };

  const selectedPlatform = PLATFORMS.find((p) => p.key === platform);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['daily-task-report', platform, date, debouncedSearch],
    queryFn: () => dailyTaskReportsAPI.getReport({ platform, date, search: debouncedSearch }),
    select: (res) => res.data,
    staleTime: 60 * 1000,
    keepPreviousData: true,
  });

  const problems = data?.problems || [];
  const students = data?.students || [];
  const summary = data?.summary || {};

  const { data: availableDates } = useQuery({
    queryKey: ['daily-task-dates', platform],
    queryFn: () => dailyTaskReportsAPI.getAvailableDates(platform),
    select: (res) => res.data.dates || [],
    staleTime: 60 * 1000,
  });

  const datesList = availableDates || [];

  const handleExportExcel = async () => {
    try {
      const response = await dailyTaskReportsAPI.exportReport({ platform, date, search: debouncedSearch });
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Daily_Task_Report_${platform}_${date}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${selectedPlatform?.name || platform} Daily Task Report exported successfully!`);
    } catch {
      toast.error('Failed to export daily task report.');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
            <HiOutlineDocumentChartBar className="w-6 h-6" />
          </div>
          <div>
            <h1 className="page-title">Daily Task Report</h1>
            <p className="page-subtitle">Compare assigned problems with student completions across platforms.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all"
          >
            <HiOutlineDocumentArrowDown className="w-4 h-4" />
            Export Excel
          </button>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-200 dark:hover:bg-surface-600 transition-all disabled:opacity-50"
          >
            <HiOutlineArrowPath className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Platform Tabs */}
      <div className="flex flex-wrap gap-2 mb-5 border-b border-surface-200 dark:border-surface-700 pb-4">
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          const isActive = platform === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPlatform(p.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? p.color : ''}`} />
              {p.name}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Historical Task Dates Dropdown */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                <HiOutlineCalendarDays className="inline w-4 h-4 mr-1 -mt-0.5" />
                Previous Task Dates
              </label>
              <select
                value={datesList.includes(date) ? date : ''}
                onChange={(e) => { if (e.target.value) setDate(e.target.value); }}
                className="input-field cursor-pointer"
              >
                <option value="">-- Select Past Date --</option>
                {datesList.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === today ? '(Today)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {/* Custom Date Picker */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Custom Date
              </label>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </div>
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                <HiOutlineMagnifyingGlass className="inline w-4 h-4 mr-1 -mt-0.5" />
                Search Student
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search by name or username..."
                className="input-field"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Assigned Problems Banner */}
      {problems.length > 0 && (
        <Card className="mb-6">
          <CardHeader
            title={`Assigned Problems — ${date}`}
            subtitle={`${problems.length} problem${problems.length !== 1 ? 's' : ''} assigned for ${selectedPlatform?.name}`}
          />
          <div className="flex flex-wrap gap-2">
            {problems.map((prob, idx) => (
              <a
                key={idx}
                href={prob.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-700 text-sm text-surface-700 dark:text-surface-200 hover:bg-primary-50 dark:hover:bg-primary-500/10 hover:text-primary-600 dark:hover:text-primary-400 transition-colors border border-surface-200 dark:border-surface-600"
              >
                <span className="font-medium">{idx + 1}.</span>
                <span className="truncate max-w-[240px]">{prob.title}</span>
                {prob.difficulty && (
                  <Badge
                    variant={
                      prob.difficulty?.toLowerCase() === 'easy' ? 'success'
                      : prob.difficulty?.toLowerCase() === 'hard' ? 'danger'
                      : 'warning'
                    }
                  >
                    {prob.difficulty}
                  </Badge>
                )}
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Report Table */}
      {isLoading ? (
        <LoadingSpinner message={`Loading ${selectedPlatform?.name} report for ${date}...`} />
      ) : problems.length === 0 ? (
        <Card>
          <EmptyState
            icon={HiOutlineDocumentChartBar}
            title="No tasks assigned"
            description={`No daily tasks have been assigned for ${selectedPlatform?.name} on ${date}. Go to the ${selectedPlatform?.name} tracker page to set today's tasks.`}
          />
        </Card>
      ) : students.length === 0 ? (
        <Card>
          <EmptyState
            icon={HiOutlineMagnifyingGlass}
            title="No students found"
            description={search ? `No students matching "${search}".` : `No students have ${selectedPlatform?.name} usernames configured.`}
          />
        </Card>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${platform}-${date}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Card padding={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" id="daily-task-report-table">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-800/70 border-b border-surface-200 dark:border-surface-700">
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                        Student
                      </th>
                      <th className="px-5 py-3.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                        Total Assigned
                      </th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                        Completed
                      </th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                        Not Completed
                      </th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-5 py-3.5 text-center text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                    {students.map((student, idx) => (
                      <ReportRow key={student.student_id} student={student} index={idx} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}


function ReportRow({ student, index }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.4) }}
      className="bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
    >
      <td className="px-5 py-3.5 whitespace-nowrap">
        <div>
          <p className="font-semibold text-surface-900 dark:text-white">{student.name}</p>
          <p className="text-xs text-surface-400">{student.department} • Year {student.year}</p>
        </div>
      </td>
      <td className="px-5 py-3.5 whitespace-nowrap">
        <span className="text-primary-600 dark:text-primary-400 font-medium">@{student.username}</span>
      </td>
      <td className="px-5 py-3.5 text-center font-medium tabular-nums text-surface-700 dark:text-surface-300">
        {student.total_assigned}
      </td>
      <td className="px-5 py-3.5 text-center">
        <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${student.completed_count > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-surface-400'}`}>
          {student.completed_count > 0 && <HiOutlineCheckCircle className="w-4 h-4" />}
          {student.completed_count}
        </span>
      </td>
      <td className="px-5 py-3.5 text-center">
        <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${student.not_completed_count > 0 ? 'text-red-500 dark:text-red-400' : 'text-surface-400'}`}>
          {student.not_completed_count > 0 && <HiOutlineXCircle className="w-4 h-4" />}
          {student.not_completed_count}
        </span>
      </td>
      <td className="px-5 py-3.5 text-center">
        <Badge
          variant={student.status === 'Completed' ? 'success' : 'danger'}
          dot
        >
          {student.status}
        </Badge>
      </td>
      <td className="px-5 py-3.5 text-center text-surface-500 dark:text-surface-400 tabular-nums">
        {student.date}
      </td>
    </motion.tr>
  );
}


function SummaryCard({ label, value, color, icon }) {
  const bgMap = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20',
  };
  const textMap = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-700 dark:text-amber-400',
    blue: 'text-blue-700 dark:text-blue-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-4 ${bgMap[color]}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-medium text-surface-500 dark:text-surface-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${textMap[color]}`}>{value}</p>
    </motion.div>
  );
}
