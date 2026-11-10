import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { PdfZoomFocus } from './pdfLayout';

export const MIN_PDF_ZOOM = 0.5;
export const MAX_PDF_ZOOM = 3;
const ZOOM_STEP = 0.25;
const WHEEL_ZOOM_SENSITIVITY = 0.002;
const boundedZoom = (zoom: number) => Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, zoom));

export function usePdfZoom(host: RefObject<HTMLDivElement>) {
  const [state, setZoom] = useState<{ zoom: number; focus?: PdfZoomFocus }>({ zoom: 1 });
  const current = useRef(state);
  current.current = state;
  const preview = useRef<HTMLElement>();
  const clearPreview = () => {
    if (!preview.current) return;
    preview.current.style.removeProperty('transform');
    preview.current.style.removeProperty('transform-origin');
    preview.current.style.removeProperty('will-change');
    preview.current = undefined;
  };
  // Commit the final layout once per gesture; keep existing canvases visible while fingers move.
  useLayoutEffect(clearPreview, [state]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.deltaY === 0
        || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault(); event.stopPropagation();
      setZoom(current => ({ zoom: boundedZoom(current.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY)) }));
    };
    let pinch: { ids: number[]; distance: number; zoom: number; target: number;
      point: { x: number; y: number }; center: { x: number; y: number }; focus: PdfZoomFocus } | undefined;
    let frame = 0;
    const center = (touches: readonly Touch[]) => ({ x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2 });
    const distance = (touches: readonly Touch[]) => Math.hypot(touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY);
    const consume = (event: TouchEvent) => { event.preventDefault(); event.stopPropagation(); };
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 2 || pinch) return;
      const touches = Array.from(event.touches);
      const midpoint = center(touches);
      const bounds = element.getBoundingClientRect();
      const page = [...element.querySelectorAll<HTMLElement>('.file-pdf-page')].reduce<HTMLElement | undefined>((nearest, page) => {
        const gap = (element: HTMLElement) => {
          const rect = element.getBoundingClientRect();
          return Math.max(rect.top - midpoint.y, midpoint.y - rect.bottom, 0);
        };
        return !nearest || gap(page) < gap(nearest) ? page : nearest;
      }, undefined);
      const list = element.querySelector<HTMLElement>('.file-pdf-page-list');
      if (!page || !list || !distance(touches)) return;
      const rect = page.getBoundingClientRect();
      const position = { x: midpoint.x - bounds.left, y: midpoint.y - bounds.top };
      pinch = { ids: touches.map(touch => touch.identifier), distance: distance(touches),
        zoom: current.current.zoom, target: current.current.zoom, center: position,
        point: { x: element.scrollLeft + position.x, y: element.scrollTop + position.y },
        focus: { page: Number(page.dataset.pdfPage), x: (midpoint.x - rect.left) / rect.width,
          y: (midpoint.y - rect.top) / rect.height, viewportX: position.x, viewportY: position.y } };
      preview.current = list;
      list.style.transformOrigin = '0 0'; list.style.willChange = 'transform';
      // Keep one-finger scrolling on the compositor; only an active pinch needs blocking moves.
      element.addEventListener('touchmove', move, { passive: false });
      event.stopPropagation();
    };
    const move = (event: TouchEvent) => {
      if (!pinch) return;
      const touches = pinch.ids.map(id => Array.from(event.touches).find(touch => touch.identifier === id));
      if (touches.some(touch => !touch)) return;
      const pair = touches as Touch[];
      const midpoint = center(pair);
      const bounds = element.getBoundingClientRect();
      pinch.center = { x: midpoint.x - bounds.left, y: midpoint.y - bounds.top };
      pinch.target = boundedZoom(pinch.zoom * distance(pair) / pinch.distance);
      consume(event);
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        if (!pinch || !preview.current) return;
        const ratio = pinch.target / pinch.zoom;
        const x = element.scrollLeft + pinch.center.x - ratio * pinch.point.x;
        const y = element.scrollTop + pinch.center.y - ratio * pinch.point.y;
        preview.current.style.transform = `translate(${x}px, ${y}px) scale(${ratio})`;
      });
    };
    const end = (event: TouchEvent) => {
      if (!pinch || pinch.ids.every(id => Array.from(event.touches).some(touch => touch.identifier === id))) return;
      consume(event); cancelAnimationFrame(frame); frame = 0;
      setZoom({ zoom: pinch.target, focus: { ...pinch.focus,
        viewportX: pinch.center.x, viewportY: pinch.center.y } });
      pinch = undefined;
      element.removeEventListener('touchmove', move);
    };
    const cancel = () => {
      pinch = undefined; cancelAnimationFrame(frame); frame = 0; clearPreview();
      element.removeEventListener('touchmove', move);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('touchstart', start, { passive: true });
    element.addEventListener('touchend', end, { passive: false });
    element.addEventListener('touchcancel', cancel);
    return () => {
      cancel(); element.removeEventListener('wheel', wheel);
      element.removeEventListener('touchstart', start); element.removeEventListener('touchmove', move);
      element.removeEventListener('touchend', end); element.removeEventListener('touchcancel', cancel);
    };
  }, [host]);
  return { ...state, resetZoom: () => setZoom({ zoom: 1 }),
    changeZoom: (direction: number) => setZoom(current => ({ zoom: boundedZoom(current.zoom + direction * ZOOM_STEP) })) };
}
