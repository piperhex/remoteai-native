import type { ReactNode } from 'react';
import type { ProjectDocument } from './protocol';

/** Hosts choose the media formats supported by their embedded or browser renderer. */
export interface ProjectPreviewProps {
  document: ProjectDocument;
  text: string;
  active: boolean;
  connected: boolean;
  editor: ReactNode;
  openFile: (path: string) => void;
}
export type ProjectPreviewRenderer = (props: ProjectPreviewProps) => ReactNode;
