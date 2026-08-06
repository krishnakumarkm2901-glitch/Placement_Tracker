import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebar } from '../../contexts/SidebarContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  HiBars3,
  HiMagnifyingGlass,
  HiOutlineBell,
  HiOutlineSun,
  HiOutlineMoon,
} from 'react-icons/hi2';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import notificationsAPI from '../../api/notifications';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';

const studentPlatformLinks = [
  { to: '/student/github', label: 'GitHub', icon: VscGithubInverted },
  { to: '/student/leetcode', label: 'LeetCode', icon: SiLeetcode },
  { to: '/student/codechef', label: 'CodeChef', icon: SiCodechef },
  { to: '/student/hackerrank', label: 'HackerRank', icon: SiHackerrank },
];

export default function Navbar() {
  const { setIsOpen } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const location = useLocation();

  const { data: notifData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: () => notificationsAPI.getAll({ limit: 1 }),
    refetchInterval: 60000,
    select: (res) => res.data.unread_count,
    enabled: isAdmin,
  });

  const unreadCount = notifData || 0;

  const themeIcon = theme === 'dark' ? HiOutlineMoon : HiOutlineSun;
  const ThemeIcon = themeIcon;

  const getSearchRoute = (pathname) => {
    if (pathname.startsWith('/students')) return '/students';
    if (pathname.startsWith('/github-tracker')) return '/github-tracker';
    if (pathname.startsWith('/leetcode')) return '/leetcode';
    if (pathname.startsWith('/codechef')) return '/codechef';
    if (pathname.startsWith('/hackerrank')) return '/hackerrank';
    return '/students';
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    const baseRoute = getSearchRoute(location.pathname);
    navigate(`${baseRoute}?search=${encodeURIComponent(query)}`);
    setSearchQuery('');
    setShowSearch(false);
  };

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl border-b border-surface-200 dark:border-surface-700">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        {/* Left: Hamburger + Search */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsOpen(true)}
            className="lg:hidden btn-icon hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl"
            aria-label="Open sidebar"
          >
            <HiBars3 className="w-5 h-5" />
          </button>

          {/* Desktop search */}
          {isAdmin && <form onSubmit={handleSearch} className="hidden md:flex items-center">
            <div className="relative">
              <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Search students, GitHub..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 lg:w-80 pl-10 pr-4 py-2 rounded-xl bg-surface-100 dark:bg-surface-800 border-0 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
            </div>
          </form>}
        </div>

        {!isAdmin && (
          <nav className="hidden md:flex items-center justify-center gap-1" aria-label="Coding platforms">
            {studentPlatformLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300' : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
              >
                <link.icon className="w-4 h-4" />
                {link.label}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Mobile search toggle */}
          {isAdmin && <button
            onClick={() => setShowSearch(!showSearch)}
            className="md:hidden btn-icon hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl"
            aria-label="Search"
          >
            <HiMagnifyingGlass className="w-5 h-5" />
          </button>}

          {/* Theme toggle */}
          {isAdmin && <button
            onClick={toggleTheme}
            className="btn-icon hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl"
            aria-label={`Current theme: ${theme}. Click to change.`}
          >
            <ThemeIcon className="w-5 h-5" />
          </button>}

          {/* Notifications */}
          {isAdmin && <button
            onClick={() => navigate('/notifications')}
            className="btn-icon hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl relative"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <HiOutlineBell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce-soft">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>}

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-violet flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.[0]?.toUpperCase() || 'A'}
              </div>
              <span className="hidden sm:block text-sm font-medium text-surface-700 dark:text-surface-300 max-w-[100px] truncate">
                {user?.name || 'Admin'}
              </span>
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-72 bg-white dark:bg-surface-800 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700 overflow-hidden z-20"
                  >
                    <div className="px-5 py-5 text-center border-b border-surface-200 dark:border-surface-700">
                      <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-primary-500 to-accent-violet flex items-center justify-center text-white text-2xl font-bold">
                        {user?.name?.[0]?.toUpperCase() || 'A'}
                      </div>
                      <p className="mt-3 text-base font-semibold text-surface-900 dark:text-white">{user?.name || 'Admin'}</p>
                      <p className="mt-1 text-xs text-surface-400 break-all">{user?.email}</p>
                      <span className="inline-flex mt-3 px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-500/10 text-xs font-semibold text-primary-600 dark:text-primary-400 capitalize">
                        {user?.role || 'admin'}
                      </span>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <nav className="md:hidden flex items-center gap-1 px-3 pb-3 overflow-x-auto" aria-label="Coding platforms">
          {studentPlatformLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `flex flex-none items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300' : 'text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-800'}`}
            >
              <link.icon className="w-4 h-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
      )}

      {/* Mobile search bar */}
      <AnimatePresence>
        {isAdmin && showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-surface-200 dark:border-surface-700 overflow-hidden"
          >
            <form onSubmit={handleSearch} className="p-3">
              <div className="relative">
                <HiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search students, GitHub..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-800 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
