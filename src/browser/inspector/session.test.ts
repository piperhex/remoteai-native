import { describe, expect, it, vi } from 'vitest';
import { inspectorSession, type InspectorBridge, type InspectorRequest } from './session';

const request: Omit<InspectorRequest, 'id'> = {
  tag: 23, hostTag: 24, error: 'Unavailable', language: 'en', theme: 'light',
  surfaceColor: '#ffffff', contentColor: '#17211b',
};

describe('native inspector lifetime', () => {
  it('retires a pending open without closing a newer session', async () => {
    let finish!: () => void;
    const bridge: InspectorBridge = { supported: true,
      open: vi.fn(() => new Promise<void>(resolve => { finish = resolve; })), close: vi.fn(), hideKeyboard: vi.fn() };
    const old = inspectorSession(bridge, 'old-tab');
    const pending = old.open(request);
    old.stop(); finish(); await pending;
    expect(bridge.open).toHaveBeenCalledWith({ ...request, id: 'old-tab' });
    expect(vi.mocked(bridge.close).mock.calls).toEqual([['old-tab'], ['old-tab']]);
  });

  it('surfaces native failures and closes only the owning session', async () => {
    const bridge = { supported: true, open: vi.fn(async () => { throw new Error('unavailable'); }),
      close: vi.fn(), hideKeyboard: vi.fn() };
    const session = inspectorSession(bridge, 'tab');
    await expect(session.open(request)).rejects.toThrow('unavailable');
    session.stop(); expect(bridge.close).toHaveBeenCalledWith('tab');
  });
});
