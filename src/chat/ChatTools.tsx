import { useState } from 'react';
import { Keyboard } from 'react-native';
import type { GuiToolsClient } from '../../vendor/shared/remote-chat/guiTools';
import { useDesktopLauncher } from '../../vendor/shared/remote-desktop/useDesktopLauncher';
import { useRetainedProjects } from '../../vendor/shared/remote-chat/useRetainedProjects';
import { useRemoteTerminalLauncher } from '../../vendor/shared/remote-chat/useRemoteTerminalLauncher';
import { ChatTerminal } from './ChatTerminal';
import { ChatGit } from './git/ChatGit';
import { RemoteDesktop } from './desktop/RemoteDesktop';
import { ChatToolsMenu } from './ChatToolsMenu';
import { PortMappings } from './portMapping/PortMappings';
import type { AuthSession } from '../types';
import { ProjectBrowser } from './ProjectBrowser';
import type { DownloadClient } from '../../vendor/shared/remote-chat/downloads';

interface Props {
  client: GuiToolsClient; cwd: string; active: boolean; connected: boolean; deviceName?: string;
  foreground?: boolean;
  scope: string; session?: AuthSession;
  downloads?: DownloadClient;
}

export function ChatTools(props: Props) {
  const [mapping, setMapping] = useState(false);
  const files = useRetainedProjects();
  const git = useRetainedProjects();
  const desktop = useDesktopLauncher();
  const [terminalCwd, setTerminalCwd] = useState(props.cwd);
  const [terminalLaunch, setTerminalLaunch] = useState(0);
  const terminal = useRemoteTerminalLauncher({ client: props.client.terminal, cwd: terminalCwd,
    connected: props.connected });
  const hideTools = () => { files.hide(); git.hide(); desktop.hide(); terminal.hide(); Keyboard.dismiss(); };
  const openFiles = () => { hideTools(); setTerminalCwd(props.cwd); files.open(props.cwd); };
  const openTerminal = () => {
    hideTools(); setTerminalCwd(props.cwd); setTerminalLaunch(value => value + 1);
  };
  const scripts = { ...terminal, addInDirectory: (directory: string, npmScript?: string) => {
    files.hide(); terminal.addInDirectory(directory, npmScript);
  } };
  const visible = props.active;
  const live = visible && (props.foreground ?? true);
  return <>
    <ChatToolsMenu active={visible} foreground={props.foreground} connected={props.connected} cwd={props.cwd}
      opened={{ desktop: desktop.opened, terminal: terminal.anyOpened,
        git: git.projects.length > 0, files: files.projects.length > 0 }}
      openMappings={() => { hideTools(); setMapping(true); }}
      openDesktop={() => { hideTools(); desktop.open(); }} openTerminal={openTerminal}
      openGit={() => { hideTools(); git.open(props.cwd); }} openFiles={openFiles} />
    {files.projects.map(cwd => <ProjectBrowser key={cwd} client={props.client.projectBrowser} cwd={cwd}
      active={visible && files.visible === cwd && !terminal.open} connected={props.connected}
      onHide={files.hide} onClose={() => files.close(cwd)} scripts={scripts} />)}
    <ChatTerminal {...props} client={props.client.terminal} cwd={terminalCwd} panel={terminal}
      active={visible} launchId={terminalLaunch} hideTrigger />
    {git.projects.map(cwd => <ChatGit key={cwd} {...props} cwd={cwd} client={props.client.git}
      active={visible && git.visible === cwd} onHide={git.hide} onClose={() => git.close(cwd)} />)}
    <PortMappings client={props.client.files} scope={props.scope} connected={props.connected} session={props.session}
      active={visible} deviceName={props.deviceName} open={mapping} close={() => setMapping(false)} />
    {desktop.opened && <RemoteDesktop client={props.client.desktop} active={live && !desktop.minimized}
      connected={props.connected} keepAlive close={desktop.close} hide={desktop.hide} />}
  </>;
}
