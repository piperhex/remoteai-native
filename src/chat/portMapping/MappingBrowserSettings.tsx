import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../i18n';
import { useThemeColor } from '../../theme/store';
import { useMappingBrowserStyles } from './mappingBrowserStyles';

export function MappingBrowserSettings({ top, dismiss, close }: {
  top: number; dismiss: () => void; close: () => void;
}) {
  const styles = useMappingBrowserStyles();
  const color = useThemeColor();
  return <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
    <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={dismiss} />
    <View accessibilityRole="menu" accessibilityLabel={t('client.app.settings')}
      style={[styles.menu, { top }]}>
      <Pressable accessibilityRole="menuitem" accessibilityLabel={t('client.projectBrowser.close')}
        onPress={close} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name="close-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{t('client.projectBrowser.close')}</Text>
      </Pressable>
    </View>
  </View>;
}
