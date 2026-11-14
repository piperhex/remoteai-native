import { beforeEach, expect, it, vi } from 'vitest';
import { useBrowserBack, useBrowserNavigationGestures } from './useBrowserNavigationGestures';
import { useHorizontalSwipe } from '../navigation/useHorizontalSwipe';
import type { GestureResponderEvent } from 'react-native';

const mock = vi.hoisted(() => ({ effect: undefined as (() => (() => void) | undefined) | undefined,
  hardware: undefined as (() => boolean) | undefined, edge: undefined as ((direction: string) => void) | undefined,
  keyboard: false, dismiss: vi.fn(), enable: vi.fn(), hardwareRemove: vi.fn(), edgeRemove: vi.fn() }));
vi.mock('react', () => ({ useEffect: (effect: typeof mock.effect) => { mock.effect = effect; },
  useCallback: (callback: unknown) => callback,
  useRef: (value: unknown) => ({ current: value }) }));
vi.mock('../navigation/useHorizontalSwipe', () => ({ useHorizontalSwipe: vi.fn(() => ({ panHandlers: {} })) }));
vi.mock('react-native', () => ({
  Platform: { OS: 'android' }, NativeModules: { BrowserGestures: { setEnabled: mock.enable } },
  useWindowDimensions: () => ({ width: 390 }),
  Keyboard: { isVisible: () => mock.keyboard, dismiss: mock.dismiss },
  BackHandler: { addEventListener: (_event: string, handler: () => boolean) => {
    mock.hardware = handler; return { remove: mock.hardwareRemove };
  } },
  NativeEventEmitter: class { addListener(_event: string, handler: (direction: string) => void) {
    mock.edge = handler; return { remove: mock.edgeRemove };
  } },
}));
beforeEach(() => { vi.clearAllMocks(); mock.keyboard = false; mock.hardware = undefined; mock.edge = undefined; });

it('routes both system edges and hardware Back to the same action only while enabled', () => {
  const back = vi.fn();
  useBrowserBack(true, back);
  const cleanup = mock.effect?.();
  expect(mock.enable).toHaveBeenLastCalledWith(true);
  expect(mock.hardware?.()).toBe(true);
  expect(back).toHaveBeenCalledOnce();
  // Older installed bridges can still report the former forward direction.
  mock.edge?.('forward'); expect(back).toHaveBeenCalledTimes(2);
  mock.edge?.('back'); expect(back).toHaveBeenCalledTimes(3);
  cleanup?.();
  expect(mock.hardwareRemove).toHaveBeenCalledOnce(); expect(mock.edgeRemove).toHaveBeenCalledOnce();
  expect(mock.enable).toHaveBeenLastCalledWith(false);
  useBrowserBack(false, back); mock.effect?.();
  expect(mock.enable).toHaveBeenCalledTimes(2);
});

it('dismisses the keyboard before navigating the browser', () => {
  const back = vi.fn(); mock.keyboard = true;
  useBrowserBack(true, back); mock.effect?.(); mock.hardware?.();
  mock.edge?.('forward');
  expect(mock.dismiss).toHaveBeenCalledTimes(2); expect(back).not.toHaveBeenCalled();
});

it('returns for inward swipes from either edge and leaves outward or central gestures alone', () => {
  const back = vi.fn();
  useBrowserNavigationGestures(true, back);
  const options = vi.mocked(useHorizontalSwipe).mock.calls.at(-1)![0];
  const start = (pageX: number) => options.shouldStart?.({ nativeEvent: { pageX } } as GestureResponderEvent);
  expect(start(10)).toBe(true);
  options.onLeft?.(); expect(back).not.toHaveBeenCalled();
  options.onRight?.(); expect(back).toHaveBeenCalledOnce();
  expect(start(380)).toBe(true);
  options.onRight?.(); expect(back).toHaveBeenCalledOnce();
  options.onLeft?.(); expect(back).toHaveBeenCalledTimes(2);
  expect(start(195)).toBe(false);
  useBrowserNavigationGestures(false, back);
  expect(vi.mocked(useHorizontalSwipe).mock.calls.at(-1)![0].enabled).toBe(false);
});
