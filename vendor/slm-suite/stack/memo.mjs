// stack/memo.mjs — the shared stack's output (pure; the same for every vertical): the human contract on every memo, the
// memo itself rendered only from the gated result, and angles always marked as proposals.

export const LABEL = 'ASSISTS ONLY. A qualified human must review this, and owns and is accountable for any use of it. It is not advice, and nothing has been sent or filed.';
export const PROPOSAL = 'PROPOSAL, for the reviewer to weigh: ';

/** render(result, { words }) → the memo text. words: the vertical's plain words for claim types, remedies, deadlines, next steps and angles */
export function render(r, { words }) {
  const w = (group, k) => (words[group] && words[group][k]) || k;
  const out = [];
  if (r.abstain) {
    out.push('ABSTAINED: ' + w('reasons', r.reason) + '.');
    if (r.missing.length) out.push('Needed before anyone relies on this: ' + r.missing.map((k) => w('facts', k)).join(', ') + '.');
    if (r.summary) out.push('The complaint, as read: ' + r.summary);
    out.push(LABEL);
    return out.join('\n');
  }
  const a = r.answer;
  out.push('CLAIM: ' + w('claims', a.claim) + '.');
  if (r.summary) out.push('The complaint, as read: ' + r.summary);
  out.push('REMEDY: ' + w('remedies', a.remedy) + '.');
  if (r.cites.length) out.push('PROVISIONS: ' + r.cites.map((p) => p.cite).join('; ') + '.');
  for (const d of a.deadlines) out.push('DEADLINE: ' + w('deadlines', d.what) + ' ' + d.date + '.');
  for (const g of a.angles) out.push(PROPOSAL + w('angles', g));
  out.push('NEXT: ' + w('next', a.next) + '.');
  out.push(LABEL);
  return out.join('\n');
}

export default { LABEL, PROPOSAL, render };
