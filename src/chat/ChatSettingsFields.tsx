import { Pressable, Text, View } from 'react-native';
import type { SettingsFieldState } from '../../vendor/shared/remote-chat/settingsMenu';
import { displayText, t } from '../i18n';
import { BottomSheet } from '../components/BottomSheet';
import { SheetScrollView } from '../components/SheetScrollView';
import { ChatSettingSegments } from './ChatSettingSegments';
import { ModelRefreshButton } from './ModelRefreshButton';
import { useChatSettingsStyles } from './ChatSettingsSheet';
import { useStyles } from './styles';

export function ChatSettingsFields({ fields, openModel, change }: {
  fields: SettingsFieldState[]; openModel: () => void;
  change: (field: SettingsFieldState['field'], value: string) => void;
}) {
  const menu = useChatSettingsStyles();
  const common = useStyles();
  return <>{fields.map(entry => entry.field !== 'model'
    ? <ChatSettingSegments key={entry.field} {...entry} label={displayText(entry.label)}
      onChange={value => change(entry.field, value)} />
    : <Pressable key={entry.field} accessibilityRole="button"
      accessibilityLabel={t('client.chat.set', { value1: displayText(entry.label) })}
      accessibilityState={{ disabled: entry.disabled }} disabled={entry.disabled}
      onPress={openModel} style={[menu.entry, entry.disabled && common.disabled]}>
      <Text style={menu.title}>{displayText(entry.label)}</Text>
      <Text numberOfLines={1} style={menu.value}>
        {entry.options.find(option => option.value === entry.value)?.label || entry.value || t('client.app.syncing')}
      </Text><Text style={menu.arrow}>›</Text>
    </Pressable>)}</>;
}

export function ChatSettingsModelSheet({ field, ready, refresh, choose, close }: {
  field: SettingsFieldState; ready: boolean; refresh: () => Promise<void>;
  choose: (value: string) => void; close: () => void;
}) {
  const styles = useStyles();
  const menu = useChatSettingsStyles();
  return <BottomSheet fullWidthContent visible title={t('client.shared.chooseModel')}
    titleAction={<ModelRefreshButton ready={ready} refreshModels={refresh} />} onBack={close} onClose={close}>
    <SheetScrollView contentContainerStyle={[styles.settings, menu.content, menu.options]}>
      {field.options.map(option => <Pressable key={option.value} accessibilityRole="radio"
        accessibilityLabel={option.label} accessibilityState={{ checked: field.value === option.value,
          disabled: field.disabled }} disabled={field.disabled}
        style={[styles.choice, field.value === option.value && styles.chosen, field.disabled && styles.disabled]}
        onPress={() => choose(option.value)}>
        <View style={styles.row}><Text style={[styles.buttonText, styles.fill]}>{option.label}</Text>
          {field.value === option.value && <Text style={styles.buttonText}>✓</Text>}</View>
        {option.description && <Text style={styles.subtitle}>{displayText(option.description)}</Text>}
      </Pressable>)}
    </SheetScrollView>
  </BottomSheet>;
}
