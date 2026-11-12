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

/** Consume system Back while browsing; Android 14 additionally reports which edge initiated it. */
export function useBrowserBack(enabled: boolean, back: () => void, forward: () => void = back) {
  const actions = useRef({ back, forward }); actions.current = { back, forward };
  useEffect(() => {
    if (!enabled) return;
    const navigate = (direction: 'back' | 'forward') => {
      if (Keyboard.isVisible()) Keyboard.dismiss(); else actions.current[direction]();
    };
    const hardware = BackHandler.addEventListener('hardwareBackPress', () => { navigate('back'); return true; });
    const events = bridge && Platform.OS === 'android' ? new NativeEventEmitter(bridge) : undefined;
    const edge = events?.addListener('browserEdgeNavigation', (direction: string) => {
      navigate(direction === 'forward' ? 'forward' : 'back');
    });
    bridge?.setEnabled(true);
    return () => { hardware.remove(); edge?.remove(); bridge?.setEnabled(false); };
  }, [enabled]);
}

export function useBrowserNavigationGestures(enabled: boolean, back: () => void, forward: () => void) {
  useBrowserBack(enabled, back, forward);
  const { width } = useWindowDimensions();
  const edge = useRef<'left' | 'right'>('left');
  const actions = useRef({ back, forward }); actions.current = { back, forward };
  const onLeft = useCallback(() => { if (edge.current === 'right') actions.current.forward(); }, []);
  const onRight = useCallback(() => { if (edge.current === 'left') actions.current.back(); }, []);
  const shouldStart = useCallback((event: { nativeEvent: { pageX: number } }) => {
    const x = event.nativeEvent.pageX;
    edge.current = x < width / 2 ? 'left' : 'right';
    return x <= EDGE_WIDTH || x >= width - EDGE_WIDTH;
  }, [width]);
  return useHorizontalSwipe({ enabled, onLeft, onRight, shouldStart }).panHandlers;
}
