import { afterEach, expect, it, vi } from 'vitest';
const bridge = vi.hoisted(() => ({ open: vi.fn(async (_id: string, _url: string) => {}), close: vi.fn(),
  send: vi.fn(async (_id: string, _text: string) => {}), sendBulk: vi.fn(async () => {}),
  listeners: new Set<(event: { id: string; type: string; data: string; code: number }) => void>() }));
vi.mock('react-native', () => ({ NativeModules: { DownloadChatSocket: bridge },
  DeviceEventEmitter: { addListener: (_name: string, callback: Parameters<typeof bridge.listeners.add>[0]) => {
    bridge.listeners.add(callback); return { remove: () => bridge.listeners.delete(callback) };
  } } }));
vi.mock('expo-crypto', () => ({ getRandomBytes: (length: number) => crypto.getRandomValues(new Uint8Array(length)) }));
import { nativeDownloadSocket } from './downloadSocket';
afterEach(() => { bridge.listeners.clear(); vi.clearAllMocks(); });

it('negotiates a separate native file socket and leaves the chat socket open after its failure', () => {
  const chat = nativeDownloadSocket('wss://cloud.test/device-chat');
  const file = nativeDownloadSocket('wss://cloud.test/device-chat?channel=file');
  const chatId = bridge.open.mock.calls[0][0], fileId = bridge.open.mock.calls[1][0];
  const emit = (id: string, type: string, frame = {}) => bridge.listeners.forEach(listener =>
    listener({ id, type, data: JSON.stringify(frame), code: 1006 }));
  emit(chatId, 'open'); emit(fileId, 'open');
  emit(fileId, 'message', { type: 'file-relay-ready', sessionId: 'session', fileBulkV1: true });
  expect(file.bulkAvailable).toBe(true); expect(chat.bulkAvailable).toBe(false);
  emit(fileId, 'close'); expect(file.readyState).toBe(3); expect(chat.readyState).toBe(1);
  chat.send('{"type":"chat-probe"}'); expect(bridge.send).toHaveBeenCalledWith(chatId, '{"type":"chat-probe"}');
  chat.close(); file.close();
});
