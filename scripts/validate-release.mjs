import assert from 'node:assert/strict';
import fs from 'node:fs';
import { nativeVersion } from './release-version.mjs';

const tag = process.env.RELEASE_TAG;
assert.ok(tag?.startsWith('v'), 'RELEASE_TAG must name an existing v-prefixed version tag.');
const expected = nativeVersion(tag);
for (const file of ['package.json', 'package-lock.json']) {
  const metadata = JSON.parse(fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  assert.equal(metadata.version, expected.version, `${file} version differs from the tag`);
}
const { expo } = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
assert.equal(expo.version, expected.version, 'Expo version differs from the tag');
assert.equal(expo.android.versionCode, expected.versionCode, 'Android version code differs from the tag');
console.log(`Validated ${tag} (Android ${expected.versionCode})`);
