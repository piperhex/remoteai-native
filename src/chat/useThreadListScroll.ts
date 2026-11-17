import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useThreadPagination } from '../../vendor/shared/remote-chat/client/useThreadPagination';
import type { ChatController } from './controller';
import type { ChatState } from './types';

const LOAD_MORE_THRESHOLD = 0.5;

export function useThreadListScroll(state: ChatState, controller: ChatController, layoutKey: string) {
  const offset = useRef(0);
  const authorizedCursor = useRef<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [content, setContent] = useState({ key: '', height: 0 });
  const checkNearEnd = useCallback(() => {
    if (state.directorySync && authorizedCursor.current !== state.cursor) return false;
    // Appended rows must finish native layout before their old height can trigger another page.
    return content.key === layoutKey && viewportHeight > 0
      && content.height - offset.current - viewportHeight <= viewportHeight * LOAD_MORE_THRESHOLD;
  }, [content, layoutKey, viewportHeight, state.directorySync, state.cursor]);
  const pagination = useThreadPagination(state, controller, checkNearEnd);
  const { setNearEnd } = pagination;

  useEffect(() => { setNearEnd(checkNearEnd()); }, [checkNearEnd, setNearEnd]);

  return {
    ...pagination,
    onLayout: (event: LayoutChangeEvent) => setViewportHeight(event.nativeEvent.layout.height),
    onContentSizeChange: (_width: number, height: number) => setContent({ key: layoutKey, height }),
    onScrollBeginDrag: () => { authorizedCursor.current = state.cursor; setNearEnd(checkNearEnd()); },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (event.nativeEvent.contentOffset.y > offset.current) authorizedCursor.current = state.cursor;
      offset.current = event.nativeEvent.contentOffset.y;
      setNearEnd(checkNearEnd());
    },
  };
}
