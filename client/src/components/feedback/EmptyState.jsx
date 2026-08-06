import { motion } from 'framer-motion';
import { HiOutlineInboxStack } from 'react-icons/hi2';

export default function EmptyState({ title = 'No data found', description, icon: Icon = HiOutlineInboxStack, action, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      <div className="w-20 h-20 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-5">
        <Icon className="w-10 h-10 text-surface-400" />
      </div>
      <h3 className="text-lg font-semibold text-surface-700 dark:text-surface-300">{title}</h3>
      {description && (
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-2 max-w-md">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
