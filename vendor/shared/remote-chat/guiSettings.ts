import type { GuiAutoSwitchSettings } from '../conversation/autoSwitchSettings';

export interface SettingsStore<T> {
  read: () => Promise<T>;
  write: (settings: T) => Promise<T>;
}

export interface GuiSettingsUsage {
  usedPercent: number;
  remainingPercent: number;
  resetsAt?: number | null;
  windowMinutes?: number | null;
}

/** Display fields only; credentials and private account metadata stay on the host. */
export interface GuiSettingsAccount {
  id: string;
  email: string;
  expiresAt: string;
  localProxyCompatible: boolean;
  usage: {
    primary?: GuiSettingsUsage | null;
    secondary?: GuiSettingsUsage | null;
    apiExpiresAt?: string | null;
  };
}

export interface GuiSettingsAccounts {
  accounts: GuiSettingsAccount[];
  providers: { id: string; name: string }[];
}

export interface GuiSystemPromptSettings {
  filterEnabled: boolean;
  filterRules: { name?: string; text: string; enabled: boolean }[];
  injectionEnabled: boolean;
  injectionPrompts: { name?: string; text: string; enabled: boolean }[];
}

export interface ModelContextSettings {
  defaults: Record<string, number>;
  overrides: Record<string, number>;
}

export interface ModelContextSnapshot extends ModelContextSettings {
  usingCachedDefaults: boolean;
}

export interface ModelContextSettingsApi {
  read: () => Promise<ModelContextSnapshot>;
  write: (model: string, capacity: number | null) => Promise<ModelContextSettings>;
}

export const GUI_SETTINGS_OPERATIONS = new Set([
  'guiSettingsAccounts', 'guiAutoSwitchRead', 'guiAutoSwitchWrite',
  'guiModelContextRead', 'guiModelContextWrite', 'guiSystemPromptsRead', 'guiSystemPromptsWrite',
]);

export function createGuiSettingsClient(request: <T>(body: object) => Promise<T>) {
  return {
    accounts: () => request<GuiSettingsAccounts>({ operation: 'guiSettingsAccounts' }),
    autoSwitch: {
      read: () => request<GuiAutoSwitchSettings>({ operation: 'guiAutoSwitchRead' }),
      write: (settings: GuiAutoSwitchSettings) =>
        request<GuiAutoSwitchSettings>({ operation: 'guiAutoSwitchWrite', settings }),
    },
    context: {
      read: () => request<ModelContextSnapshot>({ operation: 'guiModelContextRead' }),
      write: (model: string, capacity: number | null) =>
        request<ModelContextSettings>({ operation: 'guiModelContextWrite', model, capacity }),
    },
    systemPrompts: {
      read: () => request<GuiSystemPromptSettings>({ operation: 'guiSystemPromptsRead' }),
      write: (settings: GuiSystemPromptSettings) =>
        request<GuiSystemPromptSettings>({ operation: 'guiSystemPromptsWrite', settings }),
    },
  };
}

export type GuiSettingsClient = ReturnType<typeof createGuiSettingsClient>;
