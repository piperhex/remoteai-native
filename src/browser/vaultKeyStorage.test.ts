import { expect, it, vi } from 'vitest';
import { nativeVaultKeyStorage } from './vaultKeyStorage';

const secure = vi.hoisted(() => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' }));
vi.mock('expo-secure-store', () => secure);

it('uses isolated, device-only secure storage and deletes remembered keys on explicit lock', async () => {
  const value = { salt: 'ab'.repeat(16), key: 'cd'.repeat(32) };
  const first = nativeVaultKeyStorage('first@example.test'), second = nativeVaultKeyStorage('second@example.test');
  await first.write(value); await second.write(value);
  const [firstCall, secondCall] = secure.setItemAsync.mock.calls;
  expect(firstCall[0]).not.toBe(secondCall[0]); expect(firstCall[0]).not.toContain('first@example.test');
  expect(firstCall[2]).toEqual({ keychainAccessible: 'device-only' });
  secure.getItemAsync.mockResolvedValue(JSON.stringify(value));
  expect(await first.read()).toEqual(value);
  secure.getItemAsync.mockResolvedValue('{"key":"broken"}');
  await expect(first.read()).rejects.toThrow('vault-key-storage');
  await first.remove(); expect(secure.deleteItemAsync).toHaveBeenCalledWith(firstCall[0]);
});
