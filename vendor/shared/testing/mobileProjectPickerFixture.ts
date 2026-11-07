import { ChatController } from '../remote-chat/client/controller';
import type { ProjectDirectory } from '../remote-chat/projectDirectories';

/** Deterministic host responses shared by Native and mobile Web UI checks. */
export function createMobileProjectPickerFixture() {
  const cwd = 'E:/Workspace';
  const projects = [{ cwd, label: 'Workspace' }, { cwd: `${cwd}/Projects`, label: 'Projects' }];
  const shortcuts = { home: 'C:/Users/RemoteUser', desktop: 'D:/Cloud/Desktop', downloads: 'D:/Downloads',
    documents: 'D:/Cloud/Documents' };
  const entries = new Map<string, ProjectDirectory[]>([
    ['', [{ name: 'E:', path: 'E:/' }]], ['E:/', [{ name: 'Workspace', path: cwd }]],
    [cwd, ['Apps', 'Design', 'Projects', 'RemoteAI', 'Work', 'Temp'].map((name, index) => ({
      name, path: `${cwd}/${name}`, directory: true, modified: 1793268120 - index * 86400,
    }))], ...Object.values(shortcuts).map(path => [path, []] as [string, ProjectDirectory[]]),
  ]);
  for (const entry of entries.get(cwd)!) entries.set(entry.path, []);
  const fixture = { calls: [] as object[], failRead: false, failCreate: false };
  const request = async <T,>(_method: string, body?: unknown): Promise<T> => {
    const input = body as { operation: string; directory: string; path: string; name: string; cwd: string };
    fixture.calls.push(input);
    if (input.operation === 'guiProjects') return projects as T;
    if (input.operation === 'guiProjectSelect') return { cwd: input.cwd, label: input.cwd.split('/').at(-1) } as T;
    if (input.operation === 'projectEntryAction') {
      if (fixture.failCreate) { fixture.failCreate = false; throw new Error('failed'); }
      const path = `${input.path}/${input.name}`;
      if (entries.has(path)) throw new Error('exists');
      entries.set(path, []); entries.get(input.path)?.push({ name: input.name, path, directory: true });
      return { path, directory: true } as T;
    }
    if (fixture.failRead) { fixture.failRead = false; throw new Error('unavailable'); }
    const directory = input.directory;
    const children = entries.get(directory);
    if (!children) throw new Error('unavailable');
    return { directory, parent: directory === cwd ? 'E:/' : directory === 'E:/' ? '' : cwd,
      entries: children, truncated: false, ...(directory ? {} : { shortcuts }) } as T;
  };
  const controller = new ChatController(() => ({ start() {}, stop() {}, request }));
  Object.assign(controller.snapshot(), { ready: true, draftProject: projects[0],
    threads: [{ id: 'existing', cwd, preview: '', updatedAt: 1 }] });
  return { controller, fixture };
}
