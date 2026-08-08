import { HiOutlineAcademicCap } from 'react-icons/hi2';

export default function Footer() {
  return (
    <footer className="w-full border-t border-surface-200 dark:border-surface-800 bg-white/70 dark:bg-surface-900/70 backdrop-blur-md transition-colors py-4 px-4 sm:px-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-surface-600 dark:text-surface-400">
        
        {/* Developer Credit */}
        <div className="flex items-center gap-2 font-medium">
          <span>
            Developed by{' '}
            <span className="font-semibold text-surface-900 dark:text-surface-100">
              Krishna Kumar.KM
            </span>
          </span>
        </div>

        {/* Batch & Academic Info */}
        <div className="flex flex-wrap items-center justify-center md:justify-end gap-x-2.5 gap-y-1.5 text-center md:text-right">
          <span className="inline-flex items-center gap-1.5 font-medium text-surface-700 dark:text-surface-300">
            <HiOutlineAcademicCap className="w-4.5 h-4.5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            2023–2027 Batch
          </span>
          <span className="hidden sm:inline text-surface-300 dark:text-surface-600 font-normal">|</span>
          <span className="font-medium text-surface-700 dark:text-surface-300">
            B.E. Computer Science and Engineering
          </span>
          <span className="hidden sm:inline text-surface-300 dark:text-surface-600 font-normal">|</span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200/80 dark:border-primary-800/60 shadow-sm">
            4th Year
          </span>
        </div>

      </div>
    </footer>
  );
}
