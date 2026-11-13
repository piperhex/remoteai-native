import { useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDeviceMappings, type DeviceMappingEntry } from '../../vendor/shared/port-mapping/deviceRegistry';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { runningBrowserMappings, type BrowserDevice } from './browserMappings';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { t, useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { useBrowserListStyles } from './browserListStyles';

export function BrowserPortMappings({ devices, visit, close }: {
  devices: readonly BrowserDevice[]; visit: (url: string) => void; close: () => void;
}) {
  const text = marketText(useLanguage());
  const styles = useBrowserListStyles();
  const entries = runningBrowserMappings(useDeviceMappings(), devices);
  return <BottomSheet visible title={t('client.portForwarding.portMapping')} onClose={close}
    subtitle={text('market.browserActiveMappingsHint')} maxWidth={400} maxHeight="80%">
    <SheetScrollView contentContainerStyle={styles.list}>
      {!entries.length && <Text style={styles.empty}>{text('market.browserNoActiveMappings')}</Text>}
      {entries.map(mapping => <MappingAddress key={`${mapping.deviceId}:${mapping.entry.id}`} mapping={mapping}
        deviceName={devices.find(device => device.deviceId === mapping.deviceId)?.name} visit={visit} />)}
    </SheetScrollView>
  </BottomSheet>;
}

export function MappingAddress({ mapping, deviceName, visit }: {
  mapping: DeviceMappingEntry; deviceName?: string; visit: (url: string) => void;
}) {
  const { runtime, entry } = mapping;
  const alias = useSyncExternalStore(runtime.aliases.subscribe, () => runtime.aliases.get(entry.id));
  const styles = useBrowserListStyles();
  const color = useThemeColor();
  const address = `http://127.0.0.1:${entry.localPort}`;
  return <Pressable accessibilityRole="button" style={styles.row} onPress={() => visit(address)}>
    <Ionicons name="swap-horizontal-outline" size={22} color={color('#0b8065', 'accent')} />
    <View style={styles.details}>
      <Text style={styles.title}>{alias || deviceName || t('client.mappingHub.device')}</Text>
      {!!alias && !!deviceName && <Text style={styles.secondary}>{deviceName}</Text>}
      <Text style={styles.address}>{address}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={color('#718078', 'muted')} />
  </Pressable>;
}
