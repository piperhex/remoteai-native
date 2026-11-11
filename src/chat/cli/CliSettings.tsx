import { Pressable, Text, View } from 'react-native';
import { useCliGui } from '../../../vendor/shared/cli-gui/context';
import { cliModeLabel } from '../../../vendor/shared/cli-gui/modeLabels';
import { cliPickerModels } from '../../../vendor/shared/cli-gui/modelSelection';
import { resolveModelSelection } from '../../../vendor/shared/conversation/modelSelection';
import { BottomSheet } from '../../components/BottomSheet';
import { SheetScrollView } from '../../components/SheetScrollView';
import { t, useLanguage } from '../../i18n';
import { ChatProfileMenu, type ChatConnectionProps } from '../ChatProfileMenu';
import { ModelRefreshButton } from '../ModelRefreshButton';
import { useStyles } from '../styles';
import { useCliStyles } from './styles';
import { engineNames } from './engine';
import { CHAT_SETTINGS_SHEET_LAYOUT } from '../../../vendor/shared/remote-chat/settingsPresentation';

function Choices({ label, value, options, disabled, choose }: {
  label: string; value: string; options: { id: string; label: string }[]; disabled: boolean;
  choose: (value: string) => void;
}) {
  const styles = useCliStyles();
  const common = useStyles();
  return <View style={styles.field}>
    <Text style={styles.title}>{label}</Text>
    {options.map(option => <Pressable key={option.id} accessibilityRole="radio"
      accessibilityLabel={option.label} accessibilityState={{ checked: value === option.id, disabled }}
      disabled={disabled} style={[styles.option, value === option.id && styles.selected, disabled && common.disabled]}
      onPress={() => choose(option.id)}>
      <Text style={styles.body}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

export function CliSettings({ connection, ready, active, close }: {
  connection: ChatConnectionProps; ready: boolean; active: boolean; close: () => void;
}) {
  useLanguage();
  const { state, controller } = useCliGui()!;
  const styles = useCliStyles();
  const { engine, catalog, selected, busy } = state;
  if (engine === 'codex') return null;
  const disabled = !ready || busy || selected?.status === 'running' || Boolean(selected?.archived);
  const model = catalog?.models.find(entry => entry.id === state.model);
  return <BottomSheet visible title={t('client.chat.chatSettings.1e06eb')} onClose={close}
    maxHeight={`${CHAT_SETTINGS_SHEET_LAYOUT.maxHeightPercent}%`}
    titleAction={<ModelRefreshButton ready={ready && !busy}
      refreshModels={async () => { await controller.refresh(); await controller.loadCatalog(); }} />}>
    <SheetScrollView contentContainerStyle={styles.content}>
      <ChatProfileMenu {...connection} variant="settings" ready={ready} active={active} />
      <Choices label={t('client.shared.model')} value={state.model} options={catalog?.models ?? []}
        disabled={disabled} choose={value => controller.patch(resolveModelSelection(
          cliPickerModels(catalog?.models ?? []), { model: value, effort: '' }))} />
      {!!model?.efforts?.length && <Choices label={t('client.shared.reasoningEffort')} value={state.effort}
        options={model.efforts} disabled={disabled} choose={effort => controller.patch({ effort })} />}
      {!!catalog?.modes.length && <Choices label={t('client.cliGui.mode')} value={state.mode}
        options={catalog.modes.map(mode => ({ id: mode.id, label: cliModeLabel(engine, mode) }))}
        disabled={disabled || Boolean(selected)} choose={mode => controller.patch({ mode })} />}
      <View style={styles.field}>
        <Text style={styles.hint}>{t(engineNames[engine])} · {state.runtime[engine]?.cliVersion
          || t('client.cliGui.versionUnknown')}</Text>
        <Pressable accessibilityRole="button" disabled={disabled || Boolean(selected?.permissions.length)}
          style={styles.option} onPress={() => { close(); void controller.install(); }}>
          <Text style={styles.body}>{t('client.cliGui.update')}</Text>
        </Pressable>
      </View>
    </SheetScrollView>
  </BottomSheet>;
}
