import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { t, useLanguage } from '../../i18n';
import { marketText } from '../../../vendor/shared/provider-market/i18n';
import { useThemeColor } from '../../theme/store';
import { useMappingBrowserStyles } from './mappingBrowserStyles';
import { randomUUID } from 'expo-crypto';
import { useCurrentBookmark } from '../../../vendor/shared/browser/bookmarks/useCurrentBookmark';
import { bookmarkStatusKeys } from '../../../vendor/shared/browser/bookmarks/status';

export function MappingBrowserSettings({ top, dismiss, reload, bookmarks, mappings, search, history, passwords, external, url, title,
  desktop, onDesktopChange, fullscreen }: {
  top: number; dismiss: () => void; reload: () => void; bookmarks: () => void;
  mappings: () => void; search: () => void;
  history: () => void; passwords: () => void;
  external?: () => void;
  url: string; title: string;
  desktop: boolean; onDesktopChange: (desktop: boolean) => void;
  fullscreen: () => void;
}) {
  const styles = useMappingBrowserStyles();
  const { height, width } = useWindowDimensions();
  const color = useThemeColor();
  const text = marketText(useLanguage());
  const current = useCurrentBookmark({ url, title, newId: randomUUID });
  return <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
    <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={dismiss} />
    <ScrollView accessibilityRole="menu" accessibilityLabel={t('client.app.settings')}
      style={[styles.menu, { top, maxHeight: height - top - 100, maxWidth: Math.min(400, width - 16) }]}>
      <Pressable accessibilityRole="menuitem" accessibilityLabel={text('market.browserReload')}
        disabled={!url} accessibilityState={{ disabled: !url }} onPress={() => { dismiss(); reload(); }}
        style={({ pressed }) => [styles.menuItem, !url && styles.disabled, pressed && styles.pressed]}>
        <Ionicons name="reload-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{text('market.browserReload')}</Text>
      </Pressable>
      <Pressable accessibilityRole="menuitem" onPress={current.add} disabled={!current.available || current.saved}
        accessibilityLabel={text('market.bookmarkAdd')}
        accessibilityState={{ disabled: !current.available || current.saved, selected: current.saved }}
        style={({ pressed }) => [styles.menuItem, !current.available && styles.disabled, pressed && styles.pressed]}>
        <Ionicons name={current.saved ? 'checkmark-outline' : 'star-outline'} size={21}
          color={color('#0b8065', 'accent')} />
        <Text style={styles.menuText}>{text('market.bookmarkAdd')}</Text>
      </Pressable>
      <Pressable accessibilityRole="checkbox" accessibilityLabel={text('market.browserDesktopSite')}
        accessibilityState={{ checked: desktop }} onPress={() => onDesktopChange(!desktop)}
        style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name="desktop-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={[styles.menuText, { flex: 1 }]}>{text('market.browserDesktopSite')}</Text>
        <Ionicons name={desktop ? 'checkbox-outline' : 'square-outline'} size={23}
          color={color('#0b8065', 'accent')} />
      </Pressable>
      <Pressable accessibilityRole="menuitem" accessibilityLabel={text('market.browserFullscreen')}
        onPress={fullscreen} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name="expand-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{text('market.browserFullscreen')}</Text>
      </Pressable>
      {(current.invalid || current.status === 'storage-error') && <Text style={styles.menuText} accessibilityRole="alert">
        {text(current.invalid ? 'market.bookmarkInvalid' : bookmarkStatusKeys[current.status])}</Text>}
      <Pressable accessibilityRole="menuitem" onPress={external} disabled={!external}
        accessibilityLabel={t('client.workspaceActions.openInBrowser')}
        style={({ pressed }) => [styles.menuItem, !external && styles.disabled, pressed && styles.pressed]}>
        <Ionicons name="open-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{t('client.workspaceActions.openInBrowser')}</Text>
      </Pressable>
      <Pressable accessibilityRole="menuitem" onPress={search}
        accessibilityLabel={text('market.browserSearchEngine')}
        style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name="search-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{text('market.browserSearchEngine')}</Text>
      </Pressable>
      <Pressable accessibilityRole="menuitem" onPress={history} style={styles.menuItem}>
        <Ionicons name="time-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{text('market.browserHistory')}</Text>
      </Pressable>
      <Pressable accessibilityRole="menuitem" onPress={passwords} style={styles.menuItem}>
        <Ionicons name="key-outline" size={21} color={color('#17211b', 'ink')} />
        <Text style={styles.menuText}>{text('market.browserPasswords')}</Text>
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
    </ScrollView>
  </View>;
}
