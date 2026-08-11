import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebar } from '../../contexts/SidebarContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  HiOutlineHome,
  HiOutlineUserGroup,
  HiOutlineTrophy,
  HiOutlineDocumentChartBar,
  HiOutlineBellAlert,
  HiOutlineAcademicCap,
  HiArrowRightOnRectangle,
  HiXMark,
} from 'react-icons/hi2';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';
import { HiOutlineArrowsRightLeft, HiOutlineClipboardDocumentCheck, HiOutlineClipboardDocumentList } from 'react-icons/hi2';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: HiOutlineHome },
  { to: '/students', label: 'Students', icon: HiOutlineUserGroup },
  { to: '/github-tracker', label: 'GitHub', icon: VscGithubInverted },
  { to: '/leetcode', label: 'LeetCode', icon: SiLeetcode },
  { to: '/codechef', label: 'CodeChef', icon: SiCodechef },
  { to: '/hackerrank', label: 'HackerRank', icon: SiHackerrank },
  { to: '/attendance', label: 'Attendance', icon: HiOutlineClipboardDocumentCheck },
  { to: '/leaderboards', label: 'Leaderboards', icon: HiOutlineTrophy },
  { to: '/reports', label: 'Reports', icon: HiOutlineDocumentChartBar },
  { to: '/daily-task-report', label: 'Daily Task Report', icon: HiOutlineClipboardDocumentList },
  { to: '/notifications', label: 'Notifications', icon: HiOutlineBellAlert },
];

export default function Sidebar() {
  const { isOpen, setIsOpen, isCollapsed, closeMobile } = useSidebar();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const visibleNavItems = user?.role === 'admin'
    ? navItems
    : [
        { to: '/student', label: 'Dashboard', icon: HiOutlineHome },
        { to: '/student/leaderboard', label: 'Leaderboard', icon: HiOutlineTrophy },
        { to: '/student/compare', label: 'Compare', icon: HiOutlineArrowsRightLeft },
        { to: '/student/attendance', label: 'Attendance', icon: HiOutlineClipboardDocumentCheck },
      ];

  const linkClasses = (isActive) =>
    `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 min-h-[44px] ${
      isActive
        ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 shadow-sm'
        : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white'
    }`;

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-200 dark:border-surface-700">
        <img src="/img/nit.jpg" alt="NIT Logo" className="w-9 h-9 rounded-md object-contain" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold font-display gradient-text truncate">Placement_Tracker</h1>
          <p className="text-[10px] text-surface-400 -mt-0.5">Analytics Platform</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={() => setIsOpen(false)}
          className="lg:hidden btn-icon hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg"
          aria-label="Close sidebar"
        >
          <HiXMark className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard' || item.to === '/student'}
            onClick={closeMobile}
            className={({ isActive }) => linkClasses(isActive)}
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-primary-600 dark:text-primary-400' : ''}`} />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebarIndicator"
                    className="absolute left-0 w-1 h-6 bg-primary-500 rounded-r-full"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-surface-200 dark:border-surface-700">
        <button
          type="button"
          onClick={() => {
            logout();
            closeMobile();
            navigate('/loginadmin');
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <HiArrowRightOnRectangle className="w-5 h-5" />
          Logout
        </button>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile/Tablet Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 z-50 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
