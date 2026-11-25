import type { FileChange, GuiEvent, Turn } from './types';

export type ReviewFields = Pick<Turn, 'reviewCwd' | 'reviewIncomplete' | 'workspaceObservation' | 'diff'
  | 'savedReviewResult' | 'reviewHasEdits' | 'reviewDeferred' | 'reviewEdits'>;

/** A journal result may arrive after another turn starts or after the reviewed turn was unloaded. */
export function applySavedReview(turns: Turn[], review: NonNullable<GuiEvent['params']['review']>) {
  return turns.map(turn => turn.id === review.turnId ? { ...turn, ...review.fields } : turn);
}

export type ReviewResult = 'empty' | 'tools' | 'incomplete' | 'net';
export interface SavedReviewTarget {
  threadId: string; turnId: string; file?: number; offset?: number; activity?: boolean;
}
export interface SavedReviewFile {
  header?: string; path?: string; kind?: FileChange['kind']; item?: string;
  added?: number; removed?: number;
}
export interface SavedReviewPage { files?: SavedReviewFile[]; text?: string; next?: number | null }
export type ReadSavedReview = (target: SavedReviewTarget) => Promise<SavedReviewPage>;

export function pagedReviewEvent(event: GuiEvent): GuiEvent {
  const review = event.params?.review;
  if (event.method === 'turn/review/updated' && review?.fields.savedReviewResult) {
    return { ...event, params: { ...event.params, review: { ...review, fields: { ...review.fields,
      diff: undefined, reviewEdits: [], reviewDeferred: review.fields.savedReviewResult } } } };
  }
  const turn = event.params?.turn;
  if (!turn?.savedReviewResult || event.method !== 'turn/completed') return event;
  return { ...event, params: { ...event.params, turn: { ...turn, diff: undefined, reviewEdits: [],
    reviewDeferred: turn.savedReviewResult } } };
}
