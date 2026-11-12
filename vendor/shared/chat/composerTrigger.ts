import { composerTrigger, type TextSelection } from '../remote-chat/client/skillDraft';

export function composerMenuTrigger(text: string, selection: TextSelection) {
  const command = composerTrigger(text, selection);
  if (command) return { ...command, conversations: false, files: false, ssh: false };
  if (selection.start !== selection.end) return null;
  const ssh = text.slice(0, selection.start).match(/(?:^|\s)#([^\s#]*)$/u);
  if (ssh) return { start: selection.start - ssh[1].length - 1, end: selection.start,
    query: ssh[1], skillsOnly: false, conversations: false, files: false, ssh: true };
  const file = text.slice(0, selection.start).match(/(?:^|\s)%([^\s%]*)$/u);
  if (file) return { start: selection.start - file[1].length - 1, end: selection.start,
    query: file[1], skillsOnly: false, conversations: false, files: true, ssh: false };
  const match = text.slice(0, selection.start).match(/(?:^|\s)@([^\s@/]*)$/u);
  return match ? { start: selection.start - match[1].length - 1, end: selection.start,
    query: match[1], skillsOnly: true, conversations: true, files: false, ssh: false } : null;
}
