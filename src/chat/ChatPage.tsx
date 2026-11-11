import { displayText } from '../i18n/index';
import { displayError } from '../i18n/index';
import { ImageAiContext } from '../../vendor/shared/chat/ImageAiContext';
import { imageAiSender } from '../../vendor/shared/remote-chat/client/imageAiSender';
import { prepareImageEdit } from './prepareImageEdit';
import { remotePromptSuggestion } from '../../vendor/shared/remote-chat/client/promptSuggestion';
import Storage from 'expo-sqlite/kv-store';
import { t, useLanguage } from '../i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePagePreview } from '../../vendor/shared/navigation/PageSwipeContext';
import { BackHandler, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AuthSession, RemoteDevice } from '../types';
import { ChatApproval } from './ChatApprovals';
import { ChatAsyncQuestions } from './ChatAsyncQuestions';
import { ChatComposer } from './ChatComposer';
import { ChatProjectSwitch } from './ChatProjectSwitch';
import { ChatOverlay } from './ChatOverlay';
import { queueProps } from '../../vendor/shared/remote-chat/client/queueProps';
import { ChatMessages } from './ChatMessages';
import { ChatQuotesProvider } from './ChatQuotes';
import { ChatFileReferencesProvider } from '../../vendor/shared/chat/ChatFileReferences';
import { ChatProcessing } from './ChatProcessing';
import { currentRunningTurn } from '../../vendor/shared/chat/runningTurn';
import { ChatImageContext } from './ChatImage';
import { ChatImagePreviewProvider } from './ChatImagePreview';
import { ChatFileProvider } from './ChatFilePreview';
import { ChatAttachmentMetadata } from '../../vendor/shared/chat/RemoteAttachmentMetadata';
import { ChatThreads } from './ChatThreads';
import { ChatListButton } from './ChatListButton';
import { ChatProfileMenu } from './ChatProfileMenu';
import { TokenSummaryPage } from '../tokenSummary/TokenSummaryPage';
import { ChatSearch } from './ChatSearch';
import { ChatDrawer, type ChatDrawerMethods } from './ChatDrawer';
import { ChatDrawerSurface } from './ChatDrawerSurface';
import { ChatDevices } from './ChatDevices';
import { ChatConnectionInfo } from './ChatConnectionInfo';
import { ChatTaskStatus } from './ChatTaskStatus';
import { visibleChatError } from '../../vendor/shared/remote-chat/chatError';
import { TaskReviewProvider } from '../../vendor/shared/remote-chat/TaskReviewContext';
import { ChatRetryProvider } from '../../vendor/shared/remote-chat/ChatRetryProvider';
import { ChatTools } from './ChatTools';
import { useChat } from './useChat';
import { useRetainedChatDevices } from '../../vendor/shared/remote-chat/useRetainedChatDevices';
import { useDownloadConnection } from '../downloads/useDownloadConnection';
import { useChatDevice } from './useChatDevice';
import { useOfflineDevices } from './offline/devices';
import { useChatDrawerSwipe } from './useChatDrawerSwipe';
import { useChatBackground } from './useChatBackground';
import { useChatCompletionNotifications, useOpenChatNotification } from './useChatNotifications';
import { notificationId, type ChatNotificationTarget } from './notificationTarget';
import { useStyles } from './styles';
import { threadPresentation } from '../../vendor/shared/remote-chat/sidebar';
import type { ChatProject, Thread } from './types';
import { compactUnavailableReason } from '../../vendor/shared/remote-chat/client/composerCommands';
import { randomUUID } from 'expo-crypto';
import { CliGuiProvider, useCliGui } from '../../vendor/shared/cli-gui/context';
import { cliSidebarThread } from '../../vendor/shared/cli-gui/useCliSidebar';
import { CliConversation } from './cli/CliConversation';
import { engineNames } from './cli/engine';

interface Props {
  session: AuthSession; devices: RemoteDevice[]; devicesLoaded: boolean; active: boolean;
  notification: ChatNotificationTarget | null; notificationError: string;
  notificationHandled: (id: string) => void;
  tokenSummary: boolean; closeTokenSummary: () => void;
  openAccounts?: () => void;
}

export function ChatPage(props: Props) {
  const styles = useStyles();
  const preview = usePagePreview() === 'chat';
  useLanguage();
  const { session, active, notification, notificationError, notificationHandled } = props;
  const devices = useOfflineDevices(session, props.devices, props.devicesLoaded);
  const { device, chooseDevice: selectDevice } = useChatDevice({ session, devices,
    devicesLoaded: props.devicesLoaded, requestedDeviceId: notification?.deviceId });
  const scope = JSON.stringify([session.baseUrl, session.email]);
  const retained = useRetainedChatDevices({ scope, devices, selectedId: device?.deviceId });
  const chats = device ? retained : [...retained, undefined];
  const backgroundError = useChatBackground(retained.length > 0);
  const chooseDevice = (id: string) => {
    if (notification) notificationHandled(notificationId(notification));
    selectDevice(id);
  };
  return <View style={[styles.page, !active && !preview && styles.hidden]}>
    {notification && devices.length > 0 && !device && <Text style={styles.error}>
      {t("client.mobile.theComputerForThisNotificationIsUnavailableChooseAnother")}</Text>}
    {!!backgroundError && <Text accessibilityRole="alert" style={styles.error}>{backgroundError}</Text>}
    {!!notificationError && <Pressable accessibilityRole="button" accessibilityLabel={t("client.mobile.openNotificationSettings")}
      onPress={() => { void Linking.openSettings(); }}><Text style={styles.error}>{notificationError}</Text></Pressable>}
    {chats.map(chatDevice => {
      const selected = chatDevice?.deviceId === device?.deviceId;
      return <View key={JSON.stringify([scope, chatDevice?.deviceId])}
        style={[styles.fill, !selected && styles.hidden]}>
        <ConnectedChat {...props} device={chatDevice} devices={devices} selected={selected}
          active={active && selected} chooseDevice={chooseDevice} />
      </View>;
    })}
  </View>;
}

type ConnectedProps = Props & {
  device?: RemoteDevice; selected: boolean; chooseDevice: (id: string) => void;
};

function ConnectedChat(props: ConnectedProps) {
  const chat = useChat(props.session, props.device?.deviceId ?? '', props.active);
  return <CliGuiProvider transport={chat.controller.cliGui} createMessageId={randomUUID}
    enabled={chat.state.ready && props.active && chat.foreground && !props.tokenSummary}>
    <ConnectedChatContent {...props} chat={chat} />
  </CliGuiProvider>;
}

function ConnectedChatContent({ session, device, devices, selected, active: pageActive, chooseDevice, notification,
  notificationHandled, tokenSummary, closeTokenSummary, openAccounts, chat }: ConnectedProps & {
  chat: ReturnType<typeof useChat>;
}) {
  const styles = useStyles();
  useLanguage();
  const active = pageActive && !tokenSummary;
  const insets = useSafeAreaInsets();
  const { state, controller, foreground, catalog } = chat;
  const cli = useCliGui()!;
  const external = cli.state.engine !== 'codex';
  const codexTitle = state.selected ? threadPresentation(state.selected, state.sidebar, displayText).title
    : t('client.chat.newChat');
  const title = external ? cli.state.selected?.title || t(engineNames[cli.state.engine]) : codexTitle;
  useDownloadConnection({ session, deviceId: device?.deviceId ?? '', deviceName: device?.name ?? '', controller,
    enabled: selected });
  useChatCompletionNotifications(controller, session, device?.deviceId ?? '');
  useOpenChatNotification({ controller, target: notification?.deviceId === device?.deviceId ? notification : null,
    ready: state.ready, sending: state.sending, handled: notificationHandled });
  const [drawer, setDrawer] = useState(false);
  const [drawerMoving, setDrawerMoving] = useState(false);
  const drawerRef = useRef<ChatDrawerMethods>(null);
  const afterClose = useRef<(() => void) | undefined>(undefined);
  const [pickingDevice, setPickingDevice] = useState(false);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!notification) return;
    cli.controller.showCodex();
    afterClose.current = undefined;
    drawerRef.current?.closeDrawer(); setPickingDevice(false); setSearching(false);
  }, [notification, cli.controller]);
  const ready = state.ready;
  const error = visibleChatError(state.error, state);
  const runningTurn = ready ? currentRunningTurn(state.selected?.turns) : undefined;
  const running = Boolean(runningTurn);
  const openDrawer = useCallback(() => { Keyboard.dismiss(); setDrawer(true); drawerRef.current?.openDrawer(); }, []);
  const drawerSwipe = useChatDrawerSwipe(active && !drawer && !pickingDevice && !searching,
    openAccounts);
  const closeDrawer = (action?: () => void) => { afterClose.current = action; drawerRef.current?.closeDrawer(); };
  const closed = useCallback(() => {
    setDrawer(false);
    setDrawerMoving(false);
    const action = afterClose.current;
    afterClose.current = undefined;
    action?.();
  }, []);
  const newChat = (project?: ChatProject) => {
    if (state.sending || cli.state.busy) return;
    closeDrawer(() => {
      cli.controller.newConversation();
      cli.controller.patch({ cwd: project?.cwd ?? '' });
      controller.back(project);
    });
  };
  const selectThread = (thread: Thread) => {
    const session = cli.state.sessions.find(entry => cliSidebarThread(entry).id === thread.id);
    if (session) cli.controller.open(session);
    else { cli.controller.showCodex(); void controller.select(thread); }
  };
  useEffect(() => {
    controller.setViewing(active && foreground && !external && !drawer && !drawerMoving && !pickingDevice && !searching);
  }, [active, foreground, external, drawer, drawerMoving, pickingDevice, searching, controller]);
  useEffect(() => {
    if (active) return;
    afterClose.current = undefined;
    drawerRef.current?.closeDrawer(); setPickingDevice(false); setSearching(false);
  }, [active]);
  useEffect(() => {
    if (!active || pickingDevice || (!drawer && !drawerMoving && !(external ? cli.state.selected : state.selected))) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (drawer || drawerMoving) closeDrawer();
      else if (!state.sending && !cli.state.busy) {
        if (external) cli.controller.newConversation(); else controller.back();
      }
      return true;
    });
    return () => subscription.remove();
  }, [active, drawer, drawerMoving, pickingDevice, state.selected?.id, state.sending, controller,
    external, cli.state.selected?.id, cli.state.busy, cli.controller]);
  return <>
  {tokenSummary && pageActive && <TokenSummaryPage read={controller.readTokenSummary} ready={ready}
    scope={JSON.stringify([session.baseUrl, session.email, device?.deviceId ?? ''])}
    foreground={foreground} deviceName={device?.name} onBack={closeTokenSummary} />}
  <View style={[styles.fill, tokenSummary && styles.hidden]}>
  <ChatFileReferencesProvider enabled={active && !external && !state.selectedArchived}>
  <ChatQuotesProvider active={active} scope={state.draftScope ?? state.selected?.id ?? null}
    enabled={active && !external && !state.selectedArchived}>
  <ChatDrawer ref={drawerRef} enabled={active && !pickingDevice}
    onOpen={() => { setDrawer(true); setDrawerMoving(false); }}
    onMoving={() => setDrawerMoving(true)} onClose={closed}
    navigation={<ChatThreads state={state} controller={controller} newChat={newChat} active={active}
      openSearch={() => setSearching(true)}
      profileMenu={<ChatProfileMenu client={controller.guiAccounts} deviceName={device?.name} email={session.email}
        guiTools={controller.guiTools}
        running={state.sending || running || Object.values(state.sidebar.threads).some(thread => thread.running)}
        chooseDevice={() => closeDrawer(() => setPickingDevice(true))}
        ready={ready} active={active && foreground && drawer && !searching} />}
      select={(thread) => closeDrawer(() => selectThread(thread))} />}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // The drawer resets local Y to zero; iOS keyboard coordinates still include the top safe area.
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
    <ChatOverlay>
    <View style={styles.header}>
      <ChatListButton client={controller.guiAccounts} active={active && foreground} ready={ready}
        expanded={drawer} onPress={openDrawer} />
      <View style={styles.headerContent}>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}</Text>
        <ChatConnectionInfo state={state} controller={controller} device={device} active={active && foreground} />
      </View>
      {!external && state.selected && state.selectedArchived && <Pressable accessibilityRole="button"
        style={styles.compactButton} disabled={!ready || running}
        onPress={() => { void controller.archive().then(openDrawer); }}>
        <Text style={styles.buttonText}>{t("client.chat.restore")}</Text></Pressable>}
      <View style={styles.headerTools}>
        <ChatTools client={controller.guiTools} downloads={controller.downloads}
          active={active} foreground={foreground} connected={ready}
          scope={JSON.stringify([session.baseUrl, session.email, device?.deviceId ?? ''])}
          session={session}
          deviceName={device?.name} cwd={external ? cli.state.selected?.cwd ?? cli.state.cwd
            : state.selected?.cwd ?? state.draftProject?.cwd ?? ''} />
      </View>
    </View>
    {external ? <CliConversation host={controller} active={active && foreground} ready={ready}
      connection={{ client: controller.guiAccounts, deviceName: device?.name,
        chooseDevice: () => setPickingDevice(true) }} /> : <>
    <ChatTaskStatus state={state} />
    {!!error && <Text accessibilityRole="alert" style={styles.error}>{displayError(error)}</Text>}
    {state.desktopOnly && <Text style={[styles.subtitle, { maxWidth: 400, paddingHorizontal: 16 }]}>
      {t("client.remoteDesktop.theDesktopIsReadyOpenRemoteDesktopAndSignIn")}</Text>}
    <ChatDrawerSurface enabled={active && !pickingDevice && !searching} {...drawerSwipe}>
    <ChatImageContext.Provider value={{ threadId: state.selected?.id ?? null, ready, offline: true,
      load: controller.imagePreview, save: controller.managedPreviews ? controller.savePreviewImage : undefined }}>
      <ImageAiContext.Provider value={{ enabled: active && ready && !state.selectedArchived
        && !state.sending && !state.settingsBusy && !state.workspaceBusy && !state.compacting,
        send: imageAiSender(controller, prepareImageEdit) }}>
      <ChatImagePreviewProvider key={state.selected?.id ?? 'new'} active={active}>
      <ChatFileProvider key={state.selected?.id ?? 'new'} threadId={state.selected?.id ?? null}
        active={active} ready={ready} load={controller.textPreview} videos={controller.videos} files={controller.files}>
      <ChatAttachmentMetadata controller={controller} ready={ready} threadId={state.selected?.id ?? null}>
      <TaskReviewProvider controller={controller} state={state} active={active && foreground}>
      <ChatRetryProvider controller={controller} state={state}>
      <ChatMessages key={state.selected?.id ?? 'new'} thread={state.selected} offline={!ready}
        loading={state.historyLoading} loadingMore={state.historyLoadingMore} hasMore={state.historyHasMore}
        loadOlder={() => controller.loadOlder()} historyLoad={state.historyLoad}
        processing={runningTurn && <ChatProcessing key={runningTurn.id} turn={runningTurn}
          processing={state.processing} active={active && ready && foreground} />} />
      </ChatRetryProvider></TaskReviewProvider>
      </ChatAttachmentMetadata>
      </ChatFileProvider>
      </ChatImagePreviewProvider></ImageAiContext.Provider>
    </ChatImageContext.Provider>
    </ChatDrawerSurface>
    {ready && state.approvals.some((event) => event.params.threadId === state.selected?.id) &&
      <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={styles.padded} keyboardShouldPersistTaps="handled">
        {state.approvals.filter((event) => event.params.threadId === state.selected?.id).map((event) =>
          <ChatApproval key={String(event.id)} event={event} respond={(reply) => controller.respond(reply)} />)}
      </ScrollView>}
    <ChatAsyncQuestions thread={state.selected} error={error}
      disabled={!ready || state.sending || state.settingsBusy || state.selectedArchived || state.queueBusy
        || state.compacting === state.selected?.id}
      answer={controller.answerAsyncQuestion} />
    <ChatComposer suggestions={remotePromptSuggestion(state, controller.suggestNextPrompt, {
      scope: JSON.stringify([session.baseUrl, session.email, device?.deviceId]), storage: Storage,
    })}
      sshProfiles={controller.guiTools.terminal.ssh.profiles}
      dictation={controller.dictation} queue={queueProps(state, controller)}
      projectPicker={<ChatProjectSwitch state={state} controller={controller} active={active} />}
      connection={{ client: controller.guiAccounts, deviceName: device?.name,
        chooseDevice: () => setPickingDevice(true) }}
      goals={controller.goals} goal={state.selected ? state.goals?.[state.selected.id] : null} goalBusy={state.goalBusy}
      threadId={state.selected?.id ?? null} draftScope={state.draftScope} models={state.models} selection={state.settings}
      contextSettings={controller.contextSettings}
      readUsage={controller.readUsage} usageActive={active && foreground && ready}
      tokenUsage={state.selected?.tokenUsage}
      readConversationMetrics={controller.readConversationMetrics}
      loadCatalog={controller.loadComposerCatalog} loadFiles={controller.loadProjectFiles}
      loadConversations={controller.searchThreads}
      catalog={catalog} cwd={state.selected?.cwd ?? state.draftProject?.cwd ?? ''}
      compactReason={compactUnavailableReason(state)} compacting={!!state.compacting
        && state.compacting === state.selected?.id} compact={controller.compact}
      settingsBusy={state.settingsBusy || !!state.workspaceBusy} settingsError={state.settingsError}
      updateSettings={(settings) => controller.setSettings(settings)}
      refreshModels={controller.refreshModels}
      active={active} ready={ready} sending={state.sending} running={running}
      upload={state.upload} reconnecting={state.mode === 'connecting' || state.mode === 'offline'}
      send={(input) => controller.enqueueMessage(input)} interrupted={state.selected?.turns?.at(-1)?.status === 'interrupted'}
      interrupt={() => controller.interrupt()} />
    </>}
    {active && pickingDevice && <ChatDevices devices={devices} onClose={() => setPickingDevice(false)}
      choose={(id) => { chooseDevice(id); setPickingDevice(false); }} />}
    {searching && active && <ChatSearch state={state} controller={controller} onClose={() => setSearching(false)}
      select={(thread) => { setSearching(false); closeDrawer(() => selectThread(thread)); }} />}
    </ChatOverlay>
  </KeyboardAvoidingView></ChatDrawer></ChatQuotesProvider></ChatFileReferencesProvider></View></>;
}
