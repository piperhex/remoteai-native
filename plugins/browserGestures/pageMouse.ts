import { documentMouse } from '../../vendor/shared/browser/mouse/documentMouse';

// Navigation creates a fresh receiver. The native scroll view owns the outer visual viewport.
export const send = documentMouse(document, undefined, true);
