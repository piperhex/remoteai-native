import type { GuiEvent } from './types';

/** Mirrors the native boundary for remote sessions and consumers sharing a host WebView. */
export function visibleConversationEvent(event: GuiEvent, selected: string | null): GuiEvent | undefined {
  const id = event.params.threadId ?? event.params.thread?.id;
  if (event.id != null || !id || id === selected) return event;
  const { method, params } = event;
  if ((method.startsWith('item/') && !['item/started', 'item/completed'].includes(method))
    || ['turn/diff/updated', 'turn/plan/updated'].includes(method)) return;
  return { ...event, params: { ...params,
    ...(params.item ? { item: { id: params.item.id, type: params.item.type, status: params.item.status,
      exitCode: params.item.exitCode } } : {}),
    ...(params.turn ? { turn: { ...params.turn, items: [], diff: undefined, plan: undefined,
      planExplanation: undefined } } : {}),
    ...(params.thread ? { thread: { ...params.thread, turns: undefined } } : {}),
  } };
}
