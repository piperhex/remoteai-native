const fs = require('node:fs');
const path = require('node:path');

// Both embedded readers use local PDF fonts and worker code, without a public viewer or network upload.
exports.offlinePdfPlugin = root => ({
  name: 'offline-pdf',
  setup(build) {
    const pdfRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
    build.onResolve({ filter: /pdf\.worker\.min\.mjs\?url$/ }, () => ({ path: 'worker', namespace: 'offline-pdf' }));
    build.onResolve({ filter: /\/pdfAssets$|^\.\/pdfAssets$/ }, () => ({ path: 'assets', namespace: 'offline-pdf' }));
    build.onLoad({ filter: /.*/, namespace: 'offline-pdf' }, args => {
      if (args.path === 'worker') return { resolveDir: root, contents:
        `import { WorkerMessageHandler } from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
        globalThis.pdfjsWorker = { WorkerMessageHandler }; export default 'offline-pdf-worker';` };
      const assets = {};
      for (const dir of ['cmaps', 'standard_fonts', 'wasm']) {
        for (const name of fs.readdirSync(path.join(pdfRoot, dir)).sort()) {
          if (!/\.(bcmap|pfb|ttf|wasm)$/.test(name)) continue;
          assets[name] = fs.readFileSync(path.join(pdfRoot, dir, name)).toString('base64');
        }
      }
      return { contents: `const assets = ${JSON.stringify(assets)};
        function read(name) { if (!assets[name]) throw Error('Missing PDF asset');
          return Uint8Array.from(atob(assets[name]), c => c.charCodeAt(0)); }
        export class PdfCMapReader { async fetch({name}) {
          return {cMapData: read(name + '.bcmap'), isCompressed: true}; } }
        export class PdfAssetReader { async fetch({filename}) { return read(filename); } }` };
    });
  },
});
