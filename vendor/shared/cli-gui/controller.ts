import type { CliCatalog, CliEntry, CliHistory, CliRequest, CliRuntimeStatus, CliSession,
  CliTransport, ExternalEngine, GuiEngine } from './types';
import { modelSelectionError, resolveModelSelection } from '../conversation/modelSelection';
import { cliPickerModels, cliRequestEffort } from './modelSelection';

export interface CliState {
  engine: GuiEngine; selected: CliSession | null; sessions: CliSession[]; history: CliHistory | null;
  runtime: Partial<Record<ExternalEngine, CliRuntimeStatus>>; catalog: CliCatalog | null;
  cwd: string; model: string; effort: string; mode: string; draft: string;
  busy: boolean; loading: boolean; error: string; archived: boolean;
}
export class CliController {
  private state: CliState = { engine: 'codex', selected: null, sessions: [], history: null, runtime: {},
    catalog: null, cwd: '', model: '', effort: '', mode: '', draft: '', busy: false, loading: false, error: '', archived: false };
  private listeners = new Set<() => void>();
  private drafts = new Map<string, string>();
  private revision = 0;
  private catalogRevision = 0;
  private refreshPromise?: Promise<void>;
  private active = false;
  private generation = 0;
  private refreshAgain = false;
  private timer?: ReturnType<typeof setTimeout>;
  private unsubscribe?: () => void;
  private unsubscribeAccount?: () => void;
  private older?: { revision: number; generation: number; history: CliHistory };
  constructor(private readonly transport: CliTransport,
    private readonly createMessageId: () => string = () => crypto.randomUUID()) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  patch = (patch: Partial<CliState>) => {
    this.state = { ...this.state, ...patch };
    if (this.older && !this.isOlderCurrent(this.older)) {
      this.older = undefined;
      this.state.loading = patch.loading ?? false;
    } else if (this.older) this.state.loading = true;
    this.listeners.forEach(fn => fn());
  };
  private key() { return `${this.state.engine}:${this.state.selected?.id ?? 'draft'}`; }
  private saveDraft() { this.drafts.set(this.key(), this.state.draft); }
  edit = (draft: string) => { this.patch({ draft }); this.saveDraft(); };
  report = (error: unknown) => this.patch({ error: typeof error === 'string' ? error
    : error instanceof Error ? error.message : 'client.cliGui.requestFailed' });

  start() {
    const generation = ++this.generation;
    this.active = true;
    if (this.transport.subscribeAccountChange) {
      void Promise.resolve(this.transport.subscribeAccountChange(() => {
        this.catalogRevision++;
        this.patch({ catalog: null, ...(!this.state.selected ? { model: '', effort: '' } : {}) });
        void this.loadCatalog();
      })).then(stop => {
        if (this.active && generation === this.generation) this.unsubscribeAccount = stop; else stop();
      }).catch(this.report);
    }
    void Promise.resolve(this.transport.subscribe(() => this.schedule())).then(unsubscribe => {
      if (this.active && generation === this.generation) this.unsubscribe = unsubscribe; else unsubscribe();
    }).catch(this.report);
    void this.refresh();
    return () => { if (generation !== this.generation) return;
      ++this.generation; this.active = false; this.unsubscribe?.(); this.unsubscribeAccount?.();
      if (this.older) { this.older = undefined; this.patch({ loading: false }); }
      clearTimeout(this.timer); this.timer = undefined; };
  }
  private schedule = () => {
    if (!this.active || this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.refresh(); }, 1000);
  };
  showCodex = () => {
    this.saveDraft(); this.revision++;
    this.patch({ engine: 'codex', selected: null, history: null, loading: false, error: '' });
  };
  chooseEngine = (engine: GuiEngine) => {
    if (this.state.selected || this.state.busy || this.state.engine === engine) return;
    this.saveDraft(); this.revision++;
    this.patch({ engine, history: null, catalog: null, model: '', effort: '', mode: '', loading: false, error: '',
      draft: this.drafts.get(`${engine}:draft`) ?? '' });
    if (engine !== 'codex') void this.refresh().then(this.loadCatalog);
  };
  newConversation = () => {
    if (this.state.busy) return;
    this.saveDraft(); this.revision++;
    this.patch({ selected: null, history: null, catalog: null, model: '', effort: '', loading: false, error: '',
      draft: this.drafts.get(`${this.state.engine}:draft`) ?? '' });
    if (this.state.engine !== 'codex') void this.loadCatalog();
  };
  open = (selected: CliSession) => {
    if (this.state.busy) return;
    this.saveDraft(); this.revision++;
    this.patch({ selected, engine: selected.engine, model: selected.model, effort: selected.effort ?? '',
      history: null, catalog: null, loading: true, error: '',
      draft: this.drafts.get(`${selected.engine}:${selected.id}`) ?? '' });
    void this.refresh();
    void this.loadCatalog();
  };
  private async read<T>(request: CliRequest) { return this.transport.request<T>(request); }

  refresh = (): Promise<void> => {
    if (this.refreshPromise) { this.refreshAgain = true; return this.refreshPromise; }
    this.refreshPromise = this.synchronize().catch(error => {
      if (this.state.engine !== 'codex') { this.report(error); this.patch({ loading: false }); }
    }).finally(() => {
      this.refreshPromise = undefined;
      if (this.refreshAgain) { this.refreshAgain = false; void this.refresh(); }
    });
    return this.refreshPromise;
  };
  private async synchronize() {
    const revision = this.revision;
    const archived = this.state.archived;
    const wasReady = this.state.engine !== 'codex' && this.state.runtime[this.state.engine]?.status === 'ready';
    const runtimes = await Promise.all((['claude', 'gemini'] as const).map(async engine =>
      [engine, await this.read<CliRuntimeStatus>({ engine, action: 'status' })] as const));
    this.patch({ runtime: Object.fromEntries(runtimes) });
    if (runtimes.some(([, value]) => value.status === 'installing')) { this.schedule(); return; }
    if (!runtimes.some(([, value]) => value.status === 'ready')) return;
    const lists = await Promise.all((['claude', 'gemini'] as const).map(engine =>
      this.read<CliSession[]>({ engine, action: 'list', archived })));
    if (archived === this.state.archived) {
      this.patch({ sessions: lists.flat().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
    }
    if (!wasReady && this.state.engine !== 'codex') void this.loadCatalog();
    const { selected } = this.state;
    if (!selected || revision !== this.revision) return;
    const history = await this.read<CliHistory>({ engine: selected.engine, action: 'read', id: selected.id });
    if (revision === this.revision) this.patch({ history: preserveOlder(this.state.history, history),
      selected: history.session, loading: false });
    if (history.session.status === 'running' || history.session.permissions.length) this.schedule();
  }
  filter = (archived: boolean) => {
    if (this.state.archived === archived) return;
    this.patch({ archived, sessions: [] });
    void this.refresh();
  };
  loadCatalog = async () => {
    const { engine, cwd } = this.state;
    if (engine === 'codex' || this.state.runtime[engine]?.status !== 'ready') return;
    const revision = this.revision;
    const catalogRevision = ++this.catalogRevision;
    this.patch({ catalog: null });
    try {
      const catalog = await this.read<CliCatalog>({ engine, action: 'catalog', cwd: cwd || undefined,
        id: this.state.selected?.id });
      if (revision !== this.revision || catalogRevision !== this.catalogRevision || cwd !== this.state.cwd) return;
      const selection = resolveModelSelection(cliPickerModels(catalog.models), this.state);
      this.patch({ catalog, ...selection,
        mode: catalog.modes.some(mode => mode.id === 'default') ? 'default' : catalog.defaultMode ?? '' });
    } catch (error) {
      if (revision === this.revision && catalogRevision === this.catalogRevision) this.report(error);
    }
  };
  install = async () => {
    const engine = this.state.engine;
    if (engine === 'codex') return;
    try { await this.read({ engine, action: 'install' }); this.patch({ error: '' }); this.schedule(); }
    catch (error) { this.report(error); }
  };
  send = async () => {
    const { engine, selected, cwd, model, mode, draft, catalog } = this.state;
    if (engine === 'codex' || this.state.busy || !draft.trim() || selected?.archived) return;
    if (catalog?.status !== 'ready' || this.state.runtime[engine]?.status !== 'ready'
      || selected?.status === 'running' || selected?.permissions.length) return;
    const error = modelSelectionError(cliPickerModels(catalog.models), this.state);
    if (error) { this.report(error); return; }
    const chosen = catalog.models.find(entry => entry.id === model);
    if (!chosen) return;
    const effort = cliRequestEffort(chosen, this.state.effort);
    const revision = this.revision;
    this.patch({ busy: true, error: '' });
    try {
      const target = selected ?? await this.read<CliSession>({ engine, action: 'create', cwd, model, effort: effort || undefined,
        ...(mode ? { mode } : {}) });
      if (revision === this.revision) this.patch({ selected: target, history: null });
      await this.read({ engine, action: 'send', id: target.id, text: draft, messageId: this.createMessageId(),
        model, effort: effort || undefined });
      this.drafts.delete(`${engine}:${selected?.id ?? 'draft'}`);
      if (revision === this.revision) this.edit('');
      await this.refresh();
    } catch (error) { this.report(error); }
    finally { this.patch({ busy: false }); }
  };
  act = async (request: CliRequest) => {
    if (this.state.busy) return;
    this.patch({ busy: true, error: '' });
    try {
      await this.read(request);
      if (request.action === 'archive' && this.state.selected?.id === request.id) {
        this.patch({ busy: false }); this.newConversation();
      }
      await this.refresh();
    } catch (error) { this.report(error); }
    finally { this.patch({ busy: false }); }
  };
  loadOlder = async () => {
    const { selected, history } = this.state;
    if (!selected || !history?.cursor || this.state.loading) return;
    const request = { revision: this.revision, generation: this.generation, history };
    this.older = request;
    this.patch({ loading: true, error: '' });
    try {
      const page = await this.read<CliHistory>({ engine: selected.engine, action: 'read', id: selected.id,
        cursor: history.cursor });
      const latest = this.state.history;
      const pageEpoch = page.cursor?.epoch ?? (!page.hasOlder && !page.entries.length ? history.cursor.epoch : undefined);
      if (this.older !== request || !this.isOlderCurrent(request) || !latest
        || page.session.id !== selected.id || page.session.engine !== selected.engine
        || pageEpoch !== history.cursor.epoch) return;
      // Only the older boundary belongs to this response; live replies and session state remain authoritative.
      this.older = undefined;
      this.patch({ history: { ...latest, cursor: page.cursor ?? latest.cursor, hasOlder: page.hasOlder,
        entries: mergeEntries(page.entries, latest.entries) }, loading: false });
    } catch (error) { if (this.older === request) this.report(error); }
    finally {
      if (this.older === request) { this.older = undefined; this.patch({ loading: false }); }
    }
  };
  private isOlderCurrent(request: NonNullable<CliController['older']>) {
    const { selected, history } = this.state;
    return request.revision === this.revision && request.generation === this.generation
      && selected?.id === request.history.session.id && selected.engine === request.history.session.engine
      && !!history && sameHistory(request.history, history)
      && request.history.cursor?.seq === history.cursor?.seq;
  }
}

function sameHistory(previous: CliHistory, next: CliHistory) {
  return previous.session.id === next.session.id && previous.session.engine === next.session.engine
    && previous.cursor?.epoch === next.cursor?.epoch;
}

export function mergeEntries(older: CliEntry[], newer: CliEntry[]) {
  const boundary = newer[0]?.first ?? Infinity;
  return [...older.filter(entry => entry.last < boundary), ...newer];
}
function preserveOlder(previous: CliHistory | null, next: CliHistory): CliHistory {
  if (!previous || !sameHistory(previous, next)) return next;
  const entries = mergeEntries(previous.entries, next.entries);
  return entries.length > next.entries.length
    ? { ...next, entries, cursor: previous.cursor, hasOlder: previous.hasOlder } : next;
}
