import { expect, it } from 'vitest';
import { mappedHttpRetry } from './browserLoadFailure';

const failure = { code: -11, description: 'net::ERR_SSL_PROTOCOL_ERROR',
  url: 'https://dev.test:8000/components/board?view=usage#today' };
const entry = { id: 'mapping', status: 'running', protocol: 'tcp', linkProtocol: 'http',
  localDomain: 'dev.test', localPort: 8000, remotePort: 3000 } as const;

it('preserves the path, query and fragment when offering the configured HTTP address', () => {
  const mappings = [{ connected: true, entry }];
  expect(mappedHttpRetry(failure, mappings)?.href).toBe('http://dev.test:8000/components/board?view=usage#today');
  expect(mappedHttpRetry({ ...failure, code: -1200, domain: 'NSURLErrorDomain', description: '' }, mappings)?.port)
    .toBe('8000');
});

it('offers no HTTP retry for HTTPS mappings, other hosts or ports, stopped mappings or certificate errors', () => {
  for (const overrides of [{ linkProtocol: 'https' }, { localDomain: 'other.test' }, { localPort: 8001 },
    { status: 'stopped' }, { protocol: 'udp' }] as const) {
    expect(mappedHttpRetry(failure, [{ connected: true, entry: { ...entry, ...overrides } }])).toBeUndefined();
  }
  expect(mappedHttpRetry(failure, [{ connected: false, entry }])).toBeUndefined();
  expect(mappedHttpRetry({ ...failure, description: 'net::ERR_CERT_AUTHORITY_INVALID' }, [{ connected: true, entry }]))
    .toBeUndefined();
});
