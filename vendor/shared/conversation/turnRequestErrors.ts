import type { RequestError } from "./requestError";
import type { Item, Turn } from "./types";
import { hasVisibleProcessContent } from '../chat/processContent';

export interface TurnRequestError {
  id: string;
  afterItemId: string | null;
  itemCount: number;
  error?: RequestError;
  willRetry: boolean;
  anchorOutputLength?: number;
  recovered?: boolean;
}

function streamedOutputLength(item?: Item) {
  if (!item || item.type === 'userMessage' || item.type === 'modelChange') return;
  if (item.type === 'reasoning') {
    return [...(item.summary ?? []), ...(item.content ?? [])].reduce<number>((length, part) =>
      length + (typeof part === 'string' ? part.trimEnd().length : 0), 0);
  }
  if (item.type === 'agentMessage' || item.type === 'plan') return item.text?.trimEnd().length ?? 0;
  if (item.type === 'commandExecution' || item.type === 'fileChange') {
    return item.aggregatedOutput?.trimEnd().length ?? 0;
  }
}

function errorAtEnd(turn: Turn, error: RequestError | undefined, willRetry: boolean): TurnRequestError {
  const anchor = turn.items.at(-1);
  const length = willRetry ? streamedOutputLength(anchor) : undefined;
  const records = turn.requestErrors ?? [];
  const lastIndex = Number(records.at(-1)?.id.split(':').at(-1));
  const index = Number.isSafeInteger(lastIndex) ? Math.max(records.length, lastIndex + 1) : records.length;
  return { id: `${turn.id}:error:${index}`,
    afterItemId: anchor?.id ?? null, itemCount: turn.items.length, error, willRetry,
    ...(length !== undefined && { anchorOutputLength: length }) };
}

/** Anchor notices when the event arrives, before subsequent items can extend the turn. */
export function recordRequestError(turn: Turn, error: RequestError, willRetry: boolean): Turn {
  const records = turn.requestErrors ?? [];
  const next = errorAtEnd(turn, error, willRetry);
  const last = records.at(-1);
  const samePosition = last && requestErrorPosition(turn, last) === next.itemCount;
  const newRetry = last?.willRetry && willRetry && !isRequestErrorVisible(turn, last);
  const requestErrors = samePosition && !newRetry
    ? [...records.slice(0, -1), { ...next, id: last.id }]
    : [...records, next];
  return { ...turn, requestErrors, ...(willRetry ? { retryError: error, error: null } : { error }) };
}

function restoredRecords(turn: Turn, previous?: Turn) {
  const records = turn.requestErrors ?? previous?.requestErrors;
  if (turn.status !== 'inProgress' || turn.error) return records;
  const last = records?.at(-1);
  // Older hosts cached only retryError or the anchor ID. Capture its position before the next chunk is applied.
  if (!last && turn.retryError) {
    const anchor = previous?.retryError?.message === turn.retryError.message ? previous : turn;
    return [errorAtEnd(anchor ?? turn, turn.retryError, true)];
  }
  if (!records || !last?.willRetry || last.recovered || last.anchorOutputLength !== undefined) return records;
  const items = previous?.requestErrors?.at(-1)?.id === last.id ? previous.items : turn.items;
  const length = streamedOutputLength(items.find(item => item.id === last.afterItemId));
  return length === undefined ? records : [...records.slice(0, -1), { ...last, anchorOutputLength: length }];
}

/** History and completion notifications may carry a final error without an error event. */
export function restoreRequestErrors(turn: Turn, previous?: Turn): Turn {
  const restored = { ...turn, requestErrors: restoredRecords(turn, previous) };
  const last = restored.requestErrors?.at(-1);
  if (turn.error && (last?.willRetry !== false || last.error?.message !== turn.error.message
    || last.error?.additionalDetails !== turn.error.additionalDetails)) {
    return recordRequestError(restored, turn.error, false);
  }
  if (turn.status === "failed" && last?.willRetry !== false) {
    const error = turn.retryError ?? last?.error;
    return { ...restored, requestErrors: [...(restored.requestErrors ?? []), errorAtEnd(restored, error, false)] };
  }
  return restored;
}

/** IDs survive history updates; the count also covers replaced local message echoes. */
export function requestErrorPosition(turn: Turn, record: TurnRequestError): number {
  if (record.afterItemId === null) return 0;
  const index = turn.items.findIndex((item) => item.id === record.afterItemId);
  return index < 0 ? Math.min(record.itemCount, turn.items.length) : index + 1;
}

export function turnRequestErrors(turn: Turn): TurnRequestError[] {
  if (turn.requestErrors?.length) return turn.requestErrors;
  const error = turn.error ?? turn.retryError;
  return error || turn.status === "failed"
    ? [errorAtEnd(turn, error, !turn.error && turn.status !== "failed")] : [];
}

/** Recovered retries remain diagnostic history, but no longer interrupt the conversation. */
export function isRequestErrorVisible(turn: Turn, record: TurnRequestError): boolean {
  if (turn.status === "completed") return false;
  if (!record.willRetry) return true;
  if (turn.status !== "inProgress" || record.recovered) return false;
  const latest = turn.requestErrors?.at(-1);
  if (latest && latest.id !== record.id) return false;
  // Empty reasoning/message placeholders do not mean a request has recovered.
  const position = requestErrorPosition(turn, record);
  const anchor = turn.items[position - 1];
  if (record.anchorOutputLength !== undefined && anchor?.id === record.afterItemId
    && (streamedOutputLength(anchor) ?? 0) > record.anchorOutputLength) return false;
  return !turn.items.slice(position)
    .some(item => item.type !== "userMessage" && item.type !== "modelChange" && hasVisibleProcessContent(item));
}

/** A partial history window may omit the activity that proved the last retry recovered. */
export function preserveRetryRecovery(turn: Turn): Turn {
  const records = turn.requestErrors;
  const last = records?.at(-1);
  if (turn.status !== 'inProgress' || !records || !last?.willRetry || last.recovered
    || isRequestErrorVisible(turn, last)) return turn;
  return { ...turn, requestErrors: [...records.slice(0, -1), { ...last, recovered: true }] };
}

export function visibleTurnRequestErrors(turn: Turn): TurnRequestError[] {
  return turnRequestErrors(restoreRequestErrors(turn)).filter(record => isRequestErrorVisible(turn, record));
}
