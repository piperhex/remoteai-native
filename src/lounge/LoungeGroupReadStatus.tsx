import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { LoungeController } from '../../vendor/shared/lounge/controller';
import type { LoungeMessage } from '../../vendor/shared/lounge/types';
import { accountName } from '../../vendor/shared/lounge/names';
import { t } from '../i18n';
import { LoungeSheet } from './LoungeSheet';
import { useLoungeStyles } from './styles';
import { useLoungeColor } from './theme';

const READ_COLOR = '#237804';
const STATUS_HIT_SLOP = 8;

export function LoungeGroupReadStatus({ message, controller }: {
  message: LoungeMessage; controller: LoungeController;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot);
  const styles = useLoungeStyles();
  const color = useLoungeColor();
  const [open, setOpen] = useState(false);
  const overlay = useId();
  const allowed = state.policy.moderator && state.user?.id === message.sender.id && !message.recipient;
  const current = state.messages.find(item =>
    item.id === message.id && item.sender.id === message.sender.id) ?? message;
  const readers = current.delivery?.readers ?? [];
  useEffect(() => { if (!allowed) setOpen(false); }, [allowed]);
  useEffect(() => {
    controller.setGroupReadOverlay(overlay, open && allowed);
    return () => controller.setGroupReadOverlay(overlay, false);
  }, [controller, overlay, open, allowed]);
  if (!allowed || !message.groupReceipt) return null;
  const label = t('client.lounge.groupReadCount', { count: readers.length });
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={STATUS_HIT_SLOP}
      onPress={() => setOpen(true)}>
      <Text style={[styles.messageTime, readers.length > 0 && { color: color(READ_COLOR, 'accent') }]}>{label}</Text>
    </Pressable>
    {open && allowed && <LoungeSheet title={t('client.lounge.groupReadersTitle')} close={() => setOpen(false)}>
      {!readers.length && <Text style={styles.muted}>{t('client.lounge.groupReadersEmpty')}</Text>}
      {readers.map(reader => <View key={reader.id} style={styles.infoRow}>
        <View style={styles.heading}><Text style={styles.rowTitle}>{accountName(reader)}</Text>
          <Text style={styles.muted}>{reader.account}</Text></View>
      </View>)}
    </LoungeSheet>}
  </>;
}
