import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { useCliGui } from '../../../vendor/shared/cli-gui/context';
import { cliErrorText } from '../../../vendor/shared/cli-gui/errors';
import { t, useLanguage } from '../../i18n';
import { useStyles } from '../styles';
import { CliSettings } from './CliSettings';
import type { ChatConnectionProps } from '../ChatProfileMenu';
import { useCliStyles } from './styles';

export function CliRuntime({ ready, active, connection }: {
  ready: boolean; active: boolean; connection: ChatConnectionProps;
}) {
  const { state, controller } = useCliGui()!;
  const common = useStyles();
  const styles = useCliStyles();
  const [settings, setSettings] = useState(false);
  useLanguage();
  if (state.engine === 'codex') return null;
  const runtime = state.runtime[state.engine];
  const installing = runtime?.status === 'installing';
  const cli = state.engine === 'claude' ? 'Claude Code' : 'Gemini CLI';
  const guide = state.engine === 'claude' ? 'https://code.claude.com/docs/en/setup#install-claude-code'
    : 'https://geminicli.com/docs/get-started/installation/';
  return <>
    <View style={styles.setup}>
      <Text style={styles.title}>{cli}</Text>
      <Text style={styles.body}>{t('client.cliGui.setupHint')}</Text>
      {!!runtime?.error && <Text style={styles.error}>{cliErrorText(runtime.error)}</Text>}
      {installing && <ActivityIndicator accessibilityLabel={t('client.cliGui.installing')} />}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" style={[common.button, common.primary]}
          disabled={!active || !ready || installing} onPress={() => { void controller.install(); }}>
          <Text style={[styles.body, common.primaryText]}>{t(installing ? 'client.cliGui.installing'
            : runtime?.cliVersion ? 'client.cliGui.update' : 'client.cliGui.install')}</Text>
        </Pressable>
        <Pressable accessibilityRole="link" style={common.button}
          onPress={() => { void Linking.openURL(guide).catch(controller.report); }}>
          <Text style={styles.body}>{t('client.cliGui.officialInstall', { cli })}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={common.button} disabled={!ready}
          onPress={() => { void controller.refresh(); }}>
          <Text style={styles.body}>{t('client.cliGui.refresh')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={common.button} onPress={() => setSettings(true)}>
          <Text style={styles.body}>{t('client.chat.chatSettings.1e06eb')}</Text>
        </Pressable>
      </View>
    </View>
    {settings && active && <CliSettings connection={connection} ready={ready} active={active}
      close={() => setSettings(false)} />}
  </>;
}
