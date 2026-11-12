import { activityTimeline as sharedTimeline } from '../../vendor/shared/chat/activityTimeline';
import type { TimelineEntry as SharedEntry } from '../../vendor/shared/chat/activityTimeline';
export { findActivityEntry, latestActivity } from '../../vendor/shared/chat/activityTimeline';
export type { ActivityEntry } from '../../vendor/shared/chat/activityTimeline';
export type TimelineEntry = Exclude<SharedEntry, { kind: 'error' }>;
export const activityTimeline = (entries: Parameters<typeof sharedTimeline>[0]): TimelineEntry[] =>
  sharedTimeline(entries).filter((entry): entry is TimelineEntry => entry.kind !== 'error');
