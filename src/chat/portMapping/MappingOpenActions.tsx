import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { t } from '../../i18n';
import { useStyles } from '../styles';
import { textMetrics } from '../../theme/text';

const labelMetrics = textMetrics(13, 20);
const detailMetrics = textMetrics(12, 18);

export function MappingOpenActions({ port, preview, opened }: {
  port: number; preview: () => void; opened: () => void;
}) {
  const styles = useStyles();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const openBrowser = async () => {
    if (pending.current) return;
    pending.current = true;
    setOpening(true);
    setError('');
    try {
      await Linking.openURL(`http://127.0.0.1:${port}`);
      opened();
    } catch {
      setError(t('client.portForwarding.couldNotOpenTheBrowserPleaseTryAgain'));
    } finally { pending.current = false; setOpening(false); }
  };
  return <View style={{ gap: 10, paddingBottom: 16, maxWidth: 400, width: '100%', alignSelf: 'center' }}>
    <Pressable accessibilityRole="button" disabled={opening} onPress={preview}
      style={[styles.button, styles.primary, opening && styles.disabled]}>
      <Text style={[styles.buttonText, styles.primaryText, { lineHeight: undefined }, labelMetrics]}>
        {t('client.configLabels.builtInBrowser')}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={opening} onPress={() => { void openBrowser(); }}
      style={[styles.button, opening && styles.disabled]}>
      <Text style={[styles.buttonText, { lineHeight: undefined }, labelMetrics]}>
        {t('client.configLabels.externalBrowser')}</Text>
    </Pressable>
    {Platform.OS === 'ios' && <Text style={[styles.subtitle, { lineHeight: undefined }, detailMetrics]}>
      {t("client.portForwarding.switchingAppsMayInterruptTheMappingPreviewHereForA")}</Text>}
    {!!error && <Text accessibilityRole="alert" style={[styles.error, { lineHeight: undefined }, detailMetrics]}>
      {error}</Text>}
  </View>;
}
