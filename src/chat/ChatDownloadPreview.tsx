import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SheetScrollView } from '../components/SheetScrollView';
import { displayError, t } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { useThemeColor } from '../theme/store';
import type { useManagedDownload } from '../downloads/useManagedDownload';
import type { FilePreviewAction } from './FilePreviewSheet';

interface Props {
  path: string; ready: boolean; actions: FilePreviewAction[];
  download: ReturnType<typeof useManagedDownload>;
}

export function ChatDownloadPreview({ path, ready, actions, download }: Props) {
  const styles = useStyles();
  const color = useThemeColor();
  const name = path.split(/[\\/]/).at(-1) || path;
  return <SheetScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.card} testID="browser-download-card">
      <View style={styles.icon}><MaterialCommunityIcons name="file-download-outline" size={36}
        color={color('#0b8065', 'accent')} /></View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.hint}>{t('client.mobile.downloadTheFileToOpenItInACompatibleApp')}</Text>
      {!ready && !download.completed && <Text style={styles.hint}>
        {t('client.mobile.connectToYourComputerToViewTheFile')}</Text>}
      {download.status && <View style={styles.progress} accessible accessibilityRole="progressbar"
        accessibilityLabel={t('client.downloads.downloadProgress')} accessibilityLiveRegion="polite"
        accessibilityValue={{ min: 0, max: 100, now: download.percent, text: download.status }}>
        <View style={styles.progressHeading}><Text style={styles.status}>{download.status}</Text>
          <Text style={styles.percent}>{download.percent === undefined ? '—' : `${download.percent}%`}</Text></View>
        <View style={styles.track}>{download.percent !== undefined
          ? <View style={[styles.fill, { width: `${download.percent}%` }]} />
          : <View style={[styles.fill, styles.indeterminate]} />}</View>
        {!!download.detail && <Text style={styles.detail}>{download.detail}</Text>}
      </View>}
      <View style={styles.actions}>{actions.map(action => <Pressable key={action.label}
        accessibilityRole="button" accessibilityLabel={action.label} disabled={action.disabled || action.loading}
        accessibilityState={{ disabled: Boolean(action.disabled || action.loading), busy: action.loading }}
        onPress={() => void action.onPress()} style={({ pressed }) => [styles.action,
          (pressed || action.disabled || action.loading) && styles.dimmed]}>
        {action.loading ? <ActivityIndicator color={color('#0b8065', 'accent')} />
          : <MaterialCommunityIcons name={action.icon} size={20} color={color('#0b8065', 'accent')} />}
        <Text style={styles.actionLabel}>{action.label}</Text>
      </Pressable>)}</View>
      {!!download.message && <Text accessibilityLiveRegion="polite" style={styles.hint}>
        {displayError(download.message)}</Text>}
    </View>
  </SheetScrollView>;
}

const useStyles = createThemedStyles(color => ({
  page: { flex: 1 },
  content: { paddingVertical: 24, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  card: { width: '100%', maxWidth: 360, padding: 24, gap: 12, alignItems: 'center', borderWidth: 1,
    borderColor: color('#dce8df', 'border'), borderRadius: 18, backgroundColor: color('#ffffff', 'surface') },
  icon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 20,
    backgroundColor: color('#e6f8f1', 'accentSoft') },
  name: { ...textMetrics(16, 24), fontWeight: '600', textAlign: 'center', color: color('#13231c', 'ink') },
  hint: { ...textMetrics(13, 20), textAlign: 'center', color: color('#6f8177', 'muted') },
  progress: { width: '100%', gap: 6 },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  status: { ...textMetrics(13, 20), flexShrink: 1, color: color('#13231c', 'ink') },
  percent: { ...textMetrics(13, 20), fontWeight: '600', fontVariant: ['tabular-nums'], color: color('#13231c', 'ink') },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: color('#dce8df', 'border') },
  fill: { height: '100%', borderRadius: 3, backgroundColor: color('#18af8c', 'accent') },
  indeterminate: { width: '30%', alignSelf: 'center', opacity: 0.5 },
  detail: { ...textMetrics(12, 18), textAlign: 'center', fontVariant: ['tabular-nums'], color: color('#6f8177', 'muted') },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 10, maxWidth: '100%', backgroundColor: color('#e6f8f1', 'accentSoft') },
  actionLabel: { ...textMetrics(14, 22), flexShrink: 1, fontWeight: '600', color: color('#0b8065', 'accent') },
  dimmed: { opacity: 0.55 },
}));
