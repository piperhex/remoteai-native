/** Preserve the Android version code ordering used by existing Remote AI installations. */
export function nativeVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([A-Za-z][A-Za-z0-9-]*)\.(\d+))?$/.exec(value);
  if (!match) throw new Error('Use a version such as 2.2.1 or 2.2.1-beta.0.');
  const [major, minor, patch] = match.slice(1, 4).map(Number);
  const sequence = match[4] ? Number(match[5]) : 99;
  if (major > 209 || minor > 99 || patch > 999 || sequence > (match[4] ? 98 : 99)) {
    throw new Error('Version exceeds the supported Android version code range.');
  }
  const version = `${major}.${minor}.${patch}` + (match[4] ? `-${match[4]}.${sequence}` : '');
  return { version, tag: `v${version}`, versionCode: major * 10_000_000 + minor * 100_000 + patch * 100 + sequence };
}
