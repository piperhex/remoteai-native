import { useRef, useState, type Dispatch, type SetStateAction } from 'react';

/** Keep edits with their conversation, including callbacks that finish after a switch. */
export function useScopedDraft<T>(scope: string | null, initial: () => T, creating = false) {
  const entries = useRef(new Map<string | null, { value: T }>());
  const previous = useRef(scope);
  const [, refresh] = useState(0);
  if (previous.current !== scope) {
    const pending = entries.current.get(previous.current);
    if (previous.current === null && creating && pending) {
      entries.current.set(scope, pending);
      entries.current.delete(null);
    }
    previous.current = scope;
  }
  let entry = entries.current.get(scope);
  if (!entry) {
    entry = { value: initial() };
    entries.current.set(scope, entry);
  }
  const current = entry;
  const setValue: Dispatch<SetStateAction<T>> = change => {
    current.value = typeof change === 'function'
      ? (change as (value: T) => T)(current.value) : change;
    refresh(revision => revision + 1);
  };
  return [entry.value, setValue] as const;
}
