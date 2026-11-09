// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useComposerMenu } from './useComposerMenu';

type Draft = Parameters<typeof useComposerMenu>[0]['draft'];
let root: Root;
let menu: ReturnType<typeof useComposerMenu>;
const removeText = vi.fn();
const refresh = vi.fn();
const draft = { text: '', removeText, insertSkill: vi.fn() } as unknown as Draft;
function Harness() {
  menu = useComposerMenu({ draft, scope: 'thread:/project', active: true, refresh,
    compact: async () => true });
  return null;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  draft.text = '';
  removeText.mockClear(); refresh.mockClear();
  root = createRoot(document.createElement('div'));
  act(() => root.render(<Harness />));
});
afterEach(() => { act(() => root.unmount()); vi.unstubAllGlobals(); });
function type(text: string, caret = text.length) {
  draft.text = text;
  act(() => menu.setSelection({ start: caret, end: caret }));
}

it('routes ! queries to SSH without loading commands, then consumes only the trigger at the caret', () => {
  type('Inspect !dev afterwards', 12);
  expect(menu).toMatchObject({ open: true, ssh: true, files: false, conversations: false, query: 'dev' });
  expect(refresh).not.toHaveBeenCalled();
  act(() => menu.consumeTrigger());
  expect(removeText).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ start: 8, end: 12 }),
    'Inspect !dev afterwards');
  expect(menu.selection).toEqual({ start: 8, end: 8 });
  expect(menu.open).toBe(false);
});

it('dismisses SSH suggestions and reopens them when the query changes', () => {
  type('!'); act(() => menu.close());
  expect(menu.open).toBe(false);
  type('!prod'); expect(menu).toMatchObject({ open: true, ssh: true, query: 'prod' });
  expect(refresh).not.toHaveBeenCalled();
});

it('keeps an explicit plugin picker separate from an SSH trigger', () => {
  type('!dev');
  act(() => menu.openPlugins());
  expect(menu).toMatchObject({ open: true, ssh: false, plugins: true, query: '' });
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => menu.consumeTrigger());
  expect(removeText).not.toHaveBeenCalled();
});

it('preserves ordinary commands, file and conversation menus', () => {
  type('/compact'); expect(menu).toMatchObject({ ssh: false, query: 'compact', open: true });
  expect(refresh).toHaveBeenCalledTimes(1);
  type('%file'); expect(menu).toMatchObject({ ssh: false, files: true, open: true });
  type('@thread'); expect(menu).toMatchObject({ ssh: false, conversations: true, open: true });
  expect(refresh).toHaveBeenCalledTimes(1);
});
