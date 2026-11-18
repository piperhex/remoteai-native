import { useRef } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles } from '../theme/styles';
import { textMetrics } from '../theme/text';
import { useThemeColor } from '../theme/store';
import { t, useLanguage } from '../i18n';
import { ChatToolsPopover } from './ChatToolsPopover';
import { palette, useStyles } from './styles';

interface Props {
  visible: boolean; changeMenu: (open: boolean) => void; preparingFiles: boolean; connected: boolean; cwd: string;
  opened: Record<'desktop' | 'terminal' | 'git' | 'files', boolean>;
  openMappings: () => void; openDesktop: () => void; openTerminal: () => void;
  openGit: () => void; openFiles: () => void;
}

export function ChatToolsMenu(props: Props) {
  useLanguage();
  const styles = useStyles();
  const menuStyles = useMenuStyles();
  const color = useThemeColor();
  const anchor = useRef<View>(null);
  const items: { id: keyof Props['opened'] | 'mappings'; icon: keyof typeof Ionicons.glyphMap;
    label: string; open: () => void; disabled?: boolean }[] = [
    { id: 'mappings', icon: 'swap-horizontal-outline', label: t('client.portForwarding.portMapping'),
      open: props.openMappings },
    { id: 'desktop', icon: 'desktop-outline', label: t('client.remoteDesktop.remoteDesktop'),
      open: props.openDesktop, disabled: !props.connected && !props.opened.desktop },
    { id: 'terminal', icon: 'terminal-outline', label: t('client.projectBrowser.terminal'),
      open: props.openTerminal, disabled: !props.connected && !props.opened.terminal },
    { id: 'git', icon: 'git-branch-outline', label: 'Git', open: props.openGit },
    { id: 'files', icon: 'folder-open-outline', label: t('client.projectBrowser.browseFiles'),
      open: props.openFiles, disabled: (!props.connected || !props.cwd) && !props.opened.files },
  ];
  return <>
    <Pressable ref={anchor} collapsable={false} accessibilityRole="button" accessibilityLabel={t('client.git.openTools')}
      accessibilityState={{ expanded: props.visible }} style={styles.back}
      onPress={() => { Keyboard.dismiss(); props.changeMenu(!props.visible); }}>
      <Ionicons name="construct-outline" size={24} color={color(palette.ink, 'ink')} /></Pressable>
    {props.visible && <ChatToolsPopover anchor={anchor} close={() => props.changeMenu(false)}>
      {items.map(item => {
        const opened = item.id !== 'mappings' && props.opened[item.id];
        const busy = item.id === 'files' && props.preparingFiles;
        return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.label}
          disabled={item.disabled || busy} accessibilityState={{ disabled: item.disabled || busy, busy, selected: opened }}
          style={({ pressed }) => [menuStyles.item, pressed && menuStyles.pressed, item.disabled && styles.disabled]}
          onPress={() => { if (item.id !== 'files') props.changeMenu(false); item.open(); }}>
          {busy ? <ActivityIndicator style={menuStyles.progress} size="small" color={color(palette.green, 'accent')} />
            : <Ionicons name={item.icon} size={20}
              color={opened ? color(palette.green, 'accent') : color(palette.ink, 'ink')} />}
          <Text style={menuStyles.label}>{item.label}</Text>
        </Pressable>;
      })}
    </ChatToolsPopover>}
  </>;
}

const useMenuStyles = createThemedStyles(color => ({
  progress: { width: 20, height: 20 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, borderRadius: 8, padding: 12 },
  pressed: { backgroundColor: color('#eef4f1', 'canvas') },
  label: { color: color(palette.ink, 'ink'), ...textMetrics(14, 20), flexShrink: 1 },
}));
