import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { useBrowserData } from '../../vendor/shared/browser/data/context';
import { rangeStart, timeRanges, type TimeRange } from '../../vendor/shared/browser/data/model';
import { categoryKeys, categoryHints, rangeKeys, type DataCategory } from '../../vendor/shared/browser/data/presentation';
import { clearBrowserData, type DataControls } from '../../vendor/shared/browser/data/clear';
import { useDataStyles } from './dataStyles';
const icons = { history: 'time-outline', cookies: 'globe-outline', cache: 'images-outline',
  tabs: 'browsers-outline', passwords: 'key-outline' } as const;

export function BrowserClearData({ controls, close }: { controls: DataControls; close: () => void }) {
  const text = marketText(useLanguage()), styles = useDataStyles(), color = useThemeColor();
  const { store, vault, entries, passwords } = useBrowserData();
  const [range, setRange] = useState<TimeRange>('hour'), [choosing, setChoosing] = useState(false);
  const [selected, setSelected] = useState<DataCategory[]>(controls.clearSiteData ? ['history', 'cookies', 'cache'] : ['history']);
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<'done' | 'failed'>();
  const since = rangeStart(range), counts = {
    history: entries.filter(entry => entry.kind === 'visit' && entry.at >= since).length,
    passwords: entries.filter(entry => entry.kind === 'password' && entry.at >= since).length,
    tabs: controls.tabs.filter(tab => tab.at >= since).length,
  };
  const remove = async () => {
    if (busy) return;
    setBusy(true); setResult(undefined);
    try { await clearBrowserData({ store, vault, controls, categories: selected, range }); setResult('done'); }
    catch { setResult('failed'); }
    finally { setBusy(false); setConfirm(false); }
  };
  return <BottomSheet visible fullscreen title={text('market.browserDataClear')} onClose={close} onBack={close}
    dismissible={!busy} actions={[{ label: text('market.browserDataDelete'), tone: 'primary',
      disabled: !selected.length, loading: busy, onPress: () => setConfirm(true) }]}
    overlay={confirm ? <BottomSheet visible title={text('market.browserDataClear')} maxWidth={400}
      onClose={() => setConfirm(false)} dismissible={!busy} actions={[
        { label: text('market.cancel'), onPress: () => setConfirm(false), disabled: busy },
        { label: text('market.browserDataDelete'), tone: 'danger', onPress: remove, loading: busy },
      ]}><Text style={styles.title}>{text('market.browserDataConfirm')}</Text></BottomSheet> : undefined}>
    <Pressable accessibilityRole="button" style={styles.row} disabled={busy}
      onPress={() => setChoosing(!choosing)} accessibilityLabel={text('market.browserDataRange')}>
      <Text style={[styles.title, styles.details]}>{text('market.browserDataRange')}</Text>
      <Text style={styles.title}>{text(rangeKeys[range])}</Text>
      <Ionicons name="chevron-down" size={20} color={color('#718078', 'muted')} />
    </Pressable>
    <SheetScrollView>
      {choosing && timeRanges.map(value => <Pressable key={value} style={styles.action}
        accessibilityRole="radio" accessibilityState={{ checked: value === range }}
        onPress={() => { setRange(value); setChoosing(false); }}><Text style={styles.link}>{text(rangeKeys[value])}</Text>
      </Pressable>)}
      {(Object.keys(categoryKeys) as DataCategory[]).map(category => {
        const disabled = busy || (category === 'cookies' || category === 'cache') && !controls.clearSiteData
          || category === 'passwords' && !passwords.unlocked;
        return <Pressable key={category} accessibilityRole="checkbox" disabled={disabled}
          accessibilityState={{ checked: selected.includes(category), disabled }}
          style={[styles.choice, disabled && styles.disabled]} onPress={() => setSelected(current =>
            current.includes(category) ? current.filter(value => value !== category) : [...current, category])}>
          <Ionicons name={icons[category]} size={25} color={color('#17211b', 'ink')} />
          <View style={styles.details}><Text style={styles.title}>{text(categoryKeys[category])}</Text>
            {category in counts && <Text style={styles.secondary}>
              {text('market.browserDataCount', { count: counts[category as keyof typeof counts] })}</Text>}
            {categoryHints[category] && <Text style={styles.secondary}>{text(categoryHints[category]!)}</Text>}
            {category === 'passwords' && !passwords.unlocked && <Text style={styles.secondary}>
              {text('market.browserVaultUnlock')}</Text>}
          </View>
          <Ionicons name={selected.includes(category) ? 'checkbox' : 'square-outline'} size={24}
            color={color('#0b8065', 'accent')} />
        </Pressable>;
      })}
    </SheetScrollView>
    {result && <Text style={result === 'failed' ? styles.error : styles.status} accessibilityLiveRegion="polite">
      {text(result === 'failed' ? 'market.browserDataFailed' : 'market.browserDataDeleted')}</Text>}
  </BottomSheet>;
}
