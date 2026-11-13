import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const FULLSCREEN_CONTROL_SIZE = 44;
const EDGE_GAP = 12;
const DRAG_THRESHOLD = 6;
const MENU_GAP = 8;
type Point = { x: number; y: number };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

export function useFullscreenControl(dismiss: () => void) {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [saved, setSaved] = useState<Point>();
  const [menuHeight, setMenuHeight] = useState(0);
  const left = Math.max(EDGE_GAP, insets.left), top = Math.max(EDGE_GAP, insets.top);
  const right = size.width - Math.max(EDGE_GAP, insets.right);
  const bottom = size.height - Math.max(EDGE_GAP, insets.bottom);
  const constrain = (point: Point) => ({
    x: clamp(point.x, left, right - FULLSCREEN_CONTROL_SIZE),
    y: clamp(point.y, top, bottom - FULLSCREEN_CONTROL_SIZE),
  });
  const position = constrain(saved ?? { x: right - FULLSCREEN_CONTROL_SIZE, y: top });
  const latest = useRef({ position, constrain, dismiss });
  latest.current = { position, constrain, dismiss };
  const origin = useRef(position);
  const dragging = useRef(false);
  useEffect(() => { if (size.width) setSaved(latest.current.position); }, [size.width, size.height, insets]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => { dragging.current = false; return false; },
    onMoveShouldSetPanResponderCapture: (_event, gesture) => Math.hypot(gesture.dx, gesture.dy) > DRAG_THRESHOLD,
    onPanResponderGrant: () => {
      origin.current = latest.current.position; dragging.current = true; latest.current.dismiss();
    },
    onPanResponderMove: (_event, gesture) => setSaved(latest.current.constrain({
      x: origin.current.x + gesture.dx, y: origin.current.y + gesture.dy,
    })),
    onPanResponderTerminationRequest: () => false,
  }), []);
  const menuWidth = Math.min(220, Math.max(0, right - left));
  const below = position.y + FULLSCREEN_CONTROL_SIZE + MENU_GAP;
  return {
    ready: size.width > 0,
    position: { left: position.x, top: position.y },
    handlers: responder.panHandlers,
    canPress: () => !dragging.current,
    onLayout: (event: LayoutChangeEvent) => setSize(event.nativeEvent.layout),
    onMenuLayout: (event: LayoutChangeEvent) => setMenuHeight(event.nativeEvent.layout.height),
    menuStyle: { width: menuWidth, maxHeight: Math.max(0, bottom - top),
      left: clamp(position.x + FULLSCREEN_CONTROL_SIZE - menuWidth, left, right - menuWidth),
      top: clamp(below + menuHeight <= bottom ? below : position.y - menuHeight - MENU_GAP, top, bottom - menuHeight) },
  };
}
