import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useState,
  type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { Modal } from '../components/Modal';
import { ModalBackHandler } from '../components/ModalBackHandler';

type BrowserWindow = { visible: boolean; content: ReactNode };
const WindowContext = createContext<((id: string, window?: BrowserWindow) => void) | null>(null);

/** Keep retained WebViews at window size while chat and its bottom navigation are visible. */
export function ProjectBrowserWindowHost({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<Record<string, BrowserWindow>>({});
  const updateWindow = useCallback((id: string, window?: BrowserWindow) => {
    setWindows(previous => {
      const next = { ...previous };
      if (window) next[id] = window;
      else delete next[id];
      return next;
    });
  }, []);
  const covered = Object.values(windows).some(window => window.visible);
  return <WindowContext.Provider value={updateWindow}>
    <View style={styles.fill} pointerEvents={covered ? 'none' : 'auto'} accessibilityElementsHidden={covered}
      importantForAccessibility={covered ? 'no-hide-descendants' : 'auto'}>{children}</View>
    {Object.entries(windows).map(([id, { visible, content }]) =>
      <View key={id} style={[StyleSheet.absoluteFill, !visible && styles.hidden]} collapsable={false}
        pointerEvents={visible ? 'auto' : 'none'} accessibilityViewIsModal={visible} accessibilityElementsHidden={!visible}
        importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}>{content}</View>)}
  </WindowContext.Provider>;
}

export function ProjectBrowserWindow({ children, active, onHide, onClose }: {
  children: ReactNode; active: boolean; onHide?: () => void; onClose: () => void;
}) {
  const host = useContext(WindowContext);
  const id = useId();
  const retain = !!host && !!onHide;
  useLayoutEffect(() => {
    if (retain) host(id, { visible: active, content: <>
      {active && <ModalBackHandler onRequestClose={onHide} />}{children}
    </> });
  }, [retain, host, id, children, active, onHide]);
  useLayoutEffect(() => () => { if (retain) host(id); }, [retain, host, id]);
  useEffect(() => {
    if (!retain || !active) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { onHide(); return true; });
    return () => back.remove();
  }, [retain, active, onHide]);
  if (retain) return null;
  return <Modal visible={active} animationType="slide" onRequestClose={onHide ?? onClose}
    supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}>{children}</Modal>;
}

const styles = StyleSheet.create({ fill: { flex: 1 }, hidden: { opacity: 0 } });
