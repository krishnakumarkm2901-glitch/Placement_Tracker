import { useState } from 'react';

export default function Tooltip({ children, content, position = 'top' }) {
  const [show, setShow] = useState(false);

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative inline-flex" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className={`absolute ${positions[position]} z-50 px-2.5 py-1.5 text-xs font-medium text-white bg-surface-900 dark:bg-surface-600 rounded-lg whitespace-nowrap pointer-events-none animate-fade-in`}>
          {content}
        </div>
      )}
    </div>
  );
}
