import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { t, useLanguage } from '../../i18n';
import { marketText } from '../../../vendor/shared/provider-market/i18n';
import { useThemeColor } from '../../theme/store';
import { useMappingBrowserStyles } from './mappingBrowserStyles';
import { MappingPreviewActivity } from './MappingPreviewActivity';
import type { useMappingBrowser } from './useMappingBrowser';

type Browser = ReturnType<typeof useMappingBrowser>;
// Unfocused native inputs otherwise retain the caret's horizontal scroll at the URL's end.
const ADDRESS_START = { start: 0, end: 0 };

function ToolbarButton({ icon, label, onPress, disabled, expanded }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void;
  disabled?: boolean; expanded?: boolean;
}) {
  const styles = useMappingBrowserStyles();
  const color = useThemeColor();
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled, expanded }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.icon, disabled && styles.disabled, pressed && styles.pressed]}>
    <Ionicons name={icon} size={21} color={color('#0b8065', 'accent')} />
  </Pressable>;
}

export function MappingBrowserToolbar({ browser, compact, settingsOpen, openSettings,
  onLayout, tabCount, newTab, manageTabs }: {
  compact: boolean;
  browser: Browser; settingsOpen: boolean; openSettings: () => void; onLayout: (event: LayoutChangeEvent) => void;
  tabCount: number; newTab: () => void; manageTabs: () => void;
}) {
  const styles = useMappingBrowserStyles();
  const text = marketText(useLanguage());
  const color = useThemeColor();
  const [addressFocused, setAddressFocused] = useState(false);
  const address = <TextInput accessibilityLabel={t('client.portMappingEditing.accessAddress')} style={styles.address}
    placeholder={text('market.browserSearchOrAddress')} placeholderTextColor={color('#718078', 'muted')}
    value={browser.address} onChangeText={browser.setAddress}
    selection={addressFocused ? undefined : ADDRESS_START} textAlign="left"
    onFocus={() => setAddressFocused(true)} onBlur={() => setAddressFocused(false)}
    onSubmitEditing={event => browser.submit(event.nativeEvent.text)}
    keyboardType="url" returnKeyType="go" autoCapitalize="none" autoCorrect={false} selectTextOnFocus />;
  const home = <ToolbarButton icon="home-outline" label={text('market.browserHome')} onPress={browser.home} />;
  const actions = <>
    <Pressable accessibilityRole="button" accessibilityLabel={text('market.browserNewTab')}
      style={styles.icon} onPress={newTab}><Ionicons name="add" size={24} color={color('#0b8065', 'accent')} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={text('market.browserManageTabs', { count: tabCount })}
      style={styles.icon} onPress={manageTabs}><Text style={styles.tabCount}>{tabCount}</Text></Pressable>
    <ToolbarButton icon="settings-outline" label={t('client.app.settings')}
      expanded={settingsOpen} onPress={openSettings} />
  </>;
  return <View style={[styles.toolbar, compact && styles.compactToolbar]} onLayout={onLayout}>
    {compact ? <>
      {address}
      <View style={styles.compactToolbarActions}>{home}{actions}</View>
    </> : <>
      {home}
      <View style={styles.addressFrame}>{address}</View>
      {actions}
    </>}
    <MappingPreviewActivity progress={browser.homeVisible || browser.resourceVisible ? null : browser.activity.progress} />
  </View>;
}
