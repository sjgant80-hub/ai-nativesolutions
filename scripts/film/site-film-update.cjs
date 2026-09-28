// site-film-update.cjs — carry the re-rendered film's words onto the site, from script.json (the film's one source):
// the explainer transcript (visible + JSON-LD), the same overclaims in the page copy, and a cache key on every embed.
//   node site-film-update.cjs <site dir> <version> [--check]
const fs = require('fs'), path = require('path');
const [site, ver] = process.argv.slice(2);
const OLD = JSON.parse(fs.readFileSync(path.join(__dirname, 'pre-rerender', 'script.json'), 'utf8')).scenes;
const NEW = JSON.parse(fs.readFileSync(path.join(__dirname, 'script.json'), 'utf8')).scenes;
const oldT = OLD.map((s) => s.text).join(' '), newT = NEW.map((s) => s.text).join(' ');
const edit = (file, pairs) => {
  const p = path.join(site, file);
  let s = fs.readFileSync(p, 'utf8').split('\r').join('');
  for (const [a, b, all] of pairs) {
    if (!s.includes(a)) { console.error(file + ' MISSING: ' + a.slice(0, 100)); process.exit(1); }
    s = all ? s.split(a).join(b) : s.replace(a, () => b);
  }
  fs.writeFileSync(p, s);
};
const byId = (arr, id) => arr.find((s) => s.id === id).text;
const changed = NEW.filter((s) => s.text !== byId(OLD, s.id)).map((s) => s.id);
console.log('scenes whose words changed:', changed.join(', '));
const media = (f) => 'media/film/own-it-prove-it-90s.' + f;
edit('explainer.html', [
  // JSON-LD transcript = the film's scene texts, joined (it was generated that way; checked equal before editing)
  ['"transcript": "' + oldT + '"', '"transcript": "' + newT + '"'],
  // the visible transcript, scene by scene
  ...changed.map((id) => [byId(OLD, id), byId(NEW, id)]),
  // every embed of the film and its captions gets the new version key, so no cache serves the old cut
  ['src="' + media('mp4') + '"', 'src="' + media('mp4') + '?v=' + ver + '"', true],
  ['src="' + media('vtt') + '"', 'src="' + media('vtt') + '?v=' + ver + '"', true],
  ['<a href="' + media('mp4') + '">download the MP4</a>', '<a href="' + media('mp4') + '?v=' + ver + '">download the MP4</a>'],
  ['<a href="' + media('mp4') + '" download>', '<a href="' + media('mp4') + '?v=' + ver + '" download>'],
  ['<a href="' + media('vtt') + '" download>', '<a href="' + media('vtt') + '?v=' + ver + '" download>'],
]);
edit('index.html', [
  ['src="' + media('mp4') + '"', 'src="' + media('mp4') + '?v=' + ver + '"', true],
  ['src="' + media('vtt') + '"', 'src="' + media('vtt') + '?v=' + ver + '"', true],
  ['<a href="' + media('mp4') + '">Download the film (MP4)</a>', '<a href="' + media('mp4') + '?v=' + ver + '">Download the film (MP4)</a>'],
  // the same two overclaims the film had, in the front door's own copy
  ['The sizer picks the smallest open-weight model that clears your bar — from', 'The sizer suggests the smallest open-weight model that should clear your bar — from'],
  ['It races the base model on examples it has never seen.', 'It races the base model on held-out examples that weren\'t in its spec.'],
]);
// the VideoObject description on both pages carried the same two claims
for (const f of ['index.html', 'explainer.html']) {
  const p = path.join(site, f); let s = fs.readFileSync(p, 'utf8');
  const before = s;
  s = s.split('sizes the smallest open-weight model that clears your bar').join('suggests the smallest open-weight model that should clear your bar');
  s = s.split('proves it on held-out data it never saw').join('proves it on held-out examples that weren\'t in its spec');
  if (s !== before) { fs.writeFileSync(p, s); console.log(f + ': VideoObject description fixed'); }
}
fs.copyFileSync(path.join(__dirname, 'out', 'film.mp4'), path.join(site, media('mp4')));
fs.copyFileSync(path.join(__dirname, 'out', 'film.vtt'), path.join(site, media('vtt')));
console.log('film + captions copied; embeds keyed ?v=' + ver);
