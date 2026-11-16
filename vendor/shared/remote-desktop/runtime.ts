import type { DesktopVideoCodec } from './protocol';

export interface NativeDesktopRuntime {
  createPeer(configuration: RTCConfiguration): RTCPeerConnection;
  videoCodecs(): Promise<DesktopVideoCodec[]>;
}
let native: NativeDesktopRuntime | undefined;

/** Hosts supply their transport; shared browser views never import desktop application code. */
export function setNativeDesktopRuntime(runtime: NativeDesktopRuntime | undefined) { native = runtime; }
export function nativeDesktopRuntime() { return native; }

export function createDesktopPeerConnection(configuration: RTCConfiguration) {
  if (native) return native.createPeer(configuration);
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) throw new Error('PATH_UNAVAILABLE');
  return new RTCPeerConnection(configuration);
}
