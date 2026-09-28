// ai-nativesolutions · scripts/refresh-deadlist.mjs — rebuild deadlist.json FROM the estate index's own HTTP check.
// build-index.mjs now records both GitHub's claim (`pages`) and whether the page actually answered (`live`), so the
// doors that claim a page but did not open are MEASURED, not remembered. Run it after regenerating the index and
// before build-site.mjs, so the portal and the front-door counts never lean on an old verification.
//
//   node scripts/refresh-deadlist.mjs [path-to-estate-index.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const INDEX = process.argv[2] || 'C:/Users/sjgan/.claude/projects/C--Users-sjgan--claude/memory/estate-index.json';
const idx = JSON.parse(readFileSync(INDEX, 'utf8'));
if (!Array.isArray(idx.nodes) || idx.nodes.length < 100) { console.error('REFUSED: the estate index looks thin — regenerate it first.'); process.exit(1); }
if (!idx.nodes.some(n => 'pages' in n)) { console.error('REFUSED: this index predates the HTTP check (no `pages` field) — regenerate it with build-index.mjs.'); process.exit(1); }
const companion = (n) => /-(api|mcp|sdk)$/.test(n.name);
const candidates = idx.nodes.filter(n => !n.private && !n.archived && !n.fork && n.pages && !companion(n));
const dead = candidates.filter(n => !n.live).map(n => n.name).sort();
const out = { verified: String(idx.generated || '').slice(0, 10), checked: candidates.length, dead, how: 'derived from estate-index.json: public, non-archived, non-fork, Pages enabled, not an -api/-mcp/-sdk mirror, and the page did NOT answer an HTTP request when the index was built' };
writeFileSync(join(here, '..', 'deadlist.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`deadlist.json: ${candidates.length} candidate pages checked on ${out.verified} · ${dead.length} did not answer`);
