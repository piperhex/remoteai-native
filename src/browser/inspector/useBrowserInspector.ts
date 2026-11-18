import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AppState, findNodeHandle, NativeModules, Platform, type View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { t, useLanguage } from '../../i18n';
import { useThemeColor, useThemeMode } from '../../theme/store';
import { inspectorSession, type InspectorBridge } from './session';

const bridge: InspectorBridge | undefined = NativeModules.BrowserInspector;
export const browserInspectorAvailable = Platform.OS === 'android' && bridge?.supported === true;

export function useBrowserInspector(tabId: string, generation: number) {
  const [target, setTarget] = useState<RefObject<View | null>>();
  const [opening, setOpening] = useState(false);
  const [failed, setFailed] = useState(false);
  const host = useRef<View>(null);
  const session = useRef<ReturnType<typeof inspectorSession> | undefined>(undefined);
  const language = useLanguage();
  const theme = useThemeMode();
  const color = useThemeColor();
  const close = useCallback(() => {
    const previous = session.current; session.current = undefined; previous?.stop();
    setTarget(undefined); setOpening(false); setFailed(false);
  }, []);
  const hideKeyboard = useCallback(() => session.current?.hideKeyboard(), []);
  useEffect(close, [tabId, generation, close]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') close(); });
    return () => {
      listener.remove();
      session.current?.stop(); session.current = undefined;
    };
  }, [close]);
  const attach = async () => {
    if (!target || session.current || !bridge) return;
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
  return { open: Boolean(target), opening, failed, host, close, fail, hideKeyboard,
    attach: () => { void attach(); },
    show: setTarget };
}

export type BrowserInspectorControls = Pick<ReturnType<typeof useBrowserInspector>,
  'open' | 'opening' | 'show' | 'close' | 'hideKeyboard'>;
