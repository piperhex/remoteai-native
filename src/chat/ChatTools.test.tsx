// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatTools } from './ChatTools';
import type { GuiToolsClient } from '../../vendor/shared/remote-chat/guiTools';

vi.mock('react-native', () => ({ Keyboard: { dismiss: vi.fn() } }));
vi.mock('./ChatToolsMenu', () => ({ ChatToolsMenu: (props: {
  opened: Record<string, boolean>; openFiles: () => void; openGit: () => void; openDesktop: () => void;
}) => <nav><button onClick={props.openFiles}>files</button><button onClick={props.openGit}>git</button>
  <button onClick={props.openDesktop}>desktop</button><output>{JSON.stringify(props.opened)}</output></nav> }));
vi.mock('./ChatTerminal', () => ({ ChatTerminal: () => null }));
vi.mock('./portMapping/PortMappings', () => ({ PortMappings: () => null }));
vi.mock('./ProjectBrowser', () => ({ ProjectBrowser: (props: {
  cwd: string; active: boolean; onClose: () => void; onHide: () => void;
}) => <RetainedView {...props} name="files" /> }));
vi.mock('./git/ChatGit', () => ({ ChatGit: (props: {
  cwd: string; active: boolean; onClose: () => void; onHide: () => void;
}) => <RetainedView {...props} name="git" /> }));
vi.mock('./desktop/RemoteDesktop', () => ({ RemoteDesktop: (props: {
  active: boolean; keepAlive: boolean; hide: () => void; close: () => void;
}) => <section data-tool="desktop" hidden={!props.active} data-alive={props.keepAlive}>
  <button onClick={props.hide}>hide</button><button onClick={props.close}>close</button></section> }));

function RetainedView(props: {
  name: string; cwd: string; active: boolean; onHide: () => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState(0);
  return <section data-tool={props.name} data-cwd={props.cwd} hidden={!props.active}>
    <button onClick={() => setDraft(value => value + 1)}>edit</button><output>{draft}</output>
    <button onClick={props.onHide}>hide</button><button onClick={props.onClose}>close</button>
  </section>;
}
vi.stubGlobal('React', React);
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await act(async () => root.unmount()); });
const click = (host: Element, label: string) => act(async () => {
  Array.from(host.querySelectorAll('button')).find(button => button.textContent === label)!.click();
});
function fixture() {
  const host = document.createElement('div');
  const root = createRoot(host); roots.push(root);
  const client = { terminal: { list: async () => [] } } as unknown as GuiToolsClient;
  return { host, render: (cwd = '/first', active = true, foreground = true) => act(async () => root.render(
    <ChatTools client={client} cwd={cwd} scope="device" connected active={active} foreground={foreground} />)) };
}

it('keeps Git and file drafts across dismiss, navigation and project switches; X releases only that project', async () => {
  const test = fixture(); await test.render();
  for (const tool of ['files', 'git']) {
    await click(test.host.querySelector('nav')!, tool);
    const first = test.host.querySelector(`[data-tool="${tool}"]`)!;
    await click(first, 'edit'); await click(first, 'hide');
    expect(first.hasAttribute('hidden')).toBe(true);
    expect(test.host.querySelector('nav output')!.textContent).toContain(`"${tool}":true`);
    await test.render('/second'); await click(test.host.querySelector('nav')!, tool);
    expect(test.host.querySelectorAll(`[data-tool="${tool}"]`)).toHaveLength(2);
    await test.render('/first', false); await test.render();
    await click(test.host.querySelector('nav')!, tool);
    expect(first.hasAttribute('hidden')).toBe(false);
    expect(first.querySelector('output')!.textContent).toBe('1');
    await click(first, 'close');
    expect(test.host.contains(first)).toBe(false);
    await test.render();
  }
});

it('keeps the desktop session mounted while hidden, navigating and backgrounded until explicit X', async () => {
  const test = fixture(); await test.render();
  await click(test.host.querySelector('nav')!, 'desktop');
  const desktop = test.host.querySelector('[data-tool="desktop"]')!;
  await click(desktop, 'hide');
  for (const [active, foreground] of [[false, true], [true, false], [true, true]]) {
    await test.render('/first', active, foreground);
    expect(test.host.contains(desktop)).toBe(true);
    expect(desktop.getAttribute('data-alive')).toBe('true');
    expect(desktop.hasAttribute('hidden')).toBe(true);
  }
  await click(test.host.querySelector('nav')!, 'desktop');
  expect(desktop.hasAttribute('hidden')).toBe(false);
  await click(desktop, 'close');
  expect(test.host.contains(desktop)).toBe(false);
  expect(test.host.querySelector('nav output')!.textContent).toContain('"desktop":false');
});
