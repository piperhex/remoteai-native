/** New projects retain an input scope until it becomes an actual conversation. */
export class DraftScopes {
  private sequence = 0;
  private readonly projects = new Map<string, string>([['', '']]);
  private readonly threads = new Map<string, string>();

  project(cwd = '') {
    let scope = this.projects.get(cwd);
    if (scope === undefined) {
      scope = `draft:${++this.sequence}`;
      this.projects.set(cwd, scope);
    }
    return scope;
  }

  thread(id: string) { return this.threads.get(id) ?? id; }

  created(scope: string, id: string) {
    this.threads.set(id, scope);
    for (const [cwd, value] of this.projects) {
      if (value === scope) this.projects.delete(cwd);
    }
  }
}
