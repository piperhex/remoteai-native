import { createThemedStyles } from '../theme/styles';
import { t, useLanguage } from '../i18n';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { HtmlPreviewDocument } from './html/HtmlPreviewDocument';
import type { HtmlFileContext } from './html/HtmlPreparation';
import { SheetScrollView } from '../components/SheetScrollView';
import { ChatCodeBlock } from './ChatCodeBlock';
import { textMetrics } from '../theme/text';

const PREVIEW_MODES = [{ value: 'preview', get label() { return t("client.chat.preview"); } }, { value: 'source', get label() { return t("client.downloads.source"); } }] as const;

export function isHtmlPath(path: string) {
  return /\.html?$/i.test(path);
}

export function ChatHtmlPreview({ text, context, source: controlledSource }: {
  text: string; context?: HtmlFileContext; source?: boolean;
}) {
  const styles = useStyles();
  useLanguage();
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const source = controlledSource ?? mode === 'source';
  const [failed, setFailed] = useState(false);
  return <View style={styles.container}>
    {controlledSource === undefined && <View style={styles.tabs} accessibilityRole="tablist">
      {PREVIEW_MODES.map(item => <Pressable key={item.value} accessibilityRole="tab"
        accessibilityState={{ selected: mode === item.value }} onPress={() => setMode(item.value)}
        style={[styles.tab, mode === item.value && styles.selectedTab]}>
        <Text style={styles.tabText}>{item.label}</Text>
      </Pressable>)}
    </View>}
    {source && <SheetScrollView style={styles.content}>
      <ChatCodeBlock text={text} label={t("client.mobile.fullText")} language="html" lineNumbers copyLabel={t("client.chat.copyFileContents")} />
    </SheetScrollView>}
    {!source && failed && <View style={styles.notice}>
      <Text accessibilityRole="alert" style={styles.message}>{t("client.mobile.pageUnavailableTryAgainOrViewTheSource")}</Text>
      <Pressable accessibilityRole="button" onPress={() => setFailed(false)} style={styles.tab}>
        <Text style={styles.tabText}>{t("client.mobile.retryPreview")}</Text>
      </Pressable>
    </View>}
    {!source && !failed && <HtmlPreviewDocument text={text} context={context}
      onError={() => setFailed(true)} />}
  </View>;
}

const useStyles = createThemedStyles((color) => ({
  container: { flex: 1, minHeight: 0 },
  content: { flex: 1, backgroundColor: color('#fff', 'surface') },
  tabs: { flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingBottom: 4 },
  tab: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10 },
  selectedTab: { backgroundColor: color('#e3f3ed', 'canvas') },
  tabText: { ...textMetrics(14, 21), color: color('#0b8065', 'accent'), fontWeight: '700' },
  notice: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  message: { ...textMetrics(14, 21), maxWidth: 400, color: color('#708078', 'muted'), textAlign: 'center' },
}));
