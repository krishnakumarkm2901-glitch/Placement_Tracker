import { SiHackerrank, SiJavascript, SiPython } from 'react-icons/si';
import { HiOutlineAcademicCap, HiOutlineDocumentCheck, HiOutlineStar } from 'react-icons/hi2';
import { FaDatabase, FaCoffee } from 'react-icons/fa';
import Card from '../ui/Card';
import Avatar from '../ui/Avatar';
import SubmissionsHeatMap from '../charts/SubmissionsHeatMap';

const COUNTRY_FLAGS = {
  India: '🇮🇳',
  'United States': '🇺🇸',
  USA: '🇺🇸',
  'United Kingdom': '🇬🇧',
  Canada: '🇨🇦',
  Australia: '🇦🇺',
  Germany: '🇩🇪',
  France: '🇫🇷',
  Singapore: '🇸🇬',
  Japan: '🇯🇵',
  China: '🇨🇳',
  Brazil: '🇧🇷',
  'South Korea': '🇰🇷',
  Russia: '🇷🇺',
  Indonesia: '🇮🇩',
  Bangladesh: '🇧🇩',
  Pakistan: '🇵🇰',
  'Sri Lanka': '🇱🇰',
  Nepal: '🇳🇵',
};

function badgeTheme(type = '') {
  const key = type.toLowerCase();
  if (key.includes('java')) return { bg: 'bg-amber-100 dark:bg-amber-500/20', text: 'text-amber-800 dark:text-amber-200', icon: FaCoffee };
  if (key.includes('sql')) return { bg: 'bg-slate-100 dark:bg-slate-700/60', text: 'text-slate-700 dark:text-slate-200', icon: FaDatabase };
  if (key.includes('python')) return { bg: 'bg-sky-100 dark:bg-sky-500/20', text: 'text-sky-800 dark:text-sky-200', icon: SiPython };
  if (key.includes('javascript') || key.includes('js')) return { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-800 dark:text-yellow-200', icon: SiJavascript };
  if (key.includes('30-days') || key.includes('days-of-code')) return { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-800 dark:text-orange-200', icon: HiOutlineAcademicCap };
  return { bg: 'bg-emerald-100 dark:bg-emerald-500/20', text: 'text-emerald-800 dark:text-emerald-200', icon: SiHackerrank };
}

function Stars({ count = 0, total = 5 }) {
  return (
    <div className="flex items-center justify-center gap-0.5 mt-2">
      {Array.from({ length: total }, (_, index) => (
        <HiOutlineStar
          key={index}
          className={`w-3.5 h-3.5 ${index < count ? 'fill-amber-400 text-amber-400' : 'text-surface-300 dark:text-surface-600'}`}
        />
      ))}
    </div>
  );
}

function BadgeCard({ badge }) {
  const theme = badgeTheme(badge.type || badge.name);
  const Icon = theme.icon;
  const content = (
    <div className={`relative w-[132px] h-[148px] mx-auto flex flex-col items-center justify-center px-3 text-center ${theme.bg} ${theme.text}`}
      style={{ clipPath: 'polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0 50%)' }}
    >
      <Icon className="w-7 h-7 mb-2 opacity-90" />
      <p className="text-xs font-semibold leading-tight line-clamp-2">{badge.name}</p>
      <Stars count={badge.stars} total={badge.total_stars || 5} />
    </div>
  );
  if (badge.url) {
    return <a href={badge.url} target="_blank" rel="noopener noreferrer" className="block hover:scale-[1.02] transition-transform">{content}</a>;
  }
  return content;
}

function CertificateCard({ certificate }) {
  return (
    <a
      href={certificate.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative block overflow-hidden rounded-md bg-emerald-600 hover:bg-emerald-500 transition-colors text-white min-h-[108px] shadow-sm"
    >
      <div className="absolute top-0 right-0 w-0 h-0 border-t-[28px] border-l-[28px] border-t-emerald-800/40 border-l-transparent" />
      <div className="p-4 pr-10">
        <div className="flex items-start gap-2">
          <HiOutlineDocumentCheck className="w-5 h-5 mt-0.5 shrink-0 opacity-90" />
          <div>
            <h4 className="font-semibold leading-snug">{certificate.title}</h4>
            {certificate.verified && <p className="text-sm font-bold mt-2 tracking-wide">Verified</p>}
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 right-0 bg-surface-500/90 text-[10px] font-semibold tracking-wider uppercase px-2.5 py-1 rounded-tl-md">
        {certificate.type || 'SKILL'}
      </div>
    </a>
  );
}

export default function HackerRankOverview({ profile, username }) {
  const raw = profile?.raw || {};
  const badges = raw.badges || [];
  const certificates = raw.certificates || [];
  const name = raw.name || username;
  const country = raw.country;
  const flag = COUNTRY_FLAGS[country] || '';

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)] gap-5">
        <Card>
          <div className="flex flex-col items-center text-center py-4">
            <Avatar src={raw.avatar_url} name={name} size="xl" />
            <h2 className="text-xl font-bold text-surface-900 dark:text-white mt-4">
              {name}{flag ? ` ${flag}` : ''}
            </h2>
            <a
              href={profile?.profile_url || `https://www.hackerrank.com/profile/${username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-surface-500 hover:text-primary-500 mt-1"
            >
              @{username}
            </a>
            {country && !flag && <p className="text-sm text-surface-400 mt-2">{country}</p>}
            {(raw.school || raw.company) && (
              <p className="text-sm text-surface-400 mt-2">{[raw.company, raw.school].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        </Card>

        <div className="space-y-5 min-w-0">
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <HiOutlineStar className="w-5 h-5 text-amber-500 fill-amber-400" />
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Badges</h3>
              <span className="text-sm text-surface-400">({badges.length})</span>
            </div>
            {badges.length ? (
              <div className="flex flex-wrap gap-4 justify-start">
                {badges.map((badge) => (
                  <BadgeCard key={`${badge.type}-${badge.name}`} badge={badge} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400 py-6 text-center">No public badges yet.</p>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-5">
              <HiOutlineDocumentCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">Certifications</h3>
              <span className="text-sm text-surface-400">({certificates.length})</span>
            </div>
            {certificates.length ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {certificates.map((certificate) => (
                  <CertificateCard key={certificate.url || certificate.title} certificate={certificate} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400 py-6 text-center">No public certifications yet.</p>
            )}
          </Card>
        </div>
      </div>

      {raw.submission_calendar && Object.keys(raw.submission_calendar).length > 0 && (
        <Card>
          <SubmissionsHeatMap calendar={raw.submission_calendar} title="Submissions Heat Map" days={185} />
        </Card>
      )}
    </div>
  );
}
