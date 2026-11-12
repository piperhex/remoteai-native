import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { useBookmarks } from '../../vendor/shared/browser/bookmarks/context';
import { bookmarkUrl } from '../../vendor/shared/browser/bookmarks/model';
import { bookmarkStatusKeys } from '../../vendor/shared/browser/bookmarks/status';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { t, useLanguage } from '../i18n';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { useThemeColor } from '../theme/store';
import { useBookmarkStyles } from './bookmarkStyles';

export function BrowserBookmarks({ currentUrl, currentTitle, visit, close }: {
  currentUrl: string; currentTitle: string; visit: (url: string) => void; close: () => void;
}) {
  const text = marketText(useLanguage());
  const { entries, status, store } = useBookmarks();
  const styles = useBookmarkStyles();
  const color = useThemeColor();
  const [folder, setFolder] = useState('');
  const [query, setQuery] = useState('');
  const [invalid, setInvalid] = useState(false);
  const address = bookmarkUrl(currentUrl);
  const saved = entries.some(entry => entry.kind === 'link' && entry.url === address);
  const parent = entries.find(entry => entry.id === folder && entry.kind === 'folder');
  const shown = entries.filter(entry => query.trim()
    ? `${entry.title} ${entry.url}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    : entry.parentId === (parent?.id ?? ''));
  const addCurrent = () => {
    if (!address || saved) return;
    const title = [...(currentTitle || new URL(address).hostname).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')]
      .slice(0, 200).join('').trim() || new URL(address).hostname;
    setInvalid(!store.save({ id: randomUUID(), kind: 'link', url: address, title,
      parentId: parent?.id ?? '', position: Math.max(-1, ...entries.map(entry => entry.position)) + 1 }));
  };
  return <BottomSheet visible title={parent?.title ?? text('market.bookmarkAll')} onClose={close}
    onBack={parent ? () => setFolder(parent.parentId) : undefined} maxHeight="80%" maxWidth={540}>
    <TextInput style={styles.search} value={query} onChangeText={setQuery} autoCorrect={false}
      placeholderTextColor={color('#718078', 'muted')}
      placeholder={text('market.bookmarkSearch')} accessibilityLabel={text('market.bookmarkSearch')} />
    {address && <Pressable accessibilityRole="button" disabled={saved} onPress={addCurrent}
      accessibilityState={{ disabled: saved, selected: saved }} style={styles.add}>
      <Ionicons name={saved ? 'star' : 'star-outline'} size={20} color={color('#0b8065', 'accent')} />
      <Text style={styles.label}>{text('market.bookmarkAdd')}</Text>
    </Pressable>}
    <SheetScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list}>
      {!shown.length && <Text style={styles.status}>{t('client.mobile.noData')}</Text>}
      {shown.map(entry => <Pressable key={entry.id} accessibilityRole="button" style={styles.row}
        onPress={() => entry.kind === 'folder' ? (setFolder(entry.id), setQuery('')) : visit(entry.url)}>
        <Ionicons name={entry.kind === 'folder' ? 'folder-outline' : 'globe-outline'} size={22}
          color={color('#0b8065', 'accent')} />
        <View style={styles.details}><Text style={styles.label} numberOfLines={2}>{entry.title}</Text>
          {entry.kind === 'link' && <Text style={styles.url} numberOfLines={1}>{entry.url}</Text>}</View>
        <Ionicons name="chevron-forward" size={18} color={color('#718078', 'muted')} />
      </Pressable>)}
    </SheetScrollView>
    <Text style={styles.status} accessibilityLiveRegion="polite">{text(bookmarkStatusKeys[status])}</Text>
    {invalid && <Text style={styles.status} accessibilityRole="alert">{text('market.bookmarkInvalid')}</Text>}
    {(status === 'offline' || status === 'storage-error') && <Pressable accessibilityRole="button"
      style={styles.add} onPress={store.refresh}><Text style={styles.label}>{text('market.retry')}</Text></Pressable>}
  </BottomSheet>;
}
