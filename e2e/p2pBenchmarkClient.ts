import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { MobileChatConnection } from '../src/chat/connection';
import { activateSession, beginLogin, clearSession } from '../src/api/sessionStore';
import { downloadManager, downloadOwner } from '../src/downloads/manager';
import type { DownloadTask } from '../src/downloads/types';
import type { AuthSession } from '../src/types';
import { chatHandshake } from '../vendor/shared/remote-chat/handshake';
import { getChatPolicy } from '../vendor/shared/remote-chat/policy';
import type { DownloadClient } from '../vendor/shared/remote-chat/downloads';
import type { ConnectionMode } from '../vendor/shared/remote-chat/protocol';
import type { ConnectionEndpoints } from '../vendor/shared/remote-chat/connectionEndpoints';
import { CONNECTION_ERRORS } from '../vendor/shared/remote-chat/connectionErrors';
import { observeBenchmarkPeers } from './p2pBenchmarkStats';

export interface BenchmarkOptions {
  session: AuthSession; deviceId: string; path: string; expectedHash: string; runs: number;
}
interface MeasuredTask extends DownloadTask {
  manifest?: { fileHash: string }; measurements?: Record<string, number>;
}
const MIB = 1_048_576;
const wait = () => new Promise(resolve => setTimeout(resolve, 50));

async function sample(options: BenchmarkOptions & { connection: MobileChatConnection }) {
  let id = '', started = 0, transferred = 0, completed = 0;
  let latest: MeasuredTask | undefined;
  const previous = new Set(downloadManager.snapshot().map(task => task.id));
  const subscription = DeviceEventEmitter.addListener('downloadTasksChanged', (json: string) => {
    const task = (JSON.parse(json) as MeasuredTask[]).find(value => value.id === id
      || (!id && !previous.has(value.id) && value.source.path === options.path));
    if (!task) return;
    id = task.id;
    latest = task;
    if (task.status === 'downloading' && !started) started = performance.now();
    if (task.status === 'verifying' && !transferred) transferred = performance.now();
    if (task.status === 'completed' && !completed) completed = performance.now();
  });
  try {
    id = await downloadManager.enqueue({ owner: downloadOwner(options.session), deviceId: options.deviceId,
      deviceName: 'Benchmark peer', scope: 'computer', path: options.path });
    const deadline = Date.now() + 180_000;
    while (!completed && latest?.status !== 'failed' && Date.now() < deadline) await wait();
    if (!completed || !latest?.uri || !started || !transferred) throw new Error('Native download did not complete');
    if (options.connection.downloadsBulk.path() !== 'direct' || !latest.manifest) {
      throw new Error('The transfer did not use native P2P bulk');
    }
    const hash = await ReactNativeBlobUtil.fs.hash(latest.uri, 'sha256');
    if (hash.toLowerCase() !== options.expectedHash.toLowerCase()
      || latest.manifest.fileHash.toLowerCase() !== hash.toLowerCase()) throw new Error('Saved file hash mismatch');
    const downloadMs = transferred - started;
    return { bytes: latest.received, downloadMs, MiBps: latest.received / MIB / (downloadMs / 1000),
      throughSaveMs: completed - started, verified: true, savedFileVerified: true,
      filePath: options.connection.downloadsBulk.path(), measurements: latest.measurements };
  } finally { subscription.remove(); if (id) await downloadManager.delete(id); }
}

/** No synthetic file replies, transport replacements, policy overrides or embedded account credentials. */
export async function runNativeP2pBenchmark(options: BenchmarkOptions) {
  if (!NativeModules.FileDownloads?.bulkBinaryAvailable) throw new Error('Native bulk module unavailable');
  await activateSession(options.session, beginLogin());
  const peers = observeBenchmarkPeers();
  let ready = false, issue = '', mode: ConnectionMode = 'offline', stage = 'login';
  let endpoints: ConnectionEndpoints | undefined;
  const connection = new MobileChatConnection({ session: options.session, deviceId: options.deviceId,
    mode: value => { mode = value; }, ready: () => { ready = true; }, event: () => {},
    error: value => { issue = value; }, stage: value => { stage = value; },
    directEndpoints: value => { endpoints = value; } });
  const request = <T>(body: object) => connection.request<T>('request', body);
  const client: DownloadClient = { bulk: connection.downloadsBulk,
    open: body => request({ operation: 'downloadOpen', ...body }),
    browse: body => request({ operation: 'downloadBrowse', ...body }),
    read: body => request({ operation: 'fileRead', ...body }),
    close: (threadId, id) => request({ operation: 'fileClose', threadId, id }) };
  const files = { open: (threadId: string, path: string) =>
    client.open({ transferId: threadId, scope: 'computer', path }), read: client.read, close: client.close };
  connection.start();
  try {
    const deadline = Date.now() + 90_000;
    while (!ready && !issue && Date.now() < deadline) await wait();
    if (!ready) {
      const code = Object.entries(CONNECTION_ERRORS).find(([, value]) => value === issue)?.[0] ?? 'unknown';
      throw new Error(`Native connection did not become ready (${stage}, ${code})`);
    }
    console.info('NATIVE_P2P_BENCHMARK connection ready');
    try { connection.setBulkSupport(await connection.request('connect', chatHandshake)); }
    catch (error) {
      const message = error instanceof Error ? error.message : error;
      const code = Object.entries(CONNECTION_ERRORS).find(([, value]) => value === message)?.[0] ?? 'unknown';
      throw new Error(`Native handshake failed (${code})`);
    }
    while (connection.downloadsBulk.path() !== 'direct' && Date.now() < deadline) await wait();
    if (!connection.downloadsBulk.available() || connection.downloadsBulk.path() !== 'direct') {
      throw new Error('Native P2P bulk unavailable');
    }
    console.info('NATIVE_P2P_BENCHMARK direct bulk ready');
    await downloadManager.initialize();
    downloadManager.bind({ owner: downloadOwner(options.session), deviceId: options.deviceId,
      deviceName: 'Benchmark peer', ready: true, mode, windowSize: getChatPolicy(mode).fileDownloadWindowSize,
      client, files });
    const samples = [];
    for (let index = 0; index < options.runs; index++) {
      const result = await sample({ ...options, connection });
      samples.push({ ...result, endpoints, transport: await peers.snapshot() });
      console.info(`NATIVE_P2P_BENCHMARK ${index + 1}: ${result.MiBps.toFixed(2)} MiB/s; verified`);
    }
    return { capturedAt: new Date().toISOString(), receiver: 'Android production native downloader',
      android: Platform.Version, model: Platform.OS === 'android' ? Platform.constants.Model : '',
      hermes: 'HermesInternal' in globalThis, development: __DEV__, samples };
  } finally { downloadManager.unbind(files); connection.stop(); peers.close(); await clearSession(); }
}
