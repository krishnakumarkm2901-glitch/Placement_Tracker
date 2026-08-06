import { useMemo } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

/** CodeChef-style submissions heat map (~6 months / 185 days). */
export default function SubmissionsHeatMap({
  calendar = {},
  days = 185,
  className = '',
  title = 'Submissions Heat Map',
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const { cells, monthMarkers, total, activeDays, maxCount } = useMemo(() => {
    const byDate = Object.fromEntries(
      Object.entries(calendar || {}).map(([date, count]) => {
        const normalized = date.includes('-') && date.split('-')[1].length === 1
          ? (() => {
              const [y, m, d] = date.split('-').map(Number);
              return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            })()
          : date;
        return [normalized, Number(count) || 0];
      }),
    );

    const today = new Date();
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    // Align start to Monday so columns match CodeChef (Mon..Sun rows).
    const provisionalStart = new Date(end);
    provisionalStart.setUTCDate(end.getUTCDate() - (days - 1));
    const startOffset = (provisionalStart.getUTCDay() + 6) % 7; // Mon=0
    const start = new Date(provisionalStart);
    start.setUTCDate(provisionalStart.getUTCDate() - startOffset);

    const result = [];
    for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const key = cursor.toISOString().slice(0, 10);
      result.push({
        date: key,
        count: byDate[key] || 0,
        label: cursor.toLocaleDateString(undefined, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' }),
      });
    }

    const markers = [];
    result.forEach((day, index) => {
      const date = new Date(`${day.date}T00:00:00Z`);
      if (index === 0 || date.getUTCDate() === 1) {
        const column = Math.floor(index / 7);
        const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
        if (!markers.some((marker) => marker.key === key)) {
          markers.push({
            key,
            label: date.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' }),
            column,
          });
        }
      }
    });

    return {
      cells: result,
      monthMarkers: markers,
      total: Object.values(byDate).reduce((sum, count) => sum + (Number(count) || 0), 0),
      activeDays: Object.values(byDate).filter((count) => Number(count) > 0).length,
      maxCount: Math.max(1, ...result.map((day) => day.count)),
    };
  }, [calendar, days]);

  const heatColor = (count) => {
    if (!count) return isDark ? '#21262d' : '#ebedf0';
    const ratio = count / maxCount;
    if (ratio > 0.75) return isDark ? '#39d353' : '#216e39';
    if (ratio > 0.5) return isDark ? '#26a641' : '#30a14e';
    if (ratio > 0.25) return isDark ? '#006d32' : '#40c463';
    return isDark ? '#0e4429' : '#9be9a8';
  };

  const weekLabels = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];
  const weekCount = Math.ceil(cells.length / 7) || 1;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold text-surface-900 dark:text-white">{title}</h3>
        <div className="flex items-center gap-4 text-sm text-surface-500">
          <span><strong className="text-surface-900 dark:text-white">{total}</strong> submissions</span>
          <span><strong className="text-surface-900 dark:text-white">{activeDays}</strong> active days</span>
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-2 min-w-max">
          <div className="flex flex-col justify-between py-[2px] text-[10px] text-surface-400 h-[126px]">
            {weekLabels.map((label, index) => (
              <span key={`${label}-${index}`} className="h-[14px] leading-[14px]">{label}</span>
            ))}
          </div>
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateRows: 'repeat(7, 14px)',
                gridTemplateColumns: `repeat(${weekCount}, 14px)`,
                gridAutoFlow: 'column',
                gap: 4,
              }}
            >
              {cells.map((day) => (
                <div
                  key={day.date}
                  title={`${day.label}: ${day.count} submissions`}
                  className="rounded-[3px]"
                  style={{ width: 14, height: 14, backgroundColor: heatColor(day.count) }}
                />
              ))}
            </div>
            <div
              className="relative mt-2 h-4 text-[10px] text-surface-400"
              style={{ width: weekCount * 18 - 4 }}
            >
              {monthMarkers.map((marker) => (
                <span
                  key={marker.key}
                  className="absolute"
                  style={{ left: marker.column * 18 }}
                >
                  {marker.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-3 justify-end">
        <span className="text-[10px] text-surface-400 mr-1">Less</span>
        {[0, 0.2, 0.4, 0.7, 1].map((ratio, index) => (
          <div
            key={index}
            className="w-[14px] h-[14px] rounded-[3px]"
            style={{ backgroundColor: heatColor(ratio === 0 ? 0 : Math.max(1, Math.round(ratio * maxCount))) }}
          />
        ))}
        <span className="text-[10px] text-surface-400 ml-1">More</span>
      </div>
    </div>
  );
}
