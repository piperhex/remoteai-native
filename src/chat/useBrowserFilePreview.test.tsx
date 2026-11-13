// @vitest-environment jsdom
import React, { act, createContext } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { useBrowserFilePreview } from './useBrowserFilePreview';
import { NativeBrowserContext } from '../browser/context';
import type { ChatFileOptions } from './ChatFilePreview';
import type { NativeBrowserResource } from '../browser/browserTabs';

const preview = vi.hoisted(() => vi.fn((_props: unknown) => null));
vi.mock('./ChatFilePreview', () => ({ ChatFileContext: createContext(null), FilePreviewContent: preview }));
vi.mock('./ChatImage', () => ({ ChatImageContext: createContext(null) }));
vi.stubGlobal('React', React);
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

it('creates a new scoped resource on each click and updates retained connection readiness', () => {
  const root = createRoot(document.createElement('div'));
  const resources: NativeBrowserResource[] = [];
  const browser = { open: vi.fn(), openTab: vi.fn(), close: vi.fn(), visible: false, hasBottomNavigation: false,
    openResource: (resource: NativeBrowserResource) => { resources.push(resource); } };
  const options: ChatFileOptions = { threadId: 'original', ready: true, load: vi.fn(),
    files: { open: vi.fn(), read: vi.fn(), close: vi.fn() }, videos: { open: vi.fn(), read: vi.fn(), close: vi.fn() } };
  let open!: ReturnType<typeof useBrowserFilePreview>;
  function Harness({ ready }: { ready: boolean }) { open = useBrowserFilePreview({ ...options, ready }); return null; }
  const render = (ready: boolean) => act(() => root.render(
    <NativeBrowserContext.Provider value={browser}><Harness ready={ready} /></NativeBrowserContext.Provider>));
  render(true);
  act(() => { open?.({ path: 'C:/report.md', line: 4 }); open?.({ path: 'C:/report.md', line: 4 }); });
  expect(resources).toHaveLength(2);
  expect(resources[0]).not.toBe(resources[1]);
  expect(resources[0].url).toBe('file:///C:/report.md');
  const page = createRoot(document.createElement('div'));
  act(() => page.render(resources[0].render({ active: true, close: vi.fn() })));
  expect(preview.mock.calls.at(-1)?.[0]).toMatchObject({ threadId: 'original', ready: true,
    file: { path: 'C:/report.md', line: 4 }, embedded: true, active: true });
  render(false);
  expect(preview.mock.calls.at(-1)?.[0]).toMatchObject({ threadId: 'original', ready: false });
  act(() => page.unmount());
  act(() => root.unmount());
});
