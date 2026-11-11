import type { CliCatalog, CliEntry, CliHistory, CliRequest, CliSession, CliTransport, ExternalEngine }
  from '../../vendor/shared/cli-gui/types';
import type { GuiAccountsClient, GuiAccountSwitchRequest } from '../../vendor/shared/remote-chat/guiAccounts';

/** Deterministic remote host for native interaction tests; no credentials or paid requests. */
export function createCliFixture() {
  const calls: CliRequest[] = [];
  const accountCalls: GuiAccountSwitchRequest[] = [];
  const listeners = new Set<() => void>();
  const accountListeners = new Set<() => void>();
  let selection: GuiAccountSwitchRequest = { kind: 'account', id: 'internal' };
  const installed = new Set<ExternalEngine>(['claude', 'gemini']);
  const sessions: CliSession[] = (['claude', 'gemini'] as const).map(engine => ({
    engine, id: engine + '-history', title: engine === 'claude' ? '检查项目结构' : '整理测试计划',
    cwd: '/project', model: 'model-a', effort: 'high', status: 'idle', archived: false,
    permissions: [], updatedAt: '2026-11-11T10:00:00Z',
  }));
  const entries = new Map<string, CliEntry[]>(sessions.map(session => [session.id, [
    { id: 'user', first: 1, last: 1, role: 'user', text: session.title },
    { id: 'reply', first: 2, last: 2, role: 'assistant', text: '已检查项目结构，正在整理下一步计划。' },
  ]]));
  const catalog = (engine: ExternalEngine): CliCatalog => ({ status: 'ready', models: [
    { id: selection.kind === 'provider' ? 'team-model' : 'model-a', label: 'Model A', isDefault: true,
      defaultEffort: 'high', efforts: [{ id: 'high', label: 'High' }, { id: 'medium', label: 'Medium' }] },
    { id: 'model-b', label: 'Model B', efforts: [] },
    ...['C', 'D', 'E', 'F', 'G', 'H'].map(name => ({ id: `model-${name.toLowerCase()}`, label: `Model ${name}` })),
  ], modes: (engine === 'claude' ? ['default', 'acceptEdits', 'auto', 'bypassPermissions', 'plan']
    : ['default', 'autoEdit', 'yolo', 'plan']).map(id => ({ id, label: id })), defaultMode: 'default' });
  const notify = () => listeners.forEach(fn => fn());
  const accounts: GuiAccountsClient = {
    read: async () => ({ selection, running: true, choices: [
      { kind: 'account', id: 'internal', name: 'Remote AI', detail: 'Pro', available: true },
      { kind: 'provider', id: 'team', name: 'Team API', detail: 'Team models', available: true },
    ] }),
    select: async next => {
      selection = next; accountCalls.push(next); accountListeners.forEach(fn => fn()); return next;
    },
    subscribe: fn => { accountListeners.add(fn); return () => { accountListeners.delete(fn); }; },
  };
  async function request(input: CliRequest): Promise<unknown> {
    calls.push(input);
    if (input.action === 'status') return { status: installed.has(input.engine) ? 'ready' : 'missing',
      version: '0.15.4', cliVersion: input.engine === 'claude' ? '2.1.42' : '0.32.1' };
    if (input.action === 'install') { installed.add(input.engine); notify(); return {}; }
    if (input.action === 'catalog') return catalog(input.engine);
    if (input.action === 'list') return sessions.filter(s => s.engine === input.engine && s.archived === input.archived);
    if (input.action === 'create') {
      const session: CliSession = { ...sessions[0], engine: input.engine, id: 'created-' + sessions.length,
        cwd: input.cwd, model: input.model, effort: input.effort, title: '新的项目任务', archived: false, permissions: [] };
      sessions.push(session); entries.set(session.id, []); return session;
    }
    if (!('id' in input)) throw new Error('client.cliGui.invalidRequest');
    const session = sessions.find(s => s.id === input.id && s.engine === input.engine);
    if (!session) throw new Error('client.cliGui.invalidRequest');
    if (input.action === 'read') return { session: { ...session }, entries: input.cursor
      ? [{ id: 'older', first: 0, last: 0, role: 'assistant', text: '更早的项目讨论。' }] : entries.get(session.id) ?? [],
      hasOlder: !input.cursor, cursor: { epoch: 'test', seq: input.cursor ? 0 : 1 } } satisfies CliHistory;
    if (input.action === 'send') {
      entries.get(session.id)?.push({ id: input.messageId, first: 3, last: 3, role: 'user', text: input.text });
      session.permissions = [{ id: 'permission', title: '更新项目说明', actions: [
        { id: 'allow-exact', behavior: 'allow', label: '' }, { id: 'deny-exact', behavior: 'deny', label: '' },
      ] }];
    }
    if (input.action === 'approve') {
      session.permissions = [];
      entries.get(session.id)?.push({ id: 'result', first: 4, last: 4, role: 'assistant', text: '已完成项目检查。' });
    }
    if (input.action === 'stop') session.status = 'idle';
    if (input.action === 'archive') session.archived = true;
    notify(); return {};
  }
  const transport: CliTransport = { request: async <T>(input: CliRequest) => await request(input) as T,
    subscribeAccountChange: accounts.subscribe,
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; } };
  return { transport, accounts, calls, accountCalls, sessions, installed, notify };
}
