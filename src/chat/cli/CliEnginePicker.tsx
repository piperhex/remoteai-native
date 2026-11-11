import { useEffect, useState } from 'react';
import { Keyboard, Pressable, Text } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useCliGui } from '../../../vendor/shared/cli-gui/context';
import { BottomSheet } from '../../components/BottomSheet';
import { SheetScrollView } from '../../components/SheetScrollView';
import { t, useLanguage } from '../../i18n';
import { useStyles } from '../styles';
import { engineNames, engines } from './engine';
import { useCliStyles } from './styles';
import { useSettingsConnectionStyles } from '../ChatSettingsConnection';

export function CliEnginePicker({ locked = false, active, ready, cwd }: {
  locked?: boolean; active: boolean; ready: boolean; cwd?: string;
}) {
  const cli = useCliGui();
  const styles = useCliStyles();
  const common = useStyles();
  const row = useSettingsConnectionStyles();
  const [open, setOpen] = useState(false);
  useLanguage();
  useEffect(() => { if (!active || !ready) setOpen(false); }, [active, ready]);
  if (!cli) return null;
  const { engine, selected, busy, runtime } = cli.state;
  const fixed = locked || Boolean(selected) || busy;
  const version = engine === 'codex' ? undefined : runtime[engine]?.cliVersion;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={t('client.cliGui.choose')}
      accessibilityState={{ expanded: open, disabled: !ready }} disabled={!ready}
      style={[row.row, !ready && common.disabled]}
      onPress={() => { Keyboard.dismiss(); setOpen(true); }}>
      <Feather name="terminal" size={22} color={row.label.color} />
      <Text style={row.label}>{t('client.cliGui.choose')}</Text>
      <Text style={row.value} numberOfLines={1}>{t(engineNames[engine])}{version ? ` · ${version}` : ''}</Text>
      <Feather name="chevron-right" size={20} color={row.value.color} />
    </Pressable>
    <BottomSheet visible={open && active} title={t('client.cliGui.choose')} onClose={() => setOpen(false)}>
      <SheetScrollView contentContainerStyle={styles.content}>
        {fixed && <Text style={styles.hint}>{t('client.cliGui.fixedEngine')}</Text>}
        {engines.map(value => <Pressable key={value} accessibilityRole="radio"
          accessibilityLabel={t(engineNames[value])}
          accessibilityState={{ checked: value === engine, disabled: fixed && value !== engine }}
          disabled={fixed && value !== engine}
          style={[styles.option, value === engine && styles.selected, fixed && value !== engine && common.disabled]}
          onPress={() => {
            if (!fixed && cwd !== undefined) cli.controller.patch({ cwd });
            cli.controller.chooseEngine(value); setOpen(false);
          }}>
          <Text style={[styles.body, common.fill]}>{t(engineNames[value])}</Text>
          {value === engine && <Feather name="check" size={18} color={styles.label.color} />}
        </Pressable>)}
      </SheetScrollView>
    </BottomSheet>
  </>;
}
