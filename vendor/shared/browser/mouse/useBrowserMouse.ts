import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { DesktopPointer } from '../../remote-desktop/input';
import { useMousePanel } from '../../remote-desktop/useMousePanel';
import { MOUSE_PANEL_SIZE, MOUSE_ICON_SIZE, type Point, type Size } from '../../remote-desktop/geometry';
import { useMouseViewport } from '../../remote-desktop/useMouseViewport';

export type BrowserMouseEvent = Point & (
  | { kind: 'move' | 'cancel' }
  | { kind: 'button'; button: 'left' | 'middle' | 'right'; down: boolean }
  | { kind: 'wheel'; delta: number; horizontal?: boolean }
);
export type BrowserMouseTarget = (event: BrowserMouseEvent) => void;

/** The browser owns the input destination. The desktop panel owns every gesture and its timing. */
export function useBrowserMouse(frame: Size & Point, send: BrowserMouseTarget | undefined, active: boolean) {
  const target = useRef(send); target.current = send;
  const pointer = useMemo(() => {
    const mouse: DesktopPointer = new DesktopPointer(input => {
      if (input.kind === 'move' || input.kind === 'button') target.current?.({ ...mouse.getSnapshot(), ...input });
    });
    return mouse;
  }, []);
  const panel = useMousePanel(active);
  const base = useMemo(() => {
    const stage = { width: frame.width, height: frame.height };
    return { stage, content: { ...stage, x: 0, y: 0 } };
  }, [frame.width, frame.height]);
  const controls = panel.expanded ? MOUSE_PANEL_SIZE : MOUSE_ICON_SIZE;
  const previous = useRef(frame);
  useLayoutEffect(() => {
    const old = previous.current;
    if (frame.width && frame.height && (frame.x !== old.x || frame.y !== old.y
      || frame.width !== old.width || frame.height !== old.height)) {
      pointer.resizePage(base, controls, { x: frame.x - old.x, y: frame.y - old.y });
      previous.current = frame;
    }
  }, [pointer, base, frame, controls]);
  const viewport = useMouseViewport(pointer, base, controls);
  const cancel = useCallback(() => {
    target.current?.({ ...pointer.getSnapshot(), kind: 'cancel' });
    pointer.release();
  }, [pointer]);
  useLayoutEffect(() => () => {
    cancel();
    pointer.dispose();
  }, [pointer, cancel]);
  const wheel = (delta: number, horizontal?: boolean) => {
    pointer.flush();
    target.current?.({ ...pointer.getSnapshot(), kind: 'wheel', delta, horizontal });
  };
  return { pointer, panel, wheel, cancel, viewport, horizontal: true, visible: active, browserPage: true };
}
