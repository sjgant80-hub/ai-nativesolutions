#!/usr/bin/env node
// ai-nativesolutions · scripts/vendor-site.mjs — the living front door runs the estate's REAL kernels, not copies
// retyped for the site. Each file below is taken byte for byte from the repo and commit named, and pinned by SHA-256
// in vendor/SOURCES.json. The front door imports these files directly, so the code a visitor runs is the code those
// repos gate.
//
//   node scripts/vendor-site.mjs            copy from the local checkouts named in LOCAL, write vendor/SOURCES.json
//   node scripts/vendor-site.mjs --check    every vendored file still matches its pin (CI runs this)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const PINS = join(root, 'vendor', 'SOURCES.json');

// what each kernel is, where it lives, and which of its files the front door needs (paths kept, so imports resolve unchanged)
const SOURCES = [
  { id: 'slm-suite', repo: 'sjgant80-hub/slm-suite', licence: 'MIT', what: 'the SLM stack: the gate, the memo, and the UK consumer-claim library with its verified provisions',
    files: ['stack/gate.mjs', 'stack/memo.mjs', 'verticals/legal/library.mjs', 'verticals/legal/vertical.mjs', 'verticals/legal/law.json', 'data/record.json'] },
  { id: 'konomi-tongue', repo: 'sjgant80-hub/konomi-tongue', licence: 'MIT', what: 'LIGHT, layered: the five-layer lossless codec',
    files: ['layered/src/fold.mjs', 'light/sha256.mjs', 'layered/data/record.json'] },
  { id: 'liveware', repo: 'sjgant80-hub/liveware', licence: 'MIT', what: 'the signed-packet door, the immune library, the referee and the sealed attack test (Wave 1, T4)',
    files: ['src/wave1.mjs', 'src/door.mjs', 'src/receipt.mjs', 'src/seed.mjs', 'src/compress.mjs', 'src/mesh.mjs', 'src/rng.mjs',
      'vendor/fall-kit/core/identity.mjs', 'vendor/fall-kit/core/antibody.mjs', 'vendor/fall-kit/core/vendor/light/sha256.mjs',
      'vendor/fall-kit/core/vendor/light/packet.mjs', 'vendor/fall-kit/core/vendor/light/codec.mjs', 'vendor/fall-kit/core/vendor/sync/crdt.mjs', 'receipts/wave1.json'] },
];
// third-party builds (downloaded once from the npm registry's CDN; pinned the same way)
const THIRD = [
  { id: 'brotli-wasm', version: '3.0.1', licence: 'Apache-2.0', what: 'Brotli compiled to WebAssembly (the race baseline)',
    base: 'https://cdn.jsdelivr.net/npm/brotli-wasm@3.0.1/', files: ['pkg.web/brotli_wasm.js', 'pkg.web/brotli_wasm_bg.wasm', 'LICENSE'] },
  { id: 'zstd-wasm', version: '0.0.27', licence: 'MIT', what: 'Zstandard compiled to WebAssembly (the race baseline)',
    base: 'https://cdn.jsdelivr.net/npm/@bokuweb/zstd-wasm@0.0.27/', files: ['dist/web/zstd.js', 'dist/common/zstd.wasm', 'package.json'] },
  { id: 'fonts', version: 'fontsource 5.2', licence: 'OFL-1.1', what: 'Fraunces, Hanken Grotesk and JetBrains Mono (variable, latin), served from this site so no font host is called',
    base: 'https://cdn.jsdelivr.net/npm/', files: ['@fontsource-variable/fraunces@5.2.9/files/fraunces-latin-full-normal.woff2', '@fontsource-variable/fraunces@5.2.9/files/fraunces-latin-full-italic.woff2',
      '@fontsource-variable/hanken-grotesk@5.2.8/files/hanken-grotesk-latin-wght-normal.woff2', '@fontsource-variable/jetbrains-mono@5.2.8/files/jetbrains-mono-latin-wght-normal.woff2',
      '@fontsource-variable/fraunces@5.2.9/LICENSE', '@fontsource-variable/hanken-grotesk@5.2.8/LICENSE', '@fontsource-variable/jetbrains-mono@5.2.8/LICENSE'] },
];
const LOCAL = { 'slm-suite': 'C:/Users/sjgan/slm-suite', 'konomi-tongue': 'C:/Users/sjgan/Downloads/konomi-tongue', liveware: 'C:/Users/sjgan/liveware' };
const destOf = (id, f) => join(root, 'vendor', id, f.replace(/^@fontsource-variable\/([a-z-]+)@[\d.]+\//, '$1/'));

if (process.argv.includes('--check')) {
  const pins = JSON.parse(readFileSync(PINS, 'utf8'));
  let bad = 0, n = 0;
  for (const s of pins.sources) for (const [f, want] of Object.entries(s.files)) {
    n++;
    const p = join(root, 'vendor', s.id, f);
    const got = existsSync(p) ? sha(readFileSync(p)) : 'missing';
    if (got !== want) { bad++; console.error('✗ vendor/' + s.id + '/' + f + ' differs from its pin'); }
  }
  if (bad) { console.error('VENDOR CHECK FAILED: ' + bad + ' of ' + n); process.exit(1); }
  console.log('VENDOR CHECK CLEAN — ' + n + ' files byte-identical to their pins');
  process.exit(0);
}

const out = { _rule: 'Every file here is taken byte for byte from the source named and pinned by SHA-256. Edit the source repo, never these copies.', sources: [] };
for (const s of SOURCES) {
  const dir = LOCAL[s.id];
  const commit = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const files = {};
  for (const f of s.files) {
    // the bytes git stores at that commit (never the working copy: line endings can differ on disk)
    const bytes = execFileSync('git', ['-C', dir, 'show', commit + ':' + f], { maxBuffer: 1 << 26 });
    const dest = destOf(s.id, f); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, bytes);
    files[f] = sha(bytes);
  }
  out.sources.push({ id: s.id, repo: s.repo, commit, licence: s.licence, what: s.what, files });
  console.log('vendored ' + s.id + '@' + commit.slice(0, 7) + ' — ' + s.files.length + ' files');
}
for (const t of THIRD) {
  const files = {};
  for (const f of t.files) {
    const res = await fetch(t.base + f);
    if (!res.ok) { console.error('REFUSED: could not fetch ' + t.base + f + ' (' + res.status + ')'); process.exit(1); }
    const bytes = Buffer.from(await res.arrayBuffer());
    const rel = f.replace(/^@fontsource-variable\/([a-z-]+)@[\d.]+\//, '$1/');
    const dest = destOf(t.id, f); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, bytes);
    files[rel] = sha(bytes);
  }
  out.sources.push({ id: t.id, version: t.version, from: t.base, licence: t.licence, what: t.what, files });
  console.log('vendored ' + t.id + '@' + t.version + ' — ' + t.files.length + ' files');
}
writeFileSync(PINS, JSON.stringify(out, null, 2) + '\n');
console.log('wrote vendor/SOURCES.json');
