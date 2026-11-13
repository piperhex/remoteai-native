import { type ComponentProps, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheet, type BottomSheetAction } from '../components/BottomSheet';
import { t, useLanguage } from '../i18n';
import { createThemedStyles } from '../theme/styles';
import { useThemeColor } from '../theme/store';

export interface FilePreviewAction extends BottomSheetAction {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
}

function PreviewActions({ actions }: { actions: FilePreviewAction[] }) {
  const styles = useStyles();
  const color = useThemeColor();
  return <View style={styles.actions}>{actions.map(action => <Pressable key={action.label}
    accessibilityRole="button" accessibilityLabel={action.label}
    accessibilityState={{ disabled: Boolean(action.disabled || action.loading), busy: action.loading }}
    disabled={action.disabled || action.loading} onPress={() => void action.onPress()}
    style={({ pressed }) => [styles.action, pressed && styles.pressed,
      (action.disabled || action.loading) && styles.disabled]}>
    {action.loading ? <ActivityIndicator size="small" color={color('#0b8065', 'accent')} />
      : <MaterialCommunityIcons name={action.icon} size={22} color={color('#0b8065', 'accent')} />}
  </Pressable>)}</View>;
}

export function FilePreviewSheet({ path, previewable, close, actions, children, embedded = false }: {
  path: string; previewable: boolean; close: () => void; actions: FilePreviewAction[]; children: ReactNode;
  embedded?: boolean;
}) {
  useLanguage();
  if (embedded) return <View style={{ flex: 1 }}>
    {actions.length > 0 && <PreviewActions actions={actions} />}{children}
  </View>;
  return <BottomSheet visible tall fullWidthContent fillHeight={previewable} fullscreen={previewable}
    compactHeader={previewable} truncateTitle={previewable} horizontalPadding={previewable ? 12 : undefined}
    title={previewable ? path.split(/[\\/]/).at(-1) || t('client.projectBrowser.filePreview')
      : t('client.chat.files.39932f')}
    subtitle={previewable ? undefined : path} onClose={close}
    headerAction={previewable && <PreviewActions actions={actions} />}
    actions={previewable ? [] : actions}>
    {children}
  </BottomSheet>;
}

const useStyles = createThemedStyles(color => ({
  actions: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 4, flexShrink: 0 },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderRadius: 12, backgroundColor: color('#eef3f0', 'canvas') },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
}));
