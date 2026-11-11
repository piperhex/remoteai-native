import { invoke } from '../platform/localBackend';
import { uiText } from '../localization/uiText';

export type ClaudeLoginMethod = 'cli' | 'pkce';
export type ClaudeAccountRequest =
  | { action: 'list' | 'import' | 'deactivate' }
  | { action: 'start'; method: ClaudeLoginMethod; accountId?: string }
  | { action: 'poll' | 'cancel'; loginId: string }
  | { action: 'submit'; loginId: string; code: string }
  | { action: 'activate' | 'refresh' | 'delete'; id: string };

export interface ClaudeAccountTransport {
  request<T>(request: ClaudeAccountRequest): Promise<T>;
}

export interface ClaudeAccountSummary {
  id: string; accountSource: 'claudeCode'; email: string; plan: string; active: boolean;
  accountId?: string; usage: { fetchedAt?: string; error?: string };
}

export interface ClaudeLoginStatus {
  loginId: string;
  status: 'starting' | 'waiting' | 'verifying' | 'complete' | 'failed' | 'cancelled';
  authorizationUrl?: string;
  accountId?: string;
  error?: string;
}

export const localClaudeAccounts: ClaudeAccountTransport = {
  request: request => invoke('claude_account_request', { request }),
};

const errorKeys = [
  'invalidRequest', 'storageFailed', 'cliRequired', 'loginFailed', 'loginExpired', 'stateMismatch',
  'signInRequired', 'busy', 'networkFailed', 'keychainFailed', 'credentialsChanged', 'authOverride',
] as const;

export function claudeAccountError(error: unknown): string {
  const code = error instanceof Error ? error.message : String(error);
  const key = errorKeys.find(key => code === `client.officialAccounts.${key}`);
  return key ? uiText(`client.officialAccounts.${key}`) : uiText('client.officialAccounts.loginFailed');
}

export function isClaudeAccountId(id: string): boolean { return /^claude_[a-f\d]{32}$/i.test(id); }
