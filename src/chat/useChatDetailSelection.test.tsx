// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useChatDetailSelection, type ChatDetailSelection } from './useChatDetailSelection';

const dismiss = vi.hoisted(() => vi.fn());
vi.mock('react-native', () => ({ Keyboard: { dismiss } }));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
const container = document.createElement('div');
let root = createRoot(container);
let state: ReturnType<typeof useChatDetailSelection>;
function Harness({ active }: { active: boolean }) {
  state = useChatDetailSelection(active);
  return null;
}
const render = (active: boolean) => act(() => root.render(<Harness active={active} />));
afterEach(() => {
  act(() => root.unmount());
  root = createRoot(container);
  vi.clearAllMocks();
});

it.each<ChatDetailSelection>([
  { type: 'item', id: 'command' }, { type: 'work', id: 'process' },
  { type: 'activities', id: 'commands' }, { type: 'turn', id: 'turn', panel: 'changes' },
])('discards $type details when a retained page becomes inactive', selection => {
  render(true);
  act(() => state.open(selection));
  expect(state.selection).toEqual(selection);
  expect(dismiss).toHaveBeenCalledOnce();
  render(false);
  expect(state.selection).toBeNull();
  render(true);
  expect(state.selection).toBeNull();
  act(() => state.open(selection));
  expect(state.selection).toEqual(selection);
  act(() => state.close());
  render(false);
  render(true);
  expect(state.selection).toBeNull();
});

it('ignores a delayed press callback from the page that just became inactive', () => {
  render(true);
  const queuedPress = state.open;
  render(false);
  act(() => queuedPress({ type: 'item', id: 'old-command' }));
  render(true);
  expect(state.selection).toBeNull();
  expect(dismiss).not.toHaveBeenCalled();
});
