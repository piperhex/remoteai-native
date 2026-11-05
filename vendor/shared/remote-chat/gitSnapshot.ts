import type { GitClient, GitHistory } from './gitTypes';

export async function readGitSnapshot(client: GitClient, cwd: string, historyRepository = cwd) {
  // Wait for every request even on failure, so the next interval cannot overlap remaining reads.
  const [changes, history, repository] = await Promise.allSettled([
    client.changes(cwd), client.history(historyRepository, 0), client.repository(cwd),
  ]);
  if (changes.status === 'rejected') throw changes.reason;
  if (history.status === 'rejected') throw history.reason;
  if (repository.status === 'rejected') throw repository.reason;
  return { changes: changes.value, history: history.value, repository: repository.value };
}

export function refreshGitHistory(previous: GitHistory, next: GitHistory): GitHistory {
  const sameHead = next.commits.length > 0 && next.commits.every((row, index) =>
    row.hash === previous.commits[index]?.hash && row.repository === previous.commits[index]?.repository);
  if (!sameHead || previous.commits.length <= next.commits.length) return next;
  return { commits: [...next.commits, ...previous.commits.slice(next.commits.length)], hasMore: previous.hasMore };
}
