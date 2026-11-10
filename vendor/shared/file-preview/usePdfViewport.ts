import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { pdfFocusScroll, pdfScrollAnchor, visiblePdfPages, type PdfPageLayout, type PdfVisiblePages,
  type PdfZoomFocus } from './pdfLayout';

export function usePdfElementWidth(host: RefObject<HTMLElement>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [host]);
  return width;
}

export function usePdfViewport(host: RefObject<HTMLDivElement>, pages: readonly PdfPageLayout[], focus?: PdfZoomFocus) {
  const [visible, setVisible] = useState<PdfVisiblePages>({ first: 0, last: 0, current: 0 });
  const previous = useRef({ pages, top: 0, focus });
  const read = useCallback(() => {
    const element = host.current;
    if (!element || previous.current.pages !== pages) return;
    previous.current.top = element.scrollTop;
    const next = visiblePdfPages(pages, element.scrollTop, element.clientHeight);
    setVisible(current => current.first === next.first && current.last === next.last && current.current === next.current
      ? current : next);
  }, [host, pages]);
  useLayoutEffect(() => {
    const element = host.current;
    if (element && focus && focus !== previous.current.focus) {
      const position = pdfFocusScroll(pages, element.clientWidth, focus);
      if (position) { element.scrollTop = position.top; element.scrollLeft = position.left; }
    } else if (element && previous.current.pages !== pages) {
      // A smaller page list can clamp scrollTop during DOM mutations, before this effect runs.
      element.scrollTop = pdfScrollAnchor({ previous: previous.current.pages, next: pages,
        top: previous.current.top });
    }
    previous.current = { pages, top: element?.scrollTop ?? 0, focus };
    read();
  }, [host, pages, read, focus]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let frame = 0;
    const schedule = () => {
      if (previous.current.pages !== pages) return;
      // Remember scroll events immediately, including a zoom before the next animation frame.
      previous.current.top = element.scrollTop;
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; read(); });
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    element.addEventListener('scroll', schedule, { passive: true });
    return () => {
      observer.disconnect(); element.removeEventListener('scroll', schedule); cancelAnimationFrame(frame);
    };
  }, [host, pages, read]);
  const jump = useCallback((page: number, position = 0) => {
    const element = host.current;
    const target = pages[page - 1];
    if (!element || !target) return;
    element.scrollTop = target.top + target.height * position;
    read();
  }, [host, pages, read]);
  return { ...visible, page: visible.current + 1, jump };
}
