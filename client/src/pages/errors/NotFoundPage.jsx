import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50 dark:bg-surface-950 p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-lg"
      >
        <div className="text-8xl md:text-9xl font-bold gradient-text font-display mb-4">404</div>
        <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white mb-3">
          Page Not Found
        </h1>
        <p className="text-surface-500 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          to="/"
          className="btn-primary inline-flex"
        >
          Go to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}
