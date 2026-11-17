#!/usr/bin/env node
// ai-nativesolutions · scripts/agent-receipts.mjs — re-open every receipt the agent face points at, live.
// For each figure, offer, security tool and door in agent/facts.json:
//   · the page answers 200, and says what we say it says (an offer's phrase; a figure's record holds its exact text)
//   · its source repository is public, and the latest completed run of each of its current workflows passed
//   · whether that CI runs a mutation gate (witness), recorded, not assumed
// A citation is checked for reachability only and never fails the run: some publishers refuse automated requests.
// An MCP door is checked by speaking MCP to it (a hosted one over HTTP; a run-it-yourself one by running its published
// command): initialize, then tools/list must offer verify_claim.
//   node scripts/agent-receipts.mjs            write agent/receipts.json
//   node scripts/agent-receipts.mjs --check    also exit 1 if any receipt no longer stands (the daily CI job)
// GITHUB_TOKEN, when set, is sent to the GitHub API (CI provides one); without it the public rate limit applies.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import A from '../agent/kernel.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const facts = JSON.parse(readFileSync(join(root, 'agent/facts.json'), 'utf8'));
const UA = { 'user-agent': 'ai-nativesolutions-receipt-check (+https://www.ai-nativesolutions.com/llms.txt)' };
const GH = { ...UA, accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { authorization: 'Bearer ' + process.env.GITHUB_TOKEN } : {}) };

async function get(url, headers = UA) {
  try { const r = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(30000) }); return { status: r.status, text: await r.text() }; }
  catch (e) { return { status: 0, text: '', error: String(e.message || e) } }
}
const visible = (h) => h.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
function repoOf(url) {
  const m = String(url).match(/^https:\/\/sjgant80-hub\.github\.io\/([a-z0-9-]+)\//) || String(url).match(/^https:\/\/github\.com\/sjgant80-hub\/([a-z0-9-]+)/);
  if (m) return m[1];
  return /^https:\/\/www\.ai-nativesolutions\.com\//.test(String(url)) ? 'ai-nativesolutions' : null;
}

const repos = new Map();
async function repo(name) {
  if (repos.has(name)) return repos.get(name);
  const p = (async () => {
    const meta = await get('https://api.github.com/repos/sjgant80-hub/' + name, GH);
    if (meta.status !== 200) return { name, error: 'GitHub answered ' + meta.status };
    const m = JSON.parse(meta.text);
    const wf = await get('https://api.github.com/repos/sjgant80-hub/' + name + '/actions/workflows?per_page=100', GH);
    // this check's own workflow is the checker, not the product's build: its result never counts against a product
    const flows = wf.status === 200 ? JSON.parse(wf.text).workflows.filter((w) => w.state === 'active' && w.path !== '.github/workflows/agent-receipts.yml') : [];
    const ci = {}; let mutationGate = false;
    for (const w of flows) {
      // the product's own state: its latest run on a push or a schedule. A run someone dispatched by hand is left out,
      // because some workflows exist to FAIL on bad input (fallforgemint's re-run rail fails a tampered receipt).
      let run;
      for (const ev of ['push', 'schedule']) {
        const runs = await get('https://api.github.com/repos/sjgant80-hub/' + name + '/actions/workflows/' + w.id + '/runs?branch=' + encodeURIComponent(m.default_branch) + '&status=completed&event=' + ev + '&per_page=1', GH);
        const r = runs.status === 200 ? JSON.parse(runs.text).workflow_runs[0] : undefined;
        if (r && (!run || r.updated_at > run.updated_at)) run = r;
      }
      if (run) ci[w.name] = { conclusion: run.conclusion, at: run.updated_at, run: run.html_url };
      if (/^\.github\/workflows\//.test(w.path)) {
        const f = await get('https://raw.githubusercontent.com/sjgant80-hub/' + name + '/' + m.default_branch + '/' + w.path, UA);
        if (f.status === 200 && /witness/i.test(f.text)) mutationGate = true;
      }
    }
    const failing = Object.entries(ci).filter(([, v]) => v.conclusion !== 'success');
    return { name, public: m.private === false, defaultBranch: m.default_branch, licence: m.license && m.license.spdx_id ? m.license.spdx_id : 'none', ci, mutationGate, runConclusion: failing.length ? failing.map(([k, v]) => k + ': ' + v.conclusion).join('; ') : Object.keys(ci).length ? 'success' : null };
  })();
  repos.set(name, p);
  return p;
}

async function item(kind, id, name, url, mustSay, extra) {
  const page = await get(url);
  const r = repoOf(url) ? await repo(repoOf(url)) : null;
  const v = A.receiptVerdict({ status: page.status, text: visible(page.text) + ' ' + page.text, mustSay, repoPrivate: r && r.public === false ? true : undefined, runConclusion: r ? r.runConclusion : undefined });
  const why = [...v.why, ...(r && r.error ? [r.error] : [])];
  if (r && !r.error) {
    const L = facts.licences || {}, want = (L.except && L.except[r.name]) || L.default;
    if (want && r.licence !== want) why.push('its licence is ' + r.licence + ', the facts say ' + want);
  }
  return { kind, id, name, url, status: page.status, ok: why.length === 0, why, ...(r && !r.error ? { repo: 'sjgant80-hub/' + r.name, licence: r.licence, ci: r.ci, mutationGate: r.mutationGate } : {}), ...(extra || {}) };
}

async function mcpDoor(d) {
  const post = (body) => fetch(d.url, { method: 'POST', headers: { ...UA, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) }).then(async (r) => ({ status: r.status, text: await r.text() })).catch((e) => ({ status: 0, text: String(e) }));
  const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'receipt-check', version: '1' } } });
  const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const json = (t) => { try { const s = t.trim().startsWith('{') ? t : (t.match(/^data: (.*)$/m) || [])[1]; return JSON.parse(s); } catch { return null; } };
  const tools = ((json(list.text) || {}).result || {}).tools || [];
  const why = [];
  if (init.status !== 200 || !(json(init.text) || {}).result) why.push('initialize did not succeed (' + init.status + ')');
  if (!tools.some((t) => t.name === 'verify_claim')) why.push('tools/list does not offer verify_claim');
  return { kind: 'door', id: 'mcp', name: d.name, url: d.url, status: init.status, ok: why.length === 0, why, tools: tools.map((t) => t.name) };
}

// the run-it-yourself MCP door: run the exact published command, as an agent's client would, and speak MCP over stdio
async function mcpStdioDoor(d) {
  const { spawn } = await import('node:child_process');
  const [cmd, ...args] = d.command.split(/\s+/);
  const why = [];
  const out = await new Promise((resolve) => {
    let text = '';
    const p = spawn(cmd, args, { shell: process.platform === 'win32', stdio: ['pipe', 'pipe', 'ignore'] });
    const timer = setTimeout(() => { p.kill(); resolve(text); }, 240000);
    p.stdout.on('data', (c) => { text += c; });
    p.on('close', () => { clearTimeout(timer); resolve(text); });
    p.on('error', (e) => { why.push('could not start: ' + e.message); });
    for (const m of [{ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'receipt-check', version: '1' } } }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }]) p.stdin.write(JSON.stringify(m) + '\n');
    p.stdin.end();
  });
  const msgs = out.split('\n').filter((l) => l.trim().startsWith('{')).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const init = msgs.find((m) => m.id === 1), list = msgs.find((m) => m.id === 2);
  const tools = list && list.result ? list.result.tools.map((t) => t.name) : [];
  if (!init || !init.result) why.push('initialize did not succeed');
  if (!tools.includes('verify_claim')) why.push('tools/list does not offer verify_claim');
  const r = await repo(repoOf(d.url));
  if (r.public === false) why.push('its source is not public');
  if (r.runConclusion && r.runConclusion !== 'success') why.push('its latest CI run is ' + r.runConclusion);
  return { kind: 'door', id: 'mcp-stdio', name: d.name, url: d.url, command: d.command, ok: why.length === 0, why, tools, serverVersion: init && init.result ? init.result.serverInfo.version : null, repo: 'sjgant80-hub/' + r.name, ci: r.ci, mutationGate: r.mutationGate };
}

const items = [];
for (const g of facts.figures) {
  const it = await item('figure', g.id, g.title, g.receipt, '');
  if (g.check) {
    const rec = await get(g.check.url);
    const v = A.receiptVerdict({ status: rec.status, text: rec.text, mustSay: g.check.has });
    it.record = { url: g.check.url, has: g.check.has, status: rec.status, ok: v.ok };
    if (!v.ok) { it.ok = false; it.why.push(...v.why.map((w) => 'record: ' + w)); }
  } else it.record = null; // page and CI only: this figure's number is not read back from a record here
  items.push(it);
}
for (const o of facts.offers) items.push(await item('offer', o.name, o.name, o.page, o.mustSay));
for (const s of facts.security) items.push(await item('security', s.name, s.name, s.url, ''));
// the receipts door is this check's own output, so it is not a receipt of itself
for (const d of facts.doors.filter((x) => x.kind !== 'receipts')) items.push(d.kind === 'mcp' ? await mcpDoor(d) : d.kind === 'mcp-stdio' ? await mcpStdioDoor(d) : await item('door', d.name, d.name, /^https:/.test(d.url) ? d.url : A.SITE + '/' + d.url.replace(/^\.?\//, ''), ''));
const warnings = [];
for (const c of facts.citations) { const r = await get(c.source); if (r.status !== 200) warnings.push(c.topic + ': its source answered ' + r.status + ' to an automated request (not counted as a failure; open it yourself: ' + c.source + ')'); }

const failed = items.filter((x) => !x.ok);
const out = { checkedAt: new Date().toISOString(), facts: facts.version + ' as of ' + facts.asOf, ok: failed.length === 0,
  counts: { checked: items.length, failed: failed.length, products: [...repos.keys()].length, withMutationGate: (await Promise.all([...repos.values()])).filter((r) => r.mutationGate).length },
  items, warnings };
writeFileSync(join(root, 'agent/receipts.json'), JSON.stringify(out, null, 1) + '\n');
for (const x of items) console.log((x.ok ? 'ok   ' : 'FAIL ') + x.kind.padEnd(9) + x.name + (x.ok ? '' : ' — ' + x.why.join('; ')));
for (const w of warnings) console.log('warn ' + w);
console.log(out.counts.checked + ' checked, ' + out.counts.failed + ' failed; ' + out.counts.products + ' products, ' + out.counts.withMutationGate + ' with a mutation gate in CI');
if (process.argv.includes('--check') && !out.ok) process.exit(1);
