import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { marketText } from '../../vendor/shared/provider-market/i18n';
import { useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { textMetrics } from '../theme/text';
import { FULLSCREEN_CONTROL_SIZE, useFullscreenControl } from './useFullscreenControl';

export function BrowserFullscreenExit({ exit, open, setOpen }: {
  exit: () => void; open: boolean; setOpen: (open: boolean) => void;
}) {
  const text = marketText(useLanguage());
  const styles = useStyles();
  const color = useThemeColor();
  const control = useFullscreenControl(() => setOpen(false));
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={control.onLayout}>
    {open && <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />}
    {control.ready && <View style={[styles.position, control.position]} {...control.handlers}>
      <Pressable accessibilityRole="button" accessibilityLabel={text('market.moreActions')}
        accessibilityState={{ expanded: open }} onPress={() => { if (control.canPress()) setOpen(!open); }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <View style={styles.circle} />
      </Pressable>
    </View>}
    {open && <View accessibilityRole="menu" accessibilityLabel={text('market.moreActions')}
      accessibilityViewIsModal onLayout={control.onMenuLayout} style={[styles.menu, control.menuStyle]}>
      <ScrollView bounces={false}>
        <Pressable accessibilityRole="menuitem" accessibilityLabel={text('market.browserRestore')}
          onPress={() => { setOpen(false); exit(); }} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
          <Ionicons name="contract-outline" size={20} color={color('#17211b', 'ink')} />
          <Text style={styles.label}>{text('market.browserRestore')}</Text>
        </Pressable>
      </ScrollView>
    </View>}
  </View>;
}

const useStyles = createThemedStyles(color => ({
  position: { position: 'absolute' },
  button: { alignItems: 'center', justifyContent: 'center', width: FULLSCREEN_CONTROL_SIZE,
    height: FULLSCREEN_CONTROL_SIZE, borderRadius: FULLSCREEN_CONTROL_SIZE / 2, borderWidth: 1,
    borderColor: color('#dfe5df', 'border'), backgroundColor: color('#ffffff', 'surface'), elevation: 4 },
  circle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#b8bec6' },
  menu: { position: 'absolute', padding: 6, borderRadius: 14, borderWidth: 1,
    borderColor: color('#dfe5df', 'border'), backgroundColor: color('#ffffff', 'surface'), elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  label: { ...textMetrics(13, 20), color: color('#17211b', 'ink'), flexShrink: 1 },
  pressed: { backgroundColor: color('#e7f5f4', 'accentSoft') },
}));
