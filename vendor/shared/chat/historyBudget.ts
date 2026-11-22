// Count UTF-16 code units, including keys and container overhead, without serializing large output.
export const HISTORY_CONTENT_CHARS = 2 * 1024 * 1024;
export const HISTORY_ENTRY_LIMIT = 400;
export const TOOL_PREVIEW_CHARS = 16 * 1024;

const sizes = new WeakMap<object, number>();

export function historyChars(value: unknown): number {
  if (typeof value === 'string') return value.length;
  if (!value || typeof value !== 'object') return 1;
  const known = sizes.get(value);
  if (known !== undefined) return known;
  let chars = 1;
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    chars += key.length + historyChars((value as Record<string, unknown>)[key]);
    if (chars > HISTORY_CONTENT_CHARS) break;
  }
  sizes.set(value, chars);
  return chars;
}

/** Copy the visible prefix so a sliced string cannot keep a multi-megabyte backing buffer alive. */
export function historyPreview(text: string) {
  if (text.length <= TOOL_PREVIEW_CHARS) return text;
  return JSON.parse(JSON.stringify(text.slice(0, TOOL_PREVIEW_CHARS) + '…')) as string;
}
