import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchEngines } from '../../vendor/shared/browser/searchEngine';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { useNativeSearchEngine } from './searchEngine';
import { useBrowserListStyles } from './browserListStyles';

export function BrowserSearchEngines({ close }: { close: () => void }) {
  const text = marketText(useLanguage());
  const search = useNativeSearchEngine();
  const styles = useBrowserListStyles();
  const color = useThemeColor();
  return <BottomSheet visible title={text('market.browserSearchEngine')} onClose={close} maxWidth={400}>
    <SheetScrollView contentContainerStyle={styles.list}>
      {searchEngines.map(engine => <Pressable key={engine.id} accessibilityRole="radio"
        accessibilityLabel={text(engine.label)}
        accessibilityState={{ checked: search.engine === engine.id }}
        style={styles.row} onPress={() => search.select(engine.id)}>
        <Text style={[styles.title, styles.details]}>{text(engine.label)}</Text>
        <Ionicons name={search.engine === engine.id ? 'radio-button-on' : 'radio-button-off'}
          size={22} color={color('#0b8065', 'accent')} />
      </Pressable>)}
    </SheetScrollView>
    {search.saveError && <View><Text accessibilityRole="alert" style={styles.error}>
      {text('market.browserSearchSaveFailed')}</Text></View>}
  </BottomSheet>;
}
