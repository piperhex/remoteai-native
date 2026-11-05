import { remoteErrorText as displayError } from '../localization/errors';
import { displayText as t } from '../localization/messages';
import type { GitClient, GitCommitRequest, GitRepositoryEntry } from './gitTypes';
import { childFirst, localPath, parentRepository, readWorkspaces, selectedByRepository } from './gitWorkspaceModel';

interface Plan {
  entry: GitRepositoryEntry; head: string | null;
  files: GitCommitRequest['files']; references: Map<string, GitRepositoryEntry>;
}

async function planCommit(client: GitClient, entries: GitRepositoryEntry[], request: GitCommitRequest) {
  const states = await readWorkspaces(client, entries);
  if (states[0]?.changes.head !== request.head || !request.files.length) {
    throw new Error('client.git.filesOrBranchesHaveChangedRefreshAndSelectTheFiles');
  }
  const selected = selectedByRepository(states, request.files);
  const plans = new Map<string, Plan>();
  const include = (entry: GitRepositoryEntry): Plan => {
    let plan = plans.get(entry.root);
    if (!plan) {
      const state = states.find(state => state.entry.root === entry.root)!;
      plan = { entry, head: state.changes.head, files: selected.get(entry.root) ?? [], references: new Map() };
      plans.set(entry.root, plan);
    }
    return plan;
  };
  for (const state of states.filter(state => selected.has(state.entry.root))) {
    let entry = state.entry;
    include(entry);
    let parent = parentRepository(entries, entry);
    while (parent) {
      include(parent).references.set(localPath(parent, entry.path), entry);
      entry = parent; parent = parentRepository(entries, entry);
    }
  }
  // A selected existing reference also depends on publishing the child's current commit.
  for (const entry of entries.filter(entry => entry.available && entry.path)) {
    const parent = parentRepository(entries, entry)!;
    if (plans.get(parent.root)?.files.some(file => file.path === localPath(parent, entry.path))) include(entry);
  }
  for (const state of states.filter(state => plans.has(state.entry.root))) {
    if (state.changes.integration || state.changes.files.some(file => file.conflict)) {
      throw new Error('client.gitConflict.resolveFirst');
    }
  }
  return childFirst([...plans.values()].map(plan => plan.entry)).map(entry => plans.get(entry.root)!);
}

async function commitPlan(client: GitClient, plan: Plan, message: string, heads: Map<string, string | null>) {
  const current = await client.changes(plan.entry.root);
  if (current.head !== plan.head) throw new Error('client.git.filesOrBranchesHaveChangedRefreshAndSelectTheFiles');
  const files = new Map(plan.files.map(file => [file.path, file]));
  for (const [path, child] of plan.references) {
    const childState = await client.changes(child.root);
    if (childState.head !== heads.get(child.root)) {
      throw new Error('client.git.filesOrBranchesHaveChangedRefreshAndSelectTheFiles');
    }
    const reference = current.files.find(file => file.path === path);
    if (reference && reference.referenceChanged !== false) files.set(path, reference);
    else files.delete(path);
  }
  if (!files.size) return { hash: current.head, committed: false, branch: current.branch };
  const result = await client.commit({ cwd: plan.entry.root, head: current.head, message,
    files: [...files.values()].map(({ path, version }) => ({ path, version })) });
  return { ...result, committed: true, branch: current.branch };
}

/** Child commits are published before an ancestor records them. Never roll back completed repositories on failure. */
export async function commitWorkspace(options: {
  client: GitClient; entries: GitRepositoryEntry[]; request: GitCommitRequest; push: boolean;
  onCommitted?: (entry: GitRepositoryEntry, hash: string) => void;
}) {
  const { client, entries, request, push } = options;
  const plans = await planCommit(client, entries, request);
  if (push) {
    for (const plan of plans) {
      const repository = await client.repository(plan.entry.root);
      if (!repository.upstream || !repository.remotes.length) {
        const reason = t('client.git.setATrackedBranchOnYourComputerFirst');
        throw new Error(`${plan.entry.path || plan.entry.root}: ${reason}`);
      }
    }
  }
  const heads = new Map<string, string | null>();
  const completed: string[] = [];
  let hash = request.head;
  for (const plan of plans) {
    try {
      const result = await commitPlan(client, plan, request.message, heads);
      heads.set(plan.entry.root, result.hash); hash = result.hash;
      if (result.committed && result.hash) options.onCommitted?.(plan.entry, result.hash);
      if (result.committed && result.hash) completed.push(`${plan.entry.path || plan.entry.root}: `
        + t('client.git.committed', { hash: result.hash.slice(0, 8) }));
      if (push) await client.action({ cwd: plan.entry.root, action: 'push', head: result.hash, branch: result.branch });
    } catch (error) {
      throw new Error([...completed, `${plan.entry.path || plan.entry.root}: ${displayError(error)}`].join('\n'));
    }
  }
  if (!hash) throw new Error('client.git.selectFilesAndWriteACommitMessage');
  return { hash };
}
