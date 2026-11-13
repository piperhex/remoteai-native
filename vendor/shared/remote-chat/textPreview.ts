import { filePreviewKind } from '../file-preview/kinds';

export interface TextPreview {
  path: string;
  text: string;
  size?: number;
}

export function isMarkdownPath(path: string): boolean {
  return filePreviewKind(path) === 'markdown';
}
