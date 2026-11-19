import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { textMetrics } from '../theme/text';
import { t, useLanguage } from '../i18n';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useState } from 'react';
import { isRemoteAggregateId, remoteModelOptions, type RemoteModelTarget } from '../../vendor/shared/remote-chat/modelTarget';
import type { AccountSummary, RemoteDevice, RemoteProviderSummary } from '../types';
import { SheetScrollView } from '../components/SheetScrollView';

interface ModelOptionProps {
  badge: string;
  title: string;
  subtitle: string;
  current: boolean;
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
}

function ModelOption({
  badge,
  title,
  subtitle,
  current,
  disabled,
  loading,
  onPress,
}: ModelOptionProps) {
  const styles = useStyles();
  const color = useThemeColor();
  useLanguage();
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled, selected: current }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.option,
      current && styles.optionCurrent,
      pressed && styles.optionPressed,
      disabled && !current && styles.optionDisabled,
    ]}
  >
    <View style={[styles.badge, current && styles.badgeCurrent]}>
      <Text style={[styles.badgeText, current && styles.badgeTextCurrent]}>{badge}</Text>
    </View>
    <View style={styles.optionCopy}>
      <Text style={styles.optionTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.optionSubtitle} numberOfLines={1}>{subtitle}</Text>
    </View>
    {loading
      ? <ActivityIndicator color={color("#14806f", 'accent')} size="small" />
      : current
        ? <View style={styles.currentPill}><Text style={styles.currentText}>{t("client.accounts.current")}</Text></View>
        : <Text style={styles.chevron}>›</Text>}
  </Pressable>;
}

export interface RemoteModelSwitchContentProps {
  device: RemoteDevice;
  accounts: AccountSummary[];
  providers: RemoteProviderSummary[];
  switchingAccountId: string | null;
  switchingProviderId: string | null;
  onClose: () => void;
  onSwitchAccount: (deviceId: string, accountId: string, target: RemoteModelTarget) => Promise<boolean>;
  onSwitchProvider: (deviceId: string, providerId: string, target: RemoteModelTarget) => Promise<boolean>;
  onSwitchProviderGroup: (deviceId: string, group: string) => Promise<boolean>;
}

export function RemoteModelSwitchContent({
  device,
  accounts,
  providers,
  switchingAccountId,
  switchingProviderId,
  onClose,
  onSwitchAccount,
  onSwitchProvider,
  onSwitchProviderGroup,
}: RemoteModelSwitchContentProps) {
  const styles = useStyles();
  useLanguage();
  const [target, setTarget] = useState<RemoteModelTarget>('proxy');
  const busy = Boolean(switchingAccountId || switchingProviderId);
  const options = remoteModelOptions(device, target);
  const { supported: providerSupported, providerAvailable, groupSupported } = options;
  const groups = target === 'gui' ? [] : [...new Set(providers.map((provider) => provider.group).filter(Boolean))];

  const selectAccount = async (accountId: string) => {
    if (!device?.online || busy || !options.accountAvailable) return;
    if (await onSwitchAccount(device.deviceId, accountId, target)) onClose();
  };
  const selectProvider = async (providerId: string) => {
    if (!device?.online || busy || !providerAvailable) return;
    if (isRemoteAggregateId(providerId) && !options.aggregateAvailable) return;
    if (await onSwitchProvider(device.deviceId, providerId, target)) onClose();
  };
  const selectProviderGroup = async (group: string) => {
    if (!device?.online || busy || !providerAvailable || !groupSupported) return;
    if (await onSwitchProviderGroup(device.deviceId, group)) onClose();
  };

  return <SheetScrollView style={styles.scroll}>
      <View style={styles.targetRow} accessibilityRole="tablist">
        {(['proxy', 'gui'] as const).map((value) => <Pressable key={value}
          accessibilityRole="tab" accessibilityState={{ selected: target === value, disabled: busy }}
          disabled={busy} onPress={() => setTarget(value)}
          style={[styles.targetButton, target === value && styles.targetSelected]}>
          <Text style={[styles.targetText, target === value && styles.targetTextSelected]}>
            {value === 'gui' ? t("client.app.codexGuiModel") : t("client.app.proxyApiModel")}
          </Text>
        </Pressable>)}
      </View>
      <Text style={styles.description}>{target === 'gui'
        ? t("client.app.changeTheModelSourceUsedByCodexGuiOnly") : t("client.app.changeTheModelSourceUsedByTheProxyApiOnly")}</Text>
      {target === 'gui' && !providerSupported
        ? <Text style={styles.emptyText}>{t("client.app.updateTheDesktopAppToSwitchTheCodexGuiModel")}</Text> : null}
      <Text style={styles.sectionTitle}>{t("client.app.officialModel")}</Text>
      {!accounts.length ? <Text style={styles.emptyText}>{t("client.app.noOfficialAccountsSyncedYet")}</Text> : accounts.map((account) => {
        const current = !options.providerId && !options.group && options.accountId === account.id;
        return <ModelOption
          key={`account:${account.id}`}
          badge="O"
          title={account.email}
          subtitle={t("client.mobile.officialModel", { value1: account.plan || 'ChatGPT' })}
          current={current}
          disabled={busy || !device?.online || !options.accountAvailable || current}
          loading={switchingAccountId === account.id}
          onPress={() => void selectAccount(account.id)}
        />;
      })}

      <View style={styles.providerHeading}>
        <Text style={styles.sectionTitle}>{t("client.app.thirdPartyProvider")}</Text>
        {!providerSupported
          ? <Text style={styles.hint}>{t("client.app.updateTheDesktopAppFirst")}</Text>
          : !providerAvailable
            ? <Text style={styles.hint}>{t("client.app.startTheLocalProxyOnYourComputerFirst")}</Text>
            : null}
      </View>
      {!providers.length ? <Text style={styles.emptyText}>{t("client.app.noThirdPartyProvidersSyncedYet")}</Text> : <>
        {groups.map((group) => {
          const count = providers.filter((provider) => provider.group === group).length;
          const current = device?.activeProviderGroup === group;
          return <ModelOption key={`group:${group}`} badge="G" title={group}
            subtitle={t("client.mobile.enableApisTogether", { value1: count })} current={current}
            disabled={busy || !device?.online || !providerAvailable || !groupSupported || current}
            loading={switchingProviderId === `group:${group}`}
            onPress={() => void selectProviderGroup(group)} />;
        })}
        {providers.map((provider) => {
          const current = options.providerId === provider.id;
          const aggregate = isRemoteAggregateId(provider.id);
          const unsupported = aggregate && !options.aggregateAvailable;
          return <ModelOption
            key={`provider:${provider.id}`}
            badge={aggregate ? "A" : "P"}
            title={provider.name}
            subtitle={unsupported ? t("client.app.updateTheDesktopAppFirst") : provider.model || t("client.app.letCodexChooseTheModel")}
            current={current}
            disabled={busy || !device?.online || !providerAvailable || unsupported || current}
            loading={switchingProviderId === provider.id}
            onPress={() => void selectProvider(provider.id)}
          />;
        })}
      </>}
      <Text style={styles.footerHint}>
        {target === 'gui' ? t("client.app.futureCodexGuiRequestsWillUseTheSelectedSourceNo")
          : t("client.app.restartChatgptCodexAfterSwitchingBetweenOfficialModelsAndThird")}
      </Text>
    </SheetScrollView>;
}

const useStyles = createThemedStyles((color) => ({
  targetRow: { flexDirection: 'row', backgroundColor: color('#eaf2ed', 'elevated'), borderRadius: 12, padding: 4, gap: 4 },
  targetButton: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 9 },
  targetSelected: { backgroundColor: color('#fff', 'surface') },
  targetText: { ...textMetrics(12, 18), fontWeight: '700', color: color('#7c8c83', 'muted'), textAlign: 'center' },
  targetTextSelected: { color: color('#0b6e59', 'accent') },
  description: { ...textMetrics(11, 17), color: color('#7c8c83', 'muted'), marginVertical: 12, maxWidth: 400 },
  scroll: { maxHeight: 610 },
  sectionTitle: { ...textMetrics(12, 18), color: color('#52675c', 'ink'), fontWeight: '800', marginBottom: 9 },
  providerHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  hint: { ...textMetrics(10, 16), color: color('#b06b28', 'warning'), marginBottom: 9, maxWidth: 190, textAlign: 'right' },
  emptyText: { ...textMetrics(12, 18), color: color('#7c8c83', 'muted'), paddingVertical: 12 },
  option: {
    alignItems: 'center',
    backgroundColor: color('#fff', 'surface'),
    borderColor: color('#dce9e2', 'border'),
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 11,
    marginBottom: 9,
    minHeight: 66,
    padding: 12,
  },
  optionCurrent: { backgroundColor: color('#f0faf6', 'canvas'), borderColor: color('#9bd5c2', 'border') },
  optionPressed: { opacity: 0.82 },
  optionDisabled: { opacity: 0.52 },
  badge: {
    alignItems: 'center',
    backgroundColor: color('#e7f5ef', 'canvas'),
    borderRadius: 11,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  badgeCurrent: { backgroundColor: color('#ccecdf', 'accentSoft') },
  badgeText: { ...textMetrics(14, 20), color: color('#14806f', 'accent'), fontWeight: '900' },
  badgeTextCurrent: { color: color('#0b6e59', 'accent') },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { ...textMetrics(13, 19), color: color('#17352a', 'ink'), fontWeight: '800' },
  optionSubtitle: { ...textMetrics(10, 16), color: color('#7c8c83', 'muted'), marginTop: 5 },
  currentPill: { backgroundColor: color('#dff4eb', 'canvas'), borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  currentText: { ...textMetrics(10, 16), color: color('#0c765f', 'accent'), fontWeight: '800' },
  chevron: { ...textMetrics(24, 30), color: color('#91a198', 'muted') },
  footerHint: { ...textMetrics(11, 17), color: color('#7c8c83', 'muted'), marginTop: 13, maxWidth: 400, alignSelf: 'center' },
}));
