export const PAGE_DOWNLOAD_PREFIX = 'remoteai:page-download:';
export const PAGE_DOWNLOAD_CHUNK_BYTES = 192 * 1024;
const ACKNOWLEDGEMENT_TIMEOUT_MS = 30_000;

export const isPageDownloadUrl = (url: string) => /^(?:blob:|data:)/i.test(url);

// Start reading in the click's stack. Export buttons often revoke their object URL immediately afterward.
export const PAGE_DOWNLOAD_SCRIPT = `
(() => {
  if (window.__remoteAiPageDownload) return;
  const prefix = ${JSON.stringify(PAGE_DOWNLOAD_PREFIX)};
  const chunkSize = ${PAGE_DOWNLOAD_CHUNK_BYTES};
  const pending = new Map();
  const objects = new Map();
  const { createObjectURL, revokeObjectURL } = URL;
  URL.createObjectURL = (object) => {
    const url = createObjectURL.call(URL, object);
    if (object instanceof Blob) objects.set(url, object);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    objects.delete(String(url));
    revokeObjectURL.call(URL, url);
  };
  const pageId = Math.random().toString(36).slice(2);
  let nextId = 0;
  const send = (message) => window.ReactNativeWebView.postMessage(prefix + JSON.stringify(message));
  const request = (message) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(message.id);
      reject(new Error('Download acknowledgement timed out'));
    }, ${ACKNOWLEDGEMENT_TIMEOUT_MS});
    pending.set(message.id, (ok) => {
      clearTimeout(timer);
      if (ok) resolve(); else reject(new Error('Download rejected'));
    });
    send(message);
  });
  const encode = (chunk) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(chunk);
  });
  const readData = (url) => {
    const source = url.split('#', 1)[0];
    const comma = source.indexOf(',');
    if (comma < 0) throw new Error('Invalid data URL');
    const header = source.slice(5, comma);
    const encoded = /;\\s*base64\\s*$/i;
    const type = header.replace(encoded, '') || 'text/plain;charset=US-ASCII';
    const body = source.slice(comma + 1);
    if (encoded.test(header)) {
      return new Blob([Uint8Array.from(atob(decodeURIComponent(body)), value => value.charCodeAt(0))], { type });
    }
    const bytes = new TextEncoder().encode(body);
    const hex = (byte) => byte >= 48 && byte <= 57 ? byte - 48 : (byte | 32) >= 97 && (byte | 32) <= 102
      ? (byte | 32) - 87 : -1;
    let end = 0;
    for (let index = 0; index < bytes.length; index++) {
      const high = hex(bytes[index + 1]), low = hex(bytes[index + 2]);
      if (bytes[index] === 37 && high >= 0 && low >= 0) {
        bytes[end++] = (high << 4) | low;
        index += 2;
      } else bytes[end++] = bytes[index];
    }
    return new Blob([bytes.subarray(0, end)], { type });
  };
  const read = async (url) => {
    if (objects.has(url)) return objects.get(url);
    if (/^data:/i.test(url)) return readData(url);
    if (!/^blob:/i.test(url)) throw new Error('Invalid browser export URL');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Download unavailable');
    return response.blob();
  };
  const start = async (url, name) => {
    const id = pageId + '-' + (++nextId);
    try {
      const blob = await read(url);
      await request({ action: 'start', id, name, mimeType: blob.type, size: blob.size });
      for (let offset = 0; offset < blob.size; offset += chunkSize) {
        const data = await encode(blob.slice(offset, offset + chunkSize));
        await request({ action: 'write', id, offset, data });
      }
      await request({ action: 'finish', id });
    } catch {
      send({ action: 'abort', id });
    }
  };
  window.__remoteAiPageDownload = {
    start,
    acknowledge(id, ok) {
      const callback = pending.get(id);
      pending.delete(id);
      callback?.(ok);
    },
  };
  const handleClick = (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.('a[download][href]');
    if (!anchor || !/^(?:blob:|data:)/i.test(anchor.href) || !window.ReactNativeWebView) return;
    event.preventDefault();
    void start(anchor.href, anchor.download);
  };
  window.addEventListener('click', handleClick);
  const anchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    // A detached anchor's click does not propagate to the document.
    if (this.isConnected) return anchorClick.call(this);
    this.addEventListener('click', handleClick);
    try { return anchorClick.call(this); }
    finally { this.removeEventListener('click', handleClick); }
  };
})();
true;
`;
