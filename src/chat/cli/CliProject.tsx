import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useCliGui } from '../../../vendor/shared/cli-gui/context';
import type { ChatController } from '../controller';
import type { ChatProject } from '../types';
import { ChatProjectPicker } from '../ChatProjectPicker';
import { t, useLanguage } from '../../i18n';
import { useCliStyles } from './styles';

export function CliProject({ host, active, ready }: { host: ChatController; active: boolean; ready: boolean }) {
  const { state, controller } = useCliGui()!;
  const styles = useCliStyles();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ChatProject[]>([]);
  const disabled = !active || !ready || state.busy || Boolean(state.selected);
  const cwd = state.selected?.cwd ?? state.cwd;
  useLanguage();
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    void host.guiTools.projects.list().then(value => { if (!disposed) setProjects(value); })
      .catch(error => { if (!disposed) controller.report(error); });
    return () => { disposed = true; };
  }, [open, host, controller]);
  const choose = (project: ChatProject | null) => {
    controller.patch({ cwd: project?.cwd ?? '' }); setOpen(false); void controller.loadCatalog();
  };
  return <View style={styles.footer}>
    <Pressable accessibilityRole="button" accessibilityLabel={t('client.chat.chooseProject')}
      disabled={disabled} style={styles.trigger} onPress={() => setOpen(true)}>
      <Feather name="folder" size={16} color={styles.label.color} />
      <Text numberOfLines={1} style={styles.label}>{cwd || t('client.projectPicker.workWithoutProject')}</Text>
    </Pressable>
    {!!cwd && !disabled && <Pressable accessibilityRole="button"
      accessibilityLabel={t('client.projectPicker.workWithoutProject')} style={styles.trigger} onPress={() => choose(null)}>
      <Feather name="x" size={18} color={styles.label.color} />
    </Pressable>}
    {open && <ChatProjectPicker cwd={cwd} projects={projects} title={t('client.chat.chooseProject')}
      load={host.loadProjectDirectories} mutate={host.guiTools.projectBrowser.mutate}
      choose={choose} close={() => setOpen(false)} />}
  </View>;
}
