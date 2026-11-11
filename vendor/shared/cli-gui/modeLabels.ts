import { uiText } from '../localization/uiText';
import type { MessageKey } from '../localization/messages';
import type { CliMode, ExternalEngine } from './types';

const modeKeys: Record<ExternalEngine, Readonly<Record<string, MessageKey>>> = {
  claude: {
    plan: 'client.cliGui.permissionMode.plan',
    default: 'client.cliGui.permissionMode.ask',
    acceptEdits: 'client.cliGui.permissionMode.acceptEdits',
    auto: 'client.cliGui.permissionMode.auto',
    bypassPermissions: 'client.cliGui.permissionMode.bypass',
  },
  gemini: {
    default: 'client.configHelp.default',
    autoEdit: 'client.cliGui.permissionMode.acceptEdits',
    auto_edit: 'client.cliGui.permissionMode.acceptEdits',
    yolo: 'client.cliGui.permissionMode.bypass',
    plan: 'client.cliGui.permissionMode.plan',
  },
};

/** Provider IDs retain their meaning; only known built-in display names are localized. */
export function cliModeLabel(engine: ExternalEngine, mode?: CliMode) {
  if (!mode) return uiText('client.cliGui.mode');
  const key = Object.hasOwn(modeKeys[engine], mode.id) ? modeKeys[engine][mode.id] : undefined;
  return key ? uiText(key) : mode.label || uiText('client.cliGui.mode');
}
