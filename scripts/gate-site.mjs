#!/usr/bin/env node
// ai-nativesolutions · scripts/gate-site.mjs — the mutation gate for the front door's own kernels.
// Each kernel in site/kernel/ is broken on purpose, one small change at a time (witness v0.6), and its tests must
// notice every break. The result is written to site/data/witness.json, which the front door prints.
//
//   node scripts/gate-site.mjs <path-to-witness.mjs>            run the gate, write site/data/witness.json
//   node scripts/gate-site.mjs <path-to-witness.mjs> --verify   run it and fail unless it reproduces the committed record (CI)
// One kernel at a time: witness edits the file in place while it runs, so two runs in one tree would corrupt each other.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const witness = process.argv[2];
if (!witness || !existsSync(witness)) { console.error('REFUSED: give the path to witness.mjs (v0.6)'); process.exit(1); }
const VERIFY = process.argv.includes('--verify');
const KERNELS = [
  ['site/kernel/estate.mjs', 'the organism: which family a build is in, its shape and real links, where each cell starts, the simulation\'s script, what the pointer is on'],
  ['site/kernel/ground.mjs', 'the source check: a date, a price or a credit-card payment the reader gives must be in the visitor\'s own words'],
  ['site/kernel/netwatch.mjs', 'the network ledger: who the page talked to, and whether anything was sent up'],
  ['site/kernel/race.mjs', 'the compression race: the placing, the verdict sentence and the sealed table, losses included'],
];
const sha = (p) => createHash('sha256').update(readFileSync(join(root, p))).digest('hex');
const out = { _rule: 'The mutation gate on the front door\'s own kernels (witness v0.6, uncapped). Re-derived on GitHub\'s runner on every push; the front door prints these numbers.', witness: 'v0.6', kernels: [] };
let clean = true;
for (const [file, what] of KERNELS) {
  const test = file.replace(/\.mjs$/, '.test.mjs');
  const r = spawnSync(process.execPath, [witness, 'mutate', file, '--cap', '100000', '--timeout', '120000', '--test', 'node', '--test', test], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  const text = (r.stdout || '') + (r.stderr || '');
  const at = text.lastIndexOf('\n{\n'), end = text.lastIndexOf('\n}');
  let j = null;
  try { j = JSON.parse(text.slice(at + 1, end + 2)); } catch { j = null; }
  if (!j || !Number.isInteger(j.killed) || !Number.isInteger(j.total)) { console.error('REFUSED: could not read witness\'s verdict for ' + file + '\n' + text.slice(-600)); process.exit(1); }
  const survivors = (j.survived || []).map((s) => (s.line ? 'line ' + s.line + ': ' : '') + String(s.mutation || s.name || s.id || '').slice(0, 80) + (s.snippet ? ' — ' + String(s.snippet).trim().slice(0, 70) : ''));
  out.kernels.push({ file, what, sha256: sha(file), testSha256: sha(test), killed: j.killed, total: j.total, survivors });
  if (j.killed !== j.total) clean = false;
  console.log(file + ' — ' + j.killed + ' of ' + j.total + ' caught' + (survivors.length ? '\n  ' + survivors.join('\n  ') : ''));
}
const body = JSON.stringify(out, null, 2) + '\n', path = join(root, 'site', 'data', 'witness.json');
if (VERIFY) {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== body) { console.error('GATE RECORD MISMATCH: site/data/witness.json is not what this run measured. Run node scripts/gate-site.mjs and commit.'); process.exit(1); }
  console.log('GATE RECORD CONFIRMED — site/data/witness.json is exactly what this runner measured');
} else { writeFileSync(path, body); console.log('wrote site/data/witness.json'); }
if (!clean) { console.error('GATE NOT CLEAN: a broken copy got past the tests (listed above)'); process.exit(1); }
