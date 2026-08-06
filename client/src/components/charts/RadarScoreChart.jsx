import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

export default function RadarScoreChart({ scores = {}, className = '' }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const data = [
    { subject: 'Repos', value: scores.repositories || 0, max: 25 },
    { subject: 'Commits', value: scores.commits || 0, max: 35 },
    { subject: 'PRs', value: scores.pull_requests || 0, max: 20 },
    { subject: 'README', value: scores.readme || 0, max: 10 },
    { subject: 'Profile', value: scores.profile_completion || 0, max: 10 },
  ].map((d) => ({ ...d, percentage: Math.round((d.value / d.max) * 100) }));

  return (
    <div className={`w-full ${className}`}>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke={isDark ? '#334155' : '#e2e8f0'} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 12, fill: isDark ? '#94a3b8' : '#64748b' }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={false}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="percentage"
            stroke="#0969da"
            fill="#0969da"
            fillOpacity={0.2}
            strokeWidth={2}
            animationDuration={1500}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, 'Score']}
            contentStyle={{
              backgroundColor: isDark ? '#1e293b' : '#fff',
              border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
