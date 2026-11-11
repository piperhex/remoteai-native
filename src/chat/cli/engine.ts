import type { GuiEngine } from '../../../vendor/shared/cli-gui/types';

export const engineNames = {
  codex: 'client.cliGui.codex', claude: 'client.cliGui.claude', gemini: 'client.cliGui.gemini',
} as const satisfies Record<GuiEngine, string>;

export const engines = Object.keys(engineNames) as GuiEngine[];
