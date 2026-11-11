import { afterEach, expect, it, vi } from 'vitest';
import { CliController } from '../../../vendor/shared/cli-gui/controller';
import { cliSidebarThread } from '../../../vendor/shared/cli-gui/useCliSidebar';
import { cliThread } from '../../../vendor/shared/cli-gui/presentation';
import { createCliFixture } from '../../../scripts/fixtures/cli-gui';

afterEach(() => vi.useRealTimers());

it('routes creation, messages, approvals, history and archive through the selected CLI with a native ID', async () => {
  const fixture = createCliFixture();
  const controller = new CliController(fixture.transport, () => 'expo-uuid');
  await controller.refresh();
  controller.chooseEngine('claude');
  await controller.loadCatalog();
  controller.edit('检查项目');
  await controller.send();
  expect(fixture.calls).toContainEqual({ engine: 'claude', action: 'send', id: 'created-2',
    text: '检查项目', messageId: 'expo-uuid', model: 'model-a', effort: 'high' });
  controller.chooseEngine('gemini');
  expect(controller.getSnapshot().engine).toBe('claude');
  await controller.act({ engine: 'claude', action: 'approve', id: 'created-2',
    permissionId: 'permission', actionId: 'allow-exact' });
  fixture.sessions.find(session => session.id === 'created-2')!.status = 'running';
  await controller.refresh();
  await controller.act({ engine: 'claude', action: 'stop', id: 'created-2' });
  expect(controller.getSnapshot().selected?.status).toBe('idle');
  await controller.loadOlder();
  expect(cliThread(controller.getSnapshot().history)?.turns?.[0].items[0].text).toBe('更早的项目讨论。');
  await controller.act({ engine: 'claude', action: 'archive', id: 'created-2' });
  expect(controller.getSnapshot().selected).toBeNull();
  controller.filter(true); await controller.refresh();
  await expect.poll(() => controller.getSnapshot().sessions.map(cliSidebarThread)).toEqual([
    expect.objectContaining({ id: 'cli:claude:created-2' }),
  ]);
});

it('isolates engine drafts and refuses unavailable models after switching accounts', async () => {
  const fixture = createCliFixture();
  const controller = new CliController(fixture.transport, () => 'native-id');
  const stop = controller.start();
  await controller.refresh();
  controller.chooseEngine('claude'); await controller.loadCatalog(); controller.edit('Claude draft');
  controller.chooseEngine('gemini'); await controller.loadCatalog(); controller.edit('Gemini draft');
  controller.chooseEngine('claude'); await controller.loadCatalog();
  expect(controller.getSnapshot().draft).toBe('Claude draft');
  controller.patch({ model: 'removed-model' }); await controller.send();
  expect(fixture.calls.some(call => call.action === 'create')).toBe(false);
  await fixture.accounts.select({ kind: 'provider', id: 'team', engine: 'claude' });
  await controller.loadCatalog();
  expect(controller.getSnapshot().model).toBe('team-model');
  stop();
});

it('stops refreshing after the native view becomes inactive and resumes its selected session', async () => {
  vi.useFakeTimers();
  const fixture = createCliFixture();
  const controller = new CliController(fixture.transport, () => 'native-id');
  const stop = controller.start(); await controller.refresh();
  controller.open(fixture.sessions[1]); await controller.refresh();
  stop(); await vi.runAllTimersAsync();
  const count = fixture.calls.length;
  fixture.notify(); await vi.advanceTimersByTimeAsync(10_000);
  expect(fixture.calls).toHaveLength(count);
  const resume = controller.start(); await controller.refresh();
  expect(controller.getSnapshot().selected?.id).toBe('gemini-history');
  resume();
});
