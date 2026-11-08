/** Sort a copy by recent activity, retaining running and explicit pin priorities and stable ties. */
export function orderThreadsByActivity<T extends { updatedAt: number }>(threads: readonly T[], options: {
  isRunning: (thread: T) => boolean;
  isPinned?: (thread: T) => boolean;
}): T[] {
  const { isRunning, isPinned } = options;
  const activity = (thread: T) => Number.isFinite(thread.updatedAt) ? thread.updatedAt : 0;
  return [...threads].sort((left, right) => Number(isRunning(right)) - Number(isRunning(left))
    || Number(Boolean(isPinned?.(right))) - Number(Boolean(isPinned?.(left)))
    || activity(right) - activity(left));
}
