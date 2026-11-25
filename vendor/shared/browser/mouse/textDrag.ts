import type { MouseHit } from './pageDrag';

type Caret = { offsetNode: Node; offset: number };
type CaretDocument = Document & {
  caretPositionFromPoint?: (x: number, y: number) => Caret | null;
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

function caretAt(hit: MouseHit): Caret | undefined {
  const doc: CaretDocument = hit.element.ownerDocument;
  const caret = doc.caretPositionFromPoint?.(hit.x, hit.y);
  if (caret) return caret;
  const range = doc.caretRangeFromPoint?.(hit.x, hit.y);
  if (range) return { offsetNode: range.startContainer, offset: range.startOffset };
}

export function textDrag(start: MouseHit) {
  if (start.element.closest('button, input, textarea, select, [draggable=true], a[href]')) return;
  const doc = start.element.ownerDocument;
  if (doc.defaultView?.getComputedStyle(start.element).userSelect === 'none') return;
  const from = caretAt(start);
  if (!from || from.offsetNode.nodeType !== Node.TEXT_NODE || !start.element.contains(from.offsetNode)) return;
  const range = doc.createRange();
  range.selectNodeContents(from.offsetNode);
  if (!Array.from(range.getClientRects()).some(rect => start.x >= rect.left && start.x <= rect.right
    && start.y >= rect.top && start.y <= rect.bottom)) return;
  return (hit: MouseHit) => {
    if (hit.element.ownerDocument !== doc || !from.offsetNode.isConnected
      || Math.hypot(hit.x - start.x, hit.y - start.y) < 5) return;
    const to = caretAt(hit);
    if (to) doc.getSelection()?.setBaseAndExtent(from.offsetNode, from.offset, to.offsetNode, to.offset);
  };
}
