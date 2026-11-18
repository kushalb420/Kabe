// Developer tool: turns the letters of the app's fonts into drawing paths (src/lib/glyphData.ts).
// Why: when the route card is saved as a picture on a phone, the picture maker cannot use the fonts the app loads while running,
// so the text came out in another font. Drawn as shapes, the letters are always exactly the app's fonts.
// Run: node scripts/gen-glyphs.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const FONTS = {
  value: 'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf',
  label: 'node_modules/@expo-google-fonts/dm-sans/500Medium/DMSans_500Medium.ttf',
  brand: 'node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf',
};
const CHARS = [];
for (let c = 32; c <= 126; c++) CHARS.push(String.fromCharCode(c));
CHARS.push('·', '–');

function parse(file) {
  const b = fs.readFileSync(path.join(root, file));
  const u16 = (o) => b.readUInt16BE(o), i16 = (o) => b.readInt16BE(o), u32 = (o) => b.readUInt32BE(o);
  const tables = {};
  for (let i = 0; i < u16(4); i++) { const o = 12 + i * 16; tables[b.toString('latin1', o, o + 4)] = { off: u32(o + 8), len: u32(o + 12) }; }
  const head = tables.head.off, upm = u16(head + 18), locFmt = i16(head + 50);
  const nGlyphs = u16(tables.maxp.off + 4);
  const nHM = u16(tables.hhea.off + 34);
  const hmtx = tables.hmtx.off;
  const adv = (g) => u16(hmtx + 4 * Math.min(g, nHM - 1));
  const loca = (g) => (locFmt === 0 ? u16(tables.loca.off + 2 * g) * 2 : u32(tables.loca.off + 4 * g));
  // cmap format 4
  const cm = tables.cmap.off; let sub = null;
  for (let i = 0; i < u16(cm + 2); i++) { const pid = u16(cm + 4 + i * 8), eid = u16(cm + 6 + i * 8), off = u32(cm + 8 + i * 8); if (pid === 3 && eid === 1) sub = cm + off; }
  if (!sub || u16(sub) !== 4) throw new Error('no format 4 cmap in ' + file);
  const segX2 = u16(sub + 6), endO = sub + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
  const glyphOf = (code) => {
    for (let s = 0; s < segX2 / 2; s++) {
      if (code <= u16(endO + 2 * s)) {
        const start = u16(startO + 2 * s); if (code < start) return 0;
        const ro = u16(rangeO + 2 * s), delta = i16(deltaO + 2 * s);
        if (ro === 0) return (code + delta) & 0xffff;
        const g = u16(rangeO + 2 * s + ro + 2 * (code - start)); return g === 0 ? 0 : (g + delta) & 0xffff;
      }
    }
    return 0;
  };
  const glyf = tables.glyf.off;
  const outline = (g) => {
    const o = glyf + loca(g), end = glyf + loca(g + 1);
    if (end === o) return [];
    const nc = i16(o);
    if (nc < 0) {
      // a glyph built from other glyphs (for example a letter with a dot): move each part into place
      const all = []; let q = o + 10, fl;
      do {
        fl = u16(q); const gi = u16(q + 2); q += 4;
        let dx, dy;
        if (fl & 1) { dx = i16(q); dy = i16(q + 2); q += 4; } else { dx = b.readInt8(q); dy = b.readInt8(q + 1); q += 2; }
        if (fl & 8) q += 2; else if (fl & 0x40) q += 4; else if (fl & 0x80) q += 8;
        for (const c of outline(gi)) all.push(c.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })));
      } while (fl & 0x20);
      return all;
    }
    const ends = []; for (let i = 0; i < nc; i++) ends.push(u16(o + 10 + 2 * i));
    const np = ends[nc - 1] + 1, il = u16(o + 10 + 2 * nc);
    let p = o + 12 + 2 * nc + il;
    const flags = [];
    while (flags.length < np) { const f = b[p++]; flags.push(f); if (f & 8) { let r = b[p++]; while (r--) flags.push(f); } }
    const coords = (short, same) => { const out = []; let v = 0; for (let i = 0; i < np; i++) { const f = flags[i]; if (f & short) { const d = b[p++]; v += f & same ? d : -d; } else if (!(f & same)) { v += i16(p); p += 2; } out.push(v); } return out; };
    const xs = coords(2, 16), ys = coords(4, 32);
    const contours = []; let s = 0;
    for (const e of ends) { const pts = []; for (let i = s; i <= e; i++) pts.push({ x: xs[i], y: ys[i], on: !!(flags[i] & 1) }); contours.push(pts); s = e + 1; }
    return contours;
  };
  const f1 = (n) => String(Math.round(n * 10) / 10);
  const pathOf = (contours) => contours.map((pts) => {
    // rotate to start on an on-curve point (add a midpoint when there is none)
    let list = pts.slice();
    let k = list.findIndex((q) => q.on);
    if (k < 0) { const m = { x: (list[0].x + list[list.length - 1].x) / 2, y: (list[0].y + list[list.length - 1].y) / 2, on: true }; list = [m, ...list]; k = 0; }
    list = [...list.slice(k), ...list.slice(0, k)];
    let d = `M${f1(list[0].x)} ${f1(list[0].y)}`;
    let i = 1;
    const at = (n) => list[n % list.length];
    while (i <= list.length) {
      const cur = at(i);
      if (cur.on) { if (i < list.length) d += `L${f1(cur.x)} ${f1(cur.y)}`; i++; }
      else {
        const nxt = at(i + 1);
        if (nxt.on) { d += `Q${f1(cur.x)} ${f1(cur.y)} ${f1(nxt.x)} ${f1(nxt.y)}`; i += 2; }
        else { const mx = (cur.x + nxt.x) / 2, my = (cur.y + nxt.y) / 2; d += `Q${f1(cur.x)} ${f1(cur.y)} ${f1(mx)} ${f1(my)}`; i++; }
      }
    }
    return d + 'Z';
  }).join('');
  return { upm, glyphOf, adv, outline, pathOf };
}

const cache = {};
let out = '// Generated by scripts/gen-glyphs.js from the app fonts (Space Grotesk Bold and DM Sans Medium). Do not edit by hand.\n';
out += 'export type Glyph = { adv: number; d: string };\nexport type GlyphFont = { upm: number; glyphs: Record<string, Glyph> };\n\nexport const GLYPHS: Record<string, GlyphFont> = {\n';
for (const [name, file] of Object.entries(FONTS)) {
  const f = (cache[file] ||= parse(file));
  out += `  ${name}: {\n    upm: ${f.upm},\n    glyphs: {\n`;
  for (const ch of CHARS) {
    const g = f.glyphOf(ch.charCodeAt(0));
    if (!g && ch !== ' ') continue;
    out += `      ${JSON.stringify(ch)}: { adv: ${f.adv(g)}, d: ${JSON.stringify(g ? f.pathOf(f.outline(g)) : '')} },\n`;
  }
  out += '    },\n  },\n';
}
out += '};\n';
fs.writeFileSync(path.join(root, 'src/lib/glyphData.ts'), out);
console.log('written', out.length, 'bytes');
