import { motion } from 'framer-motion';

const gradients = [
  'stat-gradient-1',
  'stat-gradient-2',
  'stat-gradient-3',
  'stat-gradient-4',
  'stat-gradient-5',
  'stat-gradient-6',
];

export default function StatCard({ title, value, subtitle, icon: Icon, index = 0, trend, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`glass-card-solid p-5 hover:shadow-card-hover transition-all duration-300 group ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-500 dark:text-surface-400 truncate">{title}</p>
          <p className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white mt-1 font-display">
            {value ?? '—'}
          </p>
          {subtitle && (
            <p className="text-xs text-surface-400 dark:text-surface-500 mt-1 truncate">{subtitle}</p>
          )}
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
              trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
              <span>{trend >= 0 ? '↑' : '↓'}</span>
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`${gradients[index % gradients.length]} p-3 rounded-xl text-white group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-5 h-5 md:w-6 md:h-6" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
