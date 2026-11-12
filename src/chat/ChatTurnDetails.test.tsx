import React, { Children, isValidElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatTurnDetails } from './ChatTurnDetails';
import type { Turn } from './types';

vi.mock('react', async original => ({ ...await original<typeof import('react')>(),
  useEffect: (effect: () => void) => effect(),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Platform: { OS: 'android' },
  StyleSheet: { create: <T,>(styles: T) => styles } }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
vi.mock('../components/BottomSheet', () => ({ BottomSheet: 'Sheet' }));
vi.mock('../components/SheetScrollView', () => ({ SheetScrollView: 'ScrollView' }));
vi.mock('./Markdown', () => ({ ChatMarkdown: 'Markdown' }));
vi.mock('./ChatDiff', () => ({ ChatDiff: 'Diff' }));
vi.mock('./SelectableChatText', () => ({ SelectableChatText: 'Text' }));
vi.mock('./review/TaskReviewPanel', () => ({ TaskReviewPanel: 'Review' }));
vi.mock('./ChatTurnSummary', () => ({ turnErrorNotice: () => 'Failure' }));

function content(node: ReactNode): string {
  return Children.toArray(node).map(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return String(child);
    if (typeof child.type === 'function') {
      return content((child.type as (props: unknown) => ReactNode)(child.props));
    }
    return content(child.props.children);
  }).join('');
}
beforeEach(() => vi.stubGlobal('React', React));
afterEach(() => vi.unstubAllGlobals());

const turn: Turn = { id: 'turn', status: 'failed', items: [
  { id: 'before', type: 'agentMessage', text: 'Before' },
  { id: 'after', type: 'agentMessage', text: 'After' },
], requestErrors: [
  { id: 'first', afterItemId: 'before', itemCount: 1, willRetry: false, error: { message: 'HTTP 502' } },
  { id: 'second', afterItemId: 'after', itemCount: 2, willRetry: false, error: { message: 'HTTP 503' } },
] };

it('opens the selected failure without substituting the latest error', () => {
  const onClose = vi.fn();
  const tree = ChatTurnDetails({ turn, panel: 'error', errorId: 'first', onClose });
  expect(content(tree)).toContain('HTTP 502');
  expect(content(tree)).not.toContain('HTTP 503');
  expect(onClose).not.toHaveBeenCalled();
});

it('closes recovered diagnostics and does not reopen them for a later failure', () => {
  const onClose = vi.fn();
  const recovered = { ...turn, status: 'inProgress', requestErrors: turn.requestErrors?.map(error =>
    error.id === 'first' ? { ...error, willRetry: true } : error) };
  expect(ChatTurnDetails({ turn: recovered, panel: 'error', errorId: 'first', onClose })).toBeNull();
  expect(onClose).toHaveBeenCalledOnce();
});
