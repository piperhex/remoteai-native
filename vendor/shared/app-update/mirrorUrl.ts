const RELEASE_PATH = new RegExp('^/piperhex/remoteai(-native)?/releases/download/'
  + '(v?\\d+\\.\\d+\\.\\d+)/([a-zA-Z0-9][a-zA-Z0-9._-]{0,199})$');

/** Derive a byte source from the configured server while keeping the official URL as the package identity. */
export function updateMirrorUrl(baseUrl: string, officialUrl: string): string | undefined {
  try {
    const source = new URL(officialUrl);
    const base = new URL(baseUrl);
    const path = RELEASE_PATH.exec(source.pathname);
    if (source.origin !== 'https://github.com' || source.search || source.hash || source.username || source.password
      || !path || base.protocol !== 'https:' || base.username || base.password) return undefined;
    const endpoint = path[1] ? 'native-update-packages' : 'update-packages';
    base.pathname = `${base.pathname.replace(/\/+$/, '')}/${endpoint}/${path[2]}/${path[3]}`;
    base.search = ''; base.hash = '';
    return base.toString();
  } catch { return undefined; }
}
