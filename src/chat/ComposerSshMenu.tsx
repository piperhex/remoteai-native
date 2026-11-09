import Feather from '@expo/vector-icons/Feather';
import { FlatList, Pressable, Text, View } from 'react-native';
import { displayError, t, useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { textMetrics } from '../theme/text';
import { useSshCandidates, type ComposerSshProfiles } from '../../vendor/shared/chat/useSshCandidates';
import { sshCandidates, sshReference } from '../../vendor/shared/conversation/sshReferences';
import type { AttachmentReference } from '../../vendor/shared/conversation/attachmentTypes';
import { sshLabel } from '../../vendor/shared/terminal/sshProfiles';

export function ComposerSshMenu(props: {
  query: string; ready: boolean; profiles?: ComposerSshProfiles;
  choose: (reference: AttachmentReference) => void; close: () => void;
}) {
  useLanguage();
  const styles = useStyles();
  const color = useThemeColor();
  const { query, ready, profiles, choose, close } = props;
  const result = useSshCandidates({ active: true, connected: ready, profiles });
  const entries = ready ? sshCandidates(result.items, query) : [];
  return <View accessibilityLabel={t('client.ssh.savedConnections')} style={styles.root}>
    <View style={styles.heading}>
      <Text style={styles.detail}>{t('client.ssh.savedConnections')}</Text>
      <Pressable accessibilityRole="button"
        accessibilityLabel={t('client.mobile.close', { value1: t('client.ssh.savedConnections') })}
        onPress={close} hitSlop={8}>
        <Feather name="x" size={18} color={color('#777', 'muted')} />
      </Pressable>
    </View>
    <FlatList data={entries} keyExtractor={profile => profile.id} style={styles.list}
      keyboardShouldPersistTaps="always" nestedScrollEnabled
      renderItem={({ item }) => <Pressable accessibilityRole="menuitem" disabled={!ready}
        onPress={() => choose(sshReference(item))}
        style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
        <Feather name="terminal" size={18} color={color('#777', 'muted')} />
        <View style={styles.text}>
          <Text style={styles.title}>{sshReference(item).name}</Text>
          <Text style={styles.detail}>{sshLabel(item)}</Text>
        </View>
      </Pressable>}
      ListFooterComponent={<>
        {!ready && <Text style={styles.message}>{t('client.chat.connectToSendAMessage')}</Text>}
        {ready && result.loading && <Text style={styles.message}>{t('client.mobile.loading')}</Text>}
        {ready && !!result.error && <Text accessibilityRole="alert" style={styles.message}>
          {displayError(result.error)}</Text>}
        {ready && !result.loading && !result.error && !entries.length && <Text style={styles.message}>
          {t(query ? 'client.ssh.noMatchingConnections' : 'client.ssh.noSavedConnections')}</Text>}
      </>} />
  </View>;
}

const useStyles = createThemedStyles(color => ({
  root: { flexShrink: 1, maxWidth: 400 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  list: { maxHeight: 250, flexGrow: 0 },
  option: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 10, borderRadius: 12 },
  text: { flex: 1, minWidth: 0 },
  title: { ...textMetrics(14, 21), color: color('#161616', 'ink') },
  detail: { ...textMetrics(12, 18), color: color('#777', 'muted') },
  message: { ...textMetrics(12, 18), color: color('#777', 'muted'), margin: 12 },
  pressed: { backgroundColor: color('#f2f2f2', 'elevated') },
}));
