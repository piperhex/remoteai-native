import React, { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CliEnginePicker } from './CliEnginePicker';
import { CliController } from '../../../vendor/shared/cli-gui/controller';
import { createCliFixture } from '../../../scripts/fixtures/cli-gui';

const mocked = vi.hoisted(() => ({ controller: null as CliController | null }));
vi.mock('../../../vendor/shared/cli-gui/context', () => ({ useCliGui: () => mocked.controller
  ? { controller: mocked.controller, state: mocked.controller.getSnapshot() } : null }));
vi.mock('react', async original => ({ ...await original<typeof React>(),
  useEffect: vi.fn(), useState: () => [true, vi.fn()],
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable', Text: 'Text', Keyboard: { dismiss: vi.fn() },
  Platform: { OS: 'android' }, StyleSheet: { create: <T,>(value: T) => value } }));
vi.mock('@expo/vector-icons/Feather', () => ({ default: 'Icon' }));
vi.mock('../../components/BottomSheet', () => ({ BottomSheet: 'BottomSheet' }));
vi.mock('../../components/SheetScrollView', () => ({ SheetScrollView: 'Scroll' }));
interface Props { children?: ReactNode; accessibilityLabel?: string; onPress?: () => void; disabled?: boolean }
function nodes(tree: ReactNode): ReactElement<Props>[] {
  return Children.toArray(tree).flatMap(child => isValidElement<Props>(child)
    ? [child, ...nodes(child.props.children)] : []);
}
beforeEach(() => {
  vi.stubGlobal('React', React);
  mocked.controller = new CliController(createCliFixture().transport, () => 'native');
});
afterEach(() => vi.unstubAllGlobals());

it('offers all three engines for a fresh native conversation and forwards its project', () => {
  const view = nodes(CliEnginePicker({ active: true, ready: true, cwd: '/new-project' }));
  for (const name of ['Codex GUI', 'Claude GUI', 'Gemini GUI']) {
    expect(view.find(node => node.props.accessibilityLabel === name)?.props.disabled).toBe(false);
  }
  view.find(node => node.props.accessibilityLabel === 'Gemini GUI')?.props.onPress?.();
  expect(mocked.controller?.getSnapshot()).toMatchObject({ engine: 'gemini', cwd: '/new-project' });
});

it('locks existing Codex and external conversations and prevents offline switching', () => {
  const existing = nodes(CliEnginePicker({ active: true, ready: true, locked: true }));
  expect(existing.find(node => node.props.accessibilityLabel === 'Claude GUI')?.props.disabled).toBe(true);
  mocked.controller?.patch({ engine: 'claude', selected: createCliFixture().sessions[0] });
  const external = nodes(CliEnginePicker({ active: true, ready: true }));
  expect(external.find(node => node.props.accessibilityLabel === 'Gemini GUI')?.props.disabled).toBe(true);
  const offline = nodes(CliEnginePicker({ active: true, ready: false }));
  expect(offline.find(node => node.props.accessibilityLabel === '选择 CLI')?.props.disabled).toBe(true);
});
