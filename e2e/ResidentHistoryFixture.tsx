import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { ChatMessages } from '../src/chat/ChatMessages';
import { NativeDetailContext } from '../src/chat/ChatDeferredDetails';
import { ChatQuotesProvider } from '../src/chat/ChatQuotes';
import { ChatController } from '../vendor/shared/remote-chat/client/controller';
import { residentHistory } from '../vendor/shared/remote-chat/client/residentHistory';
import { historyDelta, type HistoryVersion } from '../vendor/shared/remote-chat/historySync';
import type { Item, Thread } from '../src/chat/types';

const thread: Thread = { id: 'budget', cwd: '', preview: '', updatedAt: 1 };
const responseText = 'The inspection is complete. All records are available in this response.\n';
const body = (): Item => ({ id: 'reply', type: 'agentMessage', phase: 'final_answer',
  text: 'Inspection results\n\n' + responseText.repeat(17_000) });
const withItem = (item: Item): Thread => ({ ...thread, turns: [{ id: 'turn', status: 'completed', items: [item] }] });

function createController() {
  const latest = residentHistory(withItem(body())).thread;
  const earlier = withItem({ id: 'previous', type: 'agentMessage', text: 'Earlier inspection report' });
  return new ChatController(events => ({
    start: () => { events.mode('direct'); events.ready(); },
    stop() {},
    request: async <T,>(method: string, value?: unknown) => {
      const request = value as { operation?: string; known?: HistoryVersion; window?: { older?: boolean } };
      if (method === 'connect') return [] as T;
      if (request.operation === 'historyItem') return { item: body() } as T;
      if (request.operation !== 'syncHistory') return { data: [], nextCursor: null } as T;
      const older = request.window?.older;
      const page = older ? earlier : latest;
      return { ...historyDelta(page, request.known), page: { hasMore: !older, hasNewer: older,
        start: { turnId: 'turn', itemId: older ? 'previous' : 'reply' } } } as T;
    },
  }));
}

export function ResidentHistoryFixture() {
  const controller = useMemo(createController, []);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  useEffect(() => { controller.start(); return () => controller.stop(); }, [controller]);
  useEffect(() => { if (state.ready) void controller.select(thread); }, [controller, state.ready]);
  return <ChatQuotesProvider scope="resident-history" active enabled>
    <NativeDetailContext.Provider value={controller}>
      <ChatMessages thread={state.olderView?.thread ?? state.selected} active loading={state.historyLoading}
        loadingMore={state.historyLoadingMore} hasMore={state.olderView?.page.hasMore ?? state.historyHasMore}
        loadOlder={() => controller.loadOlder()} historyLoad={state.historyLoad}
        showLatest={state.olderView && controller.showLatest} />
    </NativeDetailContext.Provider>
  </ChatQuotesProvider>;
}
