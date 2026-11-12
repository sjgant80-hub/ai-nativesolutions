// verticals/legal/vertical.mjs — what the legal vertical gives the shared stack (pure): the fact schema the model fills,
// the plain words the memo uses, the citation patterns that read a raw model's free-text citations, and the prompts.

export const TODAY = '2026-11-09';
export const SCHEMA = Object.freeze({
  kind: ['goods', 'service'], channel: ['shop', 'online', 'phone'], price: 'number', paidBy: ['credit card', 'debit card', 'cash', 'bank transfer'],
  bought: 'date', delivered: 'date', faultFound: 'date', repairsTried: 'int', changedMind: 'boolean', summary: 'text',
});
export const FACT_KEYS = Object.freeze(Object.keys(SCHEMA).filter((k) => k !== 'summary'));

export const WORDS = Object.freeze({
  claims: { 'goods-fault': 'faulty or not-as-described goods', 'service-poor': 'a service not done with reasonable care and skill', 'distance-cancel': 'cancelling an online or phone purchase', 'no-statutory-right': 'a change of mind on an in-person purchase' },
  remedies: { reject: 'reject the goods for a full refund (the short-term right to reject)', 'repair-or-replacement': 'repair or replacement at the trader\'s cost', 'price-reduction-or-final-reject': 'a price reduction, or the final right to reject', 'repeat-performance': 'the service performed again at the trader\'s cost', 'price-reduction': 'a price reduction for the service', 'cancel-and-refund': 'cancel and be refunded', 'cancellation-period-passed': 'the cancellation period has passed', 'no-statutory-right': 'no legal right to return goods for a change of mind' },
  deadlines: { 'reject-by': 'the short-term right to reject ends on', 'cancel-by': 'the cancellation period ends on', limitation: 'the six-year limitation period ends on' },
  next: { 'letter-before-action-14-days': 'a letter before action giving the trader 14 days to put it right', 'notify-cancellation': 'tell the trader clearly, in writing, that the contract is cancelled', 'check-returns-policy': 'check the trader\'s own returns policy, which can go further than the law', 'ask-for-missing-facts': 'ask the client for the missing facts' },
  angles: { 'cca-s75': 'paid by credit card for an item over £100 and up to £30,000, so the card issuer may be jointly liable for the breach (Consumer Credit Act 1974, s. 75).' },
  facts: { delivered: 'the delivery date (or the date the service was done)', faultFound: 'the date the fault appeared' },
  reasons: { 'missing-facts': 'a critical fact is missing', 'could-not-read': 'the complaint could not be read reliably', 'not-in-verified-table': 'a provision outside the verified table was needed' },
});

// a citation names a provision when it gives both the instrument and the number, in either order
const both = (act, num) => new RegExp('(?:' + act + ')[^;\\n]{0,40}?(?:' + num + ')|(?:' + num + ')[^;\\n]{0,40}?(?:' + act + ')', 'i');
const CRA = 'consumer rights act|\\bcra\\b', CCR = 'consumer contracts|\\bccr\\b', CCA = 'consumer credit act|\\bcca\\b', LA = 'limitation act';
const sec = (n) => '\\b(?:s\\.?|ss\\.?|sec(?:tion)?s?\\.?)\\s*' + n + '(?![\\d(])', secSub = (n, k) => '\\b(?:s\\.?|sec(?:tion)?\\.?)\\s*' + n + '\\s*\\(\\s*' + k + '\\s*\\)';
const reg = (n) => '\\b(?:reg(?:ulation)?s?\\.?)\\s*' + n + '(?!\\d)';
/** PATTERNS: [id, RegExp] in the order they are tried (the more specific first) */
export const PATTERNS = Object.freeze([
  ['cra-s19-14', both(CRA, secSub(19, 14) + '|' + sec(19))],
  ['cra-s24-10', both(CRA, secSub(24, 10))],
  ['cra-s22', both(CRA, sec(22) + '|' + secSub(22, 3))],
  ['cra-s24', both(CRA, sec(24) + '|' + secSub(24, 5))],
  ['cra-s9', both(CRA, sec(9))], ['cra-s20', both(CRA, sec(20))], ['cra-s23', both(CRA, sec(23))],
  ['cra-s49', both(CRA, sec(49))], ['cra-s55', both(CRA, sec(55))], ['cra-s56', both(CRA, sec(56))],
  ['ccr-reg29', both(CCR, reg(29))], ['ccr-reg30', both(CCR, reg(30))], ['ccr-reg34', both(CCR, reg(34))],
  ['cca-s75', both(CCA, sec(75))], ['la-s5', both(LA, sec(5))],
]);

/** the SLM's prompt: the complaint in, the facts out as JSON */
export const slmPrompt = (text, today = TODAY) => 'Today is ' + today + '. Read this UK consumer complaint and give its facts as JSON (dates as YYYY-MM-DD, null when the complaint does not say).\n\n' + text;
/** the base model's prompt: the same, with the schema spelled out (a fair baseline: it was never trained on the keys) */
export const basePrompt = (text, today = TODAY) => slmPrompt(text, today) + '\n\nAnswer with ONE JSON object with exactly these keys: "kind" ("goods" or "service"), "channel" ("shop", "online" or "phone"), "price" (a number, in pounds), "paidBy" ("credit card", "debit card", "cash" or "bank transfer"), "bought", "delivered" and "faultFound" (each "YYYY-MM-DD" or null), "repairsTried" (how many repairs or redos failed, a number), "changedMind" (true or false), "summary" (one sentence, with no dates and no law).';
/** the SLM's target: the facts in a fixed key order, then the summary */
export const slmTarget = (facts, summary) => JSON.stringify({ ...Object.fromEntries(FACT_KEYS.map((k) => [k, facts[k]])), summary });

/** the raw baseline's prompt: the same complaint, asked for the whole answer at once */
export const rawPrompt = (text, today = TODAY) => 'Today is ' + today + '. You are assisting a solicitor in England and Wales. Read this consumer complaint and answer ONLY with JSON with these keys:\n'
  + '"claim": one of "goods-fault", "service-poor", "distance-cancel", "no-statutory-right", or "cannot-tell" if a critical fact (such as the delivery date or when the fault appeared) is missing;\n'
  + '"remedy": one of "reject", "repair-or-replacement", "price-reduction-or-final-reject", "repeat-performance", "price-reduction", "cancel-and-refund", "cancellation-period-passed", "no-statutory-right", or null;\n'
  + '"provisions": a list of the UK statutes and regulations that apply, each cited with its section or regulation number;\n'
  + '"deadlines": a list of {"what": "reject-by" | "cancel-by" | "limitation", "date": "YYYY-MM-DD"};\n'
  + '"angles": a list of other claims worth considering.\n\nComplaint:\n' + text;

export default { TODAY, SCHEMA, FACT_KEYS, WORDS, PATTERNS, slmPrompt, basePrompt, slmTarget, rawPrompt };
