import { useCallback, useRef, type ReactNode } from 'react';
import { Animated, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useHorizontalSwipe } from '../navigation/useHorizontalSwipe';
import { SWIPE_START_DISTANCE } from '../../vendor/shared/navigation/pageSwipe';

function usePreviewPress(select: () => void) {
  const touch = useRef({ x: 0, y: 0, moved: false });
  return {
    onTouchStart: ({ nativeEvent }: GestureResponderEvent) => {
      touch.current = { x: nativeEvent.pageX, y: nativeEvent.pageY, moved: false };
    },
    onTouchMove: ({ nativeEvent }: GestureResponderEvent) => {
      if (Math.abs(nativeEvent.pageX - touch.current.x) >= SWIPE_START_DISTANCE
        || Math.abs(nativeEvent.pageY - touch.current.y) >= SWIPE_START_DISTANCE) touch.current.moved = true;
    },
    select: () => {
      const moved = touch.current.moved; touch.current.moved = false;
      if (!moved) select();
    },
  };
}

export function SwipeableBrowserTab({ children, width, style, close, select }: {
  children: (select: () => void) => ReactNode;
  width: number; style: StyleProp<ViewStyle>; close: () => void; select: () => void;
}) {
  const press = usePreviewPress(select);
  const offset = useRef(new Animated.Value(0)).current;
  const closing = useRef(false);
  const action = useRef(close); action.current = close;
  const move = useCallback((dx: number) => {
    if (!closing.current) offset.setValue(Math.max(0, dx));
  }, [offset]);
  const settle = useCallback((direction?: string) => {
    if (direction === 'right' || closing.current) return;
    Animated.spring(offset, { toValue: 0, useNativeDriver: true }).start();
  }, [offset]);
  const dismiss = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(offset, { toValue: width + 24, duration: 160, useNativeDriver: true })
      .start(({ finished }) => { if (finished) action.current(); });
  }, [offset, width]);
  // Consume left drags too, so releasing inside the preview cannot activate its Pressable.
  const keepTab = useCallback(() => {}, []);
  const swipe = useHorizontalSwipe({ enabled: true, onLeft: keepTab, onRight: dismiss, onMove: move, onEnd: settle });
  return <Animated.View {...swipe.panHandlers} onTouchStart={press.onTouchStart} onTouchMove={press.onTouchMove}
    style={[style, { transform: [{ translateX: offset }],
    opacity: offset.interpolate({ inputRange: [0, width], outputRange: [1, 0.25], extrapolate: 'clamp' }) }]}>
    {children(press.select)}
  </Animated.View>;
}
