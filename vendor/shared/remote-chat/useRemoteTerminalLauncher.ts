import { useEffect, useMemo, useState } from 'react';
import { useRemoteTerminalPanel } from './useRemoteTerminalPanel';
import { terminalProjectKey } from './terminalProject';

/** Keep loading and error details inside the drawer, even before a shell is available. */
export function useRemoteTerminalLauncher(options: Parameters<typeof useRemoteTerminalPanel>[0]) {
  const panel = useRemoteTerminalPanel(options);
  const project = terminalProjectKey(options.cwd);
  const views = useMemo(() => new Map<string, {
    visible: boolean; requested: boolean; directory?: string; npmScript?: string;
  }>(),
    [options.client]);
  const [, render] = useState(0);
  const view = views.get(project);
  const setView = (value: typeof view) => {
    if (value) views.set(project, value); else views.delete(project);
    render(version => version + 1);
  };
  const open = Boolean(view?.visible && (view.requested || panel.open));
  useEffect(() => {
    if (panel.open && view?.requested) setView({ ...view, requested: false });
  }, [panel.open, project, views, view]);
  const hide = () => { if (view) setView({ ...view, visible: false, requested: false }); panel.hide(); };
  const close = () => { setView(undefined); panel.hide(); };
  const addInDirectory = (directory: string, npmScript?: string) => {
    setView({ visible: true, requested: !panel.open, directory, npmScript });
    panel.addInDirectory(directory, npmScript);
  };
  const show = () => {
    setView({ visible: true, requested: !panel.open });
    // Existing errors remain readable while offline; only an explicit retry starts another request.
    if (!panel.error || panel.tabs.length) panel.show();
  };
  const toggle = () => { if (open) hide(); else show(); };
  const retry = () => {
    if (view?.directory !== undefined) panel.addInDirectory(view.directory, view.npmScript);
    else panel.toggle();
  };
  return { ...panel, opened: Boolean(view), anyOpened: views.size > 0,
    open, show, close, toggle, hide, addInDirectory, retry };
}
