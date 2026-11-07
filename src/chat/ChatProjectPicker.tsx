import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { displayError, getLocale, t, useLanguage } from '../i18n';
import { useThemeColor } from '../theme/store';
import { BottomSheet } from '../components/BottomSheet';
import { SheetFlatList, SheetInset } from '../components/SheetScrollView';
import { directoryProject, type ProjectDirectory, type ProjectPickerProps }
  from '../../vendor/shared/remote-chat/projectDirectories';
import { useMobileProjectPicker } from '../../vendor/shared/remote-chat/client/useMobileProjectPicker';
import { entryDate } from '../../vendor/shared/project-explorer/model';
import { ProjectPickerNavigation } from './ProjectPickerNavigation';
import { useProjectPickerStyles } from './projectPickerStyles';

export function ChatProjectPicker(props: ProjectPickerProps) {
  useLanguage();
  const styles = useProjectPickerStyles();
  const color = useThemeColor();
  const picker = useMobileProjectPicker(props);
  const renderEntry = ({ item }: { item: ProjectDirectory }) => <Pressable accessibilityRole="button"
    accessibilityLabel={item.name} disabled={picker.loading || picker.busy}
    onPress={() => picker.navigate(item.path)} style={styles.row}>
    <Feather name="folder" size={25} color={color('#14806f', 'accent')} />
    <View style={styles.details}><Text numberOfLines={1} style={styles.name}>{item.name}</Text>
      <Text numberOfLines={1} style={styles.metadata}>{picker.recent ? item.path : item.modified == null
        ? t('client.projectExplorer.folder') : entryDate({ ...item, directory: true }, getLocale())}</Text></View>
    <Feather name="chevron-right" size={19} color={color('#6f8177', 'muted')} />
  </Pressable>;
  return <BottomSheet fullWidthContent visible tall fillHeight title={props.title ?? t('client.chat.chooseProject')}
    subtitle={t('client.projectPicker.chooseLocation')} onClose={props.close}>
    <View style={styles.root}>
      <SheetInset style={styles.readable}><ProjectPickerNavigation picker={picker} /></SheetInset>
      <SheetFlatList data={picker.entries} keyExtractor={entry => entry.path} style={styles.list}
        contentContainerStyle={styles.readable} keyboardShouldPersistTaps="handled" nestedScrollEnabled
        renderItem={renderEntry}
        ListHeaderComponent={<>
          {picker.loading && !picker.recent
            && <ActivityIndicator accessibilityLabel={t('client.mobile.loadingFolder')} />}
          {!!picker.error && !picker.recent && <View>
            <Text accessibilityRole="alert" style={styles.message}>{displayError(picker.error)}</Text>
            <Pressable accessibilityRole="button" onPress={picker.retry}>
              <Text style={styles.link}>{t('client.terminal.retry')}</Text></Pressable>
          </View>}
        </>}
        ListEmptyComponent={!picker.loading && (!picker.error || picker.recent)
          ? <Text style={styles.message}>{t(picker.query.trim() ? 'client.projectExplorer.noMatches'
            : picker.recent ? 'client.conversation.noProjectsYet' : 'client.chat.noSubfoldersHere')}</Text> : null}
        ListFooterComponent={!picker.recent && picker.result?.truncated
          ? <Text style={styles.message}>{t('client.chat.onlySomeFoldersAreShown')}</Text> : null} />
      <SheetInset style={[styles.readable, styles.footer]}>
        <View style={styles.current}><Feather name="folder" size={21} color={color('#6f8177', 'muted')} />
          <View style={styles.details}><Text style={styles.caption}>{t('client.projectPicker.currentPath')}</Text>
            <Text numberOfLines={2} ellipsizeMode="middle" style={styles.currentPath}>
              {picker.directory || t('client.downloads.thisComputer')}</Text></View></View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('client.projectPicker.useFolder')}
          disabled={!picker.canChoose || picker.creating}
          accessibilityState={{ disabled: !picker.canChoose || picker.creating }}
          style={[styles.confirm, (!picker.canChoose || picker.creating) && styles.disabled]}
          onPress={() => { if (picker.result?.directory) props.choose(directoryProject(picker.result.directory)); }}>
          <Text style={styles.confirmText}>{t('client.projectPicker.useFolder')}</Text>
        </Pressable>
      </SheetInset>
    </View>
  </BottomSheet>;
}
