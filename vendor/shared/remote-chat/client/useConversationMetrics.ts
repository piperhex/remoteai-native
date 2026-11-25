import { useMemo, useSyncExternalStore } from 'react';
import { CONVERSATION_METRICS_REFRESH_MS, type ConversationMetrics, type ReadConversationMetrics }
  from '../conversationMetrics';

type Listener = (value: ConversationMetrics | null) => void;
interface Poll {
  listeners: Set<Listener>;
  value: ConversationMetrics | null;
  timer?: ReturnType<typeof setInterval>;
  pending: boolean;
}

// The composer, settings and running list can all observe the same thread on the same host.
const hosts = new WeakMap<ReadConversationMetrics, Map<string, Poll>>();

function observe(read: ReadConversationMetrics, id: string, listener: Listener) {
  const polls = hosts.get(read) ?? new Map<string, Poll>();
  hosts.set(read, polls);
  const poll: Poll = polls.get(id) ?? { listeners: new Set(), value: null, pending: false };
  polls.set(id, poll);
  const refresh = async () => {
    if (poll.pending) return;
    poll.pending = true;
    try { poll.value = await read(id); }
    catch { poll.value = null; }
    finally { poll.pending = false; }
    if (!poll.listeners.size) { polls.delete(id); return; }
    for (const notify of poll.listeners) notify(poll.value);
  };
  poll.listeners.add(listener);
  listener(poll.value);
  if (!poll.timer) {
    poll.timer = setInterval(() => void refresh(), CONVERSATION_METRICS_REFRESH_MS);
    void refresh();
  }
  return () => {
    poll.listeners.delete(listener);
    // React replaces subscriptions when list membership changes. Keep retained threads' timers and samples.
    queueMicrotask(() => {
      if (poll.listeners.size) return;
      clearInterval(poll.timer);
      poll.timer = undefined;
      poll.value = null;
      if (!poll.pending && polls.get(id) === poll) polls.delete(id);
    });
  };
}

function metricsSelection(read: ReadConversationMetrics | undefined, ids: string[]) {
  let values = new Map<string, ConversationMetrics>();
  const polls = read && hosts.get(read);
  for (const id of ids) {
    const value = polls?.get(id)?.value;
    if (value) values.set(id, value);
  }
  return {
    snapshot: () => values,
    subscribe(notify: () => void) {
      if (!read) return () => {};
      const stops = ids.map(id => observe(read, id, value => {
        if ((values.get(id) ?? null) === value) return;
        values = new Map(values);
        if (value) values.set(id, value);
        else values.delete(id);
        notify();
      }));
      return () => stops.forEach(stop => stop());
    },
  };
}

export function useConversationMetricsForThreads(read: ReadConversationMetrics | undefined, threadIds: string[]) {
  const key = JSON.stringify([...new Set(threadIds)].sort());
  const selection = useMemo(() => metricsSelection(read, JSON.parse(key)), [read, key]);
  return useSyncExternalStore(selection.subscribe, selection.snapshot);
}

export function useConversationMetrics(read: ReadConversationMetrics | undefined, threadId: string | null, active: boolean) {
  const values = useConversationMetricsForThreads(read, active && threadId ? [threadId] : []);
  return threadId ? values.get(threadId) ?? null : null;
}
