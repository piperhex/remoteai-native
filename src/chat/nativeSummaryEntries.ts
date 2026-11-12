import type { TurnEntry } from '../../vendor/shared/chat/turnPresentation';

/** Native already presents request failures in its turn summary. Preserve that layout across snapshot upgrades. */
export function nativeSummaryEntries(entries: TurnEntry[]): Exclude<TurnEntry, { kind: 'error' }>[] {
  const grouped = new Map<string, TurnEntry[]>();
  for (const entry of entries) {
    const group = grouped.get(entry.turn.id) ?? [];
    group.push(entry); grouped.set(entry.turn.id, group);
  }
  return [...grouped.values()].flatMap(group => {
    const visible = group.filter(entry => entry.kind !== 'error');
    if (group.some(entry => entry.kind === 'error') && !visible.some(entry => entry.kind === 'summary')) {
      visible.push({ id: `${group[0].turn.id}:summary`, kind: 'summary', turn: group[0].turn });
    }
    return visible;
  });
}
