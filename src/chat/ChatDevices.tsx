import { t, useLanguage } from '../i18n';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView, SHEET_READABLE_WIDTH } from '../components/SheetScrollView';
import type { RemoteDevice } from '../types';
import { computerDetails } from '../../vendor/shared/remote-chat/devices';
import { useStyles } from './styles';

export function ChatDevices({ devices, choose, onClose }: {
  devices: RemoteDevice[]; choose: (id: string) => void; onClose: () => void;
}) {
  const styles = useStyles();
  useLanguage();
  return <BottomSheet fullWidthContent visible title={t("client.settings.chooseAComputer")} onClose={onClose}>
    <SheetScrollView contentContainerStyle={[styles.settings, { maxWidth: SHEET_READABLE_WIDTH }]}>
      {devices.map((device) => <Pressable key={device.deviceId} accessibilityRole="button"
        style={styles.card}
        onPress={() => choose(device.deviceId)}>
        <View style={styles.row}>
          <View style={styles.fill}><Text style={styles.headerTitle}>{device.name}</Text>
            {!!computerDetails(device) && <Text style={styles.deviceMeta}>{computerDetails(device)}</Text>}</View>
          <Text style={styles.deviceMeta}>{t(device.online ? "client.chat.online" : "client.chat.offline")}</Text>
        </View>
      </Pressable>)}
      {!devices.length && <Text style={styles.subtitle}>{t("client.chat.openRemoteAiOnYourComputerAndSignInWith")}</Text>}
    </SheetScrollView>
  </BottomSheet>;
}
