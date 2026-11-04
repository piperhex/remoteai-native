import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const vendor = path.join(root, 'vendor');
const manifest = JSON.parse(fs.readFileSync(path.join(vendor, 'source-lock.json'), 'utf8'));
assert.match(manifest.revision, /^[a-f0-9]{40}$/);
assert.match(manifest.sharedSource.revision, /^[a-f0-9]{40}$/);
assert.equal(manifest.sharedSource.repository, 'https://github.com/piperhex/remoteai-shared.git');
for (const [file, expected] of Object.entries(manifest.files)) {
  const absolute = path.resolve(vendor, file);
  assert.ok(absolute.startsWith(vendor + path.sep), `Invalid dependency path: ${file}`);
  const bytes = fs.readFileSync(absolute);
  const contents = bytes.includes(0) ? bytes : bytes.toString('utf8').replaceAll('\r\n', '\n');
  assert.equal(createHash('sha256').update(contents).digest('hex'), expected, `Modified dependency: ${file}`);
}
const app = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.equal(app.dependencies['@remoteai/i18n'], manifest.i18n);
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
for (const [location, entry] of Object.entries(lock.packages)) {
  assert.ok(!location.startsWith('../'), `Dependency outside this repository: ${location}`);
  for (const version of Object.values({ ...entry.dependencies, ...entry.devDependencies })) {
    if (!version.startsWith('file:')) continue;
    const target = path.resolve(root, location, version.slice('file:'.length));
    assert.ok(target.startsWith(root), `Local dependency outside this repository: ${version}`);
  }
}
console.log(`Verified ${Object.keys(manifest.files).length} pinned dependency files`);
