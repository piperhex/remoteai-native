import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useCliGui } from '../../../vendor/shared/cli-gui/context';
import { cliPickerModels } from '../../../vendor/shared/cli-gui/modelSelection';
import { modelSelectionError } from '../../../vendor/shared/conversation/modelSelection';
import { t, useLanguage } from '../../i18n';
import type { ChatController } from '../controller';
import type { ChatConnectionProps } from '../ChatProfileMenu';
import { CliMessageInput } from './CliMessageInput';
import { ComposerActionButton } from '../ComposerActionButton';
import { ComposerModelButton } from '../ComposerModelButton';
import { ComposerDictation } from '../dictation/ComposerDictation';
import { ComposerProjectFiles } from '../ComposerProjectFiles';
import { useStyles } from '../styles';
import { CliEnginePicker } from './CliEnginePicker';
import { CliProject } from './CliProject';
import { CliSettings } from './CliSettings';
import { useCliStyles } from './styles';

export function CliComposer({ host, connection, active, ready }: {
  host: ChatController; connection: ChatConnectionProps; active: boolean; ready: boolean;
}) {
  const { state, controller } = useCliGui()!;
  const styles = useStyles();
  const cliStyles = useCliStyles();
  const [settings, setSettings] = useState(false);
  const [files, setFiles] = useState(false);
  const [dictating, setDictating] = useState(false);
  const models = useMemo(() => cliPickerModels(state.catalog?.models ?? []), [state.catalog]);
  const scope = `${state.engine}:${state.selected?.id ?? 'draft'}`;
  useEffect(() => { setSettings(false); setFiles(false); }, [scope, active]);
  useLanguage();
  if (state.engine === 'codex') return null;
  const { engine, selected, busy } = state;
  const running = selected?.status === 'running';
  const disabled = !active || !ready || busy || dictating || Boolean(selected?.archived);
  const canSend = !disabled && !running && !selected?.permissions.length && state.catalog?.status === 'ready'
    && state.runtime[engine]?.status === 'ready' && !modelSelectionError(models, state) && Boolean(state.draft.trim());
  const cwd = selected?.cwd ?? state.cwd;
  const submit = () => { void (running && selected
    ? controller.act({ engine, action: 'stop', id: selected.id }) : controller.send()); };
  return <View style={styles.composerDock}>
    <CliProject host={host} active={active} ready={ready} />
    <View style={styles.composer}>
      <View style={styles.composerField}>
        <CliMessageInput key={scope} accessibilityLabel={t('client.cliGui.message')}
          compact={false} multiline value={state.draft}
          maxLength={100_000} editable={!busy && !selected?.archived} onChangeText={controller.edit}
          placeholder={t(ready ? 'client.cliGui.messageHint' : 'client.chat.connectToSendAMessage')} />
        <View style={styles.composerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('client.chat.addContent')}
            style={styles.composerAdd} disabled={disabled} onPress={() => setFiles(true)}>
            <Feather name="plus" size={21} color={cliStyles.body.color} />
          </Pressable>
          <View style={styles.composerTrailing}>
            <ComposerModelButton models={models} selection={{ model: state.model, effort: state.effort, access: 'read-only' }}
              compact={false} onPress={() => setSettings(true)} />
            <ComposerDictation client={host.dictation} active={active && ready && !settings}
              disabled={disabled} visible={!state.draft && !running} onBusyChange={setDictating}
              onText={text => controller.edit(controller.getSnapshot().draft + text)}>
              <ComposerActionButton action={running ? 'pause' : 'send'} busy={busy}
                disabled={running ? disabled : !canSend} onPress={submit} />
            </ComposerDictation>
          </View>
        </View>
      </View>
    </View>
    {selected?.archived && <View style={cliStyles.footer}>
      <Text style={cliStyles.hint}>{t('client.chat.archived')}</Text></View>}
    <CliEnginePicker active={active} ready={ready} />
    {settings && active && <CliSettings connection={connection} ready={ready} active={active}
      close={() => setSettings(false)} />}
    {files && active && <ComposerProjectFiles imagesOnly={false} threadId={selected?.id ?? null} cwd={cwd}
      load={host.loadProjectFiles} close={() => setFiles(false)} choose={file => {
        controller.edit(`${controller.getSnapshot().draft}\n${file.path}`.trim()); setFiles(false);
      }} />}
  </View>;
}
