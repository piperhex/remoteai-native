import type { ChatState } from './client/types';

const THREAD_PREPARING = '对话正在准备，请稍后重试。';

/** A conversation's brief preparation state does not need an error notice. */
export function visibleChatError(error: string, connection?: Pick<ChatState, 'mode' | 'relayIssue'>) {
  if (error && error !== THREAD_PREPARING) return error;
  // Relay availability cannot invalidate a working direct path or replace an operation failure.
  if (!connection?.relayIssue || connection.mode === 'direct' || connection.mode === 'relay') return '';
  return connection.relayIssue === 'quota'
    ? 'client.runtimeErrors.thisMonthSRelayTrafficLimitHasBeenReachedUse'
    : 'client.runtimeErrors.serverRelayIsTemporarilyUnavailableTryAgainLaterOrUse';
}
