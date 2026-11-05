import type { GitChange, GitChanges, GitClient, GitRepositoryEntry } from './gitTypes';

export interface GitWorkspaceState { entry: GitRepositoryEntry; changes: GitChanges }
export const workspacePath = (entry: GitRepositoryEntry, path: string) => entry.path ? `${entry.path}/${path}` : path;
export const localPath = (entry: GitRepositoryEntry, path: string) =>
  entry.path ? path.slice(entry.path.length + 1) : path;
export const childFirst = (entries: GitRepositoryEntry[]) => [...entries].sort((a, b) =>
  b.path.split('/').length - a.path.split('/').length || b.path.length - a.path.length);

export function fileOwner(entries: GitRepositoryEntry[], path: string) {
  const entry = childFirst(entries).find(entry =>
    entry.available && (!entry.path || path.startsWith(`${entry.path}/`)));
  if (!entry) throw new Error('client.git.thisFolderIsNotAGitRepository');
  return entry;
}

export function parentRepository(entries: GitRepositoryEntry[], entry: GitRepositoryEntry) {
  return entry.path ? fileOwner(entries, entry.path) : undefined;
}

export async function readWorkspaces(client: GitClient, entries: GitRepositoryEntry[]): Promise<GitWorkspaceState[]> {
  // Settle the complete read before releasing the polling gate, including failed requests.
  const available = entries.filter(entry => entry.available);
  const results = await Promise.allSettled(available.map(entry => client.changes(entry.root)));
  return results.map((result, index) => {
    if (result.status === 'rejected') throw result.reason;
    return { entry: available[index], changes: result.value };
  });
}

export function workspaceFiles(states: GitWorkspaceState[]): GitChange[] {
  return states.flatMap(({ entry, changes }) => changes.files
    // A dirty child's files are selected directly; its unchanged parent reference is not a file to commit.
    .filter(file => !file.submodule || file.referenceChanged !== false)
    .map(file => ({ ...file, path: workspacePath(entry, file.path),
      originalPath: file.originalPath ? workspacePath(entry, file.originalPath) : null })));
}

export function selectedByRepository(states: GitWorkspaceState[], files: { path: string; version: string }[]) {
  const entries = states.map(state => state.entry);
  const groups = new Map<string, { path: string; version: string }[]>();
  for (const file of files) {
    const entry = fileOwner(entries, file.path);
    const selected = { ...file, path: localPath(entry, file.path) };
    const state = states.find(state => state.entry.root === entry.root)!;
    if (!state.changes.files.some(current => current.path === selected.path && current.version === selected.version)) {
      throw new Error('client.git.filesOrBranchesHaveChangedRefreshAndSelectTheFiles');
    }
    groups.set(entry.root, [...groups.get(entry.root) ?? [], selected]);
  }
  return groups;
}
