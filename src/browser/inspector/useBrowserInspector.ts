import { useEffect, useRef, useState, type RefObject } from 'react';
import { AppState, findNodeHandle, NativeModules, Platform, type View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { t, useLanguage } from '../../i18n';
import { useThemeColor, useThemeMode } from '../../theme/store';
import { inspectorSession, type InspectorBridge } from './session';

const bridge: InspectorBridge | undefined = NativeModules.BrowserInspector;
export const browserInspectorAvailable = Platform.OS === 'android' && bridge?.supported === true;

export function useBrowserInspector(target: RefObject<View | null>, active: boolean, generation: number) {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = useRef<View>(null);
  const session = useRef<ReturnType<typeof inspectorSession> | undefined>(undefined);
  const language = useLanguage();
  const theme = useThemeMode();
  const color = useThemeColor();
  const close = () => {
    const previous = session.current; session.current = undefined; previous?.stop();
    setOpen(false); setOpening(false); setFailed(false);
  };
  useEffect(() => {
    close();
    return () => { session.current?.stop(); session.current = undefined; };
  }, [active, generation]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') close(); });
    return () => listener.remove();
  }, []);
  const attach = async () => {
    if (!active || !open || session.current || !bridge) return;
    const tag = findNodeHandle(target.current);
    const hostTag = findNodeHandle(host.current);
    if (tag === null || hostTag === null) { setFailed(true); return; }
    const current = inspectorSession(bridge, randomUUID());
    session.current = current; setOpening(true); setFailed(false);
    try {
      await current.open({ tag, hostTag, error: t('client.runtimeErrors.theConnectionIsTemporarilyUnavailableTryAgain'),
        language, theme, surfaceColor: color('#ffffff', 'surface'), contentColor: color('#17211b', 'ink') });
    } catch { if (session.current === current) setFailed(true); }
    finally { if (session.current === current) setOpening(false); }
  };
  const fail = () => { session.current?.stop(); setFailed(true); setOpening(false); };
  return { open, opening, failed, host, close, fail, hideKeyboard: () => session.current?.hideKeyboard(),
    attach: () => { void attach(); },
    show: () => { if (active && browserInspectorAvailable) setOpen(true); } };
}
