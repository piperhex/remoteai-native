import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { RemoteDevice } from '../types';
import { t, useLanguage } from '../i18n';
import { useDeviceMappings, type DeviceMappingEntry } from '../../vendor/shared/port-mapping/deviceRegistry';
import { useNativeBrowser } from '../browser/context';
import { MappingOpenActions } from '../chat/portMapping/MappingOpenActions';
import { BottomSheet } from '../components/BottomSheet';
import { useMappingStyles } from '../chat/portMapping/mappingStyles';
import { MappingEditor } from './MappingEditor';
import { PortMappingHeader } from './PortMappingHeader';
import { PortMappingCard } from './PortMappingCard';
import { useMappingCardStyles } from './mappingCardStyles';

export function PortMappingPage({ devices, onBack }: { devices: RemoteDevice[]; onBack: () => void }) {
  useLanguage();
  const styles = useMappingStyles();
  const cardStyles = useMappingCardStyles();
  const browser = useNativeBrowser();
  const scroll = useRef<ScrollView>(null);
  const mappings = useDeviceMappings().filter(mapping => devices.some(device => device.deviceId === mapping.deviceId));
  const [editing, setEditing] = useState<DeviceMappingEntry | 'new'>();
  const [selection, setSelection] = useState<{ id: string }>();
  const selected = mappings.find(mapping => `${mapping.deviceId}:${mapping.entry.id}` === selection?.id
    && mapping.entry.status === 'running' && mapping.entry.protocol !== 'udp');
  const close = () => setSelection(undefined);
  useEffect(() => { if (!selected) setSelection(undefined); }, [selected]);
  const edit = (mapping: DeviceMappingEntry | 'new') => {
    setEditing(mapping); scroll.current?.scrollTo({ y: 0, animated: true });
  };
  return <View style={cardStyles.page}>
    <PortMappingHeader onBack={onBack} onAdd={() => edit('new')} canAdd={!!devices.length} />
    <ScrollView ref={scroll} contentContainerStyle={cardStyles.content} keyboardShouldPersistTaps="handled">
    {!devices.length && <Text style={styles.empty}>{t('client.mappingHub.noDevices')}</Text>}
    {!!devices.length && !mappings.length && !editing && <Text style={styles.empty}>
      {t('client.portForwarding.noPortMappingsYet')}</Text>}
    {editing && <MappingEditor key={typeof editing === 'string' ? editing : editing.entry.id}
      devices={devices} mapping={typeof editing === 'string' ? undefined : editing}
      done={() => setEditing(undefined)} />}
    {mappings.map(mapping => <PortMappingCard key={`${mapping.deviceId}:${mapping.entry.id}`}
      mapping={mapping} blue={devices.findIndex(device => device.deviceId === mapping.deviceId) % 2 === 0}
      deviceName={devices.find(device => device.deviceId === mapping.deviceId)?.name}
      edit={() => edit(mapping)}
      open={() => setSelection({ id: `${mapping.deviceId}:${mapping.entry.id}` })} />)}
    </ScrollView>
    {selected && selection && <BottomSheet visible maxWidth={400}
      title={t('client.portForwarding.openMappedAddress')}
      subtitle={`http://127.0.0.1:${selected.entry.localPort}`} onClose={close}>
      <MappingOpenActions key={selection.id} port={selected.entry.localPort} opened={close}
        preview={() => { browser.open(`http://127.0.0.1:${selected.entry.localPort}`); close(); }} />
    </BottomSheet>}
  </View>;
}
