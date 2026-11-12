export const MAX_BOOKMARKS = 500;
export interface Bookmark {
  id: string; kind: 'link' | 'folder'; title: string; url: string; parentId: string; position: number;
}
export interface BookmarkDocument { revision: number; entries: Bookmark[] }
export type BookmarkEdits = Record<string, Bookmark | null>;
export interface BookmarkReply { document: BookmarkDocument; accepted: boolean }
const identifier = /^[a-zA-Z0-9_-]{1,80}$/;

export function bookmarkUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password
      || url.href.length > 4096) return;
    return url.href;
  } catch { return; }
}

export function isBookmark(value: unknown): value is Bookmark {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Bookmark;
  return typeof entry.id === 'string' && identifier.test(entry.id)
    && typeof entry.title === 'string' && !!entry.title.trim() && [...entry.title].length <= 200
    && !/[\u0000-\u001f\u007f-\u009f]/.test(entry.title)
    && typeof entry.parentId === 'string' && (!entry.parentId || identifier.test(entry.parentId))
    && Number.isSafeInteger(entry.position) && entry.position >= 0
    && (entry.kind === 'folder' ? entry.url === '' : entry.kind === 'link' && typeof entry.url === 'string'
      && !!bookmarkUrl(entry.url));
}

export function readBookmarkDocument(value: unknown): BookmarkDocument | undefined {
  if (!value || typeof value !== 'object') return;
  const doc = value as BookmarkDocument;
  if (!Number.isSafeInteger(doc.revision) || doc.revision < 0 || !Array.isArray(doc.entries)
    || doc.entries.length > MAX_BOOKMARKS || !doc.entries.every(isBookmark)
    || new Set(doc.entries.map(entry => entry.id)).size !== doc.entries.length) return;
  return { revision: doc.revision, entries: doc.entries };
}

/** Keep independent edits; children of concurrently deleted folders return to the bar. */
export function mergeBookmarks(remote: Bookmark[], edits: BookmarkEdits): Bookmark[] {
  const entries = new Map(remote.map(entry => [entry.id, entry]));
  Object.entries(edits).forEach(([id, entry]) => { if (entry) entries.set(id, entry); else entries.delete(id); });
  return [...entries.values()].map(entry => {
    const seen = new Set([entry.id]);
    let parent = entry.parentId;
    while (parent) {
      const folder = entries.get(parent);
      if (!folder || folder.kind !== 'folder' || seen.has(parent) || seen.size > 8) return { ...entry, parentId: '' };
      seen.add(parent); parent = folder.parentId;
    }
    return entry;
  }).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function bookmarkDescendants(entries: Bookmark[], id: string): Set<string> {
  const ids = new Set([id]);
  let previous = 0;
  while (previous !== ids.size) {
    previous = ids.size;
    entries.forEach(entry => { if (ids.has(entry.parentId)) ids.add(entry.id); });
  }
  return ids;
}

/** Move within one folder and publish all affected positions as one edit. */
export function reorderBookmarks(entries: Bookmark[], id: string, targetId: string, after: boolean): BookmarkEdits {
  const source = entries.find(entry => entry.id === id);
  const target = entries.find(entry => entry.id === targetId);
  if (!source || !target || source.id === target.id || source.parentId !== target.parentId) return {};
  const siblings = entries.filter(entry => entry.parentId === source.parentId && entry.id !== id);
  const position = siblings.findIndex(entry => entry.id === targetId) + Number(after);
  siblings.splice(position, 0, source);
  return Object.fromEntries(siblings.flatMap((entry, index) => entry.position === index ? []
    : [[entry.id, { ...entry, position: index }]]));
}
