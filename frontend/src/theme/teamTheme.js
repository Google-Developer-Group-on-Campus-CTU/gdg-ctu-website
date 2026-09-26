/**
 * Team theme — single source of truth for department order + colors.
 *
 * Imported by both `pages/Officers.jsx` and `components/TeamCard.jsx`
 * so borders, tabs, and pills never drift apart.
 *
 * Canonical departments: Executive (gold) + the 5 core teams.
 * CMS values are free-text ("Executive Board", "Operations Department",
 * …) so matching is substring-based and case-insensitive.
 */

export const DEPARTMENT_ORDER = [
  'Executive',
  'Operations',
  'Technology',
  'Creatives',
  'Community Development',
  'Finance',
];

export const CORE_DEPARTMENTS = DEPARTMENT_ORDER.filter((d) => d !== 'Executive');

export const DEPT_COLORS = {
  Executive: '#FBBC05',
  Operations: '#F59E0B',
  Technology: '#EA4335',
  Creatives: '#4285F4',
  'Community Development': '#34A853',
  Finance: '#1A73E8',
};

export const DEPT_FALLBACK_COLOR = '#4285F4';

/**
 * Map a free-text CMS department to its canonical name.
 * Unknown / empty values pass through trimmed (or 'Team' when blank)
 * so grouping never crashes on unexpected input.
 */
export function normalizeDepartment(name) {
  const raw = String(name ?? '').trim();
  if (!raw) return 'Team';
  const lower = raw.toLowerCase();
  if (lower.includes('executive')) return 'Executive';
  if (lower.includes('operation')) return 'Operations';
  if (lower.includes('technolog')) return 'Technology';
  if (lower.includes('creative')) return 'Creatives';
  if (lower.includes('community')) return 'Community Development';
  if (lower.includes('financ')) return 'Finance';
  return raw;
}

export function isExecutiveDepartment(name) {
  return normalizeDepartment(name) === 'Executive';
}

/** Executive rule: department is Executive OR the member is featured. */
export function isExecutiveMember(member) {
  if (!member || typeof member !== 'object') return false;
  return isExecutiveDepartment(member.department) || Boolean(member.featured);
}

/** Strong dept color used for borders, tabs, and pills. */
export function getDeptColor(department) {
  const canonical = normalizeDepartment(department);
  return DEPT_COLORS[canonical] ?? DEPT_FALLBACK_COLOR;
}

/** Rank for sorting departments in DEPARTMENT_ORDER sequence. */
export function departmentRank(name) {
  const canonical = normalizeDepartment(name);
  const idx = DEPARTMENT_ORDER.findIndex((d) => d === canonical);
  return idx === -1 ? 99 : idx;
}

/** Short tab label — "Operations" renders as "Operations Department". */
export function deptTabLabel(name) {
  const canonical = normalizeDepartment(name);
  if (canonical === 'Team') return 'Team';
  return /department/i.test(String(name ?? '')) ? String(name).trim() : `${canonical} Department`;
}

/** Initials for the photo placeholder (no fallback-photo masking). */
export function getInitials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
