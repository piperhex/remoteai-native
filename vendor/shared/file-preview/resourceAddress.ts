export function fileResourceUrl(path: string) {
  const normalized = path.replace(/\\/g, '/');
  const encoded = normalized.split('/').map(encodeURIComponent).join('/').replace(/^([a-z])%3A/i, '$1:');
  return `file://${normalized.startsWith('/') ? '' : '/'}${encoded}`;
}
