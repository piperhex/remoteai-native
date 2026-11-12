import React, { Children, isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatRequestError } from './ChatRequestError';
import { visibleTurnRequestErrors } from '../../vendor/shared/conversation/turnRequestErrors';
import type { Turn } from './types';
import { MODEL_CAPACITY_MESSAGE } from '../../vendor/shared/conversation/requestError';
import { t } from '../i18n';

const reviewContext = vi.hoisted(() => ({ value: {} as object | null }));
vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useMemo: <T,>(compute: () => T) => compute(),
  useContext: () => reviewContext.value,
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ Pressable: 'Pressable', Text: 'Text', View: 'View',
  Platform: { OS: 'android' },
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('./ChatImage', () => ({ ChatImage: 'Image' }));

interface Props { children?: ReactNode; accessibilityLabel?: string; onPress?: () => void; disabled?: boolean }
function descendants(node: ReactNode): { type: unknown; props: Props }[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<Props>(child)) return [];
    if (typeof child.type === 'function') {
      return descendants((child.type as (props: Props) => ReactNode)(child.props));
    }
    return [child, ...descendants(child.props.children)];
  });
}
function content(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (!isValidElement<Props>(child)) return String(child);
    if (typeof child.type === 'function') return content((child.type as (props: Props) => ReactNode)(child.props));
    return content(child.props.children);
  }).join('');
}
beforeEach(() => { vi.stubGlobal('React', React); reviewContext.value = {}; });
afterEach(() => vi.unstubAllGlobals());

const turn: Turn = { id: 'turn', status: 'inProgress', items: [
  { id: 'edit', type: 'fileChange', status: 'completed', changes: [
    { path: 'src/example.ts', kind: { type: 'update' }, diff: '@@ -1 +1 @@\n-before\n+after\n' },
  ] },
  { id: 'command', type: 'commandExecution', status: 'inProgress', command: 'npm test' },
] };

function renderNotice({ turn, onOpen }: { turn: Turn; onOpen: () => void }) {
  const record = visibleTurnRequestErrors(turn).at(-1);
  if (!record) throw new Error('Expected a visible request error');
  return ChatRequestError({ turn, record, onOpen });
}

it('shows retry after the error notice and continues when pressed', () => {
  const retry = vi.fn();
  reviewContext.value = { turnId: 'turn', disabled: false, pending: false, retry };
  const tree = renderNotice({ turn: { ...turn, status: 'failed' }, onOpen: vi.fn() });
  expect(content(tree)).toContain('本次回复遇到问题，已中断。查看报错详情重试');
  const button = descendants(tree).find(node => node.type === 'Pressable' && content(node.props.children) === '重试');
  expect(button?.props.disabled).toBe(false);
  button?.props.onPress?.();
  expect(retry).toHaveBeenCalledOnce();
});

it('only offers manual retry for the latest terminal failure in a turn', () => {
  reviewContext.value = { turnId: 'turn', disabled: false, pending: false, retry: vi.fn() };
  const first = { id: 'first', afterItemId: 'edit', itemCount: 1, willRetry: false,
    error: { message: 'HTTP 502' } };
  const last = { ...first, id: 'last', afterItemId: 'command', itemCount: 2, error: { message: 'HTTP 503' } };
  const failed = { ...turn, status: 'failed', requestErrors: [first, last] };
  const onOpen = vi.fn();
  const old = ChatRequestError({ turn: failed, record: first, onOpen });
  expect(content(old)).not.toContain(t('client.terminal.retry'));
  descendants(old).find(node => node.props.accessibilityLabel === t('client.chat.viewErrorDetails'))?.props.onPress?.();
  expect(onOpen).toHaveBeenCalledOnce();
  expect(content(ChatRequestError({ turn: failed, record: last, onOpen }))).toContain(t('client.terminal.retry'));
});

it('disables retry while pending and omits it from older errors', () => {
  reviewContext.value = { turnId: 'turn', disabled: true, pending: true, retry: vi.fn() };
  const failed = { ...turn, status: 'failed' };
  const tree = renderNotice({ turn: failed, onOpen: vi.fn() });
  const button = descendants(tree).find(node => node.type === 'Pressable' && content(node.props.children) === '正在重试…');
  expect(button?.props.disabled).toBe(true);
  expect(content(renderNotice({ turn: { ...failed, id: 'old' }, onOpen: vi.fn() }))).not.toContain('正在重试…');
});

it.each([
  { error: { message: MODEL_CAPACITY_MESSAGE } },
  { error: { message: 'Request failed', additionalDetails: MODEL_CAPACITY_MESSAGE } },
  { error: null, retryError: { message: MODEL_CAPACITY_MESSAGE } },
])('shows capacity failures directly and keeps the retry action (%j)', error => {
  const retry = vi.fn();
  const onOpen = vi.fn();
  reviewContext.value = { turnId: 'turn', disabled: false, pending: false, retry };
  const tree = renderNotice({ turn: { ...turn, status: 'failed', ...error }, onOpen });
  expect(content(tree)).toContain(t('client.chat.modelAtCapacity'));
  expect(content(tree)).not.toContain('本次回复遇到问题，已中断。');
  expect(content(tree)).not.toContain('查看报错详情');
  const button = descendants(tree).find(node => node.type === 'Pressable' && content(node.props.children) === '重试');
  expect(button?.props.disabled).toBe(false);
  button?.props.onPress?.();
  expect(retry).toHaveBeenCalledOnce();
  expect(onOpen).not.toHaveBeenCalled();
});

it('shows retrying capacity errors and preserves older failures without a retry button', () => {
  reviewContext.value = { turnId: 'turn', disabled: true, pending: true, retry: vi.fn() };
  const capacityTurn = { ...turn, error: null, retryError: { message: MODEL_CAPACITY_MESSAGE } };
  const tree = renderNotice({ turn: capacityTurn, onOpen: vi.fn() });
  expect(content(tree)).toContain(t('client.chat.modelAtCapacity'));
  const button = descendants(tree).find(node => node.type === 'Pressable' && content(node.props.children) === '正在重试…');
  expect(button).toBeUndefined();
  const previous = renderNotice({ turn: { ...capacityTurn, id: 'old', status: 'failed' }, onOpen: vi.fn() });
  expect(content(previous)).toContain(t('client.chat.modelAtCapacity'));
  expect(content(previous)).not.toContain('正在重试…');
});
