import { invoke as invokeTauri } from '@tauri-apps/api/core';
import { hasDirectChatInput } from '../remote-chat/uploadMode';

export const isDesktopApp = typeof window !== 'undefined' && "__TAURI_INTERNALS__" in window;
export const isHostedWebApp = typeof document !== 'undefined' && document
  .querySelector('meta[name="codex-switch-runtime"]')
  ?.getAttribute("content") === "hosted";
export const hasLocalBackend = isDesktopApp || isHostedWebApp;

interface HostedInvokeResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

const HOSTED_WEB_API_KEY_STORAGE_KEY = "codex-switch:hosted-web-api-key";

function readHostedWebApiKey() {
  try {
    return window.sessionStorage.getItem(HOSTED_WEB_API_KEY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function writeHostedWebApiKey(value: string) {
  try {
    if (value) window.sessionStorage.setItem(HOSTED_WEB_API_KEY_STORAGE_KEY, value);
    else window.sessionStorage.removeItem(HOSTED_WEB_API_KEY_STORAGE_KEY);
  } catch {
    // Private browsing may disable session storage; the key remains in memory
    // for the current request flow instead.
  }
}

export interface HostedWebApiKeyRequest {
  resolve: (value: string | null) => void;
}

const hostedWebApiKeyRequestListeners = new Set<(request: HostedWebApiKeyRequest) => void>();
let pendingHostedWebApiKeyRequest: HostedWebApiKeyRequest | null = null;

export function subscribeToHostedWebApiKeyRequests(
  listener: (request: HostedWebApiKeyRequest) => void,
) {
  hostedWebApiKeyRequestListeners.add(listener);
  if (pendingHostedWebApiKeyRequest) listener(pendingHostedWebApiKeyRequest);
  return () => hostedWebApiKeyRequestListeners.delete(listener);
}

let hostedWebApiKeyPrompt: Promise<string | null> | null = null;
let hostedWebApiKeyRejected = false;

function requestHostedWebApiKey() {
  if (!hostedWebApiKeyPrompt) {
    let resolvePrompt: (value: string | null) => void = () => undefined;
    const request: HostedWebApiKeyRequest = {
      resolve: (value) => {
        if (pendingHostedWebApiKeyRequest === request) pendingHostedWebApiKeyRequest = null;
        resolvePrompt(value);
      },
    };
    hostedWebApiKeyPrompt = new Promise<string | null>((resolve) => {
      resolvePrompt = resolve;
      pendingHostedWebApiKeyRequest = request;
      hostedWebApiKeyRequestListeners.forEach((listener) => listener(request));
    }).finally(() => {
      hostedWebApiKeyPrompt = null;
    });
  }
  return hostedWebApiKeyPrompt;
}

export async function invoke<T = void>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (isDesktopApp) return invokeTauri<T>(command, args);
  if (!isHostedWebApp) throw new Error(`Native command is unavailable in browser preview: ${command}`);

  const body = JSON.stringify({ command, args });
  const request = (apiKey: string) => fetch("/__codex_switch__/api/invoke", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(command === 'codex_gui_request' && hasDirectChatInput(args.request)
        ? { "X-Codex-Chat-Transfer": "direct" } : {}),
      ...(apiKey ? { "X-API-Key": apiKey } : {}),
    },
    cache: "no-store",
    body,
  });
  let response = await request(readHostedWebApiKey());
  if (response.status === 401) {
    if (hostedWebApiKeyRejected) {
      throw new Error("The LAN access key was rejected. Check the key in Remote AI and reload the page.");
    }
    writeHostedWebApiKey("");
    const suppliedKey = (await requestHostedWebApiKey())?.trim() || "";
    if (suppliedKey) {
      writeHostedWebApiKey(suppliedKey);
      response = await request(suppliedKey);
      if (response.status === 401) {
        writeHostedWebApiKey("");
        hostedWebApiKeyRejected = true;
      } else {
        hostedWebApiKeyRejected = false;
      }
    } else {
      hostedWebApiKeyRejected = true;
    }
  }
  if (!response.ok) {
    throw new Error((await response.text().catch(() => "")) || `Web command failed with HTTP ${response.status}`);
  }
  const payload = await response.json() as HostedInvokeResponse<T>;
  if (!payload.ok) throw new Error(payload.error || `Web command failed: ${command}`);
  return payload.result as T;
}
