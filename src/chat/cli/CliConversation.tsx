import { useMemo, type ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { useCliGui } from '../../../vendor/shared/cli-gui/context';
import { cliThread } from '../../../vendor/shared/cli-gui/presentation';
import { cliErrorText } from '../../../vendor/shared/cli-gui/errors';
import type { ChatController } from '../controller';
import type { ChatConnectionProps } from '../ChatProfileMenu';
import { ChatMessages } from '../ChatMessages';
import { ChatDrawerSurface } from '../ChatDrawerSurface';
import { ChatFileProvider } from '../ChatFilePreview';
import { ChatImageContext } from '../ChatImage';
import { ChatImagePreviewProvider } from '../ChatImagePreview';
import { useLanguage } from '../../i18n';
import { CliComposer } from './CliComposer';
import { CliPermissions } from './CliPermissions';
import { CliRuntime } from './CliRuntime';
import { useCliStyles } from './styles';

export function CliConversation({ host, connection, active, ready, swipe }: {
  host: ChatController; connection: ChatConnectionProps; active: boolean; ready: boolean;
  swipe: Omit<ComponentProps<typeof ChatDrawerSurface>, 'children'>;
}) {
  const { state, controller } = useCliGui()!;
  const styles = useCliStyles();
  const thread = useMemo(() => cliThread(state.history), [state.history]);
  useLanguage();
  if (state.engine === 'codex') return null;
  const threadId = state.selected?.id ?? null;
  return <>
    {!!state.error && <View style={styles.footer}>
      <Text accessibilityRole="alert" style={styles.error}>{cliErrorText(state.error)}</Text></View>}
    {state.runtime[state.engine]?.status !== 'ready' && !state.selected
      ? <ChatDrawerSurface {...swipe}>
        <CliRuntime ready={ready} active={active} connection={connection} />
      </ChatDrawerSurface> : <>
      <ChatDrawerSurface {...swipe}>
      <ChatImageContext.Provider value={{ threadId, ready, load: host.imagePreview }}>
        <ChatImagePreviewProvider key={threadId ?? 'new'} active={active}>
          <ChatFileProvider threadId={threadId} ready={ready} active={active}
            load={host.textPreview} videos={host.videos} files={host.files}>
            <ChatMessages key={`${state.engine}:${threadId ?? 'new'}`} thread={thread} offline={!ready} active={active}
              loading={state.loading && !state.history} loadingMore={state.loading && Boolean(state.history)}
              hasMore={state.history?.hasOlder} loadOlder={controller.loadOlder} />
          </ChatFileProvider>
        </ChatImagePreviewProvider>
      </ChatImageContext.Provider>
      </ChatDrawerSurface>
      {!!state.selected?.permissions.length && <CliPermissions session={state.selected}
        busy={!active || !ready || state.busy} respond={controller.act} />}
      <CliComposer host={host} connection={connection} ready={ready} active={active} />
    </>}
  </>;
}
