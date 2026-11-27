import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { t } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';

export function BrowserLoadError({ retryUrl, retry }: { retryUrl?: URL; retry: (url: string) => void }) {
  const styles = useStyles();
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text accessibilityRole="alert" style={styles.message}>
      {t('client.portForwarding.couldNotLoadTheWebsiteCheckThatTheServiceIs')}
    </Text>
    {retryUrl && <Pressable accessibilityRole="link" style={styles.action} onPress={() => retry(retryUrl.href)}>
      <Text style={styles.link}>{retryUrl.origin}</Text>
    </Pressable>}
  </ScrollView>;
}

const useStyles = createThemedStyles(color => ({
  page: { ...StyleSheet.absoluteFillObject, backgroundColor: color('#fff', 'surface') },
  content: { padding: 24, gap: 8, alignItems: 'center' },
  message: { ...textMetrics(14, 22), color: color('#718078', 'muted'), maxWidth: 400, textAlign: 'center' },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  link: { ...textMetrics(14, 22), color: color('#08795d', 'accent') },
}));
