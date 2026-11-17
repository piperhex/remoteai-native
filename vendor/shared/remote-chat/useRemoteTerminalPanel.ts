import { useEffect, useMemo, useState, type SetStateAction } from 'react';
import type { GuiToolsClient } from './guiTools';
import type { TerminalInfo } from '../terminal/types';
import { terminalBelongsToProject, terminalProjectKey } from './terminalProject';
import { useScriptTerminalRefresh } from './useScriptTerminalRefresh';

const INITIAL_SIZE = { cols: 80, rows: 24 };
export const MAX_REMOTE_TERMINALS = 8;
interface Tab { id: string; cwd: string; session: TerminalInfo; exited?: boolean }
interface Panel { tabs: Tab[]; selected: string; open: boolean; busy: boolean; error: string }
const EMPTY_PANEL: Panel = { tabs: [], selected: '', open: false, busy: false, error: '' };
const asTab = (session: TerminalInfo): Tab => ({ id: session.id, cwd: session.cwd, session, exited: session.exited });
const restoreTab = (session: TerminalInfo, previous?: Tab): Tab => {
  if (!previous) return asTab(session);
  return session.exited && !previous.exited ? { ...previous, exited: true } : previous;
};

/** Both phone clients discover this project's PC shells without owning their lifetime. */
export function useRemoteTerminalPanel(options: {
  client: Pick<GuiToolsClient['terminal'], 'list' | 'open' | 'close'>; cwd: string; connected: boolean;
  errorKey?: string;
}) {
  const { client, cwd, connected } = options;
  const project = terminalProjectKey(cwd);
  const projects = useMemo(() => new Map<string, { pending: boolean; generation: number; panel: Panel }>(), [client]);
  const scope = useMemo(() => {
    const retained = projects.get(project) ?? { pending: false, generation: 0, panel: EMPTY_PANEL };
    projects.set(project, retained);
    return retained;
  }, [projects, project]);
  const [, render] = useState(0);
  const panel = scope.panel;
  const update = (change: Partial<Panel> | ((previous: Panel) => Partial<Panel>)) => {
    const current = scope.panel;
    scope.panel = { ...current, ...(typeof change === 'function' ? change(current) : change) };
    render(version => version + 1);
  };
  useEffect(() => () => {
    scope.generation += 1;
    scope.panel = { ...scope.panel, busy: false };
  }, [scope]);

  const run = async (action: (current: () => boolean) => Promise<void>) => {
    if (scope.pending) return;
    if (!connected) { update({ error: '请先连接电脑，再试一次。' }); return; }
    scope.pending = true; update({ busy: true, error: '' });
    const version = ++scope.generation;
    const current = () => version === scope.generation;
    try { await action(current); }
    catch { if (current()) update({ error: options.errorKey ?? '终端暂时无法连接，请确认电脑在线后重试。' }); }
    finally { scope.pending = false; if (current()) update({ busy: false }); }
  };
  // Filtering also supports PCs running the previous, unscoped list protocol.
  const list = async () => (await client.list(cwd)).filter(session => terminalBelongsToProject(session, cwd));
  const restore = (sessions: TerminalInfo[]) => update(previous => ({
    tabs: sessions.map(session => restoreTab(session, previous.tabs.find(tab => tab.id === session.id))),
    selected: sessions.some(session => session.id === previous.selected)
      ? previous.selected : sessions.at(-1)?.id ?? '',
  }));
  useScriptTerminalRefresh({ scope, enabled: connected && panel.tabs.some(tab =>
    tab.session.npmScript && !tab.exited && !tab.session.exited), refresh: async current => {
    if (scope.pending) return;
    const version = scope.generation;
    const sessions = await list();
    if (current() && !scope.pending && version === scope.generation) restore(sessions);
  } });
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    const version = scope.generation;
    const current = () => !cancelled && !scope.pending && version === scope.generation;
    void list().then(sessions => {
      if (current()) { restore(sessions); update({ error: '' }); }
    }).catch(() => {
      if (current()) update({ error: options.errorKey ?? '无法读取电脑上的终端，请稍后重试。' });
    });
    return () => { cancelled = true; };
  }, [scope, connected]);

  const create = async (current: () => boolean, directory = cwd, npmScript?: string) => {
    const session = await (npmScript ? client.open(directory, INITIAL_SIZE, cwd, { npmScript })
      : directory === cwd ? client.open(cwd, INITIAL_SIZE)
      : client.open(directory, INITIAL_SIZE, cwd));
    // A late open remains on its original project even after switching away.
    if (!current()) return;
    update(previous => ({ tabs: [...previous.tabs.filter(tab => tab.id !== session.id), asTab(session)],
      selected: session.id, open: true }));
  };
  const addInDirectory = (directory: string, npmScript?: string) => { void run(async current => {
    update({ open: true });
    const sessions = await list();
    if (!current()) return;
    restore(sessions);
    const existing = sessions.find(session => npmScript && !session.exited && session.npmScript === npmScript
      && terminalProjectKey(session.npmScriptCwd ?? session.cwd) === terminalProjectKey(directory));
    if (existing) { update({ selected: existing.id, open: true }); return; }
    if (sessions.length >= MAX_REMOTE_TERMINALS) { update({ error: '终端较多，请先关闭一个再试。' }); return; }
    await create(current, directory, npmScript);
  }); };
  const add = () => addInDirectory(cwd);
  const show = () => {
    if (scope.panel.open) return;
    if (scope.panel.tabs.length) { update({ open: true }); return; }
    void run(async current => {
      const sessions = await list();
      if (!current()) return;
      restore(sessions);
      if (sessions.length) update({ open: true });
      else await create(current);
    });
  };
  const toggle = () => { if (scope.panel.open) update({ open: false }); else show(); };
  const removeTabs = (ids: string[]) => { void run(async current => {
    for (const id of ids) {
      await client.close(id);
      if (!current()) return;
      update(previous => {
        const tabs = previous.tabs.filter(tab => tab.id !== id);
        return { tabs, selected: previous.selected === id ? tabs.at(-1)?.id ?? '' : previous.selected,
          open: tabs.length > 0 && previous.open };
      });
    }
  }); };
  const remove = (id: string) => removeTabs([id]);
  const select = (selected: SetStateAction<string>) => update(previous => ({
    selected: typeof selected === 'function' ? selected(previous.selected) : selected,
  }));
  const adopt = (session: TerminalInfo) => update(previous => ({
    tabs: [...previous.tabs.filter(tab => tab.id !== session.id), asTab(session)],
    selected: session.id, open: true, error: '',
  }));
  const exited = (id: string) => update(previous => ({
    tabs: previous.tabs.map(tab => tab.id === id ? { ...tab, exited: true } : tab),
  }));
  return { ...panel, add, adopt, projectCwd: cwd, addInDirectory, remove, removeTabs, show, toggle, select, exited,
    hide: () => update({ open: false }) };
}
