import type { FileChange } from './types';

export type ReviewResult = 'empty' | 'tools' | 'incomplete' | 'net';
export interface SavedReviewTarget {
  threadId: string; turnId: string; file?: number; offset?: number; activity?: boolean;
}
export interface SavedReviewFile {
  header?: string; path?: string; kind?: FileChange['kind']; item?: string;
}
export interface SavedReviewPage { files?: SavedReviewFile[]; text?: string; next?: number | null }
export type ReadSavedReview = (target: SavedReviewTarget) => Promise<SavedReviewPage>;
