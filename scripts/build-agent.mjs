#!/usr/bin/env node
// ai-nativesolutions · scripts/build-agent.mjs — the face other people's AI agents read, generated, never typed.
// From site/data/stats.json (the front door's figures and their receipts), media/film/facts.json (the estate count)
// and agent/data/agent.json (offers, security tools, citations, scope), through agent/kernel.mjs, it writes:
//   llms.txt            the plain-text summary any agent reads first
//   llms-full.txt       the same, with every figure's detail and every tool's threats
//   agent/facts.json    the same facts as JSON (the MCP server serves exactly this)
//   ai.html             the same facts as a page, with the schema.org Organization (JSON-LD)
//   node scripts/build-agent.mjs           write them
//   node scripts/build-agent.mjs --check   fail if any differs from what the sources give, or the facts are unfit (CI)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import A from '../agent/kernel.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NL = String.fromCharCode(10);
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, NL);
const json = (p) => JSON.parse(read(p));
const facts = A.build({ stats: json('site/data/stats.json'), film: json('media/film/facts.json'), agent: json('agent/data/agent.json') });
const problems = A.validate(facts);
if (problems.length) { console.error('the agent facts are not fit to publish:' + NL + problems.map((x) => '  - ' + x).join(NL)); process.exit(1); }
const out = {
  'llms.txt': A.renderLlms(facts),
  'llms-full.txt': A.renderLlms(facts, { full: true }),
  'agent/facts.json': JSON.stringify(facts, null, 1) + NL,
  'ai.html': A.renderHtml(facts),
};
if (process.argv.includes('--check')) {
  const stale = Object.keys(out).filter((p) => !existsSync(join(root, p)) || read(p) !== out[p]);
  if (stale.length) { console.error('out of date with their sources: ' + stale.join(', ') + '. Run: node scripts/build-agent.mjs'); process.exit(1); }
  console.log('agent face drawn from its sources: ' + facts.figures.length + ' figures, ' + facts.offers.length + ' offers, ' + facts.security.length + ' security tools, ' + facts.failures.length + ' failures, ' + facts.citations.length + ' citations');
} else {
  mkdirSync(join(root, 'agent'), { recursive: true });
  for (const [p, text] of Object.entries(out)) writeFileSync(join(root, p), text);
  console.log('wrote ' + Object.keys(out).join(', '));
}
