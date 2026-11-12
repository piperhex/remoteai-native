import * as React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { DeviceMappingEntry } from '../../vendor/shared/port-mapping/deviceRegistry';
import { PortMappingPage } from './PortMappingPage';

const runtime = vi.hoisted(() => ({ cursor: 0, states: [] as unknown[], entries: [] as DeviceMappingEntry[] }));
vi.mock('react', async original => ({ ...await original<typeof React>(), useEffect: vi.fn(),
  useRef: () => ({ current: null }),
  useState: (initial: unknown) => {
    const index = runtime.cursor++;
    if (!(index in runtime.states)) runtime.states[index] = initial;
    return [runtime.states[index], (value: unknown) => { runtime.states[index] = value; }];
  },
}));
vi.mock('react-native', () => ({ ScrollView: 'ScrollView', Text: 'Text', View: 'View' }));
vi.mock('../../vendor/shared/port-mapping/deviceRegistry', () => ({ useDeviceMappings: () => runtime.entries }));
vi.mock('../i18n', async original => ({ ...await original<typeof import('../i18n')>(), useLanguage: vi.fn() }));
vi.mock('../chat/portMapping/mappingStyles', () => ({ useMappingStyles: () => ({}) }));
vi.mock('./mappingCardStyles', () => ({ useMappingCardStyles: () => ({}) }));
vi.mock('../components/BottomSheet', () => ({ BottomSheet: 'Sheet' }));
vi.mock('../chat/portMapping/MappingPreview', () => ({ MappingPreview: 'Preview' }));
vi.mock('../chat/portMapping/MappingOpenActions', () => ({ MappingOpenActions: 'Actions' }));
vi.mock('./MappingEditor', () => ({ MappingEditor: 'Editor' }));
vi.mock('./PortMappingHeader', () => ({ PortMappingHeader: 'Header' }));
vi.mock('./PortMappingCard', () => ({ PortMappingCard: 'Card' }));

type Props = { children?: React.ReactNode; open?: () => void; onClose?: () => void;
  preview?: () => void; opened?: () => void; port?: number; subtitle?: string };
function elements(node: React.ReactNode): React.ReactElement<Props>[] {
  return React.Children.toArray(node).flatMap(child => React.isValidElement<Props>(child)
    ? [child, ...elements(child.props.children)] : []);
}
function render() {
  runtime.cursor = 0;
  return elements(PortMappingPage({ devices: [{ deviceId: 'one' }] as never, onBack: vi.fn() }));
}
const find = (type: string) => render().find(node => node.type === type)?.props;
beforeEach(() => {
  vi.stubGlobal('React', React); runtime.states = [];
  runtime.entries = [{ deviceId: 'one', entry: { id: 'mapping', localPort: 18306,
    status: 'running', protocol: 'tcp' } }] as DeviceMappingEntry[];
});

it('opens the chooser before creating a browser and passes the selected local port', () => {
  find('Card')!.open!();
  expect(find('Preview')).toBeUndefined();
  expect(find('Sheet')!.subtitle).toBe('http://127.0.0.1:18306');
  expect(find('Actions')!.port).toBe(18306);
  find('Actions')!.preview!();
  expect(find('Sheet')).toBeUndefined();
  expect(find('Preview')!.port).toBe(18306);
});

it('dismisses the chooser after external opening or cancellation without entering a preview', () => {
  find('Card')!.open!(); find('Actions')!.opened!();
  expect(find('Actions')).toBeUndefined(); expect(find('Preview')).toBeUndefined();
  find('Card')!.open!(); find('Sheet')!.onClose!();
  expect(find('Actions')).toBeUndefined();
});

it('removes browser actions when the selected mapping stops or becomes UDP', () => {
  find('Card')!.open!(); runtime.entries[0].entry.status = 'stopped';
  expect(find('Actions')).toBeUndefined(); expect(find('Preview')).toBeUndefined();
  runtime.entries[0].entry.status = 'running'; runtime.entries[0].entry.protocol = 'udp';
  expect(find('Actions')).toBeUndefined();
});
