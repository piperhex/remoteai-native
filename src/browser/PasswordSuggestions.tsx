import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { useLanguage } from '../i18n';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { useBrowserData } from '../../vendor/shared/browser/data/context';
import { matchingPasswords, type PasswordFocus } from '../../vendor/shared/browser/data/passwordFocus';
import type { Login } from '../../vendor/shared/browser/data/model';
import { NativeVaultUnlock } from './BrowserPasswords';
import { useDataStyles } from './dataStyles';

export function NativePasswordSuggestions({ focus, fill, close }: {
  focus: PasswordFocus; fill: (login: Login, focusId?: string) => Promise<void>; close: () => void;
}) {
  const text = marketText(useLanguage()), styles = useDataStyles(), { passwords } = useBrowserData();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const entries = matchingPasswords(passwords.entries, focus);
  return <BottomSheet visible title={text('market.browserPasswordChoose')} onClose={close} maxWidth={400}>
    <SheetScrollView keyboardShouldPersistTaps="handled">
      <Text style={styles.secondary}>{focus.origin}</Text>
      {!passwords.unlocked ? <NativeVaultUnlock /> : <View>
        {!entries.length && <Text style={styles.secondary}>{text('market.browserPasswordEmpty')}</Text>}
        {entries.map(entry => <Pressable key={entry.id} accessibilityRole="button" disabled={busy}
          style={[styles.choice, busy && styles.disabled]} onPress={() => {
            if (busy) return;
            setBusy(true); setError(false);
            void fill(entry, focus.id).then(close).catch(() => setError(true)).finally(() => setBusy(false));
          }}>
          <View style={styles.details}><Text style={styles.title}>
            {entry.username || text('market.browserPasswordUsername')}</Text>
          <Text style={styles.secondary} accessibilityElementsHidden>••••••••</Text></View>
        </Pressable>)}
      </View>}
      {error && <Text style={styles.error} accessibilityRole="alert">{text('market.browserPasswordFillFailed')}</Text>}
    </SheetScrollView>
  </BottomSheet>;
}
