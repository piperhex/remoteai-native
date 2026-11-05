import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('runs repository commits in the native runtime without browser event APIs', async () => {
  // Hermes defines window, but it does not provide DOM event listeners.
  vi.stubGlobal('window', {});
  const { createGitWorkspaceClient } = await import('../../../vendor/shared/remote-chat/gitWorkspaceClient');
  const { createGitRepositoriesFixture } = await import('../../../vendor/shared/remote-chat/testing/gitRepositoriesFixture');
  const submissions: string[] = [];
  const source = createGitRepositoriesFixture('/project', {
    onSubmission: values => submissions.splice(0, submissions.length, ...values.map(v => `${v.operation}:${v.cwd}`)),
    failChildPush: () => true,
  });
  const { client } = createGitWorkspaceClient(source, '/project');
  const changes = await client.changes('/project');
  const files = changes.files.filter(file => file.path.endsWith('src/app.ts'));
  await expect(client.commitAndPush!({ cwd: '/project', head: changes.head, files, message: 'Update' }))
    .rejects.toThrow('packages/shared: 已提交');
  expect(submissions).toEqual(['commit:/project/packages/shared']);
});
