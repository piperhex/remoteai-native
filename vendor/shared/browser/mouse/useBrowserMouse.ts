import { useLayoutEffect, useMemo, useRef } from 'react';
import { DesktopPointer } from '../../remote-desktop/input';
import { useMousePanel } from '../../remote-desktop/useMousePanel';
import type { Point, Size } from '../../remote-desktop/geometry';

export type BrowserMouseEvent = Point & (
  | { kind: 'move' | 'cancel' }
  | { kind: 'button'; button: 'left' | 'middle' | 'right'; down: boolean }
  | { kind: 'wheel'; delta: number; horizontal?: boolean }
);
export type BrowserMouseTarget = (event: BrowserMouseEvent) => void;

/** The browser owns the input destination. The desktop panel owns every gesture and its timing. */
export function useBrowserMouse(size: Size, send: BrowserMouseTarget) {
  const target = useRef(send); target.current = send;
  const pointer = useMemo(() => {
    let point = { x: 0.5, y: 0.5 };
    return new DesktopPointer(input => {
      if (input.kind === 'move') point = { x: input.x, y: input.y };
      if (input.kind === 'move' || input.kind === 'button') target.current({ ...point, ...input });
    });
  }, []);
  const panel = useMousePanel(true);
  useLayoutEffect(() => () => {
    target.current({ ...pointer.getSnapshot(), kind: 'cancel' });
    pointer.dispose();
  }, [pointer]);
  const wheel = (delta: number, horizontal?: boolean) => {
    pointer.flush();
    target.current({ ...pointer.getSnapshot(), kind: 'wheel', delta, horizontal });
  };
  return { pointer, panel, wheel, horizontal: true, visible: true, contained: true,
    viewport: { stage: size, content: { ...size, x: 0, y: 0 } } };
}
