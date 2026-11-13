import { beforeEach, expect, it, vi } from 'vitest';
import { useBrowserBack } from './useBrowserNavigationGestures';

const mock = vi.hoisted(() => ({ effect: undefined as (() => (() => void) | undefined) | undefined,
  hardware: undefined as (() => boolean) | undefined, edge: undefined as ((direction: string) => void) | undefined,
  keyboard: false, dismiss: vi.fn(), enable: vi.fn(), hardwareRemove: vi.fn(), edgeRemove: vi.fn() }));
vi.mock('react', () => ({ useEffect: (effect: typeof mock.effect) => { mock.effect = effect; },
  useRef: (value: unknown) => ({ current: value }) }));
vi.mock('../navigation/useHorizontalSwipe', () => ({ useHorizontalSwipe: vi.fn() }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' }, NativeModules: { BrowserGestures: { setEnabled: mock.enable } },
  Keyboard: { isVisible: () => mock.keyboard, dismiss: mock.dismiss },
  BackHandler: { addEventListener: (_event: string, handler: () => boolean) => {
    mock.hardware = handler; return { remove: mock.hardwareRemove };
  } },
  NativeEventEmitter: class { addListener(_event: string, handler: (direction: string) => void) {
    mock.edge = handler; return { remove: mock.edgeRemove };
  } },
}));
beforeEach(() => { vi.clearAllMocks(); mock.keyboard = false; mock.hardware = undefined; mock.edge = undefined; });

it('consumes Android system Back and routes edge directions only while enabled', () => {
  const back = vi.fn(), forward = vi.fn();
  useBrowserBack(true, back, forward);
  const cleanup = mock.effect?.();
  expect(mock.enable).toHaveBeenLastCalledWith(true);
  expect(mock.hardware?.()).toBe(true);
  expect(back).toHaveBeenCalledOnce();
  mock.edge?.('forward'); expect(forward).toHaveBeenCalledOnce();
  mock.edge?.('back'); expect(back).toHaveBeenCalledTimes(2);
  cleanup?.();
  expect(mock.hardwareRemove).toHaveBeenCalledOnce(); expect(mock.edgeRemove).toHaveBeenCalledOnce();
  expect(mock.enable).toHaveBeenLastCalledWith(false);
  useBrowserBack(false, back, forward); mock.effect?.();
  expect(mock.enable).toHaveBeenCalledTimes(2);
});

it('dismisses the keyboard before navigating the browser', () => {
  const back = vi.fn(); mock.keyboard = true;
  useBrowserBack(true, back); mock.effect?.(); mock.hardware?.();
  expect(mock.dismiss).toHaveBeenCalledOnce(); expect(back).not.toHaveBeenCalled();
});
