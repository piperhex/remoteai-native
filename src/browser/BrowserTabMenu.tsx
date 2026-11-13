import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { useMappingBrowserStyles } from '../chat/portMapping/mappingBrowserStyles';

export function BrowserTabMenu({ top, dismiss, closeAll }: {
  top: number; dismiss: () => void; closeAll: () => void;
}) {
  const styles = useMappingBrowserStyles();
  const color = useThemeColor();
  const text = marketText(useLanguage());
  const { width } = useWindowDimensions();
  return <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
    <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={dismiss} />
    <View accessibilityRole="menu" accessibilityLabel={text('market.moreActions')}
      style={[styles.menu, { top, maxWidth: Math.min(400, width - 24) }]}>
      <Pressable accessibilityRole="menuitem" accessibilityLabel={text('market.browserCloseAllTabs')}
        onPress={() => { dismiss(); closeAll(); }}
        style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name="close-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{text('market.browserCloseAllTabs')}</Text>
      </Pressable>
    </View>
  </View>;
}
