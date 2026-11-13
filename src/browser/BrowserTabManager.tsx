import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import type { NativeBrowserTab } from './browserTabs';
import { useBrowserBack } from './useBrowserNavigationGestures';
import { BrowserTabPreview } from './BrowserTabPreview';
import { useBrowserSafeAreaEdges } from './context';
import { SwipeableBrowserTab } from './SwipeableBrowserTab';

export function BrowserTabManager({ tabs, activeId, select, remove, add, close }: {
  tabs: NativeBrowserTab[]; activeId: string; select: (id: string) => void; remove: (id: string) => void;
  add: () => void; close: () => void;
}) {
  const [query, setQuery] = useState('');
  const styles = useTabStyles();
  const safeAreaEdges = useBrowserSafeAreaEdges();
  const color = useThemeColor();
  const text = marketText(useLanguage());
  const { width } = useWindowDimensions();
  useBrowserBack(true, close);
  const filtered = tabs.filter(tab => `${tab.title} ${tab.url}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <SafeAreaView style={styles.page} edges={safeAreaEdges}>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={text('market.browserReturnToPage')}
        style={styles.icon} onPress={close}><Ionicons name="chevron-back" size={24} color={color('#17211b', 'ink')} />
      </Pressable>
      <Text style={styles.heading}>{text('market.browserTabs')} ({tabs.length})</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={text('market.browserNewTab')}
        style={styles.icon} onPress={add}><Ionicons name="add" size={26} color={color('#0b8065', 'accent')} />
      </Pressable>
    </View>
    <TextInput style={styles.search} value={query} onChangeText={setQuery} autoCorrect={false}
      accessibilityLabel={text('market.browserSearchTabs')} placeholder={text('market.browserSearchTabs')}
      placeholderTextColor={color('#718078', 'muted')} />
    <ScrollView contentContainerStyle={styles.grid} keyboardShouldPersistTaps="handled">
      {filtered.map(tab => {
        const title = tab.title || tab.url || text('market.browserNewTab');
        return <SwipeableBrowserTab key={tab.id} width={(width - 44) / 2} close={() => remove(tab.id)}
          select={() => select(tab.id)}
          style={[styles.card, { width: (width - 44) / 2 },
          activeId === tab.id && styles.selected]}>
          {selectTab => <>
          <View style={styles.cardHeader}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={text('market.browserCloseTab', { name: title })}
              style={styles.icon} onPress={() => remove(tab.id)}>
              <Ionicons name="close" size={20} color={color('#17211b', 'ink')} />
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={title}
            accessibilityState={{ selected: activeId === tab.id }} style={styles.preview} onPress={selectTab}>
            {tab.preview ? <BrowserTabPreview uri={tab.preview} />
              : <Ionicons name="globe-outline" size={38} color={color('#718078', 'muted')} />}
          </Pressable>
          <Text style={styles.url} numberOfLines={1}>{tab.url || text('market.browserNewTab')}</Text>
          </>}
        </SwipeableBrowserTab>;
      })}
      {!filtered.length && <Text style={styles.empty}>{text('market.browserNoMatchingTabs')}</Text>}
    </ScrollView>
  </SafeAreaView>;
}

const useTabStyles = createThemedStyles(color => ({
  page: { flex: 1, backgroundColor: color('#f7faf7', 'canvas') },
  toolbar: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 },
  icon: { minWidth: 40, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { ...textMetrics(17, 24), flex: 1, fontWeight: '600', color: color('#17211b', 'ink') },
  search: { ...textMetrics(14, 22), marginHorizontal: 16, marginBottom: 16, minHeight: 48,
    paddingHorizontal: 16, borderRadius: 24, color: color('#17211b', 'ink'),
    backgroundColor: color('#ffffff', 'surface'), borderWidth: 1, borderColor: color('#dfe5df', 'border') },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16, paddingBottom: 24 },
  card: { flexGrow: 0, borderRadius: 16, borderWidth: 2, overflow: 'hidden',
    borderColor: color('#dfe5df', 'border'), backgroundColor: color('#ffffff', 'surface') },
  selected: { borderColor: color('#0b8065', 'accent') },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10 },
  title: { ...textMetrics(13, 20), flex: 1, fontWeight: '600', color: color('#17211b', 'ink') },
  preview: { aspectRatio: 0.85, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    backgroundColor: color('#f1f5f2', 'canvas') },
  url: { ...textMetrics(11, 18), paddingHorizontal: 10, paddingVertical: 7, color: color('#718078', 'muted') },
  empty: { ...textMetrics(14, 22), textAlign: 'center', width: '100%', padding: 24,
    color: color('#718078', 'muted') },
}));
