import { displayError } from '../i18n/index';
import { t, useLanguage } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, FlatList, Text, View } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import type { AuthSession } from '../types';
import { DownloadBrowser } from './DownloadBrowser';
import { DownloadCard } from './DownloadCard';
import { DownloadEmptyState } from './DownloadEmptyState';
import { DownloadPageHeader } from './DownloadPageHeader';
import { DownloadSources } from './DownloadSources';
import { useDownloadTasks } from './useDownloadTasks';
import { useStyles } from './styles';
import { useDownloadSelection } from '../../vendor/shared/downloads/useDownloadSelection';
import { DownloadTaskHeading } from './DownloadTaskHeading';
import { downloadManager } from './manager';
import { canPreviewCompletedDownload } from '../../vendor/shared/downloads/previewCompletedDownload';
import { useDownloadedFileActions } from './DownloadedFileActions';
import { DownloadOpenMenu, type DownloadMenuViewport } from './DownloadOpenMenu';

export function DownloadManagerPage({ session, onBack, fromBrowser, onReference }: {
  session: AuthSession; onBack: () => void; fromBrowser?: boolean; onReference?: () => void;
}) {
  const styles = useStyles();
  useLanguage();
  const state = useDownloadTasks(session);
  const { preview, reference } = useDownloadedFileActions(onReference);
  const [view, setView] = useState<'tasks' | 'project' | 'computer'>('tasks');
  const page = useRef<View>(null);
  const [viewport, setViewport] = useState<DownloadMenuViewport>();
  const [menu, setMenu] = useState<{ id: string; anchor: View }>();
  const { tasks, connection, busy, deleting, error, run, setDeleting, removeTasks, owner } = state;
  const { selected, toggle, allSelected, toggleAll } = useDownloadSelection(tasks, owner);
  const browsing = view !== 'tasks' && !!connection;
  const menuTask = menu && !busy ? tasks.find(task => task.id === menu.id && task.status === 'completed') : undefined;
  const closeMenu = () => setMenu(undefined);
  useEffect(() => {
    if (browsing) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menuTask) setMenu(undefined); else onBack();
      return true;
    });
    return () => subscription.remove();
  }, [browsing, onBack, menuTask]);

  if (view !== 'tasks' && connection) return <DownloadBrowser
    key={`${connection.deviceId}:${view}:${connection.threadId ?? connection.cwd ?? ''}`}
    connection={connection} scope={view} back={() => setView('tasks')} />;

  return <View ref={page} collapsable={false} style={styles.page}
    onLayout={({ nativeEvent: { layout: { width, height } } }) => setViewport({ width, height })}>
    <View style={styles.pageContent} importantForAccessibility={menuTask ? 'no-hide-descendants' : 'auto'}>
      <DownloadPageHeader title={t('client.downloads.downloads')} back={onBack}
        backLabel={t(fromBrowser ? 'client.mobile.back' : 'client.discovery.back')} />
      <FlatList data={tasks} keyExtractor={task => task.id} style={styles.list}
        onScroll={menuTask ? closeMenu : undefined} scrollEventThrottle={16}
        contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
        ListHeaderComponent={<>
          <DownloadSources connection={connection} browse={setView} />
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{displayError(error)}</Text>}
          <DownloadTaskHeading count={tasks.length} selected={selected.size} busy={!!busy}
            allSelected={allSelected} toggleAll={toggleAll}
            remove={() => setDeleting(tasks.filter(task => selected.has(task.id)))} />
        </>}
        renderItem={({ item }) => <DownloadCard task={item} busy={!!busy}
          selected={selected.has(item.id)} toggleSelection={() => toggle(item.id)}
          connected={!!item.website || !!downloadManager.connectionForSource(item.source)?.ready}
          action={() => { void run(item, 'action'); }} share={() => { void run(item, 'share'); }}
          menuOpen={menuTask?.id === item.id} openMenu={anchor => setMenu({ id: item.id, anchor })}
          remove={() => setDeleting([item])} />}
        ListEmptyComponent={<DownloadEmptyState />} />
    </View>
    {menu && menuTask && viewport && <DownloadOpenMenu key={menu.id}
      placement={{ page, anchor: menu.anchor, viewport }} close={closeMenu} actions={{
        open: () => { void run(menuTask, 'action'); },
        preview: preview && menuTask.uri && canPreviewCompletedDownload(menuTask) ? () => preview(menuTask) : undefined,
        reference: reference && menuTask.uri ? () => { void run(menuTask, () => reference(menuTask)); } : undefined,
      }} />}
    <BottomSheet visible={!!deleting.length} maxWidth={400} dismissible={!busy}
      title={t('client.downloads.deleteSelectedTitle', { count: deleting.length })}
      onClose={() => { if (!busy) setDeleting([]); }} actions={[
        { label: t("client.downloads.keep"), disabled: !!busy, onPress: () => setDeleting([]) },
        { label: t("client.projectBrowser.deleted"), tone: 'danger', disabled: !!busy,
          loading: !!busy, onPress: () => { void removeTasks(); } },
      ]}>
      <Text style={styles.text}>{t("client.mobile.deletesThePhoneSFileAndDownloadRecordTheOriginal")}</Text>
      {!!error && <Text style={styles.error}>{displayError(error)}</Text>}
    </BottomSheet>
  </View>;
}
