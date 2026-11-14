import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Keyboard, NativeEventEmitter, NativeModules, Platform, useWindowDimensions } from 'react-native';
import { useHorizontalSwipe } from '../navigation/useHorizontalSwipe';

interface BrowserGestureBridge {
  setEnabled: (enabled: boolean) => void;
  addListener: (event: string) => void;
  removeListeners: (count: number) => void;
}
const bridge = NativeModules.BrowserGestures as BrowserGestureBridge | undefined;
const EDGE_WIDTH = 28;

/** Both system Back edges follow the same browser history and overlay dismissal rules. */
export function useBrowserBack(enabled: boolean, back: () => void) {
  const action = useRef(back); action.current = back;
  useEffect(() => {
    if (!enabled) return;
    const navigate = () => {
      if (Keyboard.isVisible()) Keyboard.dismiss(); else action.current();
    };
    const hardware = BackHandler.addEventListener('hardwareBackPress', () => { navigate(); return true; });
    const events = bridge && Platform.OS === 'android' ? new NativeEventEmitter(bridge) : undefined;
    const edge = events?.addListener('browserEdgeNavigation', navigate);
    bridge?.setEnabled(true);
    return () => { hardware.remove(); edge?.remove(); bridge?.setEnabled(false); };
  }, [enabled]);
}

export function useBrowserNavigationGestures(enabled: boolean, back: () => void) {
  useBrowserBack(enabled, back);
  const { width } = useWindowDimensions();
  const edge = useRef<'left' | 'right'>('left');
  const action = useRef(back); action.current = back;
  const onLeft = useCallback(() => { if (edge.current === 'right') action.current(); }, []);
  const onRight = useCallback(() => { if (edge.current === 'left') action.current(); }, []);
  const shouldStart = useCallback((event: { nativeEvent: { pageX: number } }) => {
    const x = event.nativeEvent.pageX;
    edge.current = x < width / 2 ? 'left' : 'right';
    return x <= EDGE_WIDTH || x >= width - EDGE_WIDTH;
  }, [width]);
  return useHorizontalSwipe({ enabled, onLeft, onRight, shouldStart }).panHandlers;
}
