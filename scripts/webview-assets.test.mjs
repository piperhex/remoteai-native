import { readFileSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { expect, it, vi } from 'vitest';

// These integration tests parse complete production documents, including the offline PDF assets.
const DOCUMENT_TEST_TIMEOUT = 15_000;

function openDocument(name) {
  const errors = [];
  const messages = [];
  const console = new VirtualConsole();
  console.on('jsdomError', error => {
    // jsdom does not support all of the editor's CSS; this test exercises its JS runtime.
    if (error.type !== 'css parsing') errors.push(error.message);
  });
  const html = readFileSync(new URL(`../assets/${name}.html`, import.meta.url), 'utf8');
  const dom = new JSDOM(html, { url: 'https://webview.test', runScripts: 'dangerously',
    pretendToBeVisual: true, virtualConsole: console, beforeParse(window) {
      window.ReactNativeWebView = { postMessage: message => messages.push(message) };
      window.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} };
      window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
      window.TextEncoder = TextEncoder;
      window.TextDecoder = TextDecoder;
      window.DOMMatrix = class {};
      window.Range.prototype.getClientRects = () => [];
      window.Range.prototype.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0 });
    } });
  return { dom, errors, messages };
}

it('renders the packaged file browser, handles directory replies and acknowledges close', async () => {
  const { dom, errors, messages } = openDocument('project-browser');
  try {
    const receive = dom.window.projectBrowserMessage;
    expect(messages.map(JSON.parse)).toContainEqual({ type: 'ready' });
    receive({ type: 'settings', cwd: 'C:/project', language: 'zh', connected: true,
      autoSaveDelay: 0, theme: {}, labels: {}, capabilities: {} });
    await vi.waitFor(() => {
      expect(errors).toEqual([]);
      expect(dom.window.document.querySelector('.pf-browser')).not.toBeNull();
      expect(messages.map(JSON.parse).some(message => message.action === 'list')).toBe(true);
    });
    const request = messages.map(JSON.parse).find(message => message.action === 'list');
    receive({ type: 'reply', id: request.id, data: { directory: 'C:/project', parent: null,
      entries: [{ name: 'src', path: 'C:/project/src', directory: true }], truncated: false } });
    await vi.waitFor(() => expect(dom.window.document.querySelector('.pf-browser')?.textContent).toContain('src'));
    receive({ type: 'close' });
    await vi.waitFor(() => expect(messages.map(JSON.parse).some(message => message.type === 'closed')).toBe(true));
    expect(errors).toEqual([]);
  } finally { dom.window.close(); }
}, DOCUMENT_TEST_TIMEOUT);

it('renders packaged JSON attachments with the same React instance as their icons and renderer', async () => {
  const { dom, errors, messages } = openDocument('lounge-document');
  try {
    expect(messages).toContain('ready');
    dom.window.loungeDocument({ name: 'example.json', mime: 'application/json', language: 'zh', dark: false,
      base64: Buffer.from('{"status":"ok"}').toString('base64') });
    await vi.waitFor(() => {
      expect(errors).toEqual([]);
      expect(dom.window.document.querySelector('.json-file-preview svg')).not.toBeNull();
    });
    await vi.waitFor(() => expect(dom.window.document.querySelector('.cm-content')?.textContent).toContain('status'));
    expect(errors).toEqual([]);
  } finally { dom.window.close(); }
}, DOCUMENT_TEST_TIMEOUT);
