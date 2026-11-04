export interface TokenUsageEntry {
  id: string;
  ts: number;
  provider: string;
  providerId?: string | null;
  accountId?: string | null;
  accountEmail?: string | null;
  model: string;
  serviceTier?: string | null;
  durationMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  cachedTokens?: number | null;
  totalTokens?: number | null;
  modelContextWindow?: number | null;
}
