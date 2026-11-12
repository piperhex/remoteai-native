import { Ionicons } from '@expo/vector-icons';
import { Pressable, TextInput, View } from 'react-native';
import type { MessageKey } from '@remoteai/i18n';
import { t } from '../../i18n';
import { useThemeColor } from '../../theme/store';
import { MappingPreviewActivity } from './MappingPreviewActivity';
import { useMappingBrowserStyles } from './mappingBrowserStyles';
import type { useMappingBrowser } from './useMappingBrowser';

type Browser = ReturnType<typeof useMappingBrowser>;

function ToolbarButton({ icon, label, onPress, disabled, loading }: {
  icon: keyof typeof Ionicons.glyphMap; label: MessageKey; onPress: () => void;
  disabled?: boolean; loading?: boolean;
}) {
  const styles = useMappingBrowserStyles();
  const color = useThemeColor();
  return <Pressable accessibilityRole="button" accessibilityLabel={t(label)}
    accessibilityState={{ disabled: !!disabled, busy: !!loading }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.icon, disabled && styles.disabled, pressed && styles.pressed]}>
    {loading ? <MappingPreviewActivity active />
      : <Ionicons name={icon} size={21} color={color('#0b8065', 'accent')} />}
  </Pressable>;
}

export function MappingBrowserToolbar({ browser, close }: { browser: Browser; close: () => void }) {
  const styles = useMappingBrowserStyles();
  return <View style={styles.toolbar}>
    <ToolbarButton icon="close-outline" label="client.projectBrowser.close" onPress={close} />
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
  </View>;
}
