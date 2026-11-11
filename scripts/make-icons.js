// Draws Kabe's icon set (a bold K on a hard-shadow card) into assets/. Run: node scripts/make-icons.js
// Needs `sharp` (a dev dependency). Colours: yellow #FFE17C, charcoal #171E19, white, black.
const sharp = require('sharp');
const path = require('node:path');

const Y = '#FFE17C';
// a K made of a stem and two thick strokes, clipped flat at the top and bottom
const k = (fill) => `<defs><clipPath id="kc"><rect x="330" y="300" width="440" height="424"/></clipPath></defs>
  <g clip-path="url(#kc)"><rect x="350" y="300" width="120" height="424" fill="${fill}"/>
  <line x1="440" y1="560" x2="760" y2="250" stroke="${fill}" stroke-width="140"/>
  <line x1="440" y1="500" x2="770" y2="780" stroke="${fill}" stroke-width="140"/></g>`;

// the full card: used for the store icon and the splash
const card = (withBg) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${withBg ? `<rect width="1024" height="1024" fill="${Y}"/>` : ''}
  <rect x="236" y="236" width="600" height="600" rx="56" fill="#000"/>
  <rect x="196" y="196" width="600" height="600" rx="56" fill="#fff" stroke="#000" stroke-width="22"/>
  <g transform="translate(-64 -16)">${k('#000')}</g>
</svg>`;

// the Android adaptive icon keeps everything inside the centre 66% (the rest can be cropped by the phone)
const adaptive = (mono) => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(0.62) translate(-512 -512)">
    ${mono ? '' : `<rect x="236" y="236" width="600" height="600" rx="56" fill="#000"/><rect x="196" y="196" width="600" height="600" rx="56" fill="#fff" stroke="#000" stroke-width="22"/>`}
    <g transform="translate(-64 -16)">${k(mono ? '#000' : '#000')}</g>
  </g>
</svg>`;

const out = (name) => path.join(__dirname, '..', 'assets', name);
const png = (svg, file, size = 1024) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(out(file));

(async () => {
  await png(card(true), 'icon.png');
  await png(adaptive(false), 'android-icon-foreground.png');
  await png(adaptive(true), 'android-icon-monochrome.png');
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: Y } }).png().toFile(out('android-icon-background.png'));
  await png(card(false), 'splash-icon.png');
  await png(card(true), 'favicon.png', 96);
  console.log('icons written');
})();
