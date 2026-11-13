import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useBookmarks } from '../../vendor/shared/browser/bookmarks/context';
import { useDeviceMappings } from '../../vendor/shared/port-mapping/deviceRegistry';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { useThemeColor } from '../theme/store';
import { runningBrowserMappings, type BrowserDevice } from './browserMappings';
import { MappingAddress } from './BrowserPortMappings';
import { useBrowserListStyles } from './browserListStyles';

export function BrowserHome({ devices, visit, bookmarks }: {
  devices: readonly BrowserDevice[]; visit: (url: string) => void; bookmarks: () => void;
}) {
  const text = marketText(useLanguage());
  const styles = useHomeStyles();
  const list = useBrowserListStyles();
  const color = useThemeColor();
  const links = useBookmarks().entries.filter(entry => entry.kind === 'link');
  const mappings = runningBrowserMappings(useDeviceMappings(), devices);
  return <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.intro}>
      <Ionicons name="home-outline" size={30} color={color('#0b8065', 'accent')} />
      <Text accessibilityRole="header" style={styles.title}>{text('market.browserHome')}</Text>
      <Text style={styles.hint}>{text('market.browserHomeHint')}</Text>
    </View>
    <View style={styles.card}>
      <Pressable accessibilityRole="button" style={styles.heading} onPress={bookmarks}>
        <Ionicons name="star-outline" size={20} color={color('#0b8065', 'accent')} />
        <Text style={styles.section}>{text('market.bookmarkAll')}</Text>
        <Ionicons name="chevron-forward" size={18} color={color('#718078', 'muted')} />
      </Pressable>
      {!links.length && <Text style={styles.hint}>{text('market.browserHomeBookmarksHint')}</Text>}
      {links.map(entry => <Pressable key={entry.id} accessibilityRole="button" style={list.row}
        onPress={() => visit(entry.url)}>
        <Ionicons name="globe-outline" size={21} color={color('#0b8065', 'accent')} />
        <View style={list.details}><Text style={list.title} numberOfLines={2}>{entry.title}</Text>
          <Text style={list.secondary} numberOfLines={1}>{entry.url}</Text></View>
      </Pressable>)}
    </View>
    <View style={styles.card}>
      <View style={styles.heading}>
        <Ionicons name="swap-horizontal-outline" size={20} color={color('#0b8065', 'accent')} />
        <Text accessibilityRole="header" style={styles.section}>{text('market.browserHomeMappings')}</Text>
      </View>
      {!mappings.length && <Text style={styles.hint}>{text('market.browserHomeMappingsHint')}</Text>}
      {mappings.map(mapping => <MappingAddress key={`${mapping.deviceId}:${mapping.entry.id}`}
        mapping={mapping} deviceName={devices.find(device => device.deviceId === mapping.deviceId)?.name} visit={visit} />)}
    </View>
  </ScrollView>;
}

const useHomeStyles = createThemedStyles(color => ({
  content: { padding: 20, gap: 20, flexGrow: 1, backgroundColor: color('#f6f8f7', 'canvas') },
  intro: { gap: 10, paddingVertical: 12 },
  title: { ...textMetrics(22, 30), fontWeight: '600', color: color('#17211b', 'ink') },
  hint: { ...textMetrics(14, 22), color: color('#718078', 'muted') },
  card: { padding: 16, borderRadius: 16, backgroundColor: color('#ffffff', 'surface'),
    borderWidth: 1, borderColor: color('#e7ece8', 'border'), gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  section: { ...textMetrics(15, 23), fontWeight: '600', color: color('#17211b', 'ink'), flex: 1 },
}));
