import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import type { GuiToolsClient } from '../../vendor/shared/remote-chat/guiTools';
import { useDesktopLauncher } from '../../vendor/shared/remote-desktop/useDesktopLauncher';
import { useRetainedProjects } from '../../vendor/shared/remote-chat/useRetainedProjects';
import { useRemoteTerminalLauncher } from '../../vendor/shared/remote-chat/useRemoteTerminalLauncher';
import { ChatTerminal } from './ChatTerminal';
import { ChatGit } from './git/ChatGit';
import { RemoteDesktopWindow } from './desktop/RemoteDesktopWindow';
import { ChatToolsMenu } from './ChatToolsMenu';
import { PortMappings } from './portMapping/PortMappings';
import type { AuthSession } from '../types';
import { ProjectBrowser } from './ProjectBrowser';
import { useHasProjectBrowserWindowHost } from './ProjectBrowserWindow';
import type { DownloadClient } from '../../vendor/shared/remote-chat/downloads';

interface Props {
  client: GuiToolsClient; cwd: string; active: boolean; connected: boolean; deviceName?: string;
  foreground?: boolean;
  closeDeviceDesktop?: () => void;
  scope: string; session?: AuthSession;
  downloads?: DownloadClient;
}

export function ChatTools(props: Props) {
  const canPrepareFiles = useHasProjectBrowserWindowHost();
  const [menu, setMenu] = useState<{ preparing?: string } | null>(null);
  const [mapping, setMapping] = useState(false);
  const files = useRetainedProjects();
  const git = useRetainedProjects();
  const desktop = useDesktopLauncher();
  const [terminalCwd, setTerminalCwd] = useState(props.cwd);
  const [terminalLaunch, setTerminalLaunch] = useState(0);
  const terminal = useRemoteTerminalLauncher({ client: props.client.terminal, cwd: terminalCwd,
    connected: props.connected });
  const hideTools = () => { files.hide(); git.hide(); desktop.hide(); terminal.hide(); Keyboard.dismiss(); };
  const showFiles = () => { hideTools(); setTerminalCwd(props.cwd); files.open(props.cwd); setMenu(null); };
  const openFiles = () => {
    if (!canPrepareFiles || files.projects.includes(props.cwd) || !props.cwd) showFiles();
    else setMenu({ preparing: props.cwd });
  };
  const openTerminal = () => {
    hideTools(); setTerminalCwd(props.cwd); setTerminalLaunch(value => value + 1);
  };
  const scripts = { ...terminal, addInDirectory: (directory: string, npmScript?: string) => {
    files.hide(); terminal.addInDirectory(directory, npmScript);
  } };
  const visible = props.active;
  const live = visible && (props.foreground ?? true);
  const pending = live && menu?.preparing === props.cwd ? menu.preparing : undefined;
  useEffect(() => {
    if (!live || (menu?.preparing && menu.preparing !== props.cwd)) setMenu(null);
  }, [live, menu?.preparing, props.cwd]);
  const projects = pending ? [...files.projects, pending] : files.projects;
  return <>
    <ChatToolsMenu visible={live && !!menu} changeMenu={open => setMenu(open ? {} : null)}
      preparingFiles={!!pending} connected={props.connected} cwd={props.cwd}
      opened={{ desktop: desktop.opened, terminal: terminal.anyOpened,
        git: git.projects.length > 0, files: files.projects.length > 0 }}
      openMappings={() => { hideTools(); setMapping(true); }}
      openDesktop={() => { hideTools(); desktop.open(); }} openTerminal={openTerminal}
      openGit={() => { hideTools(); git.open(props.cwd); }} openFiles={openFiles} />
    {projects.map(cwd => <ProjectBrowser key={cwd} client={props.client.projectBrowser} cwd={cwd}
      active={visible && files.visible === cwd && !terminal.open} connected={props.connected}
      onPrepared={pending === cwd ? showFiles : undefined}
      onHide={files.hide} onClose={() => files.close(cwd)} scripts={scripts} />)}
    <ChatTerminal {...props} client={props.client.terminal} cwd={terminalCwd} panel={terminal}
      active={visible} launchId={terminalLaunch} hideTrigger />
    {git.projects.map(cwd => <ChatGit key={cwd} {...props} cwd={cwd} client={props.client.git}
      active={visible && git.visible === cwd} onHide={git.hide} onClose={() => git.close(cwd)} />)}
    <PortMappings client={props.client.files} scope={props.scope} connected={props.connected} session={props.session}
      active={visible} deviceName={props.deviceName} open={mapping} close={() => setMapping(false)} />
    {(desktop.opened || props.closeDeviceDesktop) && <RemoteDesktopWindow client={props.client.desktop}
      active={props.closeDeviceDesktop ? props.foreground !== false : live && !desktop.minimized}
      connected={props.connected} keepAlive close={() => { desktop.close(); props.closeDeviceDesktop?.(); }}
      hide={props.closeDeviceDesktop ? undefined : desktop.hide} />}
  </>;
}
