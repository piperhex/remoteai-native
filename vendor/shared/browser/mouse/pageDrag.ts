export interface MouseHit { x: number; y: number; element: Element }

/** WebKit and browser-hosted documents do not start native HTML drag-and-drop from a synthetic pointer. */
export function pageDrag() {
  let active: { source: MouseHit; transfer: DataTransfer; over?: Element; accepted: boolean } | undefined;
  const dispatch = (type: string, hit: MouseHit) => {
    const view = hit.element.ownerDocument.defaultView as Window & typeof globalThis;
    if (!view?.DragEvent || !hit.element.isConnected) return true;
    return hit.element.dispatchEvent(new view.DragEvent(type, { view, bubbles: true, composed: true,
      cancelable: true, clientX: hit.x, clientY: hit.y, dataTransfer: active?.transfer }));
  };
  const end = (hit?: MouseHit) => {
    if (!active) return false;
    if (hit && active.accepted && active.over === hit.element) dispatch('drop', hit);
    dispatch('dragend', active.source); active = undefined; return true;
  };
  const move = (start: MouseHit, hit: MouseHit) => {
    if (!active) {
      const source = start.element.closest<HTMLElement>('[draggable="true"], a[href], img');
      const view = start.element.ownerDocument.defaultView as Window & typeof globalThis;
      const distance = Math.hypot(start.x - hit.x, start.y - hit.y);
      if (!source?.draggable || !view.DataTransfer || !view.DragEvent || distance < 5) return;
      active = { source: { ...start, element: source }, transfer: new view.DataTransfer(), accepted: false };
      if (!dispatch('dragstart', active.source)) { active = undefined; return; }
    }
    if (active.over !== hit.element) {
      if (active.over) dispatch('dragleave', { ...hit, element: active.over });
      dispatch('dragenter', hit); active.over = hit.element;
    }
    active.accepted = !dispatch('dragover', hit);
  };
  return { move, end };
}
