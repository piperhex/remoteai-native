import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView, SHEET_READABLE_WIDTH } from '../components/SheetScrollView';
import { supportsScreenControl, type ScreenPowerControl } from '../../vendor/shared/remote-desktop/screenControl';
import { useScreenPowerStatus } from '../../vendor/shared/remote-desktop/useScreenPowerStatus';
import type { AccountSummary, RemoteDevice, RemoteProviderSummary } from '../types';
import { deviceColors, useStyles } from './styles';
import { RemoteModelSwitchContent, type RemoteModelSwitchContentProps } from './RemoteModelSwitchContent';

export type DeviceModelSwitch = Pick<RemoteModelSwitchContentProps,
  'switchingAccountId' | 'onSwitchAccount' | 'onSwitchProvider' | 'onSwitchProviderGroup'> & {
  switchingProvider: { deviceId: string; providerId: string } | null;
};

interface DeviceOptionsMenuProps {
  device: RemoteDevice;
  accounts: AccountSummary[];
  providers: RemoteProviderSummary[];
  modelSwitch: DeviceModelSwitch;
  deletingDeviceId: string | null;
  switchingAuthDeviceId: string | null;
  onClose: () => void;
  onOpenDesktop: (deviceId: string) => void;
  onDelete: (device: RemoteDevice) => void;
  onRevokeService: (device: RemoteDevice) => void;
  screenControl: ScreenPowerControl;
  onSelectAuthAccount: (deviceId: string) => void;
}

export function DeviceOptionsMenu(props: DeviceOptionsMenuProps) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  const [page, setPage] = useState<'actions' | 'model' | 'confirmScreen' | 'openingDesktop'>('actions');
  const { device, deletingDeviceId, switchingAuthDeviceId, onClose, onDelete, onSelectAuthAccount, modelSwitch } = props;
  const switchingProviderId = modelSwitch.switchingProvider?.deviceId === device.deviceId
    ? modelSwitch.switchingProvider.providerId : null;
  const switchingModel = Boolean(modelSwitch.switchingAccountId || switchingProviderId);
  const modelDisabled = !device.online || switchingModel || deletingDeviceId === device.deviceId;
  const deleteDisabled = device.online || Boolean(deletingDeviceId);
  const authDisabled = !device.online || Boolean(switchingAuthDeviceId);
  const confirmScreen = page === 'confirmScreen';
  const showModel = page === 'model';
  const openingDesktop = page === 'openingDesktop';
  const openDesktop = () => { onClose(); if (device.online) props.onOpenDesktop(device.deviceId); };
  const screen = useScreenPowerStatus(device, !showModel, props.screenControl.read);
  const runScreenAction = () => {
    if (screen.action === 'off') setPage('confirmScreen');
    if (screen.action === 'on') { onClose(); props.screenControl.change(device, false); }
  };
  const title = showModel ? t('client.app.switchModel')
    : confirmScreen ? t('client.deviceScreen.confirmTitle') : device.name;
  const subtitle = showModel ? t('client.app.chooseTheModelSourceForThisComputer', { value1: device.name })
    : confirmScreen ? device.name : undefined;
  return <BottomSheet visible={!openingDesktop} title={title} subtitle={subtitle} onClose={onClose}
    onDismiss={openingDesktop ? openDesktop : undefined}
    onBack={showModel && !switchingModel ? () => setPage('actions') : undefined}
    dismissible={!showModel || !switchingModel}
    fullWidthContent tall={showModel} maxWidth={showModel ? undefined : SHEET_READABLE_WIDTH}
    actions={confirmScreen ? [{ label: t('client.deviceScreen.turnOff'), tone: 'primary',
      disabled: screen.action !== 'off', onPress: () => {
        if (screen.action !== 'off') return;
        onClose(); props.screenControl.change(device, true);
      } }] : []}>
    {showModel ? <RemoteModelSwitchContent {...modelSwitch} device={device}
      accounts={props.accounts} providers={props.providers} switchingProviderId={switchingProviderId} onClose={onClose} />
    : <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.optionsContent}>
      {confirmScreen ? <Text style={styles.screenExplanation}>{t('client.deviceScreen.confirmMessage')}</Text> : <>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !device.online }} disabled={!device.online}
          onPress={Platform.OS === 'ios' ? () => setPage('openingDesktop') : openDesktop}
          style={({ pressed }) => [styles.option, pressed && styles.pressed, !device.online && styles.disabled]}>
          <Ionicons name="desktop-outline" size={21} color={color(deviceColors.green, 'accent')} />
          <Text style={styles.optionLabel}>{t('client.remoteDesktop.remoteDesktop')}</Text>
          <Ionicons name="chevron-forward" size={18} color={color(deviceColors.muted, 'muted')} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: modelDisabled }} disabled={modelDisabled}
          onPress={() => setPage('model')}
          style={({ pressed }) => [styles.option, pressed && styles.pressed, modelDisabled && styles.disabled]}>
          <Ionicons name="swap-horizontal-outline" size={21} color={color(deviceColors.green, 'accent')} />
          <Text style={styles.optionLabel}>{t('client.app.switchModel')}</Text>
          <Ionicons name="chevron-forward" size={18} color={color(deviceColors.muted, 'muted')} />
        </Pressable>
        {supportsScreenControl(device) && <Pressable accessibilityRole="button" disabled={!screen.action}
          accessibilityState={{ disabled: !screen.action }} onPress={runScreenAction}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
          <Ionicons name={screen.action === 'on' ? 'sunny-outline' : 'desktop-outline'} size={21}
            color={color(deviceColors.green, 'accent')} />
          <View style={styles.optionCopy}>
            <Text style={styles.screenActionLabel}>{t(screen.label)}</Text>
            {screen.detail && <Text style={styles.hintText}>{t(screen.detail)}</Text>}
          </View>
        </Pressable>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: authDisabled }} disabled={authDisabled}
          onPress={() => { onClose(); onSelectAuthAccount(device.deviceId); }}
          style={({ pressed }) => [styles.option, pressed && styles.pressed, authDisabled && styles.disabled]}>
          <Ionicons name="open-outline" size={21} color={color(deviceColors.green, 'accent')} />
          <Text style={styles.optionLabel}>{t("client.app.proxySignInAccount")}</Text>
          {switchingAuthDeviceId === device.deviceId && <ActivityIndicator color={color(deviceColors.green, 'accent')} />}
        </Pressable>
        {device.platform.toLowerCase() === 'windows' && <Pressable accessibilityRole="button"
          onPress={() => { onClose(); props.onRevokeService(device); }} style={styles.option}>
          <Ionicons name="lock-closed-outline" size={21} color={color(deviceColors.danger, 'danger')} />
          <Text style={[styles.optionLabel, styles.danger]}>{t("client.mobile.revokeUnattendedAccess")}</Text>
        </Pressable>}
        <Pressable accessibilityRole="button"
          accessibilityState={{ disabled: deleteDisabled }} disabled={deleteDisabled}
          onPress={() => { onClose(); onDelete(device); }}
          style={({ pressed }) => [styles.option, pressed && styles.pressed, deleteDisabled && styles.disabled]}>
          <Ionicons name="trash-outline" size={21} color={color(deviceColors.danger, 'danger')} />
          <Text style={[styles.optionLabel, styles.danger]}>{device.online ? t("client.app.cannotRemoveWhileOnline") : t("client.app.removeDevice")}</Text>
          {deletingDeviceId === device.deviceId && <ActivityIndicator color={color(deviceColors.danger, 'danger')} />}
        </Pressable>
        {!device.online && <Text style={styles.hintText}>{t("client.mobile.connectTheDeviceToChangeItsProxySignInAccount")}</Text>}
        </>}
    </SheetScrollView>}
  </BottomSheet>;
}
