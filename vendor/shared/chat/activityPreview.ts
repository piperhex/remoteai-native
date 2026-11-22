export const MAX_ACTIVITY_PREVIEW_CHARS = 1024;

/** Bound wire summaries after whitespace normalization; layout supplies the visible ellipsis. */
export function activityPreview(text: string) {
  const characters: string[] = [];
  let space = false;
  for (const character of text) {
    if (/\s/u.test(character)) {
      space = characters.length > 0;
      continue;
    }
    if (space) characters.push(' ');
    space = false;
    characters.push(character);
    if (characters.length > MAX_ACTIVITY_PREVIEW_CHARS) {
      return characters.slice(0, MAX_ACTIVITY_PREVIEW_CHARS - 1).join('').trimEnd() + '…';
    }
  }
  return characters.join('');
}
