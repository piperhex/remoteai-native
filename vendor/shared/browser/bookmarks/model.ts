export const MAX_BOOKMARKS = 500;
const MAX_PARENT_DEPTH = 8;
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

export function pageBookmark(page: { title: string; url: string }, newId: () => string): Bookmark | undefined {
  const url = bookmarkUrl(page.url);
  if (!url) return;
  const host = new URL(url).hostname;
  const title = [...(page.title || host).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')].slice(0, 200).join('').trim();
  return { id: newId(), kind: 'link', title: title || host, url, parentId: '', position: 0 };
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

export function hasValidBookmarkParents(entry: Bookmark, entries: ReadonlyMap<string, Bookmark>) {
  const seen = new Set([entry.id]);
  let parent = entry.parentId;
  while (parent) {
    const folder = entries.get(parent);
    if (folder?.kind !== 'folder' || seen.has(parent) || seen.size > MAX_PARENT_DEPTH) return false;
    seen.add(parent); parent = folder.parentId;
  }
  return true;
}

/** Keep independent edits; children of concurrently deleted folders return to the bar. */
export function mergeBookmarks(remote: Bookmark[], edits: BookmarkEdits): Bookmark[] {
  const entries = new Map(remote.map(entry => [entry.id, entry]));
  Object.entries(edits).forEach(([id, entry]) => { if (entry) entries.set(id, entry); else entries.delete(id); });
  return [...entries.values()].map(entry => hasValidBookmarkParents(entry, entries) ? entry : { ...entry, parentId: '' })
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export type BookmarkDragSource = { bookmarkId: string } | { page: Bookmark };

/** Resolve against the latest snapshot so a concurrent deletion cannot resurrect a dragged bookmark. */
export function bookmarkInFolder(entries: Bookmark[], source: BookmarkDragSource, folder: Bookmark): Bookmark | undefined {
  if (folder.kind !== 'folder') return;
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const link = 'page' in source ? source.page : byId.get(source.bookmarkId);
  if (link?.kind !== 'link' || link.parentId === folder.id) return;
  const children = entries.filter(entry => entry.parentId === folder.id);
  if ('page' in source && (entries.length >= MAX_BOOKMARKS || children.some(entry => entry.url === link.url))) return;
  const next = { ...link, parentId: folder.id, position: Math.max(-1, ...children.map(entry => entry.position)) + 1 };
  return hasValidBookmarkParents(next, byId) ? next : undefined;
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
