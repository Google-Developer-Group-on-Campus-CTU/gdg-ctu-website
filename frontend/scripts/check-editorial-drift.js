import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const editorialPath = path.join(__dirname, '../src/admin/editorial.js');
const src = readFileSync(editorialPath, 'utf8');

// Snapshot date pinned by remediation plan 2026-09-24
const SNAPSHOT_DATE = '2026-09-24';
if (!src.includes(`Source snapshot date: ${SNAPSHOT_DATE}`)) {
  console.error(`[drift] editorial.js missing snapshot date ${SNAPSHOT_DATE}`);
  process.exit(1);
}

function extractConst(name) {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\[([^\\]]+)\\]`, 'm');
  const m = src.match(re);
  if (!m) {
    console.error(`[drift] could not find ${name} export`);
    process.exit(1);
  }
  return m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

const expected = {
  EVENT_STATUSES: ['draft', 'published', 'archived', 'cancelled'],
  PARTNER_TIERS: ['platinum', 'gold', 'silver', 'community'],
  CONTENT_KEYS: ['hero', 'about', 'community', 'cta', 'footer'],
};

let failed = false;
for (const [key, exp] of Object.entries(expected)) {
  const actual = extractConst(key);
  const same = actual.length === exp.length && actual.every((v, i) => v === exp[i]);
  if (!same) {
    console.error(`[drift] ${key} mismatch. Expected ${JSON.stringify(exp)} but got ${JSON.stringify(actual)}`);
    failed = true;
  } else {
    console.log(`[drift] ${key} ok`);
  }
}

if (failed) {
  console.error('[drift] contract enums drifted — re-sync from backend source of truth per editorial.js header.');
  process.exit(1);
}
console.log(`[drift] editorial contract enums match snapshot ${SNAPSHOT_DATE}`);
