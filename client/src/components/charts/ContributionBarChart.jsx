import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.[0]) {
    return (
      <div className="bg-white dark:bg-surface-800 px-3 py-2 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 text-sm">
        <p className="text-surface-500">{label}</p>
        <p className="font-semibold text-cyan-600 dark:text-cyan-400">{payload[0].value} contributions</p>
      </div>
    );
  }
  return null;
};

export default function ContributionBarChart({ data = [], className = '' }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  if (!data.length) return null;

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="contributions" fill="url(#barGradient)" radius={[6, 6, 0, 0]} maxBarSize={40} animationDuration={1500} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
