import type { GuiAccountsSnapshot } from './guiAccounts';
import { guiAccountSelectionForEngine } from './guiAccounts';
import type { GuiEngine } from '../cli-gui/types';

/** Keep the chat header and account menu tied to the computer's selected account. */
export function guiAccountAvatar(snapshot: GuiAccountsSnapshot | null, fallback: string, engine?: GuiEngine) {
  const selection = guiAccountSelectionForEngine(snapshot?.selection, snapshot?.choices ?? [], engine);
  const current = snapshot?.choices.find(choice => selection?.kind === choice.kind && selection.id === choice.id);
  return {
    initials: Array.from(current?.name.trim() || '').slice(0, 2).join('') || fallback,
  };
}
