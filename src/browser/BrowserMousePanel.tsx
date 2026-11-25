import { useEffect, useRef, useState, type RefObject } from 'react';
import { AppState, NativeModules, StyleSheet, View, findNodeHandle } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { mousePreference } from '../../vendor/shared/browser/mouse/mousePreference';
import { useBrowserMouse, type BrowserMouseEvent } from '../../vendor/shared/browser/mouse/useBrowserMouse';
import { DesktopMouse } from '../chat/desktop/MousePad';

export const useBrowserMousePreference = mousePreference(() => ({
  getItem: key => Storage.getItemSync(key), setItem: (key, value) => Storage.setItemSync(key, value),
}));

const bridge: { send: (tag: number, input: BrowserMouseEvent) => void } = NativeModules.BrowserMouse;

export function BrowserMousePanel({ page }: { page: RefObject<View | null> }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const tag = useRef<number | null>(null);
  const send = (input: BrowserMouseEvent) => {
    tag.current ??= findNodeHandle(page.current);
    if (tag.current !== null) bridge.send(tag.current, input);
  };
  const mouse = useBrowserMouse(size, send);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        send({ kind: 'cancel', ...mouse.pointer.getSnapshot() }); mouse.pointer.release();
      }
    });
    return () => subscription.remove();
  }, [mouse.pointer]);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}
    onLayout={({ nativeEvent: { layout } }) => setSize({ width: layout.width, height: layout.height })}>
    {size.width > 0 && size.height > 0 && <DesktopMouse {...mouse} />}
  </View>;
}
