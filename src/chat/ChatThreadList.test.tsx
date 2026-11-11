import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatThreadList } from './ChatThreadList';
import { initialChatState, type ChatState, type Thread } from './types';
import type { ChatController } from './controller';

const hooks = vi.hoisted(() => ({ states: [] as unknown[], slot: 0 }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useEffect: vi.fn(), useContext: () => null,
  useMemo: <T,>(compute: () => T) => compute(),
  useState: <T,>(initial: () => T) => {
    const slot = hooks.slot++;
    if (!(slot in hooks.states)) hooks.states[slot] = initial();
    return [hooks.states[slot], (update: (previous: T) => T) => {
      hooks.states[slot] = update(hooks.states[slot] as T);
    }];
  },

  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ Pressable: 'Pressable', SectionList: 'SectionList', Text: 'Text',
  View: 'View', ActivityIndicator: 'Spinner', Platform: { OS: 'android' },
  StyleSheet: { create: <T,>(value: T) => value } }));
vi.mock('@expo/vector-icons/Feather', () => ({ default: 'Icon' }));
vi.mock('../../vendor/shared/chat/groups/context', () => ({ useGrouping: () => null }));
vi.mock('./groups/GroupChoice', () => ({ NativeGroupIcon: 'GroupIcon' }));
vi.mock('./useThreadListScroll', () => ({ useThreadListScroll: () => ({}) }));
beforeEach(() => { hooks.states = []; hooks.slot = 0; vi.stubGlobal('React', React); });
afterEach(() => vi.unstubAllGlobals());

function render(state: ChatState) {
  hooks.slot = 0;
  return ChatThreadList({ state, controller: {} as ChatController, select: vi.fn(), newChat: vi.fn(),
    openActions: vi.fn(), openProjectActions: vi.fn(), bottomInset: 0 }).props;
}
const ids = (group: { data: Thread[] }) => group.data.map(thread => thread.id);

it('shows pull-to-refresh progress only for an explicit refresh', () => {
  const state = { ...initialChatState(), ready: true, loading: true };
  expect(render(state).refreshing).toBe(false);
  expect(render({ ...state, listRefreshing: true }).refreshing).toBe(true);
  expect(render({ ...state, loading: false, listRefreshing: false }).refreshing).toBe(false);
});

it('opens the same conversation actions for long press, right-click and accessibility', () => {
  const thread: Thread = { id: 'cli:claude:history', name: 'CLI history', preview: '', cwd: '', updatedAt: 1 };
  const state = { ...initialChatState(), ready: true, threads: [thread] };
  const openActions = vi.fn();
  const select = vi.fn();
  const list = ChatThreadList({ state, controller: {} as ChatController, select, newChat: vi.fn(),
    openActions, openProjectActions: vi.fn(), bottomInset: 0 }).props;
  const row = list.renderItem({ item: thread, section: list.sections[0] }).props;
  row.onPointerDown({ nativeEvent: { button: 0 } });
  expect(openActions).not.toHaveBeenCalled();
  row.onLongPress();
  row.onPointerDown({ nativeEvent: { button: 2 } });
  row.onAccessibilityAction({ nativeEvent: { actionName: 'longpress' } });
  expect(openActions.mock.calls).toEqual([[thread], [thread], [thread]]);
  expect(select).not.toHaveBeenCalled();
});

it('opens project actions by long press or accessibility without collapsing the folder', () => {
  const state = { ...initialChatState(), ready: true, threads: [
    { id: 'chat', name: '项目对话', preview: '', cwd: '/project', updatedAt: 1 },
  ] };
  const openProjectActions = vi.fn();
  const list = ChatThreadList({ state, controller: {} as ChatController, select: vi.fn(), newChat: vi.fn(),
    openActions: vi.fn(), openProjectActions, bottomInset: 0 });
  const section = list.props.sections[0];
  const heading = list.props.renderSectionHeader({ section }).props.children[0];
  heading.props.onLongPress();
  expect(openProjectActions).toHaveBeenCalledWith(section);
  expect(render(state).sections[0].collapsed).toBe(false);
  heading.props.onAccessibilityAction({ nativeEvent: { actionName: 'longpress' } });
  expect(openProjectActions).toHaveBeenCalledTimes(2);
  heading.props.onPress();
  expect(render(state).sections[0].collapsed).toBe(true);
  const recent = list.props.renderSectionHeader({ section: { ...section, cwd: '' } }).props.children[0];
  expect(recent.props.onLongPress).toBeUndefined();
  expect(recent.props.accessibilityActions).toBeUndefined();
});

it.each(['/project', ''])('moves running native rows to the front of %j and restores their positions', (cwd) => {
  const state = { ...initialChatState(), ready: true, threads: Array.from({ length: 7 }, (_, index) => ({
    id: `chat-${index}`, name: `聊天 ${index}`, preview: '', updatedAt: 7 - index, cwd,
  })) };
  expect(ids(render(state).sections[0])).toEqual(['chat-0', 'chat-1', 'chat-2', 'chat-3', 'chat-4']);
  state.sidebar = { ...state.sidebar, revision: 1, threads: {
    'chat-5': { cwd, title: '聊天 5', projectName: '', running: true },
    'chat-6': { cwd, title: '聊天 6', projectName: '', running: true },
  } };
  const active = render(state);
  expect(ids(active.sections[0])).toEqual(['chat-5', 'chat-6', 'chat-0', 'chat-1', 'chat-2']);
  active.renderSectionFooter({ section: active.sections[0] }).props.onPress();
  expect(ids(render(state).sections[0])).toEqual(['chat-5', 'chat-6', 'chat-0', 'chat-1', 'chat-2', 'chat-3', 'chat-4']);
  state.sidebar = { ...state.sidebar, revision: 2, threads: Object.fromEntries(
    Object.entries(state.sidebar.threads).map(([id, value]) => [id, { ...value, running: false }]),
  ) };
  expect(ids(render(state).sections[0])).toEqual(state.threads.map(thread => thread.id));
});

it('sorts unsorted native rows by activity before folding, with running rows ahead of pins', () => {
  const threads: Thread[] = [1, 7, 3, 5, 6, 2, 4].map((updatedAt, index) => ({
    id: `chat-${index}`, cwd: '/project', preview: '', updatedAt,
  }));
  const state = { ...initialChatState(), ready: true, threads, sidebar: {
    revision: 1, threads: {}, readState: {}, pins: ['chat-2'],
  } };
  state.threads[0] = { ...threads[0], status: { type: 'active' } };
  expect(ids(render(state).sections[0])).toEqual(['chat-0', 'chat-2', 'chat-1', 'chat-4', 'chat-3']);
  state.threads = threads.map(thread => thread.id === 'chat-0'
    ? { ...thread, updatedAt: 8, status: { type: 'idle' } } : thread);
  expect(ids(render(state).sections[0])).toEqual(['chat-2', 'chat-0', 'chat-1', 'chat-4', 'chat-3']);
  expect(threads.map(thread => thread.updatedAt)).toEqual([1, 7, 3, 5, 6, 2, 4]);
});

it('sorts a native custom group after combining conversations from multiple projects', () => {
  const state = { ...initialChatState(), ready: true, threads: [
    { id: 'old', cwd: '/first', preview: '', updatedAt: 1 },
    { id: 'latest', cwd: '/second', preview: '', updatedAt: 9 },
    { id: 'running', cwd: '/first', preview: '', updatedAt: 2, status: { type: 'active' } },
  ] };
  state.sidebar.grouping = { groups: [{ id: 'custom', name: 'Custom', parentId: null }], projects: {},
    threads: { old: 'custom', latest: 'custom', running: 'custom' } };
  expect(ids(render(state).sections[0])).toEqual(['running', 'latest', 'old']);
});
