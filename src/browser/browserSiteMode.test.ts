import { expect, it } from 'vitest';
import { desktopUserAgent } from './browserSiteMode';

it('requests desktop pages without advertising a different WebView engine version', () => {
  const android = 'Mozilla/5.0 (Linux; Android 14; Phone Build/X; wv) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Version/4.0 Chrome/130.0.1.2 Mobile Safari/537.36';
  const desktop = desktopUserAgent(android);
  expect(desktop).toContain('Chrome/130.0.1.2');
  expect(desktop).toContain('X11; Linux x86_64');
  expect(desktop).not.toMatch(/Android|Mobile|Version\/4.0|wv/);
  const ios = desktopUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
    + 'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148');
  expect(ios).toContain('Macintosh'); expect(ios).toContain('AppleWebKit/605.1.15');
  expect(ios).not.toMatch(/iPhone|Mobile/);
});
