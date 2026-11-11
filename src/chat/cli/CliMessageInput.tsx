import { useEffect, useState, type ComponentProps } from 'react';
import { ComposerInput } from '../ComposerInput';

export function CliMessageInput({ value = '', onChangeText, ...props }: ComponentProps<typeof ComposerInput>) {
  const [draft, setDraft] = useState({ source: value, text: value });
  if (draft.source !== value) setDraft({ source: value, text: value });
  // Commit local typing together with TextInput's native event count before publishing to the
  // synchronous external store. A microtask can still interrupt React's pending native-state update.
  useEffect(() => {
    if (draft.text !== draft.source) onChangeText?.(draft.text);
  }, [draft, onChangeText]);
  return <ComposerInput {...props} value={draft.text}
    onChangeText={text => setDraft(current => ({ ...current, text }))} />;
}
