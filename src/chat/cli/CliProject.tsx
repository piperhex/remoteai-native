import { useSyncExternalStore } from 'react';
import { useCliGui } from '../../../vendor/shared/cli-gui/context';
import type { ChatController } from '../controller';
import { ChatProjectSwitch } from '../ChatProjectSwitch';

export function CliProject({ host, active, ready }: { host: ChatController; active: boolean; ready: boolean }) {
  const { state, controller } = useCliGui()!;
  const hostState = useSyncExternalStore(host.subscribe, host.snapshot);
  return <ChatProjectSwitch state={hostState} controller={host} active={active} workspace={{
    cwd: state.selected?.cwd ?? state.cwd,
    disabled: !ready || state.busy || Boolean(state.selected),
    choose: cwd => { controller.patch({ cwd }); void controller.loadCatalog(); },
  }} />;
}
