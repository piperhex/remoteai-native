import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import type { MessageKey } from '@remoteai/i18n';
import { t, useLanguage } from '../../i18n';
import { marketText } from '../../../vendor/shared/provider-market/i18n';
import { useThemeColor } from '../../theme/store';
import { useMappingBrowserStyles } from './mappingBrowserStyles';
import type { useMappingBrowser } from './useMappingBrowser';

type Browser = ReturnType<typeof useMappingBrowser>;

function ToolbarButton({ icon, label, onPress, disabled, expanded }: {
  icon: keyof typeof Ionicons.glyphMap; label: MessageKey; onPress: () => void;
  disabled?: boolean; expanded?: boolean;
}) {
  const styles = useMappingBrowserStyles();
  const color = useThemeColor();
  return <Pressable accessibilityRole="button" accessibilityLabel={t(label)}
    accessibilityState={{ disabled: !!disabled, expanded }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.icon, disabled && styles.disabled, pressed && styles.pressed]}>
    <Ionicons name={icon} size={21} color={color('#0b8065', 'accent')} />
  </Pressable>;
}

export function MappingBrowserToolbar({ browser, settingsOpen, openSettings, onLayout, tabCount, newTab, manageTabs }: {
  browser: Browser; settingsOpen: boolean; openSettings: () => void; onLayout: (event: LayoutChangeEvent) => void;
  tabCount: number; newTab: () => void; manageTabs: () => void;
}) {
  const styles = useMappingBrowserStyles();
  const text = marketText(useLanguage());
  const color = useThemeColor();
  return <View style={styles.toolbar} onLayout={onLayout}>
    <ToolbarButton icon="chevron-back" label="client.mobile.back" disabled={!browser.history.back}
      onPress={() => browser.navigate('goBack')} />
    <ToolbarButton icon="chevron-forward" label="client.projectExplorer.forward" disabled={!browser.history.forward}
      onPress={() => browser.navigate('goForward')} />
    <TextInput accessibilityLabel={t('client.portMappingEditing.accessAddress')} style={styles.address}
      placeholder={text('market.browserSearchOrAddress')}
      placeholderTextColor={color('#718078', 'muted')}
      value={browser.address} onChangeText={browser.setAddress}
      onSubmitEditing={event => browser.submit(event.nativeEvent.text)}
      keyboardType="url" returnKeyType="go" autoCapitalize="none" autoCorrect={false} selectTextOnFocus />
    <Pressable accessibilityRole="button" accessibilityLabel={text('market.browserNewTab')}
      style={styles.icon} onPress={newTab}><Ionicons name="add" size={24} color={color('#0b8065', 'accent')} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={text('market.browserManageTabs', { count: tabCount })}
      style={styles.icon} onPress={manageTabs}><Text style={styles.tabCount}>{tabCount}</Text></Pressable>
    <ToolbarButton icon="settings-outline" label="client.app.settings" expanded={settingsOpen} onPress={openSettings} />
  </View>;
}
