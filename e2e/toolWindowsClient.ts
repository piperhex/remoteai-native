import { createGuiToolsClient, type GuiToolsClient } from '../vendor/shared/remote-chat/guiTools';
import { createAsyncGitFixture } from '../vendor/shared/remote-chat/testing/gitFixture';
import { createProjectBrowserClient } from '../vendor/shared/project-browser/protocol';
import { browserRequest } from '../vendor/apps/desktop/e2e/project-browser-fixture';
import type { TerminalInfo } from '../vendor/shared/terminal/types';

/** Exercise the production tools without connecting to a PC or starting a real shell. */
export function createToolWindowsClient(): GuiToolsClient {
  const base = createGuiToolsClient(async () => { throw new Error('Unexpected tool fixture request'); });
  const terminals = new Map<string, TerminalInfo>();
  return {
    ...base,
    projectBrowser: createProjectBrowserClient(browserRequest),
    git: createAsyncGitFixture(),
    desktop: { open: () => new Promise(() => undefined), signal: async () => ({ candidates: [] }),
      settings: async () => undefined, close: async () => undefined },
    terminal: {
      ...base.terminal,
      list: async () => [...terminals.values()],
      open: async cwd => {
        const session = { id: `fixture-${terminals.size}`, cwd, projectCwd: cwd, shell: 'Fixture shell' };
        terminals.set(session.id, session);
        return session;
      },
      read: async (id, cursor) => ({ found: terminals.has(id), cursor: 1, truncated: false,
        events: cursor ? [] : [{ type: 'output', data: Array.from('TOOL_WINDOW_READY\r\n$ ',
          character => character.charCodeAt(0)) }] }),
      write: async () => undefined, resize: async () => undefined,
      close: async id => { terminals.delete(id); },
    },
  };
}
