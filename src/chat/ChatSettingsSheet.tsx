import type { ReactNode } from 'react';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView, SHEET_READABLE_WIDTH } from '../components/SheetScrollView';
import { CHAT_SETTINGS_SHEET_LAYOUT } from '../../vendor/shared/remote-chat/settingsPresentation';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { t } from '../i18n';
import { palette, useStyles } from './styles';

export function ChatSettingsSheet({ children, panels, nestedOpen, close }: {
  children: ReactNode; panels?: ReactNode; nestedOpen: boolean; close: () => void;
}) {
  const styles = useStyles();
  const menu = useChatSettingsStyles();
  return <BottomSheet visible fullWidthContent hideHeader
    maxHeight={`${CHAT_SETTINGS_SHEET_LAYOUT.maxHeightPercent}%`}
    title={t('client.chat.chatSettings.1e06eb')} onClose={close}>
    <SheetScrollView contentContainerStyle={[styles.settings, menu.content]}
      accessibilityElementsHidden={nestedOpen} importantForAccessibility={nestedOpen ? 'no-hide-descendants' : 'auto'}>
      {children}
    </SheetScrollView>
    {panels}
  </BottomSheet>;
}

export const useChatSettingsStyles = createThemedStyles(color => ({
  content: { paddingHorizontal: CHAT_SETTINGS_SHEET_LAYOUT.horizontalPadding, paddingBottom: 14,
    gap: CHAT_SETTINGS_SHEET_LAYOUT.gap },
  options: { maxWidth: SHEET_READABLE_WIDTH },
  title: { flexShrink: 1, ...textMetrics(15, 22), color: color(palette.ink, 'ink'), fontWeight: '600' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 42 },
  value: { flex: 1, textAlign: 'right', color: color(palette.green, 'accent'), ...textMetrics(14, 22) },
  arrow: { color: color(palette.muted, 'muted'), ...textMetrics(22, 28) },
}));
