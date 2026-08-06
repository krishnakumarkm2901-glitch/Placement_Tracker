import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { VscGithubInverted } from 'react-icons/vsc';
import { SiCodechef, SiHackerrank, SiLeetcode } from 'react-icons/si';
import { HiOutlineSquares2X2, HiOutlineTrophy, HiOutlineChartBar, HiOutlineMoon, HiOutlineSun, HiOutlineMagnifyingGlass } from 'react-icons/hi2';
import { useTheme } from '../../contexts/ThemeContext';

const platformLinks = [
  { to: '/platform/github', label: 'GitHub', icon: VscGithubInverted },
  { to: '/platform/leetcode', label: 'LeetCode', icon: SiLeetcode },
  { to: '/platform/codechef', label: 'CodeChef', icon: SiCodechef },
  { to: '/platform/hackerrank', label: 'HackerRank', icon: SiHackerrank },
];

export default function PublicLayout() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [studentSearch, setStudentSearch] = useState(() => new URLSearchParams(location.search).get('search') || '');
  const selectedPlatform = location.pathname.match(/^\/platform\/([^/]+)/)?.[1] || 'github';
  const links = [
    { to: `/platform/${selectedPlatform}`, label: 'Dashboard', icon: HiOutlineSquares2X2 },
    { to: `/platform/${selectedPlatform}/leaderboard`, label: 'Leaderboard', icon: HiOutlineTrophy },
    { to: `/platform/${selectedPlatform}/compare`, label: 'Compare', icon: HiOutlineChartBar },
  ];
  const ThemeIcon = theme === 'dark' ? HiOutlineSun : HiOutlineMoon;

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-surface-900/90 backdrop-blur-xl border-b border-surface-200 dark:border-surface-700">
        <div className="max-w-7xl mx-auto min-h-16 px-4 sm:px-6 py-2 flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-4">
          <nav className="flex items-center gap-1 overflow-x-auto max-w-full" aria-label="Coding platforms">
            {platformLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) => `flex flex-none items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${isActive ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300' : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
              >
                <link.icon className="w-4 h-4" />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </nav>
          <form
            className="relative w-full lg:w-64 lg:ml-auto"
            onSubmit={(event) => {
              event.preventDefault();
              const query = studentSearch.trim();
              navigate(`/platform/${selectedPlatform}${query ? `?search=${encodeURIComponent(query)}` : ''}`);
            }}
          >
            <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="search"
              value={studentSearch}
              onChange={(event) => setStudentSearch(event.target.value)}
              placeholder="Search students..."
              aria-label="Search students"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-surface-300 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-sm text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </form>
          <nav className="flex items-center gap-1 sm:gap-3">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.label === 'Dashboard'}
                className={({ isActive }) => `flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-md text-sm font-semibold transition-colors min-h-[44px] ${isActive ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300' : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'}`}
              >
                <link.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </NavLink>
            ))}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-11 h-11 ml-1 rounded-md flex items-center justify-center text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <ThemeIcon className="w-5 h-5" />
            </button>
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
    </div>
  );
}
