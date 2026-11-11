import { object } from './protocol';
import type { GuiEngine } from '../cli-gui/types';

export const GUI_ACCOUNTS_EVENT = 'guiAccounts/changed';
// Account list updates also include balance refreshes; only this event invalidates pinned recordings.
export const GUI_ACCOUNT_SELECTION_EVENT = 'guiAccounts/selectionChanged';

export type GuiAccountSelection = { kind: 'none' } | { kind: 'account' | 'provider' | 'aggregate'; id: string };
export type SelectableGuiAccount = Exclude<GuiAccountSelection, { kind: 'none' }>;
export type GuiAccountSwitchRequest = SelectableGuiAccount & { engine?: GuiEngine };
export interface GuiAccountChoice {
  kind: SelectableGuiAccount['kind'];
  id: string;
  name: string;
  detail: string;
  searchDetail?: string;
  websiteUrl?: string;
  plan?: string;
  primaryRemainingPercent?: number | null;
  secondaryRemainingPercent?: number | null;
  available: boolean;
  accountSource?: string;
  active?: boolean;
}
export interface GuiAccountsSnapshot {
  selection: GuiAccountSelection;
  choices: GuiAccountChoice[];
  running: boolean;
}
export interface GuiAccountsClient {
  read: () => Promise<GuiAccountsSnapshot>;
  select: (selection: GuiAccountSwitchRequest) => Promise<GuiAccountSelection>;
  subscribe: (changed: () => void) => () => void;
}

/** Validate remote data before account pickers render it, including older desktop service replies. */
export function parseGuiAccountsSnapshot(value: unknown): GuiAccountsSnapshot {
  const data = object(value);
  // Older background services used this shape while the desktop app was unavailable.
  if (data.choices === undefined && data.running === undefined && data.selection === null
    && Array.isArray(data.accounts) && data.accounts.length === 0
    && Array.isArray(data.providers) && data.providers.length === 0) {
    return { selection: { kind: 'none' }, choices: [], running: false };
  }
  const selection = object(data.selection);
  if (!isSelection(selection) || typeof data.running !== 'boolean'
    || !Array.isArray(data.choices) || !data.choices.every(isChoice)) {
    throw new Error('暂时无法读取电脑的账户，请重试。');
  }
  return { selection, choices: data.choices, running: data.running };
}

function isSelection(value: Record<string, unknown>): value is Record<string, unknown> & GuiAccountSelection {
  return value.kind === 'none' || (isAccountKind(value.kind) && isAccountId(value.id));
}

function isAccountKind(value: unknown): value is SelectableGuiAccount['kind'] {
  return value === 'account' || value === 'provider' || value === 'aggregate';
}

function isAccountId(value: unknown): value is string {
  return typeof value === 'string' && !!value.trim();
}

function isChoice(value: unknown): value is GuiAccountChoice {
  if (!value || typeof value !== 'object') return false;
  const choice = value as Partial<GuiAccountChoice>;
  return isAccountKind(choice.kind) && isAccountId(choice.id)
    && typeof choice.name === 'string' && typeof choice.detail === 'string'
    && typeof choice.available === 'boolean'
    && [choice.searchDetail, choice.plan, choice.websiteUrl, choice.accountSource]
      .every(text => text === undefined || typeof text === 'string')
    && (choice.active === undefined || typeof choice.active === 'boolean');
}

/** Claude uses its native default when set; otherwise all engines use the proxy selection. */
export function guiAccountSelectionForEngine(
  selection: GuiAccountSelection | undefined,
  choices: ReadonlyArray<Pick<GuiAccountChoice, 'id' | 'accountSource' | 'active'>>,
  engine: GuiEngine = 'codex',
): GuiAccountSelection {
  const native = engine === 'claude' && choices.find(choice => choice.accountSource === 'claudeCode' && choice.active);
  return native ? { kind: 'account', id: native.id } : selection ?? { kind: 'none' };
}

export function isGuiAccountSelected(
  choice: Pick<GuiAccountChoice, 'kind' | 'id'>, selection?: GuiAccountSelection,
): boolean {
  return selection?.kind === choice.kind && selection.id === choice.id;
}
