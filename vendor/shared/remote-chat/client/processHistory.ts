import type { Turn } from './types';
import { requestErrorPosition } from '../../conversation/turnRequestErrors';

/** A process reference replaces a range, not just the item sharing its first ID. */
export function reconcileProcessHistory(snapshot: Turn, live: Turn, before?: Turn): { snapshot: Turn; live: Turn } {
  if (!snapshot.items.some(item => item.processRef)) return { snapshot, live };
  const positions = new Map(live.items.map((item, index) => [item.id, index]));
  const original = new Map(before?.items.map(item => [item.id, item]));
  const boundaries = live.requestErrors !== before?.requestErrors
    ? live.requestErrors?.map(error => requestErrorPosition(live, error)) ?? [] : [];
  const covered = new Set<string>();
  const anchors = new Map<string, string>();
  const restored = new Map<string, string>();
  const items = snapshot.items.flatMap(item => {
    const ref = item.processRef;
    if (!ref || ref.turnId !== live.id) return [item];
    const start = positions.get(ref.itemId);
    const end = positions.get(ref.endItemId);
    if (start === undefined || end === undefined || start > end) return [item];
    const range = live.items.slice(start, end + 1);
    // New or changed activities inside the range cannot be represented by the older summary.
    // Retain the entire raw range so it can be folded again with fresh counts and outputs.
    if (range.some(activity => activity !== original.get(activity.id))
      || boundaries.some(position => position > start && position <= end + 1)) {
      restored.set(item.id, ref.endItemId);
      return range;
    }
    for (const activity of range) {
      covered.add(activity.id);
      anchors.set(activity.id, item.id);
    }
    return [item];
  });
  return {
    snapshot: remapErrors({ ...snapshot, items }, restored),
    live: remapErrors({ ...live, items: live.items.filter(item => !covered.has(item.id)) }, anchors),
  };
}

function remapErrors(turn: Turn, anchors: Map<string, string>): Turn {
  if (!turn.requestErrors || !anchors.size) return turn;
  return { ...turn, requestErrors: turn.requestErrors.map(error => {
    const afterItemId = error.afterItemId && anchors.get(error.afterItemId);
    return afterItemId ? { ...error, afterItemId } : error;
  }) };
}
