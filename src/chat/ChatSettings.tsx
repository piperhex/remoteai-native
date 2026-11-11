import { displayError } from '../i18n/index';
import { t, useLanguage } from '../i18n';
import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import type { Model, ThreadTokenUsage } from './types';
import type { ComposerSettings } from '../../vendor/shared/remote-chat/composer';
import { composerSettingsFields, settingsNotice,
  type SettingField } from '../../vendor/shared/remote-chat/settingsMenu';
import { useStyles } from './styles';
import { ChatUsage } from './ChatUsage';
import type { ReadUsage } from '../../vendor/shared/remote-chat/usage';
import type { ReadConversationMetrics } from '../../vendor/shared/remote-chat/conversationMetrics';
import type { ContextSettingsApi } from '../../vendor/shared/remote-chat/contextSettings';
import { ChatContextSettings } from './ChatContextSettings';
import { ChatProfileMenu, type ChatConnectionProps } from './ChatProfileMenu';
import { ChatSettingsFields, ChatSettingsModelSheet } from './ChatSettingsFields';
import { ChatSettingsSheet } from './ChatSettingsSheet';

interface Props {
  connection: ChatConnectionProps;
  cliLocked?: boolean;
  cwd?: string;
  threadId: string | null;
  contextSettings: ContextSettingsApi;
  tokenUsage?: ThreadTokenUsage;
  readUsage: ReadUsage;
  readConversationMetrics: ReadConversationMetrics;
  usageActive: boolean;
  models: Model[];
  selection: ComposerSettings;
  saving: boolean;
  ready: boolean;
  error: string;
  updateSettings: (settings: Partial<ComposerSettings>) => Promise<void>;
  refreshModels: () => Promise<void>;
  onClose: () => void;
}

export function ChatSettings({ models, selection, saving, ready, error, updateSettings, refreshModels, onClose,
  readUsage, readConversationMetrics, usageActive, tokenUsage, threadId, contextSettings, connection,
  cliLocked = false, cwd }: Props) {
  const styles = useStyles();
  useLanguage();
  const [field, setField] = useState<SettingField | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const nestedOpen = field !== null || contextOpen;
  useEffect(() => { setContextOpen(false); }, [threadId, ready]);
  const notice = settingsNotice({ saving, ready, error });
  const fields = composerSettingsFields(models, selection);
  const selectInline = (field: SettingField, value: string) => {
    if (value !== selection[field] || error) void updateSettings({ [field]: value });
  };
  const choose = async (value: string) => {
    if (!field) return;
    if (value !== selection[field] || error) await updateSettings({ [field]: value });
    setField((current) => current === field ? null : current);
  };
  return <ChatSettingsSheet nestedOpen={nestedOpen} close={onClose} panels={<>
    {contextOpen && threadId && ready && <ChatContextSettings key={threadId} threadId={threadId}
      api={contextSettings} onClose={() => setContextOpen(false)} />}
    {field && <ChatSettingsModelSheet field={fields[0]} ready={ready} refresh={refreshModels}
      choose={value => { void choose(value); }} close={() => setField(null)} />}
  </>}>
      <ChatUsage read={readUsage} active={usageActive && !nestedOpen} ready={ready} tokenUsage={tokenUsage}
        readConversationMetrics={readConversationMetrics} threadId={threadId}
        onContextSettings={threadId && ready ? () => setContextOpen(true) : undefined} />
      <ChatProfileMenu {...connection} variant="settings" ready={ready} active={usageActive}
        cliLocked={Boolean(threadId) || cliLocked} cliCwd={cwd} />
      <ChatSettingsFields fields={fields} openModel={() => setField('model')} change={selectInline} />
      {!!notice && <Text accessibilityRole={error ? 'alert' : undefined}
        style={error ? styles.error : styles.subtitle}>{displayError(notice)}</Text>}
      {!!error && <Pressable accessibilityRole="button" style={styles.button}
        onPress={() => { void updateSettings(selection); }}><Text style={styles.buttonText}>{t("client.chat.saveAgain")}</Text></Pressable>}
  </ChatSettingsSheet>;
}
