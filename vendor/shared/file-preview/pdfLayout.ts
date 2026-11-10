export interface PdfPageSize { width: number; height: number }
export interface PdfPageLayout extends PdfPageSize { top: number }
export interface PdfVisiblePages { first: number; last: number; current: number }
export interface PdfZoomFocus { page: number; x: number; y: number; viewportX: number; viewportY: number }

export const PDF_PAGE_GAP = 16;
export const PDF_PAGE_GUTTER = 16;

export function pdfPageLayout(sizes: readonly PdfPageSize[], width: number, zoom: number): PdfPageLayout[] {
  const widest = sizes.reduce((largest, size) => Math.max(largest, size.width), 1);
  const scale = Math.max(1, width - PDF_PAGE_GUTTER * 2) / widest * zoom;
  let top = PDF_PAGE_GUTTER;
  return sizes.map(size => {
    const page = { width: size.width * scale, height: size.height * scale, top };
    top += page.height + PDF_PAGE_GAP;
    return page;
  });
}

/** Binary search also keeps scrolling through very long documents independent of their page count. */
export function pdfPageAt(pages: readonly PdfPageLayout[], offset: number): number {
  let first = 0;
  let last = pages.length - 1;
  while (first < last) {
    const middle = Math.floor((first + last) / 2);
    if (pages[middle].top + pages[middle].height + PDF_PAGE_GAP <= offset) first = middle + 1;
    else last = middle;
  }
  return first;
}

export function visiblePdfPages(pages: readonly PdfPageLayout[], top: number, height: number): PdfVisiblePages {
  if (!pages.length) return { first: 0, last: 0, current: 0 };
  const first = pdfPageAt(pages, Math.max(0, top - height));
  const last = pdfPageAt(pages, top + height * 2);
  let current = pdfPageAt(pages, top);
  let mostVisible = 0;
  for (let index = current; index <= last; index += 1) {
    const page = pages[index];
    const overlap = Math.max(0, Math.min(top + height, page.top + page.height) - Math.max(top, page.top));
    const visible = overlap / Math.max(1, Math.min(height, page.height));
    if (visible > mostVisible) { current = index; mostVisible = visible; }
  }
  return { first, last, current };
}

export function pdfScrollAnchor(options: {
  previous: readonly PdfPageLayout[]; next: readonly PdfPageLayout[]; top: number;
}): number {
  if (!options.previous.length || !options.next.length) return 0;
  const index = Math.min(pdfPageAt(options.previous, options.top), options.next.length - 1);
  const before = options.previous[index];
  const after = options.next[index];
  return Math.max(0, after.top + (options.top - before.top) / before.height * after.height);
}

/** Keep the point between two fingers at the same viewport position after pages are resized. */
export function pdfFocusScroll(pages: readonly PdfPageLayout[], width: number, focus: PdfZoomFocus) {
  const page = pages[focus.page - 1];
  if (!page) return undefined;
  const contentWidth = pages.reduce((widest, page) => Math.max(widest, page.width + PDF_PAGE_GUTTER * 2), width);
  return { top: Math.max(0, page.top + page.height * focus.y - focus.viewportY),
    left: Math.max(0, (contentWidth - page.width) / 2 + page.width * focus.x - focus.viewportX) };
}
