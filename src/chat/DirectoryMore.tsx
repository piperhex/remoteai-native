import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useCliGui } from '../../vendor/shared/cli-gui/context';
import { t } from '../i18n';
import { useStyles } from './styles';
import { textMetrics } from '../theme/text';
import { cliEnginesInThreads } from '../../vendor/shared/cli-gui/summary';
import type { Thread } from './types';

export function DirectoryMore({ visible, load, busy = false, style }: {
  visible: boolean; load: () => Promise<void>; busy?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { fontSize, lineHeight, ...subtitle } = StyleSheet.flatten(styles.subtitle);
  const metrics = textMetrics(fontSize - 1, lineHeight);
  const [loading, setLoading] = useState(false);
  if (!visible) return null;
  return <Pressable accessibilityRole="button" accessibilityState={{ busy: loading || busy }} disabled={loading || busy}
    style={style ?? styles.button} onPress={() => {
      setLoading(true); void load().finally(() => setLoading(false));
    }}><View style={styles.row}>{(loading || busy) && <ActivityIndicator size="small" />}
      <Text style={[subtitle, metrics]}>{t(loading || busy ? 'client.projectBrowser.loading' : 'client.chat.loadMore')}</Text>
    </View></Pressable>;
}

export function CliDirectoryMore({ threads, style }: { threads: Thread[]; style?: StyleProp<ViewStyle> }) {
  const cli = useCliGui();
  const engines = cli ? cliEnginesInThreads(threads, cli.state.sessions).filter(engine => cli.state.listMore?.[engine]) : [];
  return <DirectoryMore visible={engines.length > 0} style={style}
    load={() => cli?.controller.loadMoreSessions(engines) ?? Promise.resolve()} />;
}
