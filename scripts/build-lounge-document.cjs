const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { webviewReactAliases } = require('./webview-react.cjs');
const { offlinePdfPlugin } = require('./offline-pdf.cjs');
const root = path.resolve(__dirname, '..');
async function build() {
  const result = await esbuild.build({ absWorkingDir: root,
    entryPoints: ['vendor/shared/lounge/nativeDocumentEntry.tsx'], bundle: true, minify: true,
    format: 'iife', platform: 'browser', target: ['chrome100', 'safari16'], write: false,
    outfile: 'lounge-document.js', jsx: 'automatic', legalComments: 'inline', plugins: [offlinePdfPlugin(root)],
    supported: { 'template-literal': false }, define: { 'process.env.NODE_ENV': '"production"' },
    alias: webviewReactAliases,
  });
  const script = result.outputFiles.find(file => file.path.endsWith('.js')).text.replace(/<\/script/gi, '<\\/script');
  const css = result.outputFiles.find(file => file.path.endsWith('.css')).text;
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval';
style-src 'unsafe-inline'; img-src data: blob:">
<style>html,body,#root{height:100%;margin:0}#root{display:flex;flex-direction:column}
:root{--panel:#fff;--ink:#24262c;--muted:#77808a;--line:#e5e8ec;--green:#159e86;--green-soft:#e6f5f0;
--pf-surface:var(--panel);--pf-subtle:#f1f3f5;--pf-border:var(--line)}
:root[data-theme=dark]{--panel:#252a30;--ink:#e8eef5;--muted:#a2acb8;--line:#414850;--pf-subtle:#1d2227}
body{font:14px system-ui;color:var(--ink);background:var(--panel)}button{font:inherit}
${css}</style></head><body><div id="root"></div><script>${script}</script></body></html>`;
  const target = path.join(root, 'assets/lounge-document.html');
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n') !== html) {
      throw new Error('Run node scripts/build-lounge-document.cjs');
    }
  } else fs.writeFileSync(target, html);
}
build().catch(error => { console.error(error); process.exitCode = 1; });
