import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';

const [serial, output, label = 'current', iterations = '1024'] = process.argv.slice(2);
if (!serial || !output || !/^\d+$/.test(iterations) || Number(iterations) < 64 || Number(iterations) > 8192) {
  throw new Error('Usage: node scripts/benchmark-chat-packet-android.mjs SERIAL REPORT [LABEL] [ITERATIONS]');
}
const test = 'com.codexswitch.downloads.PacketCipherBenchmark';
const args = ['-s', serial, 'shell', 'am', 'instrument', '-w', '-e', 'class', test,
  '-e', 'iterations', iterations,
  'com.codexswitch.mobile.downloadtest.test/com.codexswitch.downloads.DownloadTestRunner'];
let log = '';
const code = await new Promise((done, reject) => {
  const child = spawn('adb', args, { windowsHide: true });
  const timer = setTimeout(() => { child.kill(); reject(new Error('Local packet benchmark timed out')); }, 180000);
  child.stdout.on('data', bytes => { log += bytes; });
  child.stderr.on('data', bytes => { log += bytes; });
  child.once('error', error => { clearTimeout(timer); reject(error); });
  child.once('exit', value => { clearTimeout(timer); done(value); });
});
await mkdir(dirname(resolve(output)), { recursive: true });
await writeFile(`${output}.log`, log);
if (code !== 0 || !/OK \(1 test\)/.test(log)) throw new Error(log);
const marker = 'INSTRUMENTATION_STATUS: packetBenchmark=';
const records = log.split(/\r?\n/).filter(line => line.includes(marker))
  .map(line => JSON.parse(line.slice(line.indexOf(marker) + marker.length)));
if (records.length !== 49) throw new Error(`Incomplete benchmark: ${records.length} records`);
const source = await readFile(new URL('../plugins/chatPacketCipher/PacketCipher.kt', import.meta.url));
const apk = await readFile(new URL('../android/app/build-download-throughput/outputs/apk/debug/app-debug.apk', import.meta.url));
const report = { label, timestamp: new Date().toISOString(), sourceSha256: createHash('sha256').update(source).digest('hex'),
  apkSha256: createHash('sha256').update(apk).digest('hex'), records };
await writeFile(output, JSON.stringify(report, null, 2));
for (const size of [2400, 16000]) {
  const stages = new Set(records.filter(row => row.size === size).map(row => row.stage));
  for (const stage of stages) {
    const rows = records.filter(row => row.size === size && row.stage === stage);
    console.log(JSON.stringify({ label, size, stage, ms: rows.map(row => +row.ms.toFixed(3)),
      MiBps: rows.map(row => +row.MiBps.toFixed(2)) }));
  }
}
