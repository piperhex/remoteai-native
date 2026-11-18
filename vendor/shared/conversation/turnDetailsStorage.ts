import type { Conversation, PlanStep } from "./types";
import { modelChangeRecords, validModelChangeRecords, type ModelChangeRecord } from "./modelChangeHistory";

const STORAGE_KEY = "codex-switch:gui-turn-details:v1";
const MAX_RECORDS = 30;
const MAX_CACHE_CHARACTERS = 500_000;
interface TurnDetails {
  threadId: string; turnId: string; diff?: string; plan?: PlanStep[]; planExplanation?: string | null;
  modelChanges?: ModelChangeRecord[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validDetails(value: unknown): value is TurnDetails {
  if (!isRecord(value) || typeof value.threadId !== "string" || typeof value.turnId !== "string") return false;
  if (value.modelChanges !== undefined && !validModelChangeRecords(value.modelChanges)) return false;
  if (value.diff !== undefined && typeof value.diff !== "string") return false;
  if (value.planExplanation != null && typeof value.planExplanation !== "string") return false;
  return value.plan === undefined || (Array.isArray(value.plan) && value.plan.every((step) =>
    isRecord(step) && typeof step.step === "string" && typeof step.status === "string"));
}

function readRecords(): { raw?: string; records: TurnDetails[] } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > MAX_CACHE_CHARACTERS) return { records: [] };
    const records: unknown = JSON.parse(raw);
    return { raw, records: Array.isArray(records) ? records.filter(validDetails).slice(-MAX_RECORDS) : [] };
  } catch { return { records: [] }; } // Browser privacy settings can disable optional session storage.
}

/** app-server history has file items, but does not replay turn plan/net-diff notifications. */
export function cachedTurnDetails(threadId: string): Map<string, TurnDetails> {
  return new Map(readRecords().records.filter((record) => record.threadId === threadId).map((record) =>
    [record.turnId, record]));
}

function encodeNewest(record: TurnDetails) {
  const limit = MAX_CACHE_CHARACTERS - 2; // Leave room for the surrounding array.
  // An oversized diff cannot fit even before JSON adds escapes and field names.
  if ((record.diff?.length ?? 0) <= limit) {
    const encoded = JSON.stringify(record);
    if (encoded.length <= limit) return encoded;
  }
  if (record.diff === undefined) return;
  const { diff: _diff, ...metadata } = record;
  if (metadata.plan === undefined && metadata.planExplanation == null && !metadata.modelChanges?.length) return;
  const encoded = JSON.stringify(metadata);
  if (encoded.length <= limit) return encoded;
}

function encodeCache(records: TurnDetails[], newest?: string) {
  const entries = newest === undefined ? [] : [newest];
  let characters = 2 + (newest?.length ?? 0);
  // Walk the newest suffix once. Encoded lengths include escapes, brackets and commas.
  for (let index = records.length - 1; index >= 0 && entries.length < MAX_RECORDS; index--) {
    const encoded = JSON.stringify(records[index]);
    characters += encoded.length + Number(entries.length > 0);
    if (characters > MAX_CACHE_CHARACTERS) break;
    entries.push(encoded);
  }
  return `[${entries.reverse().join(",")}]`;
}

export function rememberTurnDetails(value: Conversation, turnId: string) {
  const turn = value.turns.find((entry) => entry.id === turnId);
  if (!turn) return;
  const modelChanges = modelChangeRecords(turn.items);
  if (turn.diff === undefined && turn.plan === undefined && !modelChanges.length) return;
  const { raw, records } = readRecords();
  const prior = records.filter((record) => record.threadId !== value.thread.id || record.turnId !== turnId);
  try {
    const newest = encodeNewest({ threadId: value.thread.id, turnId, diff: turn.diff, plan: turn.plan,
      planExplanation: turn.planExplanation, modelChanges });
    const next = encodeCache(prior, newest);
    if (next !== raw) sessionStorage.setItem(STORAGE_KEY, next);
  }
  catch { /* History file items remain available if the optional cache reaches the browser quota. */ }
}
