// mux-mp4.cjs — a minimal, standard, non-fragmented MP4 muxer for one H.264 video track + one AAC-LC
// audio track. moov is written before mdat ("faststart") and the tracks are interleaved in ~1 s chunks, so a
// browser can begin playback and seek using range requests. No dependencies.
//
//   mux({ width, height, fps, video: [{data, key}], avcC, sampleRate, channels, audio: [Buffer], asc }) → Buffer
const u8 = (n) => Buffer.from([n & 255]);
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16BE(n >>> 0); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };
const str = (s) => Buffer.from(s, 'latin1');
const box = (type, ...parts) => { const body = Buffer.concat(parts.flat()); return Buffer.concat([u32(8 + body.length), str(type), body]); };
const full = (type, version, flags, ...parts) => box(type, Buffer.from([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...parts);
const MATRIX = Buffer.concat([0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].map(u32));

function desc(tag, payload) {           // MPEG-4 descriptor with a single-byte length (all ours are < 128 bytes)
  if (payload.length > 127) throw new Error('descriptor too long for short form');
  return Buffer.concat([u8(tag), u8(payload.length), payload]);
}
function esds(asc, avgBitrate) {
  const dsi = desc(0x05, asc);
  const dcd = desc(0x04, Buffer.concat([u8(0x40), u8((0x05 << 2) | 1), Buffer.from([0, 0, 0]), u32(avgBitrate), u32(avgBitrate), dsi]));
  const sl = desc(0x06, Buffer.from([0x02]));
  return full('esds', 0, 0, desc(0x03, Buffer.concat([u16(0), u8(0), dcd, sl])));
}
function stscRuns(counts) {             // [samplesPerChunk per chunk] → compressed (first_chunk, samples_per_chunk, 1) entries
  const out = []; counts.forEach((c, i) => { if (!out.length || out[out.length - 1][1] !== c) out.push([i + 1, c]); });
  return full('stsc', 0, 0, u32(out.length), ...out.map(([f, c]) => Buffer.concat([u32(f), u32(c), u32(1)])));
}

function mux(o) {
  const { width, height, fps, video, avcC, sampleRate, channels, audio, asc } = o;
  const vUnits = video.reduce((a, s, i) => a + (i + 1 < video.length ? Math.max(1, Math.round((video[i + 1].ts - s.ts) * fps / 1e6)) : 1), 0), vDur = vUnits / fps, aSamples = audio.length * 1024, aDur = aSamples / sampleRate;
  const durMs = Math.round(Math.max(vDur, aDur) * 1000);
  // interleave: one chunk of video then one of audio per second of media
  const chunks = []; let vi = 0, ai = 0;
  for (let sec = 0; vi < video.length || ai < audio.length; sec++) {
    const vEnd = Math.min(video.length, Math.round((sec + 1) * fps)), aEnd = Math.min(audio.length, Math.round((sec + 1) * sampleRate / 1024));
    if (vEnd > vi) { chunks.push({ track: 'v', from: vi, to: vEnd }); vi = vEnd; }
    if (aEnd > ai) { chunks.push({ track: 'a', from: ai, to: aEnd }); ai = aEnd; }
  }
  const vChunks = chunks.filter(c => c.track === 'v'), aChunks = chunks.filter(c => c.track === 'a');

  const build = (offsets) => {
    const vOff = [], aOff = []; chunks.forEach((c, i) => (c.track === 'v' ? vOff : aOff).push(offsets[i]));
    const keys = []; video.forEach((s, i) => { if (s.key) keys.push(i + 1); });
    const vstbl = box('stbl',
      full('stsd', 0, 0, u32(1), box('avc1', Buffer.alloc(6), u16(1), u16(0), u16(0), Buffer.alloc(12), u16(width), u16(height),
        u32(0x00480000), u32(0x00480000), u32(0), u16(1), Buffer.alloc(32), u16(0x0018), Buffer.from([0xff, 0xff]), box('avcC', avcC))),
      (() => { const d = video.map((s, i) => i + 1 < video.length ? Math.max(1, Math.round((video[i + 1].ts - s.ts) * fps / 1e6)) : 1); const runs = []; d.forEach(x => { if (runs.length && runs[runs.length - 1][1] === x) runs[runs.length - 1][0]++; else runs.push([1, x]); }); return full('stts', 0, 0, u32(runs.length), ...runs.map(([c, x]) => Buffer.concat([u32(c), u32(x)]))); })(),
      full('stss', 0, 0, u32(keys.length), ...keys.map(u32)),
      stscRuns(vChunks.map(c => c.to - c.from)),
      full('stsz', 0, 0, u32(0), u32(video.length), ...video.map(s => u32(s.data.length))),
      full('stco', 0, 0, u32(vOff.length), ...vOff.map(u32)));
    const astbl = box('stbl',
      full('stsd', 0, 0, u32(1), box('mp4a', Buffer.alloc(6), u16(1), Buffer.alloc(8), u16(channels), u16(16), u16(0), u16(0), u32(sampleRate * 65536), esds(asc, 128000))),
      full('stts', 0, 0, u32(1), u32(audio.length), u32(1024)),
      stscRuns(aChunks.map(c => c.to - c.from)),
      full('stsz', 0, 0, u32(0), u32(audio.length), ...audio.map(s => u32(s.length))),
      full('stco', 0, 0, u32(aOff.length), ...aOff.map(u32)));
    const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    const lang = u16(0x55c4); // 'und'
    const vtrak = box('trak',
      full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(Math.round(vDur * 1000)), Buffer.alloc(8), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(width * 65536), u32(height * 65536)),
      box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(fps), u32(vUnits), lang, u16(0)),
        full('hdlr', 0, 0, u32(0), str('vide'), Buffer.alloc(12), str('VideoHandler\0')),
        box('minf', full('vmhd', 0, 1, Buffer.alloc(8)), dinf, vstbl)));
    const atrak = box('trak',
      full('tkhd', 0, 3, u32(0), u32(0), u32(2), u32(0), u32(Math.round(aDur * 1000)), Buffer.alloc(8), u16(0), u16(1), u16(0x0100), u16(0), MATRIX, u32(0), u32(0)),
      box('mdia', full('mdhd', 0, 0, u32(0), u32(0), u32(sampleRate), u32(aSamples), lang, u16(0)),
        full('hdlr', 0, 0, u32(0), str('soun'), Buffer.alloc(12), str('SoundHandler\0')),
        box('minf', full('smhd', 0, 0, u16(0), u16(0)), dinf, astbl)));
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(durMs), u32(0x00010000), u16(0x0100), Buffer.alloc(10), MATRIX, Buffer.alloc(24), u32(3));
    return box('moov', mvhd, vtrak, atrak);
  };

  const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
  const payloads = chunks.map(c => Buffer.concat(c.track === 'v' ? video.slice(c.from, c.to).map(s => s.data) : audio.slice(c.from, c.to)));
  const moovSize = build(chunks.map(() => 0)).length;               // offsets are fixed-width, so size is known
  let p = ftyp.length + moovSize + 8; const offsets = payloads.map(b => { const o = p; p += b.length; return o; });
  const moov = build(offsets);
  if (moov.length !== moovSize) throw new Error('moov size changed between passes');
  const mdatBody = Buffer.concat(payloads);
  return { file: Buffer.concat([ftyp, moov, u32(8 + mdatBody.length), str('mdat'), mdatBody]), durMs, vDur, aDur, chunks: chunks.length };
}
module.exports = { mux };
