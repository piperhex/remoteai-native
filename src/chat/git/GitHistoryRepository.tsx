import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RemoteGit } from '../../../vendor/shared/remote-chat/useRemoteGit';
import type { GitRepositoryEntry } from '../../../vendor/shared/remote-chat/gitTypes';
import { t, useLanguage } from '../../i18n';
import { createThemedStyles } from '../../theme/styles';
import { textMetrics } from '../../theme/text';
import { GitActionDialog, useGitActionStyles } from './GitActionDialog';

const name = (entry: GitRepositoryEntry) =>
  entry.path || entry.root.split(/[\\/]/).filter(Boolean).at(-1) || entry.root;

export function GitHistoryRepository({ panel, connected, open }: {
  panel: RemoteGit; connected: boolean; open?: () => void;
}) {
  useLanguage();
  const styles = useStyles();
  const entries = panel.repository?.repositories ?? [];
  if (entries.length < 2) return null;
  const selected = entries.find(entry => entry.root === panel.historyRepository) ?? entries[0];
  const disabled = !connected || panel.busy;
  return <View style={styles.row}>
    <Text style={styles.label}>{t('client.git.gitRepository')}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={t('client.git.gitRepository')}
      accessibilityValue={{ text: name(selected) }} accessibilityState={{ disabled }} disabled={disabled}
      style={[styles.picker, disabled && styles.disabled]} onPress={open}>
      <Text numberOfLines={1} style={styles.value}>{name(selected)}</Text>
      <Ionicons name="chevron-down" size={14} color={styles.label.color} />
    </Pressable>
  </View>;
}

export function GitRepositoryMenu({ panel, connected, close }: {
  panel: RemoteGit; connected: boolean; close: () => void;
}) {
  useLanguage();
  const styles = useGitActionStyles();
  return <GitActionDialog title={t('client.git.gitRepository')} close={close}>
    {panel.repository?.repositories?.map(entry => {
      const selected = entry.root === panel.historyRepository;
      const disabled = !entry.available || !connected || panel.busy;
      return <Pressable key={entry.root} accessibilityRole="menuitem" accessibilityLabel={name(entry)}
        accessibilityState={{ selected, disabled }} disabled={disabled}
        style={[styles.item, selected && styles.selected, disabled && styles.disabled]}
        onPress={() => { close(); void panel.selectHistoryRepository(entry.root); }}>
        <Text style={styles.label}>{name(entry)}</Text>
      </Pressable>;
    })}
  </GitActionDialog>;
}

const useStyles = createThemedStyles(color => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginVertical: 8 },
  label: { ...textMetrics(12, 18), color: color('#718078', 'muted') },
  value: { ...textMetrics(13, 20), flex: 1, color: color('#17211b', 'ink') },
  picker: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: color('#dfe5df', 'border'), borderRadius: 6, paddingHorizontal: 10 },
  disabled: { opacity: .45 },
}));
