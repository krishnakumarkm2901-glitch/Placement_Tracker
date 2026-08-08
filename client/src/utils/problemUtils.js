const HACKERRANK_ALIASES = {
  'python-if-else': 'py-if-else',
  'say-hello-world-with-python': 'py-hello-world',
  'print-function': 'python-print',
  'arithmetic-operators': 'python-arithmetic-operators',
  'python-division': 'python-division',
  'loops': 'python-loops',
  'write-a-function': 'write-a-function',
};

/**
 * Resolves platform problem URLs and display titles from problem names/codes or full URLs.
 */
export function getProblemUrl(titleOrUrl, platform = 'leetcode') {
  if (!titleOrUrl) return '';
  const str = String(titleOrUrl).trim();
  if (!str) return '';

  // If already a full URL
  if (/^https?:\/\//i.test(str)) {
    return str;
  }

  const p = (platform || 'leetcode').toLowerCase();
  const cleanSlug = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (p === 'codechef') {
    // CodeChef problem code e.g. NYRES -> https://www.codechef.com/problems/NYRES
    const code = str.includes(' ') ? cleanSlug.toUpperCase() : str.toUpperCase();
    return `https://www.codechef.com/problems/${code}`;
  }

  if (p === 'hackerrank') {
    const hrSlug = HACKERRANK_ALIASES[cleanSlug] || cleanSlug;
    return `https://www.hackerrank.com/challenges/${hrSlug}/problem`;
  }

  // Default LeetCode
  return `https://leetcode.com/problems/${cleanSlug}/`;
}

export function parseProblemInput(input, platform = 'leetcode', index = 1) {
  if (!input) return null;
  const str = String(input).trim();
  if (!str) return null;

  // If user entered a full URL, retain exact URL
  if (/^https?:\/\//i.test(str)) {
    let title = str;
    try {
      const urlObj = new URL(str);
      const parts = urlObj.pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        let rawTitle = parts[parts.length - 1];
        if (rawTitle === 'problem' && parts.length > 1) {
          rawTitle = parts[parts.length - 2];
        }
        if (platform === 'codechef' && !rawTitle.includes('-')) {
          title = rawTitle.toUpperCase();
        } else {
          title = rawTitle
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
        }
      }
    } catch (_) {}

    return {
      id: String(index),
      title: title || str,
      url: str,
    };
  }

  const url = getProblemUrl(str, platform);

  return {
    id: String(index),
    title: str,
    url,
  };
}
