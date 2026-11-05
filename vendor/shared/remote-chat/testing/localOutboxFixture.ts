import { ChatController } from '../client/controller';
import type { ConnectionEvents } from '../client/connection';
import type { Thread } from '../client/types';
import { QUEUE_EVENT, type QueueSnapshot } from '../queue';

/** Deliberately held acknowledgements exercise the production composer and controller on every host. */
export function createLocalOutboxFixture() {
  const thread: Thread = { id: 'outbox-chat', name: '消息发送', cwd: '/workspace/remoteai', preview: '', updatedAt: 1,
    turns: [{ id: 'active-turn', status: 'inProgress', items: [
      { id: 'question', type: 'userMessage', text: '请检查消息发送流程。' },
      { id: 'answer', type: 'agentMessage', text: '正在检查项目。' },
    ] }] };
  let events: ConnectionEvents;
  let sequence = 0;
  let queue: QueueSnapshot = { revision: 0, threads: {} };
  const pending: { body: Record<string, unknown>; resolve: (value: unknown) => void;
    reject: (error: Error) => void }[] = [];
  const controller = new ChatController(value => {
    events = value;
    return { start: () => { events.mode('relay'); events.ready(); }, stop: () => {},
      request: async <T>(method: string, input?: unknown): Promise<T> => {
        const body = input as Record<string, unknown> | undefined;
        if (method === 'connect') return [] as T;
        if (body?.operation === 'models') return { data: [{ id: 'gpt-test', model: 'gpt-test',
          displayName: 'GPT-6', isDefault: true, defaultReasoningEffort: 'high',
          supportedReasoningEfforts: [{ reasoningEffort: 'high', description: '' }] }] } as T;
        if (body?.operation === 'syncHistory') throw new Error('当前手机端暂不支持此操作。');
        if (body?.operation === 'read') return { thread } as T;
        if (body?.operation === 'queueRead') return queue as T;
        if (body && ['queueEnqueue', 'send', 'start'].includes(String(body.operation))) {
          return new Promise<T>((resolve, reject) => pending.push({ body, resolve: value => resolve(value as T), reject }));
        }
        return { data: [], nextCursor: null } as T;
      } };
  });
  const start = async () => {
    controller.start();
    if (!controller.snapshot().ready) await new Promise<void>(resolve => {
      const unsubscribe = controller.subscribe(() => {
        if (controller.snapshot().ready) { unsubscribe(); resolve(); }
      });
    });
    await controller.select(thread);
  };
  const accept = () => {
    const request = pending.shift();
    if (!request) return;
    if (request.body.operation === 'start') { request.resolve({ thread }); return; }
    const id = `accepted-${++sequence}`;
    queue = { revision: queue.revision + 1, threads: { [thread.id]: [...(queue.threads[thread.id] ?? []), {
      id, clientId: String(request.body.clientId), text: String(request.body.text),
      imageCount: 0, attachmentCount: 0, busy: false,
    }] } };
    events.event({ method: QUEUE_EVENT, params: queue });
    request.resolve({ ...queue, enqueuedId: id });
  };
  return { controller, start, accept, pending: () => pending.length,
    fail: () => pending.shift()?.reject(new Error('电脑暂未确认结果，请刷新对话后再试，避免重复发送。')) };
}
