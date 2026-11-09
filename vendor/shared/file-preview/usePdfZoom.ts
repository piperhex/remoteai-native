import { useEffect, useState, type RefObject } from 'react';

export const MIN_PDF_ZOOM = 0.5;
export const MAX_PDF_ZOOM = 3;
const ZOOM_STEP = 0.25;
const WHEEL_ZOOM_SENSITIVITY = 0.002;
const boundedZoom = (zoom: number) => Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, zoom));

export function usePdfZoom(host: RefObject<HTMLDivElement>) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || event.deltaY === 0
        || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault(); event.stopPropagation();
      setZoom(current => boundedZoom(current * Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY)));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [host]);
  return { zoom, resetZoom: () => setZoom(1),
    changeZoom: (direction: number) => setZoom(current => boundedZoom(current + direction * ZOOM_STEP)) };
}
