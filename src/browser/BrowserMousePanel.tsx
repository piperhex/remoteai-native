import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AppState, NativeModules, StyleSheet, View, findNodeHandle } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import { mousePreference } from '../../vendor/shared/browser/mouse/mousePreference';
import { useBrowserMouse, type BrowserMouseEvent } from '../../vendor/shared/browser/mouse/useBrowserMouse';
import { DesktopMouse } from '../chat/desktop/MousePad';
import { useStyles } from '../chat/styles';
import { DockMouseContext } from './inspector/DockedBrowserMouse';

export const useBrowserMousePreference = mousePreference(() => ({
  getItem: key => Storage.getItemSync(key), setItem: (key, value) => Storage.setItemSync(key, value),
}));

const bridge: { send: (tag: number, input: BrowserMouseEvent) => void } = NativeModules.BrowserMouse;

interface Props {
  page: RefObject<View | null>; cancelOnLoad: RefObject<(() => void) | undefined>;
  active: boolean; enabled: boolean; home: boolean; children: ReactNode;
}

export function BrowserMousePanel({ page, cancelOnLoad, active, enabled, home, children }: Props) {
  const styles = useStyles();
  const dock = useContext(DockMouseContext);
  const target = dock?.target ?? page;
  const [size, setSize] = useState({ width: 0, height: 0, x: 0, y: 0 });
  const tag = useRef<number | null>(null);
  const send = (input: BrowserMouseEvent) => {
    if (input.kind !== 'cancel') tag.current = findNodeHandle(target.current);
    if (tag.current !== null) bridge.send(tag.current, input);
    if (input.kind === 'cancel') tag.current = null;
  };
  const visible = enabled && active;
  const mouse = useBrowserMouse(dock?.frame ?? size, send, visible);
  useLayoutEffect(() => {
    if (visible && dock) dock.display(mouse);
  }, [dock, visible, mouse]);
  useLayoutEffect(() => {
    if (visible && dock) return () => dock.display(undefined);
  }, [dock, visible]);
  useLayoutEffect(() => {
    if (!visible) return;
    cancelOnLoad.current = mouse.cancel;
    return () => { mouse.cancel(); cancelOnLoad.current = undefined; };
  }, [cancelOnLoad, mouse.cancel, visible, home, target]);
  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') mouse.cancel();
    });
    return () => subscription.remove();
  }, [mouse.cancel, visible]);
  const { x, y } = mouse.viewport.content;
  return <View style={stage} onLayout={({ nativeEvent: { layout } }) => {
    if (layout.width && layout.height) setSize(layout);
  }}>
    <View ref={page} collapsable={false} style={[styles.page,
      enabled && !dock && { transform: [{ translateX: x }, { translateY: y }] }]}>
      {children}
    </View>
    {visible && !dock && size.width > 0 && <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <DesktopMouse {...mouse} />
    </View>}
  </View>;
}

const stage = { flex: 1, overflow: 'hidden', backgroundColor: '#000' } as const;
