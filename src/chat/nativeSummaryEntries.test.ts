import { expect, it } from 'vitest';
import { nativeSummaryEntries } from './nativeSummaryEntries';
import type { TurnEntry } from '../../vendor/shared/chat/turnPresentation';

it('keeps native failures in one summary without dropping responses or duplicating existing summaries', () => {
  const turn = { id: 'failed', items: [], status: 'failed' } as TurnEntry['turn'];
  const errors = [{ id: 'failure', kind: 'error', turn, error: {} }] as TurnEntry[];
  const response = { id: 'response', kind: 'message', turn, item: {} } as TurnEntry;
  expect(nativeSummaryEntries([response, ...errors]).map(entry => entry.kind)).toEqual(['message', 'summary']);
  const summary = { id: 'summary', kind: 'summary', turn } as TurnEntry;
  expect(nativeSummaryEntries([...errors, summary])).toEqual([summary]);
});
