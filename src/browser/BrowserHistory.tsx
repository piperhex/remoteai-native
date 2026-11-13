import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { useBrowserData } from '../../vendor/shared/browser/data/context';
import { historyGroups, type Visit } from '../../vendor/shared/browser/data/model';
import { dataStatusKeys } from '../../vendor/shared/browser/data/presentation';
import type { DataControls } from '../../vendor/shared/browser/data/clear';
import { useDataStyles } from './dataStyles';
import { BrowserClearData } from './BrowserClearData';

export function BrowserHistory({ visit, close, controls }: {
  visit: (url: string) => void; close: () => void; controls: DataControls;
}) {
  const language = useLanguage(), text = marketText(language), styles = useDataStyles(), color = useThemeColor();
  const data = useBrowserData(), [query, setQuery] = useState(''), [clearing, setClearing] = useState(false);
  const [error, setError] = useState(false);
  const groups = historyGroups(data.entries.filter((entry): entry is Visit => entry.kind === 'visit'), query);
  return <BottomSheet visible fullscreen title={text('market.browserHistory')} onClose={close}
    overlay={clearing ? <BrowserClearData controls={controls} close={() => setClearing(false)} /> : undefined}>
    <TextInput value={query} onChangeText={setQuery} style={styles.input} autoCorrect={false}
      placeholder={text('market.browserHistorySearch')} accessibilityLabel={text('market.browserHistorySearch')}
      placeholderTextColor={color('#718078', 'muted')} />
    <Pressable accessibilityRole="button" style={styles.action} onPress={() => setClearing(true)}>
      <Text style={styles.link}>{text('market.browserDataClear')}</Text></Pressable>
    <Text style={styles.status} accessibilityLiveRegion="polite">{text(dataStatusKeys[data.status])}</Text>
    {error && <Text style={styles.error} accessibilityRole="alert">{text('market.browserDataStorage')}</Text>}
    <SheetScrollView keyboardShouldPersistTaps="handled">
      {!groups.length && <Text style={styles.secondary}>{text('market.browserHistoryEmpty')}</Text>}
      {groups.map(([date, entries]) => <View key={date}>
        <Text style={styles.day}>{new Date(date).toLocaleDateString(language, { dateStyle: 'full' })}</Text>
        {entries.map(entry => <View key={entry.id} style={styles.row}>
          <Ionicons name="globe-outline" size={24} color={color('#0b8065', 'accent')} />
          <Pressable accessibilityRole="button" style={styles.details} onPress={() => visit(entry.url)}>
            <Text style={styles.title} numberOfLines={2}>{entry.title || new URL(entry.url).hostname}</Text>
            <Text style={styles.secondary} numberOfLines={1}>{new URL(entry.url).host}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.icon}
            accessibilityLabel={text('market.browserHistoryRemove')} onPress={() => {
              try { data.store.remove([entry.id]); setError(false); } catch { setError(true); }
            }}><Ionicons name="close-circle" size={23} color={color('#718078', 'muted')} /></Pressable>
        </View>)}
      </View>)}
    </SheetScrollView>
  </BottomSheet>;
}
