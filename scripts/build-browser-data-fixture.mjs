import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

// Fictional, reproducible interoperability fixture. Node creates it; the device must unlock it.
const salt = '00112233445566778899aabbccddeeff';
const key = pbkdf2Sync('browser-test-passphrase', Buffer.from(salt, 'hex'), 600000, 32, 'sha256');
function seal(value, context) {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value), cipher.final(), cipher.getAuthTag()]);
  return { nonce: nonce.toString('hex'), ciphertext: ciphertext.toString('hex') };
}
const entries = [{ id: 'vault', kind: 'vault', salt, check: seal('remoteai-browser-passwords-v1', salt) },
  { id: 'fixture-password', kind: 'password', salt, at: 1,
    secret: seal(JSON.stringify({ origin: 'https://example.com', username: 'demo@example.com',
      password: 'fixture-only-secret' }), `${salt}:fixture-password`) }];
key.fill(0);
writeFileSync(new URL('../e2e/browser-data-vault.json', import.meta.url), JSON.stringify(entries, null, 2) + '\n');
