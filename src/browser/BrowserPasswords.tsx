import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { useBrowserData } from '../../vendor/shared/browser/data/context';
import { loginOrigin, type Login } from '../../vendor/shared/browser/data/model';
import type { SavedLogin } from '../../vendor/shared/browser/data/vault';
import { dataStatusKeys } from '../../vendor/shared/browser/data/presentation';
import { useDataStyles } from './dataStyles';

export function NativeVaultUnlock() {
  const text = marketText(useLanguage()), styles = useDataStyles();
  const { vault, hydrated } = useBrowserData(), creating = !vault.header();
  const [phrase, setPhrase] = useState(''), [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const valid = !!phrase && (!creating || phrase.length >= 12 && phrase === confirm && hydrated);
  const unlock = async () => {
    if (busy || !valid) return;
    setBusy(true); setError(false);
    try { await vault.unlock(phrase); setPhrase(''); setConfirm(''); }
    catch { setError(true); }
    finally { setBusy(false); }
  };
  return <View>
    <Text style={styles.secondary}>{text(creating ? 'market.browserVaultHint' : 'market.browserVaultUnlockHint')}</Text>
    <Text style={styles.title}>{text('market.browserVaultPassphrase')}</Text>
    <TextInput secureTextEntry value={phrase} onChangeText={setPhrase} style={styles.input} autoCapitalize="none"
      autoCorrect={false} maxLength={1024} accessibilityLabel={text('market.browserVaultPassphrase')} />
    {creating && <><Text style={styles.title}>{text('market.browserVaultConfirm')}</Text>
      <TextInput secureTextEntry value={confirm} onChangeText={setConfirm} style={styles.input} autoCapitalize="none"
        autoCorrect={false} maxLength={1024} accessibilityLabel={text('market.browserVaultConfirm')} /></>}
    {creating && !hydrated && <Text style={styles.status}>{text('market.browserVaultSyncRequired')}</Text>}
    {error && <Text style={styles.error} accessibilityRole="alert">{text('market.browserVaultFailed')}</Text>}
    <Pressable accessibilityRole="button" disabled={busy || !valid} style={[styles.action, (busy || !valid) && styles.disabled]}
      onPress={() => void unlock()}><Text style={styles.link}>
      {text(creating ? 'market.browserVaultCreate' : 'market.browserVaultUnlock')}</Text></Pressable>
  </View>;
}

export function BrowserPasswords({ currentUrl, close, fill }: {
  currentUrl: string; close: () => void; fill: (login: Login) => Promise<void>;
}) {
  const text = marketText(useLanguage()), styles = useDataStyles(), { vault, passwords, status } = useBrowserData();
  const color = useThemeColor();
  const [query, setQuery] = useState(''), [editing, setEditing] = useState<Login | SavedLogin>();
  const [removing, setRemoving] = useState<SavedLogin>(), [error, setError] = useState(false);
  useEffect(() => { if (!passwords.unlocked) { setEditing(undefined); setRemoving(undefined); } }, [passwords.unlocked]);
  const shown = passwords.entries.filter(entry => `${entry.origin} ${entry.username}`
    .toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const overlay = editing ? <NativePasswordEditor login={editing} close={() => setEditing(undefined)} />
    : removing ? <BottomSheet visible title={text('market.browserPasswords')} maxWidth={400}
      onClose={() => setRemoving(undefined)} actions={[
        { label: text('market.cancel'), onPress: () => setRemoving(undefined) },
        { label: text('market.bookmarkDelete'), tone: 'danger', onPress: () => {
          try { vault.remove([removing.id]); setRemoving(undefined); } catch { setError(true); }
        } },
      ]}><Text style={styles.title}>{text('market.browserPasswordDeleteConfirm')}</Text></BottomSheet> : undefined;
  return <BottomSheet visible fullscreen title={text('market.browserPasswords')} onClose={close} overlay={overlay}>
    <SheetScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.status}>{text(dataStatusKeys[status])}</Text>
      {!passwords.unlocked ? <NativeVaultUnlock /> : <>
        <TextInput style={styles.input} value={query} onChangeText={value => { setQuery(value); vault.touch(); }}
          placeholder={text('market.browserPasswordSearch')} accessibilityLabel={text('market.browserPasswordSearch')}
          placeholderTextColor={color('#718078', 'muted')} />
        <View style={styles.row}>
          <Pressable accessibilityRole="button" style={[styles.action, styles.details]} onPress={() => setEditing({
            origin: loginOrigin(currentUrl) ?? '', username: '', password: '',
          })}><Text style={styles.link}>{text('market.browserPasswordAdd')}</Text></Pressable>
          <Pressable accessibilityRole="button" style={styles.action} onPress={vault.lock}>
            <Text style={styles.link}>{text('market.browserVaultLock')}</Text></Pressable>
        </View>
        {passwords.error && <Text style={styles.error}>{text('market.browserVaultCorrupt')}</Text>}
        {status === 'conflict' && <NativeVaultConflict />}
        {error && <Text style={styles.error} accessibilityRole="alert">{text('market.browserPasswordFillFailed')}</Text>}
        {!shown.length && <Text style={styles.secondary}>{text('market.browserPasswordEmpty')}</Text>}
        {shown.map(entry => <View key={entry.id} style={{ paddingVertical: 12 }}>
          <Text style={styles.title}>{entry.origin}</Text><Text style={styles.secondary}>{entry.username}</Text>
          <View style={[styles.row, { flexWrap: 'wrap', paddingVertical: 0 }]}>
            {entry.origin === loginOrigin(currentUrl) && <Pressable accessibilityRole="button" style={styles.action}
              onPress={() => { vault.touch(); void fill(entry).then(close).catch(() => setError(true)); }}>
              <Text style={styles.link}>{text('market.browserPasswordFill')}</Text></Pressable>}
            <Pressable accessibilityRole="button" style={styles.action} onPress={() => { vault.touch(); setEditing(entry); }}>
              <Text style={styles.link}>{text('market.browserPasswordEdit')}</Text></Pressable>
            <Pressable accessibilityRole="button" style={styles.action} onPress={() => setRemoving(entry)}>
              <Text style={styles.link}>{text('market.bookmarkDelete')}</Text></Pressable>
          </View>
        </View>)}
      </>}
    </SheetScrollView>
  </BottomSheet>;
}

function NativeVaultConflict() {
  const text = marketText(useLanguage()), styles = useDataStyles(), { vault } = useBrowserData();
  const [phrase, setPhrase] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  return <View>
    <Text style={styles.title}>{text('market.browserVaultPassphrase')}</Text>
    <TextInput secureTextEntry value={phrase} onChangeText={setPhrase} style={styles.input}
      autoCapitalize="none" autoCorrect={false} maxLength={1024} accessibilityLabel={text('market.browserVaultPassphrase')} />
    <Pressable accessibilityRole="button" disabled={busy || !phrase} style={styles.action} onPress={() => {
      setBusy(true); setError(false);
      void vault.mergeConflict(phrase).then(() => setPhrase('')).catch(() => setError(true)).finally(() => setBusy(false));
    }}><Text style={styles.link}>{text('market.save')}</Text></Pressable>
    {error && <Text style={styles.error}>{text('market.browserVaultFailed')}</Text>}
  </View>;
}

function NativePasswordEditor({ login, close }: { login: Login | SavedLogin; close: () => void }) {
  const text = marketText(useLanguage()), styles = useDataStyles(), { vault } = useBrowserData();
  const [draft, setDraft] = useState<Login>(login), [show, setShow] = useState(false), [error, setError] = useState(false);
  const update = (key: keyof Login, value: string) => { vault.touch(); setDraft(current => ({ ...current, [key]: value })); };
  return <BottomSheet visible title={text('id' in login ? 'market.browserPasswordEdit' : 'market.browserPasswordAdd')}
    onClose={close} maxWidth={540} actions={[{ label: text('market.save'), tone: 'primary', onPress: () => {
      const origin = loginOrigin(draft.origin);
      if (!origin || !draft.password) { setError(true); return; }
      try { vault.save({ ...draft, origin }, 'id' in login ? login.id : undefined); close(); } catch { setError(true); }
    } }]}>
    <SheetScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{text('market.browserPasswordOrigin')}</Text>
      <TextInput style={styles.input} value={draft.origin} onChangeText={value => update('origin', value)}
        autoCapitalize="none" autoCorrect={false} maxLength={2048} accessibilityLabel={text('market.browserPasswordOrigin')} />
      <Text style={styles.title}>{text('market.browserPasswordUsername')}</Text>
      <TextInput style={styles.input} value={draft.username} onChangeText={value => update('username', value)}
        autoCapitalize="none" autoCorrect={false} maxLength={512} accessibilityLabel={text('market.browserPasswordUsername')} />
      <Text style={styles.title}>{text('market.browserPasswordValue')}</Text>
      <TextInput style={styles.input} value={draft.password} onChangeText={value => update('password', value)}
        secureTextEntry={!show} autoCapitalize="none" autoCorrect={false} maxLength={4096}
        accessibilityLabel={text('market.browserPasswordValue')} />
      <Pressable accessibilityRole="button" style={styles.action} onPress={() => { vault.touch(); setShow(!show); }}>
        <Text style={styles.link}>{text(show ? 'market.browserPasswordHide' : 'market.browserPasswordShow')}</Text></Pressable>
      {error && <Text style={styles.error} accessibilityRole="alert">{text('market.browserPasswordInvalid')}</Text>}
    </SheetScrollView>
  </BottomSheet>;
}

export function NativePasswordCapture({ login, close }: { login: Login; close: () => void }) {
  const text = marketText(useLanguage()), styles = useDataStyles(), { vault, passwords } = useBrowserData();
  const [error, setError] = useState(false);
  useEffect(() => { const timer = setTimeout(close, 120000); return () => clearTimeout(timer); }, [close]);
  return <BottomSheet visible title={text('market.browserPasswordSavePrompt')} onClose={close} maxWidth={400}
    actions={[{ label: text('market.cancel'), onPress: close },
      { label: text('market.save'), tone: 'primary', disabled: !passwords.unlocked, onPress: () => {
        try { vault.save(login); close(); } catch { setError(true); }
      } }]}>
    <SheetScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{login.origin}</Text><Text style={styles.secondary}>{login.username}</Text>
      <Text style={styles.status}>{text('market.browserPasswordSaveHint')}</Text>
      {!passwords.unlocked && <NativeVaultUnlock />}
      {error && <Text style={styles.error} accessibilityRole="alert">{text('market.browserDataStorage')}</Text>}
    </SheetScrollView>
  </BottomSheet>;
}
