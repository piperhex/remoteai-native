import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import type { TurnPanel } from './ChatTurnSummary';

export type ChatDetailSelection = { type: 'work' | 'activities' | 'item'; id: string }
  | { type: 'turn'; id: string; panel: TurnPanel; errorId?: string };

/** Retained chat pages must not retain a native dialog after navigation. */
export function useChatDetailSelection(active: boolean) {
  const [selection, setSelection] = useState<ChatDetailSelection | null>(null);
  const enabled = useRef(active);
  enabled.current = active;
  useEffect(() => { if (!active) setSelection(null); }, [active]);
  const open = useCallback((value: ChatDetailSelection) => {
    // A queued press from the outgoing pane must not open a dialog over the incoming page.
    if (!enabled.current) return;
    Keyboard.dismiss();
    setSelection(value);
  }, []);
  const close = useCallback(() => setSelection(null), []);
  return { selection: active ? selection : null, open, close };
}
