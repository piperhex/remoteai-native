import fs from 'node:fs';
import { nativeVersion } from './release-version.mjs';

const next = nativeVersion(process.argv[2] ?? '');
for (const file of ['package.json', 'package-lock.json', 'app.json']) {
  const url = new URL(`../${file}`, import.meta.url);
  const metadata = JSON.parse(fs.readFileSync(url, 'utf8'));
  if (file === 'app.json') {
    metadata.expo.version = next.version;
    metadata.expo.android.versionCode = next.versionCode;
  } else {
    metadata.version = next.version;
    if (metadata.packages?.['']) metadata.packages[''].version = next.version;
  }
  fs.writeFileSync(url, JSON.stringify(metadata, null, 2) + '\n');
}
console.log(`Prepared ${next.tag}. Run the checks, commit, then push the annotated tag to release.`);
