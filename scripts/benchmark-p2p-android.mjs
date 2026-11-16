import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
function argument(name, fallback) {
  const index = args.indexOf(name);
  const value = index < 0 ? fallback : args[index + 1];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
const serial = argument('--serial');
if (!/^emulator-\d+$/.test(serial)) throw new Error('Select an Android emulator explicitly.');
const app = 'com.codexswitch.mobile.p2pbenchmark';
const port = 18786;
const adb = async (...values) => (await exec('adb', ['-s', serial, ...values],
  { windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024 })).stdout.trim();
const auth = JSON.parse(await readFile(argument('--auth-file'), 'utf8'));
if (!auth.accessToken) throw new Error('No saved access token');
const runs = Number(argument('--runs', '3'));
if (!Number.isInteger(runs) || runs < 1 || runs > 10) throw new Error('Runs must be 1-10');
const config = { session: { baseUrl: argument('--server'), accessToken: auth.accessToken,
  refreshToken: '', email: auth.email ?? 'local-benchmark' }, deviceId: argument('--device'),
  path: argument('--file'), expectedHash: argument('--sha256'), runs };
if (!/^[a-f\d]{64}$/i.test(config.expectedHash)) throw new Error('Expected source SHA-256 is required');
let accept, reject;
const result = new Promise((resolve, fail) => { accept = resolve; reject = fail; });
let configured = false;
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'GET' && request.url === '/config' && !configured) {
    configured = true;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(config)); return;
  }
  if (request.method !== 'POST' || request.url !== '/result' || !configured) {
    response.writeHead(404).end(); return;
  }
  try {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 128 * 1024) throw new Error('Oversized benchmark report');
    }
    const report = JSON.parse(body);
    response.end('ok'); accept(report);
  } catch { response.writeHead(400).end(); reject(new Error('Invalid benchmark report')); }
});
let timer;
try {
  await new Promise((resolve, fail) => {
    server.once('error', fail); server.listen(port, '127.0.0.1', resolve);
  });
  await adb('install', '-r', path.resolve(argument('--apk')));
  await adb('reverse', `tcp:${port}`, `tcp:${port}`);
  await adb('shell', 'am', 'force-stop', app);
  await adb('shell', 'am', 'start', '-W', '-n', `${app}/com.codexswitch.mobile.MainActivity`);
  console.info('Native benchmark started; file bytes use the real P2P transport.');
  timer = setTimeout(() => reject(new Error('Native benchmark timed out')), (120 + 180 * runs) * 1000);
  const report = await result;
  if (report.failed || report.samples?.length !== runs
    || report.samples.some(sample => !sample.verified || !sample.savedFileVerified || sample.filePath !== 'direct')) {
    throw new Error(`Native benchmark failed (${report.reason ?? 'invalid samples'}); inspect emulator logcat`);
  }
  report.environment = { serial, abi: await adb('shell', 'getprop', 'ro.product.cpu.abi'),
    model: await adb('shell', 'getprop', 'ro.product.model'),
    android: await adb('shell', 'getprop', 'ro.build.version.release'),
    nativeRevision: (await exec('git', ['rev-parse', 'HEAD'], { windowsHide: true, cwd: root })).stdout.trim() };
  const output = path.resolve(argument('--output'));
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.info(JSON.stringify({ output, samples: report.samples.map(({ MiBps, verified }) => ({ MiBps, verified })) }));
} finally {
  clearTimeout(timer);
  try {
    // This fixed package belongs only to the benchmark, including its temporary SecureStore session.
    await adb('shell', 'am', 'force-stop', app);
    await adb('shell', 'pm', 'clear', app);
  } finally {
    await adb('reverse', '--remove', `tcp:${port}`).catch(() => {
      console.warn('Could not remove the benchmark ADB reverse mapping.');
    });
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
