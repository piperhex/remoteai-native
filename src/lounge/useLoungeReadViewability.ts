import { useEffect, useRef } from 'react';
import type { ViewToken } from 'react-native';
import type { LoungeController } from '../../vendor/shared/lounge/controller';
import type { LoungeMessage } from '../../vendor/shared/lounge/types';
import { historyKey } from '../../vendor/shared/lounge/archive';

const READ_VISIBLE_MS = 500;
const VISIBLE_PERCENT = 50;

export function useLoungeReadViewability<T>(options: {
  controller: LoungeController; message: (item: T) => LoungeMessage;
  scope: string; history?: boolean; suspended?: boolean;
}) {
  const latest = useRef(options); latest.current = options;
  const visible = useRef(new Map<string, LoungeMessage>());
  const callback = useRef(({ changed }: { changed: ViewToken<T>[] }) => {
    const current = latest.current;
    for (const item of changed) {
      const message = current.message(item.item);
      if (item.isViewable) visible.current.set(historyKey(message), message);
      else visible.current.delete(historyKey(message));
      current.controller.setGroupMessageVisible({ message,
        visible: item.isViewable && !current.suspended, history: current.history });
    }
  });
  const { controller, history, scope, suspended } = options;
  useEffect(() => () => {
    for (const message of visible.current.values()) controller.setGroupMessageVisible({
      message, visible: false, history });
    visible.current.clear();
  }, [controller, history, scope]);
  useEffect(() => {
    for (const message of visible.current.values()) controller.setGroupMessageVisible({
      message, visible: !suspended, history });
  }, [controller, history, suspended]);
  const config = useRef({ minimumViewTime: READ_VISIBLE_MS, viewAreaCoveragePercentThreshold: VISIBLE_PERCENT });
  return { onViewableItemsChanged: callback.current, viewabilityConfig: config.current };
}
