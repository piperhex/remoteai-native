import { Ionicons } from '@expo/vector-icons';
import { Pressable, TextInput, View, type LayoutChangeEvent } from 'react-native';
import type { MessageKey } from '@remoteai/i18n';
import { t } from '../../i18n';
import { useThemeColor } from '../../theme/store';
import { MappingPreviewActivity } from './MappingPreviewActivity';
import { useMappingBrowserStyles } from './mappingBrowserStyles';
import type { useMappingBrowser } from './useMappingBrowser';

type Browser = ReturnType<typeof useMappingBrowser>;

function ToolbarButton({ icon, label, onPress, disabled, loading, expanded }: {
  icon: keyof typeof Ionicons.glyphMap; label: MessageKey; onPress: () => void;
  disabled?: boolean; loading?: boolean; expanded?: boolean;
}) {
  const styles = useMappingBrowserStyles();
  const color = useThemeColor();
  return <Pressable accessibilityRole="button" accessibilityLabel={t(label)}
    accessibilityState={{ disabled: !!disabled, busy: !!loading, expanded }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.icon, disabled && styles.disabled, pressed && styles.pressed]}>
    {loading ? <MappingPreviewActivity active />
      : <Ionicons name={icon} size={21} color={color('#0b8065', 'accent')} />}
  </Pressable>;
}

export function MappingBrowserToolbar({ browser, settingsOpen, openSettings, onLayout }: {
  browser: Browser; settingsOpen: boolean; openSettings: () => void; onLayout: (event: LayoutChangeEvent) => void;
}) {
  const styles = useMappingBrowserStyles();
  return <View style={styles.toolbar} onLayout={onLayout}>
    <ToolbarButton icon="chevron-back" label="client.mobile.back" disabled={!browser.history.back}
      onPress={() => browser.navigate('goBack')} />
    <ToolbarButton icon="chevron-forward" label="client.projectExplorer.forward" disabled={!browser.history.forward}
      onPress={() => browser.navigate('goForward')} />
    <TextInput accessibilityLabel={t('client.portMappingEditing.accessAddress')} style={styles.address}
      value={browser.address} onChangeText={browser.setAddress} onSubmitEditing={browser.submit}
      keyboardType="url" returnKeyType="go" autoCapitalize="none" autoCorrect={false} selectTextOnFocus />
    <ToolbarButton icon="refresh-outline" label="client.chat.refresh" loading={browser.activity.active}
      onPress={() => browser.navigate('reload')} />
    <ToolbarButton icon="open-outline" label="client.workspaceActions.openInBrowser"
      onPress={() => { void browser.openExternal(); }} />
    <ToolbarButton icon="settings-outline" label="client.app.settings" expanded={settingsOpen} onPress={openSettings} />
  </View>;
}
