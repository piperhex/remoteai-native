import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useCliGui } from '../../../vendor/shared/cli-gui/context';
import { cliSettingsFields, cliSettingsPatch } from '../../../vendor/shared/cli-gui/settingsFields';
import { t, useLanguage } from '../../i18n';
import { ChatProfileMenu, type ChatConnectionProps } from '../ChatProfileMenu';
import { ChatSettingsFields, ChatSettingsModelSheet } from '../ChatSettingsFields';
import { ChatSettingsSheet } from '../ChatSettingsSheet';
import { ChatUsage } from '../ChatUsage';
import { useStyles } from '../styles';

export function CliSettings({ connection, ready, active, close }: {
  connection: ChatConnectionProps; ready: boolean; active: boolean; close: () => void;
}) {
  useLanguage();
  const { state, controller } = useCliGui()!;
  const styles = useStyles();
  const [modelOpen, setModelOpen] = useState(false);
  if (state.engine === 'codex') return null;
  const fields = cliSettingsFields(state, ready);
  const disabled = fields[0].disabled || Boolean(state.selected?.permissions.length);
  const refresh = async () => { await controller.refresh(); await controller.loadCatalog(); };
  return <ChatSettingsSheet close={close} nestedOpen={modelOpen} panels={modelOpen &&
    <ChatSettingsModelSheet field={fields[0]} ready={ready && !state.busy} refresh={refresh}
      choose={value => { controller.patch(cliSettingsPatch(state, 'model', value)); setModelOpen(false); }}
      close={() => setModelOpen(false)} />}>
    <ChatUsage active={active && !modelOpen} ready={ready} threadId={null} />
    <ChatProfileMenu {...connection} variant="settings" ready={ready} active={active} />
    <ChatSettingsFields fields={fields} openModel={() => setModelOpen(true)}
      change={(field, value) => controller.patch(cliSettingsPatch(state, field, value))} />
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
      style={[styles.button, disabled && styles.disabled]} onPress={() => { close(); void controller.install(); }}>
      <Text style={styles.buttonText}>{t('client.cliGui.update')}</Text>
    </Pressable>
  </ChatSettingsSheet>;
}
