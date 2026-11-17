import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';
import { textMetrics } from '../theme/text';
import { t, useLanguage } from '../i18n';
import Feather from '@expo/vector-icons/Feather';
import { useEffect } from 'react';
import { BackHandler, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

export type ComposerAddAction = 'camera' | 'library' | 'projectPhotos' | 'file' | 'projectFiles' | 'plugins';
const OPTIONS = [
  { action: 'camera', get label() { return t("client.mobile.camera"); }, icon: 'camera' },
  { action: 'library', get label() { return t("client.mobile.phonePhotos"); }, icon: 'image' },
  { action: 'projectPhotos', get label() { return t("client.mobile.computerPhotos"); }, icon: 'image' },
  { action: 'file', get label() { return t("client.mobile.phoneFiles"); }, icon: 'paperclip' },
  { action: 'projectFiles', get label() { return t("client.mobile.computerFiles"); }, icon: 'monitor' },
  { action: 'plugins', get label() { return t("client.chat.plugins"); }, icon: 'box' },
] as const;

export function ComposerAddMenu({ busy, choose, close }: {
  busy: boolean; choose: (action: ComposerAddAction) => void; close: () => void;
}) {
  const menuStyles = useMenuStyles();
  const color = useThemeColor();
  const { height } = useWindowDimensions();
  useLanguage();
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => back.remove();
  }, [close]);
  return <ScrollView accessibilityLabel={t("client.mobile.attachmentMenu")} keyboardShouldPersistTaps="always"
    showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
    style={[menuStyles.panel, { maxHeight: height * 0.4 }]} contentContainerStyle={menuStyles.grid}>
    {OPTIONS.map(({ action, label, icon }) => <Pressable key={action} accessibilityRole="menuitem"
      accessibilityLabel={label} disabled={busy && action !== 'plugins'} onPress={() => choose(action)}
      style={({ pressed }) => [menuStyles.option, pressed && menuStyles.pressed,
        busy && action !== 'plugins' && menuStyles.disabled]}>
      <View style={menuStyles.icon}><Feather name={icon} size={24} color={color("#161616", 'ink')} /></View>
      <Text style={menuStyles.label}>{label}</Text>
    </Pressable>)}
  </ScrollView>;
}

const useMenuStyles = createThemedStyles((color) => ({
  panel: { flexGrow: 0, flexShrink: 1, borderTopWidth: 1, borderTopColor: color('#e4e8e5', 'border'),
    backgroundColor: color('#f4f4f4', 'canvas') },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, paddingHorizontal: 12,
    paddingTop: 16, paddingBottom: 24 },
  option: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 4,
    borderRadius: 12 },
  icon: { width: 52, height: 52, flexShrink: 0, borderRadius: 16, backgroundColor: color('#fff', 'surface'),
    alignItems: 'center', justifyContent: 'center' },
  label: { alignSelf: 'stretch', textAlign: 'center', ...textMetrics(13, 20), color: color('#636b66', 'muted') },
  pressed: { backgroundColor: color('#f2f2f2', 'elevated') },
  disabled: { opacity: 0.4 },
}));
