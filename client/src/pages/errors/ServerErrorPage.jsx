import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function ServerErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-lg"
      >
        <div className="text-7xl mb-6">💥</div>
        <div className="text-6xl md:text-7xl font-bold text-red-500 font-display mb-4">500</div>
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white mb-3">
          Server Error
        </h1>
        <p className="text-surface-500 mb-8">
          Something went wrong on our end. Please try again later.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Refresh Page
          </button>
          <Link to="/" className="btn-secondary">
            Go to Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
