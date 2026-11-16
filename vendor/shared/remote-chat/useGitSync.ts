import { useEffect, useState } from 'react';
import type { GitAction, GitChanges, GitClient, GitStrategy } from './gitTypes';
import { GIT_ACTION_NOTICE } from './gitActions';

interface Options {
  client: GitClient; cwd: string; scope: object; changes: GitChanges | null; strategy: GitStrategy;
  run: (action: () => Promise<void>) => Promise<void>; load: () => Promise<void>;
  isCurrent: () => boolean; onDone: () => void; setNotice: (notice: string) => void;
}

export function useGitSync(options: Options) {
  const [updating, setUpdating] = useState(false);
  useEffect(() => setUpdating(false), [options.scope]);
  const action = (action: GitAction, target?: string) => options.run(async () => {
    const { changes, client, cwd, strategy, isCurrent, onDone, setNotice, load } = options;
    if (!changes) return;
    const update = action === 'pull' || action === 'update';
    setUpdating(update);
    let failure: unknown;
    try {
      await client.action({ cwd, action, target, strategy, head: changes.head, branch: changes.branch });
      if (!isCurrent()) return;
      onDone();
      setNotice(update ? 'client.gitUpdate.completed' : GIT_ACTION_NOTICE[action]);
    } catch (error) { failure = error; if (isCurrent() && update) onDone(); }
    finally {
      // Integration or restoration can change files even when Git reports a failure.
      try { if (isCurrent()) await load(); } catch (error) { failure ??= error; }
      if (isCurrent()) setUpdating(false);
    }
    if (failure) throw failure;
  });
  return { action, updating };
}
