// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ChatImagePreviewProvider, useChatImagePreview } from './ChatImagePreview';
import type { Turn } from '../../vendor/shared/conversation/types';

const state = vi.hoisted(() => ({ mounts: 0, unmounts: 0, dismiss: vi.fn() }));
vi.mock('react-native', () => ({ Keyboard: { dismiss: state.dismiss } }));
vi.mock('../i18n', () => ({ t: (key: string) => key }));
vi.mock('./ImageViewer', () => ({ ImageViewer: (props: {
  thumbnail?: string; description: string; load: () => Promise<string>; close: () => void;
  navigation: { previous?: () => void; next?: () => void };
}) => {
  React.useEffect(() => { state.mounts++; return () => { state.unmounts++; }; }, []);
  const [original, setOriginal] = React.useState('');
  return <section aria-label="preview">
    <img src={original || props.thumbnail} alt={props.description} />
    <button disabled={!props.navigation.previous} onClick={props.navigation.previous}>previous</button>
    <button disabled={!props.navigation.next} onClick={props.navigation.next}>next</button>
    <button onClick={() => { void props.load().then(setOriginal); }}>original</button>
    <button onClick={props.close}>close</button>
  </section>;
} }));

const sources = ['C:/images/first.png', 'C:/images/second.png', 'C:/images/third.png'];
const urls = sources.map((_, index) => `data:image/png;base64,${index}`);
const turns: Turn[] = [{ id: 'turn', status: 'completed', items: [
  { id: 'first', type: 'userMessage', content: [{ type: 'localImage', path: sources[0] }] },
  { id: 'reply', type: 'agentMessage', text: `![second](${sources[1]})\n\n![third](${sources[2]})` },
] }];
const load = vi.fn(async (_thread: string, source: string, original?: boolean) =>
  urls[sources.indexOf(source)] + (original ? '-original' : ''));

function Open() {
  const open = useChatImagePreview();
  return <button onClick={() => open({ source: sources[2], thumbnail: urls[2], description: 'third',
    options: { threadId: 'thread', ready: true, load } })}>open</button>;
}

const container = document.createElement('div');
const root = createRoot(container);
Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
afterEach(async () => {
  await act(async () => root.render(null));
  vi.clearAllMocks(); state.mounts = 0; state.unmounts = 0;
});
const button = (label: string) => [...container.querySelectorAll('button')].find(node => node.textContent === label)!;
async function click(label: string) { await act(async () => button(label).click()); }

it('pages through unmounted history, resets each image and keeps the original loader on the selected source', async () => {
  await act(async () => root.render(<ChatImagePreviewProvider turns={turns}><Open /></ChatImagePreviewProvider>));
  await click('open');
  expect(state.dismiss).toHaveBeenCalledOnce();
  expect(container.querySelector('img')?.getAttribute('src')).toBe(urls[2]);
  expect(button('next').disabled).toBe(true);
  await click('previous');
  expect(container.querySelector('img')?.getAttribute('src')).toBe(urls[1]);
  expect(button('previous').disabled).toBe(false);
  expect(button('next').disabled).toBe(false);
  await click('original');
  expect(load).toHaveBeenLastCalledWith('thread', sources[1], true, undefined);
  expect(container.querySelector('img')?.getAttribute('src')).toBe(`${urls[1]}-original`);
  await click('previous');
  expect(container.querySelector('img')?.getAttribute('src')).toBe(urls[0]);
  expect(button('previous').disabled).toBe(true);
  await click('next');
  expect(container.querySelector('img')?.getAttribute('src')).toBe(urls[1]);
  expect(state.mounts).toBe(4);
  expect(state.unmounts).toBe(3);
  await click('close');
  expect(container.querySelector('section')).toBeNull();
});

it('disables both arrows for a single image and hides the modal when the conversation is inactive', async () => {
  await act(async () => root.render(<ChatImagePreviewProvider><Open /></ChatImagePreviewProvider>));
  await click('open');
  expect(button('previous').disabled).toBe(true);
  expect(button('next').disabled).toBe(true);
  await act(async () => root.render(<ChatImagePreviewProvider active={false}><Open /></ChatImagePreviewProvider>));
  expect(container.querySelector('section')).toBeNull();
});
