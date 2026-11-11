// @vitest-environment jsdom
import React, { act, useSyncExternalStore } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CliController } from '../../../vendor/shared/cli-gui/controller';
import { createCliFixture } from '../../../scripts/fixtures/cli-gui';
import { CliMessageInput } from './CliMessageInput';

const input = vi.hoisted(() => ({ value: undefined as string | undefined, hint: '',
  change: (_text: string) => {}, setNativeProps: vi.fn() }));
vi.mock('../ComposerInput', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return { ComposerInput: forwardRef(function MockInput({ value, displayValue, onChangeText }: {
    value?: string; displayValue: string; onChangeText: (text: string) => void;
  }, ref) {
    input.value = value; input.hint = displayValue; input.change = onChangeText;
    useImperativeHandle(ref, () => ({ setNativeProps: input.setNativeProps }));
    return null;
  }) };
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
  input.setNativeProps.mockClear();
  controller = new CliController(createCliFixture().transport, () => 'native');
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); vi.unstubAllGlobals(); });

it('keeps rapid native typing intact while updating the sendable draft immediately', () => {
  for (const text of ['C', 'Check', 'Check project']) act(() => {
    input.change(text);
    expect(controller.getSnapshot().draft).toBe(text);
  });
  expect(input.value).toBeUndefined();
  expect(input.hint).toBe('Check project');
  expect(input.setNativeProps).not.toHaveBeenCalled();
});

it('writes restored drafts and clearing to the native field without rewriting unchanged input', () => {
  act(() => input.change('Typed'));
  act(() => controller.edit('Restored draft'));
  expect(input.setNativeProps).toHaveBeenLastCalledWith({ text: 'Restored draft' });
  act(() => controller.patch({ busy: true }));
  expect(input.setNativeProps).toHaveBeenCalledTimes(1);
  act(() => controller.edit(''));
  expect(input.setNativeProps).toHaveBeenLastCalledWith({ text: '' });
  expect(input.hint).toBe('');
});
