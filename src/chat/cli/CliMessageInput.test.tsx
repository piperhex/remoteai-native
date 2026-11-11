// @vitest-environment jsdom
import React, { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CliController } from '../../../vendor/shared/cli-gui/controller';
import { createCliFixture } from '../../../scripts/fixtures/cli-gui';
import { CliMessageInput } from './CliMessageInput';

const input = vi.hoisted(() => ({ value: '', change: (_text: string) => {} }));
vi.mock('../ComposerInput', () => {
  return { ComposerInput: function MockInput({ value, onChangeText }: {
    value: string; onChangeText: (text: string) => void;
  }) {
    input.value = value; input.change = onChangeText;
    return null;
  } };
});
let root: Root;
let controller: CliController;
function Harness() {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  return <CliMessageInput compact={false} value={state.draft} onChangeText={controller.edit} />;
}
beforeEach(() => {
  vi.stubGlobal('React', React);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  controller = new CliController(createCliFixture().transport, () => 'native');
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); vi.unstubAllGlobals(); });

it('publishes rapid typing after TextInput records its native event and retains the latest text', async () => {
  await act(async () => {
    for (const text of ['C', 'Check', 'Check project']) input.change(text);
    expect(controller.getSnapshot().draft).toBe('');
  });
  expect(controller.getSnapshot().draft).toBe('Check project');
  expect(input.value).toBe('Check project');
});

it('keeps the actual input value synchronized for restore, clear and subsequent typing', async () => {
  await act(async () => input.change('Typed'));
  act(() => controller.edit('Restored draft'));
  expect(input.value).toBe('Restored draft');
  act(() => controller.patch({ busy: true }));
  expect(input.value).toBe('Restored draft');
  act(() => controller.edit(''));
  expect(input.value).toBe('');
  await act(async () => input.change('Follow-up'));
  expect(controller.getSnapshot().draft).toBe('Follow-up');
  expect(input.value).toBe('Follow-up');
});

it('does not publish a queued edit after its conversation input unmounts', async () => {
  await act(async () => {
    input.change('Previous conversation');
    root.unmount();
  });
  expect(controller.getSnapshot().draft).toBe('');
});
