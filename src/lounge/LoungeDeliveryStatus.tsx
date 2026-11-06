import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deliveryLabel, type LoungeDelivery } from '../../vendor/shared/lounge/delivery';
import { t } from '../i18n';
import type { LoungeMessage } from '../../vendor/shared/lounge/types';
import type { LoungeController } from '../../vendor/shared/lounge/controller';
import { LoungeGroupReadStatus } from './LoungeGroupReadStatus';

export function LoungeDeliveryStatus({ delivery, inline = false, message, controller }: {
  delivery?: LoungeDelivery; inline?: boolean; message?: LoungeMessage; controller?: LoungeController;
}) {
  if (message?.groupReceipt && !message.recipient) return controller
    ? <LoungeGroupReadStatus message={message} controller={controller} /> : null;
  if (delivery?.direction !== 'outgoing') return null;
  const name = ({ read: 'checkmark-done', delivered: 'checkmark', pending: 'time-outline',
    rejected: 'alert-circle-outline' } as const)[delivery.status];
  return <View accessible accessibilityRole="image" accessibilityLabel={t(deliveryLabel(delivery.status))}
    style={{ alignSelf: inline ? 'center' : 'flex-end', paddingTop: inline ? 0 : 4 }}>
    <Ionicons name={name} size={15} color={delivery.status === 'read' ? '#28a36b' : '#8c939d'} />
  </View>;
}
