import type { ChatController } from './controller';
import type { ChatState } from './types';
import type { QueueAction, QueueMessage, QueueDraft } from '../queue';
import { currentRunningTurn } from '../../chat/runningTurn';

export interface QueueProps {
  messages: QueueMessage[];
  running: boolean;
  disabled: boolean;
  act: (operation: QueueAction, id?: string) => Promise<void>;
  take: (id: string) => Promise<QueueDraft | undefined>;
}

export function queueProps(state: ChatState, controller: ChatController): QueueProps {
  return {
    messages: queueMessages(state),
    running: Boolean(currentRunningTurn(state.selected?.turns)),
    disabled: !state.ready || state.queueBusy,
    act: (operation, id) => controller.queueAction(operation, id),
    take: (id) => controller.takeQueuedMessage(id),
  };
}

function queueMessages(state: ChatState) {
  const remote = state.queue.threads[state.selected?.id ?? ''] ?? [];
  const local = state.localQueue?.[state.draftScope ?? state.selected?.id ?? ''] ?? [];
  // Queue broadcasts can precede the enqueue response. Correlate by ID, never by message text.
  const pending = new Set(local.map(message => message.id));
  return [...remote.filter(message => !message.clientId || !pending.has(message.clientId)), ...local];
}
