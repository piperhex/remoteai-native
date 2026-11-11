export const RECOVERY_EVENT = 'recovery/changed';

export interface RecoveryEntry { threadId: string; turnId: string; observedAt: number }
export interface RecoveryCandidate { entry: RecoveryEntry; title: string }
export interface RecoverySnapshot { batchId: string; candidates: RecoveryCandidate[] }
export interface RecoveryResult { failed: { threadId: string; title: string }[] }
export type RecoveryRequest = { operation: 'recoveryList' }
  | { operation: 'recoveryDecide'; batchId: string; action: 'resume' | 'dismiss'; entries: RecoveryEntry[] };
export interface RecoveryClient {
  read(): Promise<RecoverySnapshot>;
  decide(snapshot: RecoverySnapshot, action: 'resume' | 'dismiss'): Promise<RecoveryResult>;
  subscribe(listener: (event: { method: string; params: { threadId?: string } }) => void):
    (() => void) | Promise<() => void>;
}

export function createRecoveryClient(request: <T>(body: RecoveryRequest) => Promise<T>,
  subscribe: RecoveryClient['subscribe']): RecoveryClient {
  return {
    read: () => request({ operation: 'recoveryList' }),
    decide: (snapshot, action) => request({ operation: 'recoveryDecide', batchId: snapshot.batchId,
      action, entries: snapshot.candidates.map(candidate => candidate.entry) }),
    subscribe,
  };
}
