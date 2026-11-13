import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { textMetrics } from '../theme/text';

export function BrowserFullscreenExit({ exit }: { exit: () => void }) {
  const text = marketText(useLanguage());
  const styles = useStyles();
  const color = useThemeColor();
  const insets = useSafeAreaInsets();
  return <Pressable accessibilityRole="button" accessibilityLabel={text('market.browserRestore')} onPress={exit}
    style={({ pressed }) => [styles.button, { top: Math.max(12, insets.top), right: Math.max(12, insets.right) },
      pressed && styles.pressed]}>
    <Ionicons name="contract-outline" size={20} color={color('#17211b', 'ink')} />
    <Text style={styles.label}>{text('market.browserRestore')}</Text>
  </Pressable>;
}

const useStyles = createThemedStyles(color => ({
  button: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44,
    maxWidth: 240, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1,
    borderColor: color('#dfe5df', 'border'), backgroundColor: color('#ffffff', 'surface'), elevation: 4 },
  label: { ...textMetrics(13, 20), color: color('#17211b', 'ink'), flexShrink: 1 },
  pressed: { backgroundColor: color('#e7f5f4', 'accentSoft') },
}));
