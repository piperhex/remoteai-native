import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t, useLanguage } from '../../i18n';
import { marketText } from '../../../vendor/shared/provider-market/i18n';
import { useThemeColor } from '../../theme/store';
import { useMappingBrowserStyles } from './mappingBrowserStyles';

export function MappingBrowserSettings({ top, dismiss, close, bookmarks, mappings, search }: {
  top: number; dismiss: () => void; close: () => void; bookmarks: () => void;
  mappings: () => void; search: () => void;
}) {
  const styles = useMappingBrowserStyles();
  const color = useThemeColor();
  const text = marketText(useLanguage());
  return <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
    <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={dismiss} />
    <View accessibilityRole="menu" accessibilityLabel={t('client.app.settings')}
      style={[styles.menu, { top }]}>
      <Pressable accessibilityRole="menuitem" onPress={search}
        accessibilityLabel={text('market.browserSearchEngine')}
        style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name="search-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{text('market.browserSearchEngine')}</Text>
      </Pressable>
      <Pressable accessibilityRole="menuitem" onPress={mappings}
        accessibilityLabel={t('client.portForwarding.portMapping')}
        style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name="swap-horizontal-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{t('client.portForwarding.portMapping')}</Text>
      </Pressable>
      <Pressable accessibilityRole="menuitem" onPress={bookmarks}
        accessibilityLabel={text('market.bookmarkAll')}
        style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name="bookmarks-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{text('market.bookmarkAll')}</Text>
      </Pressable>
      <Pressable accessibilityRole="menuitem" accessibilityLabel={t('client.projectBrowser.close')}
        onPress={close} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name="close-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{t('client.projectBrowser.close')}</Text>
      </Pressable>
    </View>
  </View>;
}
