const badgeVariants = {
  primary: 'badge-primary',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  default: 'badge bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300',
};

export default function Badge({ children, variant = 'default', dot = false, className = '' }) {
  return (
    <span className={`${badgeVariants[variant]} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          variant === 'success' ? 'bg-emerald-500' :
          variant === 'danger' ? 'bg-red-500' :
          variant === 'warning' ? 'bg-amber-500' :
          'bg-primary-500'
        }`} />
      )}
      {children}
    </span>
  );
}
