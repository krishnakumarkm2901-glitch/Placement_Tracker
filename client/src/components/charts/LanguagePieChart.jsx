import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

const COLORS = ['#0969da', '#1f883d', '#8250df', '#bf8700', '#cf222e', '#218bff', '#2da44e', '#6e7781', '#bc4c00', '#57606a'];

const CustomTooltip = ({ active, payload }) => {
  if (active && payload?.[0]) {
    return (
      <div className="bg-white dark:bg-surface-800 px-3 py-2 rounded-lg shadow-lg border border-surface-200 dark:border-surface-700 text-sm">
        <p className="font-medium text-surface-900 dark:text-white">{payload[0].name}</p>
        <p className="text-surface-500">{payload[0].value.toFixed(1)}%</p>
      </div>
    );
  }
  return null;
};

export default function LanguagePieChart({ data = [], className = '' }) {
  const { resolvedTheme } = useTheme();

  const chartData = data.slice(0, 10).map((d) => ({
    name: d.language,
    value: d.percentage,
  }));

  if (!chartData.length) return null;

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            animationBegin={0}
            animationDuration={1000}
          >
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={COLORS[idx % COLORS.length]} strokeWidth={0} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => (
              <span className="text-xs text-surface-600 dark:text-surface-400">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
