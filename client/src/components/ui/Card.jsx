import { motion } from 'framer-motion';

export default function Card({ children, className = '', hover = false, glass = false, padding = true, ...props }) {
  const baseClass = glass ? 'glass-card' : 'glass-card-solid';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { y: -2, boxShadow: '0 10px 25px rgba(0,0,0,0.08)' } : undefined}
      className={`${baseClass} ${padding ? 'p-4 sm:p-5 md:p-6' : ''} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ title, subtitle, action, className = '' }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold text-surface-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
