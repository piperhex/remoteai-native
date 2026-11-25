import type { BrowserMouseEvent } from './useBrowserMouse';
import { pageDrag, type MouseHit as Hit } from './pageDrag';
import { textDrag } from './textDrag';

type Point = { x: number; y: number };
type Page = Window & typeof globalThis;

function insideFrame(frame: HTMLIFrameElement, point: Point): Hit | undefined {
  const doc = frame.contentDocument;
  if (!doc || !frame.offsetWidth || !frame.offsetHeight) return;
  const rect = frame.getBoundingClientRect();
  const x = (point.x - rect.left) * frame.offsetWidth / rect.width - frame.clientLeft;
  const y = (point.y - rect.top) * frame.offsetHeight / rect.height - frame.clientTop;
  return hitDocument(doc, { x, y });
}

function hitDocument(doc: Document, point: Point, scope?: Element): Hit | undefined {
  let element = doc.elementsFromPoint(point.x, point.y).find(node => !scope || scope.contains(node));
  while (element?.shadowRoot) {
    const child = element.shadowRoot.elementFromPoint(point.x, point.y);
    if (!child || child === element) break;
    element = child;
  }
  if (element?.tagName === 'IFRAME') return insideFrame(element as HTMLIFrameElement, point);
  return element ? { ...point, element } : undefined;
}

function emit(hit: Hit, type: string, options: MouseEventInit = {}) {
  const view = hit.element.ownerDocument.defaultView as Page;
  if (!view || !hit.element.isConnected) return false;
  const init = { bubbles: true, composed: true, cancelable: true, clientX: hit.x, clientY: hit.y, view, ...options };
  const event = type.startsWith('pointer') && view.PointerEvent
    ? new view.PointerEvent(type, { ...init, pointerType: 'mouse', pointerId: 1, isPrimary: true })
    : new view.MouseEvent(type, init);
  return hit.element.dispatchEvent(event);
}

function scroll(hit: Hit, input: Extract<BrowserMouseEvent, { kind: 'wheel' }>, nativeRoot?: Document) {
  const doc = hit.element.ownerDocument;
  const view = doc.defaultView as Page;
  const deltaX = input.horizontal ? input.delta : 0;
  const deltaY = input.horizontal ? 0 : -input.delta;
  const allowed = hit.element.dispatchEvent(new view.WheelEvent('wheel', { deltaX, deltaY,
    clientX: hit.x, clientY: hit.y, bubbles: true, composed: true, cancelable: true, view }));
  if (!allowed) return true;
  for (let node: Element | null = hit.element; node; node = node.parentElement) {
    if (node === doc.scrollingElement) break;
    const style = view.getComputedStyle(node);
    if (!/auto|scroll|overlay/.test(input.horizontal ? style.overflowX : style.overflowY)) continue;
    const before = input.horizontal ? node.scrollLeft : node.scrollTop;
    node.scrollBy({ left: deltaX, top: deltaY, behavior: 'instant' });
    if (before !== (input.horizontal ? node.scrollLeft : node.scrollTop)) return true;
  }
  if (doc === nativeRoot) return false;
  view.scrollBy({ left: deltaX, top: deltaY, behavior: 'instant' });
  return true;
}

/** Dispatch only within the displayed page and same-origin descendant frames. */
export function documentMouse(doc: Document, scope?: HTMLElement, nativeRootScroll = false) {
  let buttons = 0;
  let hover: Hit | undefined;
  const presses = new Map<number, Hit>();
  const drag = pageDrag();
  let selectText: ReturnType<typeof textDrag>;
  let clicked: { element: Element; at: number; point: Point } | undefined;
  const reset = () => {
    buttons = 0;
    for (const [button, hit] of presses) {
      emit(hit, 'pointercancel', { button, buttons }); emit(hit, 'mouseup', { button, buttons });
    }
    drag.end(); presses.clear(); hover = undefined; clicked = undefined; selectText = undefined;
  };
  return (input: BrowserMouseEvent) => {
    if (input.kind === 'cancel') { reset(); return; }
    const rect = scope?.getBoundingClientRect();
    const viewport = doc.defaultView?.visualViewport;
    const width = rect?.width ?? viewport?.width ?? doc.documentElement.clientWidth;
    const height = rect?.height ?? viewport?.height ?? doc.documentElement.clientHeight;
    const hit = hitDocument(doc, { x: (rect?.x ?? 0) + input.x * (width - 1),
      y: (rect?.y ?? 0) + input.y * (height - 1) }, scope);
    if (!hit) { if (input.kind === 'button' && !input.down) reset(); return; }
    if (input.kind === 'wheel') return scroll(hit, input, nativeRootScroll ? doc : undefined);
    if (input.kind === 'move') {
      if (hover?.element !== hit.element) {
        if (hover) { emit(hover, 'pointerout', { buttons }); emit(hover, 'mouseout', { buttons }); }
        emit(hit, 'pointerover', { buttons }); emit(hit, 'mouseover', { buttons });
      }
      hover = hit;
      emit(hit, 'pointermove', { buttons, button: -1 }); emit(hit, 'mousemove', { buttons });
      const start = presses.get(0);
      if (start) { drag.move(start, hit); selectText?.(hit); }
      return;
    }
    if (input.kind !== 'button') return;
    const button = input.button === 'left' ? 0 : input.button === 'right' ? 2 : 1;
    const mask = [1, 4, 2][button];
    if (input.down) {
      presses.set(button, hit); buttons |= mask;
      if (emit(hit, 'pointerdown', { button, buttons }) && emit(hit, 'mousedown', { button, buttons }) && button === 0) {
        selectText = textDrag(hit);
        (hit.element.closest<HTMLElement>('button, input, textarea, select, a[href], [tabindex], [contenteditable]'))
          ?.focus({ preventScroll: true });
      }
      if (button === 2) emit(hit, 'contextmenu', { button, buttons });
      return;
    }
    const start = presses.get(button); presses.delete(button); buttons &= ~mask;
    if (!start) return;
    emit(hit, 'pointerup', { button, buttons }); emit(hit, 'mouseup', { button, buttons });
    if (button === 0) { selectText = undefined; if (drag.end(hit)) return; }
    if (button !== 0 || start.element !== hit.element || Math.hypot(start.x - hit.x, start.y - hit.y) > 5) return;
    const now = Date.now();
    const double = clicked?.element === hit.element && now - clicked.at < 500
      && Math.hypot(clicked.point.x - hit.x, clicked.point.y - hit.y) <= 5;
    emit(hit, 'click', { detail: double ? 2 : 1 });
    if (double) emit(hit, 'dblclick', { detail: 2 });
    clicked = double ? undefined : { element: hit.element, at: now, point: hit };
  };
}
