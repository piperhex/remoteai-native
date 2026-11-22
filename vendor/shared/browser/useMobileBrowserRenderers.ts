import { useCallback, useEffect, useState } from 'react';

const MOBILE_RENDERER_LIMIT = 3;

function recentRenderers(previous: string[], activeId: string) {
  if (!activeId || previous[0] === activeId) return previous;
  return [activeId, ...previous.filter(id => id !== activeId)].slice(0, MOBILE_RENDERER_LIMIT);
}

/** Keep the current page and two recently viewed pages warm. Restored tabs load on first selection. */
export function useMobileBrowserRenderers(activeId: string, visible: boolean) {
  const [recent, setRecent] = useState<string[]>([]);
  const releaseBackground = useCallback(() => {
    setRecent(visible && activeId ? [activeId] : []);
  }, [visible, activeId]);
  useEffect(() => {
    if (visible) setRecent(previous => recentRenderers(previous, activeId));
    else setRecent(previous => previous.slice(0, 1));
  }, [activeId, visible]);
  return { resident: visible ? recentRenderers(recent, activeId) : recent, releaseBackground };
}
