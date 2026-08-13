import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  HiOutlineClipboardDocumentCheck,
  HiChevronLeft,
  HiChevronRight,
} from 'react-icons/hi2';
import { useAuth } from '../../contexts/AuthContext';
import attendanceAPI from '../../api/attendance';
import Card from '../../components/ui/Card';
import LoadingSpinner from '../../components/feedback/LoadingSpinner';
import EmptyState from '../../components/feedback/EmptyState';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance-student', user?.student_id, month, year],
    queryFn: () => attendanceAPI.getStudent(user.student_id, { month, year }),
    select: (res) => res.data,
    enabled: Boolean(user?.student_id),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });

  const goBack = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goForward = () => {
    const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear();
    if (isCurrentMonth) return;
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isCurrent = month === now.getMonth() + 1 && year === now.getFullYear();

  if (!user?.student_id) {
    return (
      <div className="page-container">
        <Card>
          <EmptyState
            icon={HiOutlineClipboardDocumentCheck}
            title="No student profile linked"
            description="Ask an administrator to link your student account."
          />
        </Card>
      </div>
    );
  }

  const dailyData = data?.daily || [];
  const presentCount = dailyData.filter((d) => d.status === 'present').length;
  const absentCount = dailyData.filter((d) => d.status === 'absent').length;
  const rate = data?.rate ?? 0;
  const daysInMonth = data?.days_in_month || 31;

  // Build calendar grid
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = dailyData.find((d) => d.day === day);
    calendarCells.push(dayData || { day, status: 'future' });
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
          <HiOutlineClipboardDocumentCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="page-subtitle">Your daily solving consistency and attendance record.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Present Days" value={presentCount} color="emerald" icon="✅" />
        <SummaryCard label="Absent Days" value={absentCount} color="red" icon="❌" />
        <SummaryCard label="Total Days" value={presentCount + absentCount} color="blue" icon="📅" />
        <SummaryCard
          label="Attendance Rate"
          value={`${rate}%`}
          color={rate >= 75 ? 'emerald' : rate >= 50 ? 'amber' : 'red'}
          icon="📊"
        />
      </div>

      {/* Month Navigation */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={goBack}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
            aria-label="Previous month"
          >
            <HiChevronLeft className="w-5 h-5 text-surface-600 dark:text-surface-300" />
          </button>
          <h2 className="text-lg font-bold text-surface-900 dark:text-white">
            {MONTHS[month - 1]} {year}
          </h2>
          <button
            onClick={goForward}
            disabled={isCurrent}
            className={`p-2 rounded-lg transition-colors ${isCurrent ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-100 dark:hover:bg-surface-700'}`}
            aria-label="Next month"
          >
            <HiChevronRight className="w-5 h-5 text-surface-600 dark:text-surface-300" />
          </button>
        </div>

        {isError ? (
          <div className="p-6 border border-red-100 dark:border-red-500/20 bg-red-50/25 dark:bg-red-500/5 rounded-xl text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl">⚠️</span>
              <p className="text-sm font-medium text-red-800 dark:text-red-400">Failed to load attendance records</p>
              <p className="text-xs text-red-500 dark:text-red-500/70 max-w-sm">
                There was a problem querying the database for your attendance. Please try again.
              </p>
              <button
                onClick={() => refetch()}
                className="mt-2 px-4 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : isLoading ? (
          <LoadingSpinner message="Loading attendance..." />
        ) : (
          <motion.div
            key={`${month}-${year}`}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
          >
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {WEEKDAYS.map((wd) => (
                <div key={wd} className="text-center text-xs font-semibold text-surface-400 dark:text-surface-500 py-1">
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell, idx) =>
                cell === null ? (
                  <div key={`empty-${idx}`} className="aspect-square" />
                ) : (
                  <CalendarDay key={cell.day} day={cell.day} status={cell.status} />
                )
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 mt-5 pt-4 border-t border-surface-200 dark:border-surface-700">
              <LegendItem color="bg-emerald-500" label="Present" />
              <LegendItem color="bg-red-500" label="Absent" />
              <LegendItem color="bg-surface-200 dark:bg-surface-600" label="Future" />
            </div>
          </motion.div>
        )}
      </Card>
    </div>
  );
}


function CalendarDay({ day, status }) {
  const base = 'aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200';
  const styles = {
    present: 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
    absent: 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400',
    future: 'bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 text-surface-400 dark:text-surface-500',
  };

  return (
    <motion.div
      className={`${base} ${styles[status]}`}
      whileHover={{ scale: 1.05 }}
      title={`Day ${day}: ${status.charAt(0).toUpperCase() + status.slice(1)}`}
    >
      <span className="text-xs font-medium opacity-70">{day}</span>
      <span className="text-sm mt-0.5">
        {status === 'present' ? '✅' : status === 'absent' ? '❌' : '○'}
      </span>
    </motion.div>
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


function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-xs text-surface-500 dark:text-surface-400">{label}</span>
    </div>
  );
}
