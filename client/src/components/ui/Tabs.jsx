import { useState } from 'react';
import { motion } from 'framer-motion';

export default function Tabs({ tabs, defaultTab, className = '', trailingContent }) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.key);

  const activeContent = tabs.find((t) => t.key === activeTab)?.content;

  return (
    <div className={className}>
      <div className="flex gap-1 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors min-h-[44px] ${
              activeTab === tab.key
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
            }`}
            aria-selected={activeTab === tab.key}
            role="tab"
          >
            {activeTab === tab.key && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white dark:bg-surface-700 rounded-lg shadow-sm"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon && <tab.icon className="w-4 h-4" />}
              {tab.label}
            </span>
          </button>
        ))}
        {trailingContent && (
          <div className="ml-auto flex items-center gap-5 px-4 text-sm whitespace-nowrap text-surface-500">
            {trailingContent}
          </div>
        )}
      </div>
      <div className="mt-4">{activeContent}</div>
    </div>
  );
}
