import { useLayoutEffect, useState, type ComponentProps, type RefObject } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { useThemeColor } from '../theme/store';
import { colors, useStyles } from './styles';

const MENU_GAP = 6;
const EDGE_MARGIN = 8;
const MENU_WIDTH = 232;

export interface DownloadMenuViewport { width: number; height: number }
interface Anchor { right: number; top: number; bottom: number }

function menuTop(anchor: Anchor, height: number, viewportHeight: number) {
  const below = viewportHeight - EDGE_MARGIN - anchor.bottom - MENU_GAP;
  const above = anchor.top - MENU_GAP - EDGE_MARGIN;
  const top = below >= height || below >= above ? anchor.bottom + MENU_GAP : anchor.top - MENU_GAP - height;
  return Math.max(EDGE_MARGIN, Math.min(top, viewportHeight - EDGE_MARGIN - height));
}

export function DownloadOpenMenu({ placement, actions, close }: {
  placement: { anchor: View; page: RefObject<View | null>; viewport: DownloadMenuViewport };
  actions: { open: () => void; preview?: () => void; reference?: () => void };
  close: () => void;
}) {
  const styles = useStyles();
  const color = useThemeColor();
  const { anchor, page, viewport } = placement;
  const [bounds, setBounds] = useState<Anchor>();
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    let cancelled = false;
    page.current?.measureInWindow((pageX, pageY) => {
      anchor.measureInWindow((x, y, width, height) => {
        if (!cancelled && width > 0 && height > 0) {
          setBounds({ right: x - pageX + width, top: y - pageY, bottom: y - pageY + height });
        }
      });
    });
    return () => { cancelled = true; };
  }, [anchor, page, viewport]);

  if (!bounds) return null;
  const width = Math.min(MENU_WIDTH, viewport.width - EDGE_MARGIN * 2);
  const maxHeight = viewport.height - EDGE_MARGIN * 2;
  if (width <= 0 || maxHeight <= 0) return null;
  const left = Math.max(EDGE_MARGIN, Math.min(bounds.right - width, viewport.width - width - EDGE_MARGIN));
  const top = menuTop(bounds, Math.min(height, maxHeight), viewport.height);
  const items: Array<{ label: string; icon: ComponentProps<typeof Ionicons>['name']; run: () => void }> = [
    { label: t('client.composer.defaultApp'), icon: 'open-outline', run: actions.open },
  ];
  if (actions.preview) items.push({ label: t('client.filePreview.openInBuiltInBrowser'), icon: 'globe-outline',
    run: actions.preview });
  if (actions.reference) items.push({ label: t('client.projectBrowser.referenceFile'), icon: 'attach-outline',
    run: actions.reference });

  return <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('client.git.closeMenu')}
      onPress={close} />
    <ScrollView style={[styles.openMenu, { left, top, width, maxHeight, opacity: height ? 1 : 0 }]}
      contentContainerStyle={styles.openMenuContent} keyboardShouldPersistTaps="handled"
      onLayout={event => setHeight(event.nativeEvent.layout.height)}>
      {items.map(({ label, icon, run }) => <Pressable key={icon} accessibilityRole="menuitem" accessibilityLabel={label}
        onPress={() => { close(); run(); }} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
        <Ionicons name={icon} size={17} color={color(colors.green, 'accent')} />
        <Text style={styles.menuText}>{label}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}
