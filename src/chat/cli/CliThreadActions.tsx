import { Pressable, Text, View } from 'react-native';
import { useCliGui } from '../../../vendor/shared/cli-gui/context';
import type { CliSession } from '../../../vendor/shared/cli-gui/types';
import { BottomSheet } from '../../components/BottomSheet';
import { t, useLanguage } from '../../i18n';
import { useCliStyles } from './styles';
import { useStyles } from '../styles';
import { engineNames } from './engine';

export function CliThreadActions({ session, ready, close }: {
  session: CliSession; ready: boolean; close: () => void;
}) {
  const cli = useCliGui()!;
  const styles = useCliStyles();
  const common = useStyles();
  useLanguage();
  const disabled = !ready || cli.state.busy || session.status === 'running' || session.archived;
  return <BottomSheet visible title={t('client.threadActions.chatActions')} onClose={close}>
    <View style={styles.content}>
      <Text style={styles.title}>{session.title}</Text>
      <Text style={styles.hint}>{t(engineNames[session.engine])}</Text>
      {!!session.cwd && <Text selectable style={styles.hint}>{session.cwd}</Text>}
      {!session.archived && <Pressable accessibilityRole="button" disabled={disabled}
        style={[styles.option, disabled && common.disabled]} onPress={() => {
          void cli.controller.act({ engine: session.engine, action: 'archive', id: session.id }).then(close);
        }}><Text style={styles.body}>{t('client.cliGui.archive')}</Text></Pressable>}
    </View>
  </BottomSheet>;
}
