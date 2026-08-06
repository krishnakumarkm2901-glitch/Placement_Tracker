import { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const COLORS = ['#0e4429', '#006d32', '#26a641', '#39d353'];
const DARK_COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

export default function ContributionHeatmap({ data = [], className = '' }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const weeks = useMemo(() => {
    // Group contribution days into weeks (last 52 weeks)
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    const last365 = sorted.slice(-365);

    const result = [];
    let week = [];
    for (let i = 0; i < last365.length; i++) {
      week.push(last365[i]);
      const d = new Date(last365[i].date);
      if (d.getDay() === 6 || i === last365.length - 1) {
        result.push(week);
        week = [];
      }
    }
    return result;
  }, [data]);

  const getColor = (count) => {
    if (count === 0) return isDark ? '#161b22' : '#ebedf0';
    if (count <= 3) return isDark ? '#0e4429' : '#9be9a8';
    if (count <= 6) return isDark ? '#006d32' : '#40c463';
    if (count <= 9) return isDark ? '#26a641' : '#30a14e';
    return isDark ? '#39d353' : '#216e39';
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className={`${className}`}>
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex flex-col gap-0.5 min-w-[700px]">
          {/* Month labels */}
          <div className="flex gap-0.5 ml-3 mb-1">
            {weeks.map((week, wi) => {
              if (wi % 4 === 0 && week[0]) {
                const d = new Date(week[0].date);
                return (
                  <span key={wi} className="text-[10px] text-surface-400 w-[52px]">
                    {months[d.getMonth()]}
                  </span>
                );
              }
              return null;
            })}
          </div>

          {/* Heatmap grid */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="w-[13px] h-[13px] rounded-sm transition-colors cursor-pointer hover:ring-1 hover:ring-surface-400"
                    style={{ backgroundColor: getColor(day.count) }}
                    title={`${day.date}: ${day.count} contributions`}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1 mt-2 justify-end">
            <span className="text-[10px] text-surface-400 mr-1">Less</span>
            {[0, 2, 5, 8, 12].map((c, i) => (
              <div
                key={i}
                className="w-[13px] h-[13px] rounded-sm"
                style={{ backgroundColor: getColor(c) }}
              />
            ))}
            <span className="text-[10px] text-surface-400 ml-1">More</span>
          </div>
        </div>
      </div>
    </div>
  );
}
