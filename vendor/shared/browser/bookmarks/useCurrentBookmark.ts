import { useState } from 'react';
import { useBookmarks } from './context';
import { bookmarkUrl } from './model';

/** Save the current page without an editor, using the same account store as the bookmark manager. */
export function useCurrentBookmark(options: { url: string; title: string; newId: () => string; parentId?: string }) {
  const { entries, status, store } = useBookmarks();
  const [invalid, setInvalid] = useState(false);
  const address = bookmarkUrl(options.url);
  const saved = !!address && entries.some(entry => entry.kind === 'link' && entry.url === address);
  const add = () => {
    if (!address || saved) return;
    const title = [...(options.title || new URL(address).hostname).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')]
      .slice(0, 200).join('').trim() || new URL(address).hostname;
    setInvalid(!store.save({ id: options.newId(), kind: 'link', title, url: address,
      parentId: options.parentId ?? '', position: Math.max(-1, ...entries.map(entry => entry.position)) + 1 }));
  };
  return { available: !!address, saved, invalid, status, add };
}
