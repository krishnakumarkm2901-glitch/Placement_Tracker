import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  HiOutlineClipboardDocumentCheck,
  HiChevronLeft,
  HiChevronRight,
  HiOutlineCalendarDays,
  HiOutlineSparkles,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
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
  const [selectedDay, setSelectedDay] = useState(now.getDate());

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
    setSelectedDay(1);
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
    setSelectedDay(1);
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
  const totalSolves = data?.solves ?? 0;
  const rate = data?.rate ?? 0;
  const daysInMonth = data?.days_in_month || 31;

  // Selected Day Details
  const currentDayData = dailyData.find((d) => d.day === selectedDay) || {
    day: selectedDay,
    status: 'future',
    leetcode: 0,
    codechef: 0,
    hackerrank: 0,
    daily_task: false,
    platform_solved: 0,
  };

  // Build calendar grid
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const calendarCells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    calendarCells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = dailyData.find((d) => d.day === day);
    calendarCells.push(dayData || { day, status: 'future', leetcode: 0, codechef: 0, hackerrank: 0, daily_task: false, platform_solved: 0 });
  }

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20">
          <HiOutlineClipboardDocumentCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="page-title">My Attendance</h1>
          <p className="page-subtitle">Your daily problem-solving consistency and attendance history.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Present Days" value={presentCount} color="emerald" icon="✅" />
        <SummaryCard label="Absent Days" value={absentCount} color="red" icon="❌" />
        <SummaryCard label="Monthly Solves" value={totalSolves} color="teal" icon="⚡" />
        <SummaryCard
          label="Attendance Rate"
          value={`${rate}%`}
          color={rate >= 75 ? 'emerald' : rate >= 50 ? 'amber' : 'red'}
          icon="📊"
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Calendar View (Left/Top) */}
        <div className="lg:col-span-7">
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
                      <CalendarDay
                        key={cell.day}
                        day={cell.day}
                        status={cell.status}
                        isSelected={selectedDay === cell.day}
                        onClick={() => setSelectedDay(cell.day)}
                      />
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

        {/* Selected Day Breakdown Card (Right) */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HiOutlineCalendarDays className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                <h3 className="text-base font-bold text-surface-900 dark:text-white">
                  {MONTHS[month - 1]} {selectedDay}, {year}
                </h3>
              </div>
              <div>
                {currentDayData.status === 'present' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                    <HiOutlineCheckCircle className="w-4 h-4" /> Present
                  </span>
                ) : currentDayData.status === 'absent' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold">
                    <HiOutlineXCircle className="w-4 h-4" /> Absent
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500 text-xs font-medium">
                    ○ Upcoming
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <BreakdownItem label="LeetCode Solved" count={currentDayData.leetcode} platform="leetcode" />
              <BreakdownItem label="HackerRank Solved" count={currentDayData.hackerrank} platform="hackerrank" />
              <BreakdownItem label="CodeChef Solved" count={currentDayData.codechef} platform="codechef" />
              
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200/50 dark:border-surface-700/50">
                <span className="text-xs font-medium text-surface-600 dark:text-surface-300">Portal Daily Task</span>
                {currentDayData.daily_task ? (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-md">Completed</span>
                ) : (
                  <span className="text-xs font-medium text-surface-400">Not Completed</span>
                )}
              </div>

              <div className="pt-2 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between">
                <span className="text-xs font-bold text-surface-700 dark:text-surface-200">Total Solved Today</span>
                <span className="text-lg font-bold text-teal-600 dark:text-teal-400">{currentDayData.platform_solved}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Day-by-Day Table History */}
      {!isLoading && !isError && dailyData.length > 0 && (
        <Card padding={false} className="overflow-hidden">
          <div className="p-4 border-b border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-800/50">
            <h3 className="text-sm font-bold text-surface-900 dark:text-white">
              Daily Solving History ({MONTHS[month - 1]} {year})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-800/80 text-surface-600 dark:text-surface-300 border-b border-surface-200 dark:border-surface-700">
                  <th className="py-2.5 px-4 text-left font-semibold">Date</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Status</th>
                  <th className="py-2.5 px-3 text-center font-semibold">LeetCode</th>
                  <th className="py-2.5 px-3 text-center font-semibold">HackerRank</th>
                  <th className="py-2.5 px-3 text-center font-semibold">CodeChef</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Daily Task</th>
                  <th className="py-2.5 px-3 text-center font-semibold">Total Solves</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
                {dailyData.map((d) => (
                  <tr
                    key={d.day}
                    onClick={() => setSelectedDay(d.day)}
                    className={`cursor-pointer transition-colors ${
                      selectedDay === d.day
                        ? 'bg-teal-50/60 dark:bg-teal-500/10'
                        : d.status === 'present'
                        ? 'hover:bg-emerald-50/30 dark:hover:bg-emerald-500/5'
                        : 'hover:bg-surface-50 dark:hover:bg-surface-800/40'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-surface-900 dark:text-white">
                      {MONTHS[month - 1]} {d.day}, {year}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {d.status === 'present' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                          ✅ Present
                        </span>
                      ) : d.status === 'absent' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 font-semibold text-[11px]">
                          ❌ Absent
                        </span>
                      ) : (
                        <span className="text-surface-400">○ Future</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-semibold text-surface-700 dark:text-surface-300">{d.leetcode}</td>
                    <td className="py-2.5 px-3 text-center font-semibold text-surface-700 dark:text-surface-300">{d.hackerrank}</td>
                    <td className="py-2.5 px-3 text-center font-semibold text-surface-700 dark:text-surface-300">{d.codechef}</td>
                    <td className="py-2.5 px-3 text-center">
                      {d.daily_task ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">Completed</span>
                      ) : (
                        <span className="text-surface-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-teal-600 dark:text-teal-400">{d.platform_solved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}


function CalendarDay({ day, status, isSelected, onClick }) {
  const base = 'aspect-square rounded-xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer';
  const styles = {
    present: 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
    absent: 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400',
    future: 'bg-surface-50 dark:bg-surface-800/50 border border-surface-200 dark:border-surface-700 text-surface-400 dark:text-surface-500',
  };

  const selectedRing = isSelected ? 'ring-2 ring-teal-500 dark:ring-teal-400 scale-105 shadow-md' : '';

  return (
    <motion.div
      onClick={onClick}
      className={`${base} ${styles[status]} ${selectedRing}`}
      whileHover={{ scale: 1.05 }}
      title={`Day ${day}: ${status.charAt(0).toUpperCase() + status.slice(1)}`}
    >
      <span className="text-xs font-semibold opacity-80">{day}</span>
      <span className="text-xs mt-0.5">
        {status === 'present' ? '✅' : status === 'absent' ? '❌' : '○'}
      </span>
    </motion.div>
  );
}


function BreakdownItem({ label, count, platform }) {
  const platformColors = {
    leetcode: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200/50 dark:border-amber-500/20',
    hackerrank: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/20',
    codechef: 'text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-500/10 border-amber-200/50 dark:border-amber-500/20',
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${platformColors[platform] || ''}`}>
      <span className="text-xs font-medium">{label}</span>
      <span className="text-sm font-bold">{count}</span>
    </div>
  );
}


function SummaryCard({ label, value, color, icon }) {
  const bgMap = {
    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20',
    red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    amber: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20',
    teal: 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/20',
  };
  const textMap = {
    emerald: 'text-emerald-700 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    amber: 'text-amber-700 dark:text-amber-400',
    teal: 'text-teal-700 dark:text-teal-400',
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
