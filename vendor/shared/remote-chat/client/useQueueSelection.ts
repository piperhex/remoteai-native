import { useEffect, useState } from 'react';
import type { QueueMessage } from '../queue';

export function useQueueSelection(messages: QueueMessage[], disabled: boolean) {
  const [selectedId, select] = useState<string | null>(null);
  const selected = messages.find((message) => message.id === selectedId) ?? messages[0];
  useEffect(() => { select(selected?.id ?? null); }, [selected?.id]);
  const index = messages.indexOf(selected);
  return { selected, select,
    canMoveUp: !disabled && !selected?.busy && !selected?.local
      && index > 0 && !messages[index - 1].busy && !messages[index - 1].local,
    canMoveDown: !disabled && !selected?.busy && !selected?.local
      && index < messages.length - 1 && !messages[index + 1]?.busy && !messages[index + 1]?.local };
}
