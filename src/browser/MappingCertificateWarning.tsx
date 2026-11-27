import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';

export function MappingCertificateWarning({ url, fingerprint, changed, back, trust }: {
  url: string; fingerprint: string; changed: boolean; back: () => void; trust: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);
  const styles = useStyles();
  return <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Ionicons name="warning-outline" size={40} color={styles.warning.color} />
    <Text accessibilityRole="header" style={styles.title}>{t('client.mappingCertificate.title')}</Text>
    <Text style={styles.body}>{t('client.mappingCertificate.description', { host: new URL(url).host })}</Text>
    {changed && <Text accessibilityRole="alert" style={styles.warning}>{t('client.mappingCertificate.changed')}</Text>}
    <Pressable accessibilityRole="button" style={styles.primary} onPress={back}>
      <Text style={styles.primaryText}>{t('client.mappingCertificate.back')}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: advanced }}
      style={styles.action} onPress={() => setAdvanced(!advanced)}>
      <Text style={styles.link}>{t('client.mappingCertificate.advanced')}</Text>
    </Pressable>
    {advanced && <>
      <Text selectable style={styles.body}>SHA-256{'\n'}{fingerprint.match(/.{2}/g)?.join(':')}</Text>
      <Text style={styles.body}>{t('client.mappingCertificate.remember')}</Text>
      <Pressable accessibilityRole="button" style={styles.action} onPress={trust}>
        <Text style={styles.link}>{t('client.mappingCertificate.trust')}</Text>
      </Pressable>
    </>}
  </ScrollView>;
}

const useStyles = createThemedStyles(color => ({
  page: { ...StyleSheet.absoluteFillObject, backgroundColor: color('#fff', 'surface') },
  content: { padding: 24, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  title: { ...textMetrics(20, 28), fontWeight: '700', color: color('#17211b', 'ink') },
  body: { ...textMetrics(14, 21), color: color('#34493e', 'ink') },
  warning: { ...textMetrics(14, 21), color: color('#ae3a32', 'danger') },
  primary: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: color('#08795d', 'accent') },
  primaryText: { ...textMetrics(14, 21), fontWeight: '600', color: color('#fff', 'canvas') },
  action: { alignSelf: 'flex-start', paddingVertical: 8 },
  link: { ...textMetrics(14, 21), color: color('#08795d', 'accent') },
}));
