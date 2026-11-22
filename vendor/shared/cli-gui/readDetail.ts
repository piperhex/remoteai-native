import { cliItem } from './presentation';
import { sameHistory } from './historyWindow';
import type { CliDetailResponse, CliEntry, CliHistory, CliRequest, CliTransport } from './types';
import { CLI_DETAIL_CHUNK_CHARS, CLI_DETAIL_MAX_CHARS } from './types';

type Read = Extract<CliRequest, { action: 'read' }>;
const failed = () => new Error('client.cliGui.historyFailed');

export function readCliDetail(transport: CliTransport, request: Read, history: CliHistory) {
  let cancelled = false;
  const read = async () => {
    const first = await transport.request<CliDetailResponse>(request);
    if (!('detailPart' in first)) {
      const entry = first.entries.find(value => value.id === request.detailId);
      if (!entry || !sameHistory(history, first)) throw failed();
      return { item: cliItem(entry) };
    }
    let part = first.detailPart;
    const { token, total } = part;
    const pieces: string[] = [];
    let offset = 0;
    try {
      if (!Number.isSafeInteger(total) || total < 1 || total > CLI_DETAIL_MAX_CHARS) throw failed();
      while (!cancelled && offset < total) {
        if (part.token !== token || part.total !== total || part.offset !== offset || part.epoch !== history.cursor?.epoch
          || part.text.length !== Math.min(CLI_DETAIL_CHUNK_CHARS, total - offset)) throw failed();
        pieces.push(part.text);
        offset += part.text.length;
        if (offset === total) break;
        const next = await transport.request<CliDetailResponse>({ ...request, detailChunk: { token, offset } });
        if (!('detailPart' in next)) throw failed();
        part = next.detailPart;
      }
      if (cancelled) throw failed();
      const entry = JSON.parse(pieces.join('')) as CliEntry;
      if (entry.id !== request.detailId) throw failed();
      return { item: cliItem(entry) };
    } finally {
      // A disconnected client cannot release explicitly; the worker also expires every abandoned token.
      void transport.request({ ...request, detailChunk: { token } }).catch(() => {});
    }
  };
  return Object.assign(read(), { cancel: () => { cancelled = true; } });
}
