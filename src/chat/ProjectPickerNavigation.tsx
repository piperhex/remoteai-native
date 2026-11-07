import Feather from '@expo/vector-icons/Feather';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { displayError, t } from '../i18n';
import { useThemeColor } from '../theme/store';
import type { MobileProjectPickerState } from '../../vendor/shared/remote-chat/client/useMobileProjectPicker';
import { useProjectPickerStyles } from './projectPickerStyles';

const SHORTCUTS = [
  { key: 'desktop', icon: 'monitor', label: 'client.projectExplorer.desktop' },
  { key: 'downloads', icon: 'download', label: 'client.projectExplorer.downloads' },
  { key: 'documents', icon: 'file-text', label: 'client.projectPicker.documents' },
] as const;

function CreateFolder({ picker }: { picker: MobileProjectPickerState }) {
  const styles = useProjectPickerStyles();
  return <View style={styles.create}>
    <Text style={styles.inputLabel}>{t('client.projectBrowser.newFolder')}</Text>
    <TextInput autoFocus accessibilityLabel={t('client.projectBrowser.name')} style={styles.input}
      value={picker.name} maxLength={255} editable={!picker.busy} onChangeText={picker.setName}
      onSubmitEditing={() => void picker.createFolder()} />
    {!!picker.name && !!picker.invalidName && <Text accessibilityRole="alert" style={styles.error}>
      {displayError(picker.invalidName)}</Text>}
    {!!picker.actionError && <Text accessibilityRole="alert" style={styles.error}>
      {displayError(picker.actionError)}</Text>}
    <View style={styles.createActions}>
      <Pressable accessibilityRole="button" disabled={picker.busy} onPress={picker.cancelCreate}>
        <Text style={styles.link}>{t('client.accounts.cancel')}</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={picker.busy || !!picker.invalidName}
        style={(picker.busy || !!picker.invalidName) && styles.disabled} onPress={() => void picker.createFolder()}>
        <Text style={styles.link}>{t('client.projectBrowser.ok')}</Text></Pressable>
    </View>
  </View>;
}

export function ProjectPickerNavigation({ picker }: { picker: MobileProjectPickerState }) {
  const styles = useProjectPickerStyles();
  const color = useThemeColor();
  const iconColor = color('#6f8177', 'muted');
  const path = [t('client.downloads.thisComputer'), ...picker.parts.map(part =>
    part.name.replace(/[\\/]+$/, '') || '/')].join('  /  ');
  return <View style={styles.navigation}>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.downloads.goBack')}
        disabled={picker.busy || (!picker.directory && !picker.recent)}
        style={[styles.iconButton, (picker.busy || (!picker.directory && !picker.recent)) && styles.disabled]}
        onPress={() => picker.recent ? picker.toggleRecent() : picker.navigate(picker.parent)}>
        <Feather name="chevron-left" size={21} color={iconColor} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.projectExplorer.address')}
        accessibilityState={{ expanded: picker.locations }} disabled={picker.busy} style={styles.address}
        onPress={() => picker.setLocations(!picker.locations)}>
        <Feather name="monitor" size={18} color={iconColor} />
        <Text numberOfLines={1} style={styles.addressText}>{path}</Text>
        <Feather name="chevron-down" size={15} color={iconColor} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.projectBrowser.newFolder')}
        disabled={!picker.canCreate} style={[styles.iconButton, !picker.canCreate && styles.disabled]}
        onPress={picker.openCreate}><Feather name="folder-plus" size={20} color={iconColor} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.projectExplorer.search')}
        accessibilityState={{ selected: picker.searching }} style={styles.iconButton}
        onPress={() => { picker.setSearching(!picker.searching); picker.setQuery(''); }}>
        <Feather name="search" size={20} color={iconColor} /></Pressable>
    </View>
    {picker.locations && <ScrollView style={styles.locations} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.downloads.thisComputer')}
        style={styles.location} onPress={() => picker.navigate('')}>
        <Feather name="monitor" size={18} color={iconColor} />
        <Text style={styles.locationText}>{t('client.downloads.thisComputer')}</Text></Pressable>
      {picker.parts.map(part => <Pressable key={part.path} accessibilityRole="button" accessibilityLabel={part.name}
        style={styles.location} onPress={() => picker.navigate(part.path)}>
        <Feather name="folder" size={18} color={iconColor} /><Text style={styles.locationText}>{part.name}</Text>
      </Pressable>)}
    </ScrollView>}
    <View style={styles.shortcuts}>
      {SHORTCUTS.map(({ key, icon, label }) => <Pressable key={key} accessibilityRole="button"
        accessibilityLabel={t(label)} disabled={picker.busy || !picker.shortcuts?.[key]}
        style={[styles.shortcut, (picker.busy || !picker.shortcuts?.[key]) && styles.disabled]}
        onPress={() => picker.navigate(picker.shortcuts?.[key] ?? '')}>
        <Feather name={icon} size={18} color={color('#14806f', 'accent')} />
        <Text style={styles.shortcutText}>{t(label)}</Text></Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel={t('client.chat.recent')}
        accessibilityState={{ selected: picker.recent }} disabled={picker.busy}
        style={[styles.shortcut, picker.recent && styles.selected]} onPress={picker.toggleRecent}>
        <Feather name="clock" size={18} color={color('#14806f', 'accent')} />
        <Text style={styles.shortcutText}>{t('client.chat.recent')}</Text></Pressable>
    </View>
    {picker.searching && <TextInput autoFocus style={styles.input}
      accessibilityLabel={t('client.projectExplorer.search')}
      placeholder={t('client.projectExplorer.search')} placeholderTextColor={iconColor}
      value={picker.query} onChangeText={picker.setQuery} />}
    {picker.creating && <CreateFolder picker={picker} />}
  </View>;
}
