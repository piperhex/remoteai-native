import { createContext, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { StyleSheet, View, type LayoutRectangle } from 'react-native';
import type { useBrowserMouse } from '../../../vendor/shared/browser/mouse/useBrowserMouse';
import { DesktopMouse } from '../../chat/desktop/MousePad';

type Mouse = ReturnType<typeof useBrowserMouse>;
interface DockMouse {
  target: RefObject<View | null>;
  frame: LayoutRectangle;
  display: (mouse: Mouse | undefined) => void;
}

export const DockMouseContext = createContext<DockMouse | undefined>(undefined);

/** The active tab keeps its pointer. Only its drawing surface and hit-test root span the split. */
export function DockedBrowserMouse({ open, children }: { open: boolean; children: ReactNode }) {
  const target = useRef<View>(null);
  const [frame, setFrame] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [mouse, display] = useState<Mouse>();
  const dock = useMemo(() => open && frame.width && frame.height ? { target, frame, display } : undefined,
    [open, frame]);
  const overlay = dock && mouse;
  return <DockMouseContext.Provider value={dock}>
    <View style={styles.stage} onLayout={({ nativeEvent: { layout } }) => setFrame(layout)}>
      <View ref={target} collapsable={false} style={[styles.content, overlay && {
        transform: [{ translateX: overlay.viewport.content.x }, { translateY: overlay.viewport.content.y }],
      }]}>{children}</View>
      {overlay && <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <DesktopMouse {...overlay} />
      </View>}
    </View>
  </DockMouseContext.Provider>;
}

const styles = StyleSheet.create({
  stage: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  content: { flex: 1 },
});
