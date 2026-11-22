// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useNativeBrowserTabs } from './useNativeBrowserTabs';
import { useMobileBrowserRenderers } from '../../vendor/shared/browser/useMobileBrowserRenderers';

const storage = vi.hoisted(() => ({ getItemSync: vi.fn(() => null), setItemSync: vi.fn() }));
vi.mock('expo-sqlite/kv-store', () => ({ default: storage }));
vi.mock('../chat/portMapping/useMappingBrowser', () => ({ mappingBrowserUrl: (url: string) => url }));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

it('mounts restored pages lazily and drops background renderers under memory pressure', () => {
  const root = createRoot(document.createElement('div'));
  let renderers!: ReturnType<typeof useMobileBrowserRenderers>;
  function Harness({ id, visible }: { id: string; visible: boolean }) {
    renderers = useMobileBrowserRenderers(id, visible); return null;
  }
  const show = (id: string, visible = true) => act(() => root.render(<Harness id={id} visible={visible} />));
  show('restored', false); expect(renderers.resident).toEqual([]);
  for (const id of ['one', 'two', 'three', 'one', 'four']) show(id);
  expect(renderers.resident).toEqual(['four', 'one', 'three']);
  act(() => renderers.releaseBackground());
  expect(renderers.resident).toEqual(['four']);
  show('four', false); act(() => renderers.releaseBackground());
  expect(renderers.resident).toEqual([]);
  show('two', false); expect(renderers.resident).toEqual([]);
  show('two'); expect(renderers.resident).toEqual(['two']);
  act(() => root.unmount());
});

it('allocates independent tabs for repeated previews and never restores conversation resources', () => {
  const root = createRoot(document.createElement('div'));
  let browser!: ReturnType<typeof useNativeBrowserTabs>;
  function Harness() { browser = useNativeBrowserTabs('owner'); return null; }
  act(() => root.render(<Harness />));
  const render = vi.fn();
  const resource = { title: 'report.pdf', url: 'file:///report.pdf', render };
  act(() => { browser.add(resource.url, resource); browser.add(resource.url, resource); });
  expect(browser.tabs).toHaveLength(3);
  expect(new Set(browser.tabs.map(tab => tab.id)).size).toBe(3);
  expect(browser.activeId).toBe(browser.tabs[2].id);
  const retained = browser.tabs[1];
  act(() => { browser.add('https://example.test'); browser.add('https://example.test'); });
  expect(browser.tabs).toHaveLength(5);
  expect(browser.tabs[1]).toBe(retained);
  expect(storage.setItemSync.mock.calls.at(-1)?.[1]).not.toContain('report.pdf');
  act(() => browser.remove(retained.id));
  expect(browser.tabs).toHaveLength(4);
  expect(browser.tabs.filter(tab => tab.resource)).toHaveLength(1);
  act(() => root.unmount());
});

it('closes every retained resource and persists only a fresh browser homepage', () => {
  const root = createRoot(document.createElement('div'));
  let browser!: ReturnType<typeof useNativeBrowserTabs>;
  function Harness() { browser = useNativeBrowserTabs('close-all'); return null; }
  act(() => root.render(<Harness />));
  const resource = { title: 'report.pdf', url: 'file:///report.pdf', render: () => null };
  act(() => { browser.add(resource.url, resource); browser.add('https://example.test'); });
  const previousIds = browser.tabs.map(tab => tab.id);
  act(() => browser.closeAll());
  expect(browser.tabs).toHaveLength(1);
  expect(browser.tabs[0]).toMatchObject({ url: '', title: '' });
  expect(previousIds).not.toContain(browser.activeId);
  expect(browser.tabs[0].resource).toBeUndefined();
  expect(JSON.parse(storage.setItemSync.mock.calls.at(-1)![1])).toEqual({
    tabs: [{ url: '', title: '', visitedAt: expect.any(Number) }], activeIndex: 0,
  });
  const homepage = browser.activeId;
  act(() => browser.remove(homepage));
  expect(browser.tabs).toHaveLength(1);
  expect(browser.tabs[0].url).toBe('');
  expect(browser.activeId).not.toBe(homepage);
  act(() => root.unmount());
});

it('bounds tab thumbnails and consumes only the matching navigation request', () => {
  const root = createRoot(document.createElement('div'));
  let browser!: ReturnType<typeof useNativeBrowserTabs>;
  function Harness() { browser = useNativeBrowserTabs('previews'); return null; }
  act(() => root.render(<Harness />));
  for (let index = 0; index < 16; index++) {
    act(() => browser.add(`https://example.test/${index}`));
    act(() => browser.setPreview(browser.activeId, 'thumbnail'));
  }
  expect(browser.tabs.filter(tab => tab.preview)).toHaveLength(12);
  expect(browser.tabs[1].preview).toBeUndefined();
  act(() => browser.setPreview(browser.activeId, 'x'.repeat(256 * 1024 + 1)));
  expect(browser.tabs.at(-1)!.preview).toBeUndefined();
  act(() => browser.visit('https://example.test/first'));
  const first = browser.tabs.at(-1)!.request!;
  act(() => browser.visit('https://example.test/second'));
  const second = browser.tabs.at(-1)!.request!;
  act(() => browser.consumeRequest(browser.activeId, first));
  expect(browser.tabs.at(-1)!.request).toBe(second);
  act(() => browser.consumeRequest(browser.activeId, second));
  expect(browser.tabs.at(-1)!.request).toBeUndefined();
  expect(browser.tabs.at(-1)!.url).toBe(second.url);
  act(() => root.unmount());
});
