// Builds the web version of Kabe into ./dist, ready to put on a free static host (GitHub Pages, Netlify, Cloudflare Pages).
//   node scripts/build-web.js
// The Gemini key from .env is blanked for this build so it can never end up in a public file (the app reaches the AI through
// Kabe's own server instead). Also writes: 404.html (so any address opens the app), .nojekyll (GitHub Pages must not skip the
// _expo folder) and privacy.html (the privacy policy as a public page).
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
execSync('npx expo export --platform web', { cwd: root, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_GEMINI_KEY: '' } });

// the tags that let a phone add the site to its home screen like an app (this export mode ignores a custom page wrapper)
const head = [
  '<meta name="description" content="A free fitness and nutrition app: log meals from a photo or your voice, get meal ideas from your own kitchen, and keep going with friends." />',
  '<meta name="theme-color" content="#FDE186" />',
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-title" content="Kabe" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
  '<link rel="manifest" href="/manifest.webmanifest" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
].join('\n    ');
const indexFile = path.join(dist, 'index.html');
let html = fs.readFileSync(indexFile, 'utf8');
html = html.replace('shrink-to-fit=no"', 'shrink-to-fit=no, viewport-fit=cover"').replace('</head>', '    ' + head + '\n  </head>');
fs.writeFileSync(indexFile, html);

// every address opens the app (GitHub Pages serves 404.html for unknown paths)
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

// a small Markdown to HTML step for the policy (headings, paragraphs, bullet lists, **bold**)
const inline = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
const out = [];
let list = false;
for (const line of fs.readFileSync(path.join(root, 'docs/PRIVACY_POLICY.md'), 'utf8').replace(/\r\n/g, '\n').split('\n')) {
  const li = line.match(/^- (.*)/);
  if (list && !li) { out.push('</ul>'); list = false; }
  if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); }
  else if (line.startsWith('## ')) out.push(`<h2>${inline(line.slice(3))}</h2>`);
  else if (line.startsWith('# ')) out.push(`<h1>${inline(line.slice(2))}</h1>`);
  else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
}
if (list) out.push('</ul>');
fs.writeFileSync(path.join(dist, 'privacy.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Kabe privacy policy</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:680px;margin:0 auto;padding:24px 18px;background:#FDE186;color:#111}main{background:#fff;border:3px solid #111;border-radius:20px;padding:20px 22px}h1{margin-top:0}h2{margin-top:1.4em}a{color:#111}</style></head>
<body><main>
${out.join('\n')}
</main></body></html>
`);
console.log('web build ready in', dist);
