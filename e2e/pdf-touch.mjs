async function pinchFocus(pages) {
  return pages.evaluate(element => {
    const viewport = element.getBoundingClientRect();
    const preferred = { x: viewport.left + viewport.width / 2,
      y: viewport.top + Math.min(viewport.height / 2, 300) };
    const visible = [...element.querySelectorAll('.file-pdf-page')].map(page => {
      const rect = page.getBoundingClientRect();
      return { page, rect, top: Math.max(rect.top, viewport.top), bottom: Math.min(rect.bottom, viewport.bottom) };
    }).filter(page => page.bottom > page.top);
    const containsCenter = page => page.top <= preferred.y && page.bottom >= preferred.y;
    // A viewport midpoint can fall in a page gap; use the largest visible page in that case.
    const target = visible.find(containsCenter)
      ?? visible.sort((a, b) => (b.bottom - b.top) - (a.bottom - a.top))[0];
    if (!target) throw new Error('Missing visible PDF page');
    const { page, rect, top, bottom } = target;
    const center = { x: preferred.x, y: containsCenter(target) ? preferred.y : (top + bottom) / 2 };
    return { center, page: page.dataset.pdfPage, x: (center.x - rect.left) / rect.width,
      y: (center.y - rect.top) / rect.height, width: rect.width };
  });
}

/** Inject real Chromium touch input, including Android WebViews, and report the touched document point. */
export async function pinchPdf(page, pages, { from = 110, to = 190, dx = 0, dy = 0, cancel = false } = {}) {
  const { center, ...focus } = await pinchFocus(pages);
  const session = await page.context().newCDPSession(page);
  const points = (distance, progress) => [0, 1].map(id => ({ id, radiusX: 6, radiusY: 6, force: 1,
    x: center.x + dx * progress + (id ? 1 : -1) * distance / 2, y: center.y + dy * progress }));
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(from, 0) });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
        touchPoints: points(from + (to - from) * step / 8, step / 8) });
      await page.waitForTimeout(25);
    }
    const liveWidth = await pages.locator(`.file-pdf-page[data-pdf-page="${focus.page}"]`).evaluate(
      element => element.getBoundingClientRect().width);
    await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
    return { ...focus, liveWidth, expectedX: center.x + dx, expectedY: center.y + dy };
  } finally { await session.detach(); }
}

export async function pdfFocusError(pages, focus) {
  return pages.evaluate((element, focus) => {
    const bounds = element.querySelector(`.file-pdf-page[data-pdf-page="${focus.page}"]`).getBoundingClientRect();
    const viewport = element.getBoundingClientRect();
    const left = bounds.left - viewport.left + element.scrollLeft + focus.x * bounds.width;
    const top = bounds.top - viewport.top + element.scrollTop + focus.y * bounds.height;
    const expectedLeft = Math.max(0, Math.min(element.scrollWidth - element.clientWidth,
      left - (focus.expectedX - viewport.left)));
    const expectedTop = Math.max(0, Math.min(element.scrollHeight - element.clientHeight,
      top - (focus.expectedY - viewport.top)));
    return Math.hypot(element.scrollLeft - expectedLeft, element.scrollTop - expectedTop);
  }, focus);
}

export async function swipePdf(page, pages, { dx = 0, dy = -140 } = {}) {
  const bounds = await pages.boundingBox();
  const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 0 }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove',
        touchPoints: [{ x: start.x + dx * step / 8, y: start.y + dy * step / 8, id: 0 }] });
      await page.waitForTimeout(30);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
}
