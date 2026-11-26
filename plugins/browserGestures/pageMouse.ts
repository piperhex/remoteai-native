import { documentMouse } from '../../vendor/shared/browser/mouse/documentMouse';
import type { BrowserMouseEvent } from '../../vendor/shared/browser/mouse/useBrowserMouse';

// Navigation creates a fresh receiver. The native scroll view owns the outer visual viewport.
export const send = documentMouse(document, undefined, true);

/** Android's embedded window needs an explicit keyboard request for a mouse click in an editor. */
export function sendEditorClick(input: BrowserMouseEvent) {
  let editing = false;
  const checkTarget = (event: MouseEvent) => {
    const target = event.composedPath()[0];
    editing = target instanceof HTMLElement && (target.isContentEditable
      || target.matches('textarea:read-write, input:read-write'));
  };
  window.addEventListener('click', checkTarget, true);
  try { send(input); } finally { window.removeEventListener('click', checkTarget, true); }
  return editing;
}
