import { useMemo } from 'react';
import { useConversationEntries as useSharedEntries } from '../../vendor/shared/chat/useConversationEntries';
import type { Turn } from './types';
import { nativeSummaryEntries } from './nativeSummaryEntries';

export function useConversationEntries(turns: Turn[]) {
  const state = useSharedEntries(turns);
  const entries = useMemo(() => nativeSummaryEntries(state.entries), [state.entries]);
  return { ...state, entries };
}
